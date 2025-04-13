"use client";

import AudioChat from "@/components/AudioChat";
import { ChatHistory } from "@/components/ChatDialog";
import { Composer } from "@/components/Composer";
import { Header } from "@/components/Header";
import { useAudio } from "@/hooks/useAudio";
import { useWebsocket } from "@/hooks/useWebsocket";
import { useEffect, useState } from "react";

import "./styles.css";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [initComplete, setInitComplete] = useState(false);

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

  // Debug app initialization
  useEffect(() => {
    console.log('[DEBUG App] Component mounting - audioIsReady:', audioIsReady);
    console.log('[DEBUG App] Component mounting - websocketReady:', websocketReady);

    if (audioIsReady && websocketReady && !initComplete) {
      console.log('[DEBUG App] App fully initialized - all services ready');
      setInitComplete(true);
    }

    return () => {
      console.log('[DEBUG App] Component unmounting');
    };
  }, [audioIsReady, websocketReady, initComplete]);

  // Debug for audio playback state changes
  useEffect(() => {
    console.log('[DEBUG App] Audio playback state changed:', isPlayingAudio);
  }, [isPlayingAudio]);

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
            isReady={websocketReady && audioIsReady}
            startRecording={startRecording}
            stopRecording={stopRecording}
            sendAudioMessage={sendAudioMessage}
            isPlayingAudio={isPlayingAudio}
          />
        }
      />
    </div>
  );
}
