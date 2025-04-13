import { useCallback, useEffect, useRef, useState } from "react";
import { WavRecorder, WavStreamPlayer } from "wavtools";

import { AudioEvents, eventEmitter } from "@/lib/eventEmitter";
import { normalizeArray } from "@/lib/utils";

export function useAudio() {
  const wavRecorder = useRef<WavRecorder | null>(null);
  const wavPlayer = useRef<WavStreamPlayer | null>(null);
  const audioChunks = useRef<Int16Array[]>([]);
  const trackId = useRef<string | null>(null);
  const [frequencies, setFrequencies] = useState<number[]>([]);

  const [audioPlayerIsReady, setAudioPlayerIsReady] = useState(false);
  const [audioRecorderIsReady, setAudioRecorderIsReady] = useState(false);
  const [playbackFrequencies, setPlaybackFrequencies] = useState<number[]>([]);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Use refs to avoid closure issues
  const isPlayingAudioRef = useRef(false);
  const stoppedManually = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    isPlayingAudioRef.current = isPlayingAudio;

    // Emit events when isPlayingAudio changes
    if (isPlayingAudio) {
      console.log('[DEBUG useAudio] Emitting playback started event');
      eventEmitter.emit(AudioEvents.PLAYBACK_STARTED);
    } else if (!isPlayingAudio && isPlayingAudioRef.current) {
      console.log('[DEBUG useAudio] Emitting playback ended event');
      eventEmitter.emit(AudioEvents.PLAYBACK_ENDED);
    }
  }, [isPlayingAudio]);

  // Add debug logging on initial state
  useEffect(() => {
    console.log('[DEBUG useAudio] Initialize - isPlayingAudio:', isPlayingAudio);
    console.log('[DEBUG useAudio] Initialize - stoppedManually:', stoppedManually.current);
  }, []);

  useEffect(() => {
    async function init() {
      console.log('[DEBUG useAudio] Starting audio initialization');
      wavRecorder.current = new WavRecorder({ sampleRate: 24000 });
      await wavRecorder.current.begin();
      setAudioRecorderIsReady(true);
      wavPlayer.current = new WavStreamPlayer({ sampleRate: 24000 });
      await wavPlayer.current.connect();
      setAudioPlayerIsReady(true);
      console.log('[DEBUG useAudio] Audio initialization complete');
    }
    init();
  }, []);

  const getFrequencies = useCallback(async () => {
    if (wavPlayer.current) {
      const newFrequencies = wavPlayer.current.getFrequencies("voice").values;
      const normalizedFrequencies = normalizeArray(newFrequencies, 5);
      setPlaybackFrequencies(normalizedFrequencies);

      const status = await wavPlayer.current?.getTrackSampleOffset();
      if (status) {
        if (!isPlayingAudioRef.current) {
          console.log('[DEBUG useAudio] Audio playback started - status:', status);
          setIsPlayingAudio(true);
        }
        window.requestAnimationFrame(getFrequencies);
      } else {
        setPlaybackFrequencies([]);
        // Audio playback has ended
        if (isPlayingAudioRef.current && !stoppedManually.current) {
          console.log('[DEBUG useAudio] Audio playback naturally ended');
          setIsPlayingAudio(false);

          // We'll emit the PLAYBACK_ENDED event in the useEffect above
          // This ensures the state is updated before the event is emitted
        } else if (isPlayingAudioRef.current && stoppedManually.current) {
          console.log('[DEBUG useAudio] Audio playback manually stopped');
          setIsPlayingAudio(false);
        }
      }
    }
  }, []);

  const playAudio = useCallback(
    (audio: Int16Array<ArrayBuffer>) => {
      if (wavPlayer.current) {
        console.log('[DEBUG useAudio] Playing new audio chunk');
        stoppedManually.current = false; // Reset the manual stop flag when new audio plays
        wavPlayer.current.add16BitPCM(audio, trackId.current ?? undefined);
        setIsPlayingAudio(true);
        window.requestAnimationFrame(getFrequencies);
      }
    },
    [getFrequencies]
  );

  async function startRecording() {
    console.log('[DEBUG useAudio] Starting recording');
    await stopPlaying();
    stoppedManually.current = false;
    trackId.current = crypto.randomUUID();
    await wavRecorder.current?.clear();
    audioChunks.current = [];
    await wavRecorder.current?.record((data) => {
      audioChunks.current.push(data.mono);
      const updatedFrequencies = wavRecorder.current?.getFrequencies(
        "voice"
      ) || {
        values: new Float32Array([0]),
      };
      setFrequencies(normalizeArray(updatedFrequencies.values, 30));
    });

    // Emit recording started event
    eventEmitter.emit(AudioEvents.RECORDING_STARTED);
    console.log('[DEBUG useAudio] Recording started');
  }

  async function stopPlaying() {
    console.log('[DEBUG useAudio] Manually stopping audio playback');
    stoppedManually.current = true;
    setIsPlayingAudio(false);
    await wavPlayer.current?.interrupt();
    setPlaybackFrequencies(Array.from({ length: 30 }, () => 0));
    console.log('[DEBUG useAudio] Audio playback stopped');
  }

  async function stopRecording() {
    console.log('[DEBUG useAudio] Stopping recording');
    await wavRecorder.current?.pause();
    const dataArrays = audioChunks.current.map((chunk) => {
      return new Int16Array(chunk);
    });

    const totalLength = dataArrays.reduce(
      (acc, chunk) => acc + chunk.length,
      0
    );
    const mergedAudio = new Int16Array(totalLength);
    let offset = 0;
    dataArrays.forEach((chunk) => {
      for (let i = 0; i < chunk.length; i++) {
        mergedAudio[offset + i] = chunk[i];
      }
      offset += chunk.length;
    });

    // Emit recording ended event
    eventEmitter.emit(AudioEvents.RECORDING_ENDED);
    console.log('[DEBUG useAudio] Recording stopped - audio length:', totalLength);
    return mergedAudio;
  }

  // Log state changes for debugging
  useEffect(() => {
    console.log('[DEBUG useAudio] isPlayingAudio state changed:', isPlayingAudio);
  }, [isPlayingAudio]);

  return {
    isReady: audioPlayerIsReady && audioRecorderIsReady,
    playAudio,
    startRecording,
    stopRecording,
    stopPlaying,
    frequencies,
    playbackFrequencies,
    isPlayingAudio,
  };
}
