import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAudio } from "@/hooks/use-audio";
import { Volume2, Save, Play, Settings } from "lucide-react";
import type { UserSettings, User } from "@shared/schema";

interface VoiceSettingsProps {
  userId: string;
  settings?: UserSettings;
  user?: User;
}

export default function VoiceSettings({ userId, settings, user }: VoiceSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { updateVolume } = useAudio();
  
  // Local state for form values
  const [voiceProvider, setVoiceProvider] = useState(settings?.voiceProvider || 'openai');
  const [voiceId, setVoiceId] = useState(settings?.voiceId || '');
  const [volume, setVolume] = useState(settings?.volume || 75);
  const [autoPlay, setAutoPlay] = useState(settings?.autoPlay ?? true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Update local state when settings change
  useEffect(() => {
    if (settings) {
      setVoiceProvider(settings.voiceProvider || 'openai');
      setVoiceId(settings.voiceId || '');
      setVolume(settings.volume || 75);
      setAutoPlay(settings.autoPlay ?? true);
      setHasUnsavedChanges(false);
    }
  }, [settings]);

  // Fetch ElevenLabs voices for Pro users
  const { data: elevenLabsVoices } = useQuery({
    queryKey: ['/api/elevenlabs/voices'],
    enabled: Boolean(user?.isPro && voiceProvider === 'elevenlabs'),
    retry: false,
  });

  // Fetch favorite voices
  const { data: favoriteVoices } = useQuery({
    queryKey: ['/api/favorites/voices'],
    enabled: true,
    retry: false,
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<UserSettings>) => {
      const response = await apiRequest("PUT", `/api/settings/${userId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings', userId] });
      setHasUnsavedChanges(false);
      toast({
        title: "Voice settings saved",
        description: "Your voice preferences have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save voice settings.",
        variant: "destructive",
      });
    },
  });

  // Test voice mutation
  const testVoiceMutation = useMutation({
    mutationFn: async ({ voiceId, text }: { voiceId: string; text?: string }) => {
      const response = await apiRequest("POST", "/api/elevenlabs/test-voice", {
        voiceId,
        text: text || "Hello! This is a test of your selected voice."
      });
      return response.arrayBuffer();
    },
    onSuccess: (audioBuffer) => {
      // Play the audio
      const audio = new Audio(URL.createObjectURL(new Blob([audioBuffer], { type: 'audio/mpeg' })));
      audio.volume = volume / 100;
      audio.play();
      
      toast({
        title: "Voice preview",
        description: "Playing voice sample...",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to play voice preview.",
        variant: "destructive",
      });
    },
  });

  // Handle form changes
  const handleVoiceProviderChange = (provider: string) => {
    setVoiceProvider(provider);
    setHasUnsavedChanges(true);
    
    // Reset voice ID when switching providers
    if (provider === 'openai') {
      setVoiceId('');
    } else if (provider === 'elevenlabs' && !voiceId) {
      setVoiceId('21m00Tcm4TlvDq8ikWAM'); // Default ElevenLabs voice
    } else if (provider === 'favorite' && favoriteVoices?.voices?.length > 0) {
      setVoiceId(favoriteVoices.voices[0].voiceId); // Set to first favorite voice
    }
  };

  const handleVoiceIdChange = (id: string) => {
    setVoiceId(id);
    setHasUnsavedChanges(true);
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    setHasUnsavedChanges(true);
    
    // Update overlay volume in real-time
    updateVolume(newVolume / 100);
    // Store in localStorage for immediate audio control
    localStorage.setItem('banterbox-volume', newVolume.toString());
    localStorage.setItem('banterbox-muted', 'false');
  };

  const handleAutoPlayChange = (checked: boolean) => {
    setAutoPlay(checked);
    setHasUnsavedChanges(true);
  };

  // Save all voice settings
  const handleSaveSettings = () => {
    const updates: Partial<UserSettings> = {
      voiceProvider,
      voiceId: voiceProvider === 'elevenlabs' ? voiceId : undefined,
      volume,
      autoPlay,
    };
    
    updateSettingsMutation.mutate(updates);
  };

  // Test current voice
  const handleTestVoice = () => {
    if (voiceProvider === 'elevenlabs' && voiceId) {
      testVoiceMutation.mutate({ voiceId });
    } else {
      toast({
        title: "No voice to test",
        description: "Please select an ElevenLabs voice first.",
      });
    }
  };

  return (
    <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-primary" />
            <CardTitle className="text-white">Voice Settings</CardTitle>
          </div>
          {user?.isPro && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gradient-to-r from-primary to-secondary text-white">
              <i className="fas fa-crown text-xs mr-1"></i>
              Pro
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Voice Provider Selection */}
        <div>
          <Label className="text-sm font-medium text-gray-300 mb-2 block">
            Voice Provider
          </Label>
          <Select 
            value={voiceProvider}
            onValueChange={handleVoiceProviderChange}
            data-testid="select-voice-provider"
          >
            <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="openai">OpenAI TTS (Free)</SelectItem>
              <SelectItem value="elevenlabs" disabled={!user?.isPro}>
                ElevenLabs Premium {!user?.isPro && '(Pro Required)'}
              </SelectItem>
              <SelectItem value="custom" disabled={!user?.isPro}>
                Custom Voice Clone {!user?.isPro && '(Pro Required)'}
              </SelectItem>
              <SelectItem value="favorite" disabled={!user?.isPro || !favoriteVoices?.voices?.length}>
                Saved Voices {!user?.isPro && '(Pro Required)'} {(!favoriteVoices?.voices?.length) && '(No saved voices)'}
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-400 mt-1">
            Choose your preferred text-to-speech provider
          </p>
        </div>

        {/* ElevenLabs Voice Selection */}
        {voiceProvider === 'elevenlabs' && user?.isPro && (
          <div>
            <Label className="text-sm font-medium text-gray-300 mb-2 block">
              ElevenLabs Voice
            </Label>
            <Select 
              value={voiceId}
              onValueChange={handleVoiceIdChange}
              data-testid="select-elevenlabs-voice"
            >
              <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Select a voice..." />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {(Array.isArray(elevenLabsVoices) ? elevenLabsVoices : [])?.map((voice: any) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    {voice.name} - {voice.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400 mt-1">
              Select your preferred ElevenLabs voice
            </p>
          </div>
        )}

        {/* Volume Control */}
        <div>
          <Label className="text-sm font-medium text-gray-300 mb-2 block">
            Volume: {volume}%
          </Label>
          <div className="flex items-center space-x-3">
            <Volume2 className="h-4 w-4 text-gray-400" />
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="flex-1"
              data-testid="slider-volume"
            />
            <Volume2 className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Adjust the volume for banter audio playback
          </p>
        </div>

        {/* Auto-play Setting */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium text-gray-300">Auto-play Banter</Label>
            <p className="text-xs text-gray-400">Automatically play banter audio when generated</p>
          </div>
          <Switch
            checked={autoPlay}
            onCheckedChange={handleAutoPlayChange}
            className="data-[state=checked]:bg-primary"
            data-testid="switch-autoplay"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3 pt-4 border-t border-gray-700">
          <Button
            onClick={handleSaveSettings}
            disabled={!hasUnsavedChanges || updateSettingsMutation.isPending}
            className="bg-primary hover:bg-primary/90 text-white"
            data-testid="button-save-voice-settings"
          >
            <Save className="h-4 w-4 mr-2" />
            {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
          
          {voiceProvider === 'elevenlabs' && voiceId && (
            <Button
              variant="outline"
              onClick={handleTestVoice}
              disabled={testVoiceMutation.isPending}
              className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700"
              data-testid="button-test-voice"
            >
              <Play className="h-4 w-4 mr-2" />
              {testVoiceMutation.isPending ? "Playing..." : "Test Voice"}
            </Button>
          )}
        </div>

        {/* Unsaved Changes Indicator */}
        {hasUnsavedChanges && (
          <div className="text-xs text-yellow-400 flex items-center space-x-1">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
            <span>You have unsaved changes</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
