import fetch from 'node-fetch';

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
}

export class ElevenLabsService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('ELEVENLABS_API_KEY not found - ElevenLabs features will be disabled');
    }
  }

  // Get available voices
  async getVoices(): Promise<ElevenLabsVoice[]> {
    if (!this.apiKey) {
      console.warn('ElevenLabs API key not configured');
      return [];
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      return data.voices.map((voice: any) => ({
        voice_id: voice.voice_id,
        name: voice.name,
        category: voice.category,
        description: voice.description,
      }));
    } catch (error) {
      console.error('Error fetching ElevenLabs voices:', error);
      throw error;
    }
  }

  // Generate speech from text
  async generateSpeech(text: string, voiceId: string): Promise<Buffer> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs TTS error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const audioBuffer = await response.buffer();
      return audioBuffer;
    } catch (error) {
      console.error('Error generating speech with ElevenLabs:', error);
      throw error;
    }
  }

  // Get default voice for new users
  getDefaultVoice(): string {
    // Rachel voice ID - a popular female voice
    return '21m00Tcm4TlvDq8ikWAM';
  }

  // Get popular voice options for Pro users
  getPopularVoices(): Array<{ id: string; name: string; description: string }> {
    return [
      { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'American Female' },
      { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'American Female' },
      { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', description: 'American Female' },
      { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'American Male' },
      { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', description: 'American Male' },
      { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', description: 'American Male' },
      { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', description: 'American Male' },
    ];
  }
}

export const elevenLabsService = new ElevenLabsService();