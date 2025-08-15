export async function playAudioFromUrl(audioUrl: string): Promise<HTMLAudioElement> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    
    // Handle both data URLs and regular URLs
    if (audioUrl.startsWith('data:')) {
      audio.src = audioUrl;
    } else if (audioUrl.startsWith('/')) {
      // Convert relative URLs to absolute URLs
      const baseUrl = `${window.location.protocol}//${window.location.host}`;
      audio.src = `${baseUrl}${audioUrl}`;
      audio.crossOrigin = "anonymous";
      console.log('Loading audio from absolute URL:', audio.src);
    } else {
      audio.src = audioUrl;
      audio.crossOrigin = "anonymous";
    }
    
    audio.preload = "auto";
    
    audio.oncanplaythrough = () => {
      console.log('Audio can play through:', audio.src);
      resolve(audio);
    };
    
    audio.onerror = (error) => {
      console.error('Audio load error:', error, 'URL:', audio.src);
      reject(new Error(`Failed to load audio from ${audio.src}: ${error}`));
    };
    
    // Start loading the audio
    audio.load();
  });
}

export function createAudioContext(): AudioContext | null {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    return new AudioContext();
  } catch (error) {
    console.error("Web Audio API not supported:", error);
    return null;
  }
}

export async function decodeAudioData(audioContext: AudioContext, arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  try {
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (error) {
    throw new Error(`Failed to decode audio data: ${error}`);
  }
}

export function playAudioBuffer(audioContext: AudioContext, audioBuffer: AudioBuffer): AudioBufferSourceNode {
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start();
  return source;
}

// Volume control utilities
export function setAudioVolume(audio: HTMLAudioElement, volume: number): void {
  audio.volume = Math.max(0, Math.min(1, volume / 100));
}

// Mobile-specific audio utilities
export function enableAudioOnMobile(): void {
  // Create a silent audio element to unlock audio context on mobile
  const unlockAudio = () => {
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
    audio.play().catch(() => {
      // Ignore errors for unlock attempt
    });
    
    // Remove event listeners after first interaction
    document.removeEventListener('touchstart', unlockAudio);
    document.removeEventListener('touchend', unlockAudio);
    document.removeEventListener('click', unlockAudio);
  };

  // Add event listeners for user interaction
  document.addEventListener('touchstart', unlockAudio);
  document.addEventListener('touchend', unlockAudio);
  document.addEventListener('click', unlockAudio);
}
