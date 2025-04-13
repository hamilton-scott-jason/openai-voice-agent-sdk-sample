'use client';

import { useEffect, useRef, useState } from "react";

import { AudioPlayback } from "@/components/AudioPlayback";
import ArrowUpIcon from "@/components/icons/ArrowUpIcon";
import MicIcon from "@/components/icons/MicIcon";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/utils";
import { AudioEvents, eventEmitter } from "@/lib/eventEmitter";

interface AudioChatProps {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Int16Array<ArrayBuffer>>;
  sendAudioMessage: (audio: Int16Array<ArrayBuffer>) => void;
  isReady: boolean;
  frequencies: number[];
  isPlayingAudio?: boolean;
}

const AudioChat = ({
  isReady = true,
  startRecording,
  stopRecording,
  sendAudioMessage,
  frequencies,
  isPlayingAudio = false,
}: AudioChatProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [hasSpoken, setHasSpoken] = useState(false); // Track if user has spoken
  const silenceStartTime = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);  // Keep a ref for the timer to avoid cleanup issues
  const [isMounted, setIsMounted] = useState(false); // Add this to track client-side rendering
  const wasPlayingAudio = useRef(false); // Track previous audio state
  const autoRecordingEnabled = useRef(true); // Track if auto-recording is enabled
  const componentRenderCount = useRef(0); // For debugging renders
  const isRecordingRef = useRef(false); // Use ref to avoid closure issues
  const unsubscribeRef = useRef<(() => void) | null>(null); // Store event unsubscribe function

  // Update ref whenever isRecording changes to keep it fresh
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Configure silence detection parameters
  const SILENCE_THRESHOLD = 0.2; // Threshold for what constitutes silence
  const SILENCE_DURATION = 1500; // Time in milliseconds of silence before stopping (1.5 seconds)

  // Ensure we're only running client-side code after hydration
  useEffect(() => {
    componentRenderCount.current += 1;
    console.log(`[DEBUG AudioChat] Component render #${componentRenderCount.current}`);
    console.log('[DEBUG AudioChat] Initial render state - isRecording:', isRecording);
    console.log('[DEBUG AudioChat] Initial render state - isPlayingAudio:', isPlayingAudio);
    console.log('[DEBUG AudioChat] Initial render state - isMounted:', isMounted);

    if (!isMounted) {
      setIsMounted(true);
      console.log('[DEBUG AudioChat] Component mounted');
    }
  });

  // Subscribe to the PLAYBACK_ENDED event instead of using a callback prop
  useEffect(() => {
    if (isMounted) {
      console.log('[DEBUG AudioChat] Setting up audio playback ended event listener');

      // Define the event handler
      const handleAudioPlaybackEnded = async () => {
        console.log('[DEBUG AudioChat] Audio playback ended event received');
        console.log('[DEBUG AudioChat] Current state - isReady:', isReady);
        console.log('[DEBUG AudioChat] Current state - isRecording (from ref):', isRecordingRef.current);
        console.log('[DEBUG AudioChat] Current state - autoRecordingEnabled:', autoRecordingEnabled.current);

        if (isReady && !isRecordingRef.current && autoRecordingEnabled.current) {
          console.log('[DEBUG AudioChat] Attempting to auto-start recording after audio ended');
          try {
            await startRecording();
            console.log('[DEBUG AudioChat] Auto-recording successfully started');
            setIsRecording(true);
            setHasSpoken(false);
          } catch (error) {
            console.error('[DEBUG AudioChat] Error starting auto-recording:', error);
          }
        } else {
          console.log('[DEBUG AudioChat] Skipping auto-recording - conditions not met');
          console.log('[DEBUG AudioChat] - isReady:', isReady);
          console.log('[DEBUG AudioChat] - !isRecordingRef.current:', !isRecordingRef.current);
          console.log('[DEBUG AudioChat] - autoRecordingEnabled.current:', autoRecordingEnabled.current);
        }
      };

      // Subscribe to the event
      const unsubscribe = eventEmitter.on(AudioEvents.PLAYBACK_ENDED, handleAudioPlaybackEnded);
      unsubscribeRef.current = unsubscribe;

      // Clean up the event listener when the component unmounts
      return () => {
        console.log('[DEBUG AudioChat] Cleaning up event listener');
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      };
    }
  }, [isMounted, isReady, startRecording]);

  // Track audio playback state changes
  useEffect(() => {
    if (isMounted) {
      console.log('[DEBUG AudioChat] Audio playback state changed:', isPlayingAudio);
      console.log('[DEBUG AudioChat] Previous audio state:', wasPlayingAudio.current);

      if (wasPlayingAudio.current && !isPlayingAudio) {
        console.log('[DEBUG AudioChat] Audio playback transition from playing to stopped');
      } else if (!wasPlayingAudio.current && isPlayingAudio) {
        console.log('[DEBUG AudioChat] Audio playback transition from stopped to playing');
      }

      wasPlayingAudio.current = isPlayingAudio;
    }
  }, [isPlayingAudio, isMounted]);

  // Helper function to detect silence from frequency data
  const isSilent = (freqs: number[]): boolean => {
    if (!freqs.length) return true;

    // Calculate average frequency value
    const avgFrequency = freqs.reduce((sum, freq) => sum + freq, 0) / freqs.length;
    return avgFrequency < SILENCE_THRESHOLD;
  };

  // Effect for handling cleanup only when recording stops or component unmounts
  useEffect(() => {
    // Skip during server rendering
    if (!isMounted) return;

    console.log('[DEBUG AudioChat] Recording state changed:', isRecording);

    // Only set up cleanup when recording is active
    if (isRecording) {
      console.log(`[DEBUG AudioChat] Recording active - setup cleanup effect`);

      // Cleanup function that only runs when recording stops or component unmounts
      return () => {
        if (timerRef.current) {
          console.log(`[DEBUG AudioChat] Recording stopped or component unmounted - cleaning up timer ${timerRef.current}`);
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
          silenceStartTime.current = null;
        }
      };
    }
  }, [isRecording, isMounted]);

  // Separate effect for silence detection that doesn't clean up on frequency changes
  useEffect(() => {
    // Skip this effect during server rendering and before hydration is complete
    if (!isMounted || !isRecording) return;

    const isCurrentlySilent = isSilent(frequencies);
    const avgFrequency = frequencies.length ? frequencies.reduce((sum, freq) => sum + freq, 0) / frequencies.length : 0;

    // For debugging, only log significant changes to reduce noise
    if (frequencies.some(f => f > 0.3)) {
      console.log(`[DEBUG AudioChat] High activity detected - avgFreq=${avgFrequency.toFixed(3)}`);
    }

    // If we detect non-silence for the first time, set hasSpoken to true
    if (!isCurrentlySilent && !hasSpoken) {
      console.log(`[DEBUG AudioChat] First speech detected`);
      setHasSpoken(true);
    }

    // Only track silence if the user has already spoken
    if (!hasSpoken) {
      return; // Don't start tracking silence until user speaks
    }

    if (isCurrentlySilent && silenceStartTime.current === null) {
      // Silence just started
      silenceStartTime.current = Date.now();
      console.log(`[DEBUG AudioChat] Silence detected - starting timer (${SILENCE_DURATION}ms countdown)`);

      // Clear any existing timer just to be safe
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }

      // Create new silence timer
      const timer = window.setTimeout(async () => {
        console.log(`[DEBUG AudioChat] Silence timer completed - stopping recording`);
        // If we're still recording and the silence threshold was reached
        if (isRecording) {
          const audio = await stopRecording();
          sendAudioMessage(audio);
          setIsRecording(false);
          silenceStartTime.current = null;
          console.log(`[DEBUG AudioChat] Recording stopped due to silence timeout`);
        }
        timerRef.current = null;
      }, SILENCE_DURATION);

      timerRef.current = timer; // Store in ref to prevent it from being cleared on re-renders
      console.log(`[DEBUG AudioChat] Timer ID set: ${timer}`);
    } else if (!isCurrentlySilent && silenceStartTime.current !== null) {
      // User started talking again, clear the timer
      console.log(`[DEBUG AudioChat] Sound detected again - clearing silence timer`);
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        console.log(`[DEBUG AudioChat] Timer ${timerRef.current} cleared`);
        timerRef.current = null;
      }
      silenceStartTime.current = null;
    }
  }, [frequencies, isRecording, stopRecording, sendAudioMessage, hasSpoken, isMounted]);

  async function toggleRecording() {
    // If not mounted yet (server rendering), don't do anything
    if (!isMounted) return;

    console.log(`[DEBUG AudioChat] Manual recording toggle clicked - current state:`, isRecording);

    if (isRecording) {
      console.log(`[DEBUG AudioChat] Manual recording stop triggered`);
      if (timerRef.current) {
        console.log(`[DEBUG AudioChat] Clearing timer ${timerRef.current} during manual stop`);
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      silenceStartTime.current = null;

      const audio = await stopRecording();
      sendAudioMessage(audio);
      setIsRecording(false);
    } else {
      console.log(`[DEBUG AudioChat] Manual recording start triggered`);
      await startRecording();
      setIsRecording(true);
      setHasSpoken(false); // Reset hasSpoken when starting a new recording
    }
  }

  return (
    <Button
      variant="outline"
      size="iconSmall"
      disabled={!isReady || isPlayingAudio} // Disable the button during audio playback
      aria-label={isRecording ? "Stop Recording" : "Start Recording"}
      className={cn(
        `mb-1 me-1 [&_svg]:size-5`,
        isRecording
          ? "mr-4 bg-red-100 w-full h-full absolute top-0 left-0 z-10 flex justify-end px-4 hover:bg-red-200"
          : "mr-0 border-2 border-gray-100 hover:text-black hover:bg-gray-300 hover:border-gray-300"
      )}
      onClick={toggleRecording}
      suppressHydrationWarning
    >
      {isRecording ? (
        <div className="flex w-full justify-between items-center gap-4 h-full" suppressHydrationWarning>
          <AudioPlayback
            playbackFrequencies={frequencies}
            itemClassName="bg-red-400 w-[4px] sm:w-[6px]"
            className="gap-[3px] w-full"
            height={36}
          />
          <Button variant="stop" size="iconSmall" asChild className="mr-2" suppressHydrationWarning>
            <div className="!size-6 h-8 w-8 p-4" suppressHydrationWarning>
              <ArrowUpIcon />
            </div>
          </Button>
        </div>
      ) : (
        <MicIcon />
      )}
    </Button>
  );
};

export default AudioChat;
