import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Sparkles, Save, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { UserSettings } from "@shared/schema";

interface PersonalitySelectorProps {
  userId: string;
}

const personalityPresets = {
  witty: {
    name: "Witty & Clever",
    description: "Smart, funny responses with wordplay",
    prompt: "You are a witty and clever banter bot. Create short, punchy responses with clever wordplay, puns, and smart humor. Keep responses under 20 words and make them memorable.",
    example: "Chat from viewer123: 'First!' → 'First to my heart too! Welcome to the VIP early bird club! 🎉'"
  },
  friendly: {
    name: "Friendly & Warm",
    description: "Welcoming and positive responses",
    prompt: "You are a friendly and warm banter bot. Create welcoming, positive responses that make everyone feel included. Use encouraging language and spread good vibes.",
    example: "New follower: Sarah_Gaming → 'Welcome Sarah! So happy you're here! The community just got even more awesome! 💖'"
  },
  sarcastic: {
    name: "Sarcastic & Edgy",
    description: "Playfully sarcastic humor",
    prompt: "You are a playfully sarcastic banter bot. Create witty, slightly edgy responses with gentle sarcasm. Keep it fun and not mean-spirited.",
    example: "Chat: 'This game looks easy' → 'Oh absolutely, just like brain surgery! Can't wait to see your speedrun! 😏'"
  },
  hype: {
    name: "Hype & Energetic",
    description: "High-energy excitement builder",
    prompt: "You are a high-energy hype bot. Create exciting, enthusiastic responses that pump up the energy. Use caps, exclamation points, and motivational language.",
    example: "Donation: $5 from TechGuru → 'YOOO TechGuru with the LEGENDARY support! You're absolutely CRUSHING it today! 🔥⚡'"
  },
  chill: {
    name: "Chill & Laid-back",
    description: "Relaxed and casual vibes",
    prompt: "You are a chill and laid-back banter bot. Create relaxed, casual responses that keep things cool and comfortable. Use casual language and maintain a zen vibe.",
    example: "Raid from CoolStreamer: 50 viewers → 'Yooo CoolStreamer crew! Thanks for the chill vibes, welcome to the hangout spot 🌊'"
  },
  context: {
    name: "With Context (Experimental)",
    description: "Context-aware responses using conversation history",
    prompt: "You are a context-aware banter bot. Use conversation history and context to create more relevant and engaging responses. Reference previous messages, ongoing topics, and stream context to make responses feel more natural and connected.",
    example: "Chat: 'Remember when you said that?' → 'Oh yeah! That was during the boss fight! Still can't believe we pulled that off! 😄'"
  },
  custom: {
    name: "Custom Personality",
    description: "Create your own unique personality",
    prompt: "",
    example: "Define your own style and tone..."
  }
};

export function PersonalitySelector({ userId }: PersonalitySelectorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedPersonality, setSelectedPersonality] = useState("witty");
  const [customPrompt, setCustomPrompt] = useState("");

  const { data: settings } = useQuery({
    queryKey: ['/api/settings', userId],
    enabled: !!userId,
  });

  // Initialize state when settings load
  useEffect(() => {
    if (settings && typeof settings === 'object' && 'banterPersonality' in settings) {
      setSelectedPersonality((settings as any).banterPersonality || "witty");
      setCustomPrompt((settings as any).customPersonalityPrompt || "");
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('PUT', `/api/settings/${userId}`, {
        banterPersonality: selectedPersonality,
        customPersonalityPrompt: selectedPersonality === 'custom' ? customPrompt : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings', userId] });
      toast({
        title: "Personality Updated",
        description: "Your banter personality has been saved successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save personality settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const currentPreset = personalityPresets[selectedPersonality as keyof typeof personalityPresets] || null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Banter Personality
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Personality Selection */}
        <div className="space-y-2">
          <Label htmlFor="personality-select">Choose Your Style</Label>
          <Select
            value={selectedPersonality}
            onValueChange={setSelectedPersonality}
          >
            <SelectTrigger data-testid="select-personality">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(personalityPresets).map(([key, preset]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <span>{preset.name}</span>
                    {key === 'custom' && <Sparkles className="h-3 w-3" />}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Personality Description */}
        {currentPreset && selectedPersonality !== 'custom' && (
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                {currentPreset.description}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                <strong>Example:</strong> {currentPreset.example}
              </p>
            </div>
          </div>
        )}

        {/* Custom Personality Prompt */}
        {selectedPersonality === 'custom' && (
          <div className="space-y-2">
            <Label htmlFor="custom-prompt">Custom Personality Prompt</Label>
            <Textarea
              id="custom-prompt"
              data-testid="textarea-custom-prompt"
              placeholder="Describe how you want your banter bot to respond. Be specific about tone, style, and personality traits..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">
              Tip: Include specific instructions about tone, humor style, and response length for best results.
            </p>
          </div>
        )}

        {/* Current Settings */}
        {settings && typeof settings === 'object' && 'banterPersonality' in settings && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Current: {personalityPresets[(settings as any).banterPersonality as keyof typeof personalityPresets]?.name || "Unknown"}
            </Badge>
            {(settings as any).customPersonalityPrompt && (
              <Badge variant="outline" className="text-xs">
                Custom Prompt Set
              </Badge>
            )}
          </div>
        )}

        {/* Save Button */}
        <Button
          data-testid="button-save-personality"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || (selectedPersonality === 'custom' && !customPrompt.trim())}
          className="w-full"
        >
          {saveMutation.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Personality Settings
        </Button>
      </CardContent>
    </Card>
  );
}