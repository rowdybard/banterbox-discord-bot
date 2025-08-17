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

  // Generate speech with custom settings for voice builder
  async generateSpeechWithSettings(text: string, voiceId: string, settings: any): Promise<Buffer> {
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
          voice_settings: settings,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs TTS error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const audioBuffer = await response.buffer();
      return audioBuffer;
    } catch (error) {
      console.error('Error generating speech with custom settings:', error);
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

  // Get comprehensive voice options for personality-based TTS
  getAllVoices(): Array<{ id: string; name: string; description: string; personality: string }> {
    return [
      // Gaming Voices
      { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Clear, energetic female', personality: 'Gaming Hype Beast' },
      { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', description: 'Enthusiastic young male', personality: 'Retro Gaming Guru' },
      { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', description: 'Dynamic female gamer', personality: 'Competitive Esports Analyst' },
      
      // Comedy Voices
      { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'Witty, sophisticated male', personality: 'Sarcastic Roast Master' },
      
      // Educational Voices
      { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', description: 'Clear, professional narrator', personality: 'Study Buddy Scholar' },
      { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', description: 'Gentle, encouraging female', personality: 'Science Enthusiast' },
      { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', description: 'Warm, educational female', personality: 'Creative Art Mentor' },
      
      // Music Voices
      { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'Rich, expressive female', personality: 'Music Stream Maestro' },
      
      // Custom Voices
      { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', description: 'Deep, ominous male', personality: 'Horror Story Narrator' },
      { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy', description: 'Sweet, cheerful female', personality: 'Wholesome Cheerleader' },
      { id: 'bVMeCyTHy58xNoL34h3p', name: 'Jeremy', description: 'Smooth, relaxed male', personality: 'Chill Vibes Curator' },
      { id: 'flq6f7yk4E4fJM5XTYuZ', name: 'Michael', description: 'Calm, soothing male', personality: 'Zen Meditation Guide' },
      { id: 'g5CIjZEefAph4nQFvHAz', name: 'Sarah', description: 'Warm, intimate female', personality: 'Midnight Café Host' },
      { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', description: 'Enthusiastic, warm female', personality: 'Cooking Show Host' },
      
      // Additional unique voices for variety
      { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', description: 'British, sophisticated male', personality: 'Chill Vibes Curator' },
      { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'Deep, authoritative male', personality: 'Chill Vibes Curator' },
      { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', description: 'Young, energetic British male', personality: 'Chill Vibes Curator' },
      { id: 'SOYHLrjzK2X1ezoPC6cr', name: 'Harry', description: 'Casual, friendly British male', personality: 'Chill Vibes Curator' },
      { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', description: 'Confident, clear male', personality: 'Chill Vibes Curator' },
      { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', description: 'Professional British female', personality: 'Chill Vibes Curator' },
      { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', description: 'American young female', personality: 'Chill Vibes Curator' },
      { id: 'oWAxZDx7w5VEj9dCyTzz', name: 'Grace', description: 'Elegant, refined female', personality: 'Chill Vibes Curator' },
    ];
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
