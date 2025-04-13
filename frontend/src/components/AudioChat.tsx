'use client';

import { useEffect, useRef, useState } from "react";

import { AudioPlayback } from "@/components/AudioPlayback";
import ArrowUpIcon from "@/components/icons/ArrowUpIcon";
import MicIcon from "@/components/icons/MicIcon";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/utils";
import { eventEmitter } from "@/lib/eventEmitter";
import CloseIcon from "./icons/CloseIcon";

interface AudioChatProps {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Int16Array<ArrayBuffer>>;
  sendAudioMessage: (audio: Int16Array<ArrayBuffer>) => void;
  isReady: boolean;
  frequencies: number[];
  isPlayingAudio?: boolean;
  isRecording: boolean;  // Controlled by parent
  setIsRecording: (recording: boolean) => void;  // Controlled by parent
}

const AudioChat = ({
  isReady = true,
  startRecording,
  stopRecording,
  sendAudioMessage,
  frequencies,
  isPlayingAudio = false,
  isRecording,
  setIsRecording,
}: AudioChatProps) => {
  const [hasSpoken, setHasSpoken] = useState(false); // Track if user has spoken
  const silenceStartTime = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);  // Keep a ref for the timer to avoid cleanup issues
  const [isMounted, setIsMounted] = useState(false); // Add this to track client-side rendering
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Configure silence detection parameters
  const SILENCE_THRESHOLD = 0.2; // Threshold for what constitutes silence
  const SILENCE_DURATION = 1500; // Time in milliseconds of silence before stopping (1.5 seconds)

  // Ensure we're only running client-side code after hydration
  useEffect(() => {
    console.log(`[DEBUG AudioChat] Component mounted - isRecording:`, isRecording);
    setIsMounted(true);

    // Set up event listener for speech detection reset
    const unsubscribe = eventEmitter.on('app:reset_speech_detection', () => {
      console.log('[DEBUG AudioChat] Received reset speech detection event');
      setHasSpoken(false);
      silenceStartTime.current = null;
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      console.log('[DEBUG AudioChat] Component unmounting');
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

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

    // Reset hasSpoken when starting new recording sessions
    if (isRecording && !isPlayingAudio) {
      console.log('[DEBUG AudioChat] New recording session - resetting hasSpoken state if needed');
    }

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
  }, [isRecording, isMounted, isPlayingAudio]);

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
      console.log(`[DEBUG AudioChat] Silence detected - starting timer (${SILENCE_DURATION}ms countdown), hasSpoken: ${hasSpoken}`);

      // Clear any existing timer just to be safe
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }

      // Create new silence timer
      const timer = window.setTimeout(async () => {
        const duration = Date.now() - (silenceStartTime.current as number);
        console.log(`[DEBUG AudioChat] Silence timer completed - stopping recording - duration: ${duration}ms`);
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
  }, [frequencies, isRecording, stopRecording, sendAudioMessage, hasSpoken, isMounted, setIsRecording]);

  // Add keyboard listener for Escape key to cancel recording
  useEffect(() => {
    // Only add listener when recording is active and component is mounted
    if (!isMounted || !isRecording) return;

    console.log(`[DEBUG AudioChat] Adding Escape key listener for recording cancellation`);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        console.log(`[DEBUG AudioChat] Escape key pressed, cancelling recording`);
        cancelRecording();
      }
    };

    // Add the event listener
    window.addEventListener('keydown', handleKeyDown);

    // Clean up the event listener when recording stops or component unmounts
    return () => {
      console.log(`[DEBUG AudioChat] Removing Escape key listener`);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isRecording, isMounted]);

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
    } else {
      console.log(`[DEBUG AudioChat] Manual recording start triggered`);
      await startRecording();
      setHasSpoken(false); // Reset hasSpoken when starting a new recording
    }
  }

  // Add function to cancel recording without sending audio
  async function cancelRecording() {
    // If not mounted yet (server rendering), don't do anything
    if (!isMounted || !isRecording) return;

    console.log(`[DEBUG AudioChat] Recording cancelled by user`);

    // Clean up any timers
    if (timerRef.current) {
      console.log(`[DEBUG AudioChat] Clearing timer ${timerRef.current} during cancel`);
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    silenceStartTime.current = null;

    // Stop recording but don't send the audio
    await stopRecording();
    setIsRecording(false);

    console.log(`[DEBUG AudioChat] Recording cancelled, audio discarded`);
  }

  return (
    <>
      {isRecording ? (
        <div
          className={cn(
            "mb-1 me-1 mr-4 bg-red-100 w-full h-full absolute top-0 left-0 z-10 flex justify-end px-4 hover:bg-red-200"
          )}
          suppressHydrationWarning
        >
          <div className="flex w-full justify-between items-center gap-4 h-full" suppressHydrationWarning>
            <AudioPlayback
              playbackFrequencies={frequencies}
              itemClassName="bg-red-400 w-[4px] sm:w-[6px]"
              className="gap-[3px] w-full"
              height={36}
            />
            {/* Cancel button */}
            <Button
              variant="ghost"
              size="iconSmall"
              onClick={() => cancelRecording()}
              className="mr-2 hover:bg-red-200 !size-6 h-8 w-8 p-4 rounded-full"
              aria-label="Cancel Recording"
              suppressHydrationWarning
            >
              <CloseIcon className="h-4 w-4" />
            </Button>
            {/* Submit button */}
            <Button
              variant="stop"
              size="iconSmall"
              onClick={() => toggleRecording()}
              className="mr-2 !size-6 h-8 w-8 p-4"
              suppressHydrationWarning
            >
              <ArrowUpIcon />
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="iconSmall"
          disabled={!isReady || isPlayingAudio}
          aria-label="Start Recording"
          className={cn(
            `mb-1 me-1 [&_svg]:size-5 mr-0 border-2 border-gray-100 hover:text-black hover:bg-gray-300 hover:border-gray-300`
          )}
          onClick={toggleRecording}
          suppressHydrationWarning
        >
          <MicIcon />
        </Button>
      )}
    </>
  );
};

export default AudioChat;
