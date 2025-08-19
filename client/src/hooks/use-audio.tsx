import { useState, useRef, useCallback, useEffect } from "react";
import { playAudioFromUrl } from "../lib/audio-utils";

export function useAudio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.8); // Default to 80%
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Volume will be set from user settings, not localStorage

  const stopCurrentAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsPlaying(false);
    setCurrentAudioId(null);
  }, []);

  const playAudio = useCallback(async (audioUrl: string, audioId?: string, customVolume?: number) => {
    try {
      // Stop any currently playing audio
      stopCurrentAudio();

      console.log("Loading audio from URL:", audioUrl);
      const audio = await playAudioFromUrl(audioUrl);
      
      // Use custom volume if provided, otherwise use current volume
      const audioVolume = customVolume !== undefined ? customVolume : volume;
      audio.volume = audioVolume;
      console.log("Audio volume set to:", audioVolume);
      
      currentAudioRef.current = audio;
      setIsPlaying(true);
      setCurrentAudioId(audioId || null);

      // Set up event listeners
      audio.onended = () => {
        console.log("Audio playback ended");
        setIsPlaying(false);
        setCurrentAudioId(null);
        currentAudioRef.current = null;
      };

      audio.onerror = (error: any) => {
        console.error("Audio playback error:", error);
        setIsPlaying(false);
        setCurrentAudioId(null);
        currentAudioRef.current = null;
      };

      // Start playback
      console.log("Starting audio playback");
      await audio.play();
      console.log("Audio playback started successfully");
    } catch (error) {
      console.error("Failed to play audio:", error);
      setIsPlaying(false);
      setCurrentAudioId(null);
      currentAudioRef.current = null;
      
      // Add user notification for audio errors
      if (typeof window !== 'undefined' && (window as any).toast) {
        (window as any).toast({
          title: "Audio Error",
          description: "Failed to play audio. Please try again.",
          variant: "destructive"
        });
      }
    }
  }, [stopCurrentAudio, volume]);

  const pauseAudio = useCallback(() => {
    if (currentAudioRef.current && !currentAudioRef.current.paused) {
      currentAudioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const resumeAudio = useCallback(() => {
    if (currentAudioRef.current && currentAudioRef.current.paused) {
      currentAudioRef.current.play();
      setIsPlaying(true);
    }
  }, []);

  const updateVolume = useCallback((newVolume: number) => {
    setVolume(newVolume);
    if (currentAudioRef.current) {
      currentAudioRef.current.volume = newVolume;
    }
  }, []);

  return {
    isPlaying,
    currentAudioId,
    volume,
    playAudio,
    pauseAudio,
    resumeAudio,
    stopAudio: stopCurrentAudio,
    updateVolume,
  };
}
