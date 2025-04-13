"use client";

import AudioChat from "@/components/AudioChat";
import { ChatHistory } from "@/components/ChatDialog";
import { Composer } from "@/components/Composer";
import { Header } from "@/components/Header";
import { useAudio } from "@/hooks/useAudio";
import { useWebsocket } from "@/hooks/useWebsocket";
import { AudioEvents, eventEmitter } from "@/lib/eventEmitter";
import { useCallback, useEffect, useRef, useState } from "react";

import "./styles.css";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [initComplete, setInitComplete] = useState(false);
  const [manualRecording, setManualRecording] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isReadyRef = useRef(false);
  const startRecordingRef = useRef<(() => Promise<void>) | null>(null);
  const manualRecordingRef = useRef(false);
  const eventSetup = useRef(false);

  const {
    isReady: audioIsReady,
    playAudio,
    startRecording,
    stopRecording,
    stopPlaying,
    frequencies,
    playbackFrequencies,
    isPlayingAudio
  } = useAudio();

  const {
    isReady: websocketReady,
    sendAudioMessage,
    sendTextMessage,
    history: messages,
    resetHistory,
    isLoading,
    agentName,
  } = useWebsocket({
    onNewAudio: playAudio,
  });

  const isReady = websocketReady && audioIsReady;

  // Keep refs in sync with state and props
  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

  useEffect(() => {
    manualRecordingRef.current = manualRecording;
  }, [manualRecording]);

  // Set up the event listener only once when the component mounts
  useEffect(() => {
    if (eventSetup.current) {
      return; // Skip if already set up
    }

    console.log('[DEBUG App] Setting up one-time stable audio playback ended event listener');
    eventSetup.current = true;

    // Define a stable event handler that reads from refs
    const handleAudioPlaybackEnded = async () => {
      console.log('[DEBUG App] Audio playback ended event received');
      console.log('[DEBUG App] Current state - isReady:', isReadyRef.current);
      console.log('[DEBUG App] Current state - manualRecording:', manualRecordingRef.current);

      if (isReadyRef.current && !manualRecordingRef.current && startRecordingRef.current) {
        console.log('[DEBUG App] Attempting to auto-start recording after audio ended');
        try {
          // We need to emit an event to let AudioChat know this is a new recording session
          // This will help reset the hasSpoken state in AudioChat
          eventEmitter.emit('app:reset_speech_detection');

          await startRecordingRef.current();
          // Use a timeout to ensure state is updated after all event handling is complete
          setTimeout(() => {
            console.log('[DEBUG App] Setting recording state via timeout');
            setManualRecording(true);
          }, 0);
          console.log('[DEBUG App] Auto-recording successfully started');
        } catch (error) {
          console.error('[DEBUG App] Error starting auto-recording:', error);
        }
      } else {
        console.log('[DEBUG App] Skipping auto-recording - conditions not met');
        console.log('[DEBUG App] - isReadyRef.current:', isReadyRef.current);
        console.log('[DEBUG App] - !manualRecordingRef.current:', !manualRecordingRef.current);
        console.log('[DEBUG App] - startRecordingRef.current exists:', !!startRecordingRef.current);
      }
    };

    // Subscribe to the event and keep the unsubscribe function
    const unsubscribe = eventEmitter.on(AudioEvents.PLAYBACK_ENDED, handleAudioPlaybackEnded);
    unsubscribeRef.current = unsubscribe;

    // Clean up only when component unmounts
    return () => {
      console.log('[DEBUG App] Final cleanup of stable event listener');
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      eventSetup.current = false;
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // Debug app initialization
  useEffect(() => {
    console.log('[DEBUG App] Component mounting - audioIsReady:', audioIsReady);
    console.log('[DEBUG App] Component mounting - websocketReady:', websocketReady);

    if (audioIsReady && websocketReady && !initComplete) {
      console.log('[DEBUG App] App fully initialized - all services ready');
      setInitComplete(true);
    }
  }, [audioIsReady, websocketReady, initComplete]);

  // Debug for audio playback state changes
  useEffect(() => {
    console.log('[DEBUG App] Audio playback state changed:', isPlayingAudio);
  }, [isPlayingAudio]);

  // Wrapper functions to handle recording state
  const handleStartRecording = useCallback(async () => {
    console.log('[DEBUG App] Start recording requested');
    await startRecording();
    setManualRecording(true);
  }, [startRecording]);

  const handleStopRecording = useCallback(async () => {
    console.log('[DEBUG App] Stop recording requested');
    const audio = await stopRecording();
    setManualRecording(false);
    return audio;
  }, [stopRecording]);

  function handleSubmit() {
    console.log('[DEBUG App] Text submission triggered');
    setPrompt("");
    sendTextMessage(prompt);
  }

  async function handleStopPlaying() {
    console.log('[DEBUG App] Stop playing triggered');
    await stopPlaying();
  }

  return (
    <div className="w-full h-dvh flex flex-col items-center">
      <Header
        agentName={agentName ?? ""}
        playbackFrequencies={playbackFrequencies}
        stopPlaying={handleStopPlaying}
        resetConversation={resetHistory}
      />
      <ChatHistory messages={messages} isLoading={isLoading} />
      <Composer
        prompt={prompt}
        setPrompt={setPrompt}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        audioChat={
          <AudioChat
            frequencies={frequencies}
            isReady={isReady}
            startRecording={handleStartRecording}
            stopRecording={handleStopRecording}
            sendAudioMessage={sendAudioMessage}
            isPlayingAudio={isPlayingAudio}
            isRecording={manualRecording}
            setIsRecording={setManualRecording}
          />
        }
      />
    </div>
  );
}
