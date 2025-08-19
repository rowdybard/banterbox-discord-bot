import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import { Save, Brain, Plus, Star, Crown } from "lucide-react";
import type { UserSettings, User } from "@shared/schema";
import { isProUser } from "@shared/subscription";

const personalityPresets = {
  witty: {
    name: "Witty & Clever",
    description: "Smart, funny responses with wordplay",
  },
  friendly: {
    name: "Friendly & Warm", 
    description: "Welcoming and positive responses",
  },
  sarcastic: {
    name: "Sarcastic & Edgy",
    description: "Playfully sarcastic humor",
  },
  hype: {
    name: "Hype & Energetic",
    description: "High-energy excitement builder",
  },
  chill: {
    name: "Chill & Laid-back",
    description: "Relaxed and casual vibes",
  },
  context: {
    name: "With Context (Experimental)",
    description: "Context-aware responses using conversation history",
  },
};

interface UnifiedSettingsProps {
  userId: string;
  settings?: UserSettings;
  user?: User;
}

export default function UnifiedSettings({ userId, settings, user }: UnifiedSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  


  // Personality Settings State
  const [selectedPersonality, setSelectedPersonality] = useState(settings?.banterPersonality || 'witty');
  const [customPrompt, setCustomPrompt] = useState(settings?.customPersonalityPrompt || '');
  const [hasUnsavedPersonalityChanges, setHasUnsavedPersonalityChanges] = useState(false);
  
  // New Personality Dialog State
  const [isNewPersonalityDialogOpen, setIsNewPersonalityDialogOpen] = useState(false);
  const [newPersonalityName, setNewPersonalityName] = useState('');
  const [newPersonalityPrompt, setNewPersonalityPrompt] = useState('');
  const [newPersonalityDescription, setNewPersonalityDescription] = useState('');

  // Update local state when settings change
  useEffect(() => {
    if (settings) {
      // Personality settings
      setSelectedPersonality(settings.banterPersonality || 'witty');
      setCustomPrompt(settings.customPersonalityPrompt || '');
      setHasUnsavedPersonalityChanges(false);
    }
  }, [settings]);

  // Fetch favorite personalities
  const { data: favoritePersonalities } = useQuery({
    queryKey: ['/api/favorites/personalities'],
    enabled: true,
    retry: false,
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<UserSettings>) => {
      const response = await apiRequest("PUT", `/api/settings/${userId}`, updates);
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings', userId] });
      
      if (variables.banterPersonality !== undefined || variables.customPersonalityPrompt !== undefined) {
        setHasUnsavedPersonalityChanges(false);
        toast({
          title: "Personality settings saved",
          description: "Your personality preferences have been updated.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings.",
        variant: "destructive",
      });
    },
  });

  // Save new personality mutation
  const saveNewPersonalityMutation = useMutation({
    mutationFn: async ({ name, prompt, description }: { name: string; prompt: string; description: string }) => {
      const response = await apiRequest("POST", "/api/favorites/personalities", {
        name,
        prompt,
        description,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/favorites/personalities'] });
      setIsNewPersonalityDialogOpen(false);
      setNewPersonalityName('');
      setNewPersonalityPrompt('');
      setNewPersonalityDescription('');
      
      toast({
        title: "Personality saved",
        description: "Your new personality has been saved to favorites.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save personality.",
        variant: "destructive",
      });
    },
  });





  // Personality Settings Handlers
  const handlePersonalityChange = (personality: string) => {
    setSelectedPersonality(personality);
    setHasUnsavedPersonalityChanges(true);
    
    // If it's a favorite personality, get its prompt
    if (personality.startsWith('favorite_')) {
      const favoriteId = personality.replace('favorite_', '');
      const favorite = (favoritePersonalities as any)?.personalities?.find((p: any) => p.id === favoriteId);
      if (favorite) {
        setCustomPrompt(favorite.prompt);
      }
    } else if (personality === 'custom') {
      // Keep existing custom prompt
    } else {
      // Reset custom prompt for preset personalities
      setCustomPrompt('');
    }
  };

  const handleCustomPromptChange = (prompt: string) => {
    setCustomPrompt(prompt);
    setHasUnsavedPersonalityChanges(true);
  };

  // Save new personality handler
  const handleSaveNewPersonality = () => {
    if (!newPersonalityName.trim() || !newPersonalityPrompt.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide both a name and prompt for your personality.",
        variant: "destructive",
      });
      return;
    }

    saveNewPersonalityMutation.mutate({
      name: newPersonalityName.trim(),
      prompt: newPersonalityPrompt.trim(),
      description: newPersonalityDescription.trim(),
    });
  };



  const handleSavePersonalitySettings = () => {
    const updates: Partial<UserSettings> = {
      banterPersonality: selectedPersonality,
      customPersonalityPrompt: (selectedPersonality === 'custom' || selectedPersonality.startsWith('favorite_')) ? customPrompt : undefined,
    };
    
    updateSettingsMutation.mutate(updates);
  };



  return (
    <div className="space-y-6">
      {/* Personality Settings */}
      <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-primary" />
              <CardTitle className="text-white">Personality Settings</CardTitle>
            </div>
            <Dialog open={isNewPersonalityDialogOpen} onOpenChange={setIsNewPersonalityDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Save New
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-dark border-gray-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Save New Personality</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-300 mb-2 block">
                      Personality Name
                    </Label>
                    <Input
                      value={newPersonalityName}
                      onChange={(e) => setNewPersonalityName(e.target.value)}
                      placeholder="Enter a name for your personality..."
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-300 mb-2 block">
                      Personality Instructions
                    </Label>
                    <Textarea
                      value={newPersonalityPrompt}
                      onChange={(e) => setNewPersonalityPrompt(e.target.value)}
                      placeholder="Describe how you want the AI to respond to events..."
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 resize-none"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-300 mb-2 block">
                      Description (Optional)
                    </Label>
                    <Input
                      value={newPersonalityDescription}
                      onChange={(e) => setNewPersonalityDescription(e.target.value)}
                      placeholder="Brief description of this personality..."
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                    />
                  </div>
                  <div className="flex justify-end space-x-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setIsNewPersonalityDialogOpen(false)}
                      className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveNewPersonality}
                      disabled={saveNewPersonalityMutation.isPending || !newPersonalityName.trim() || !newPersonalityPrompt.trim()}
                      className="bg-primary hover:bg-primary/90 text-white"
                    >
                      {saveNewPersonalityMutation.isPending ? "Saving..." : "Save Personality"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Personality Selection */}
          <div>
            <Label className="text-sm font-medium text-gray-300 mb-2 block">
              Banter Personality
            </Label>
            <Select 
              value={selectedPersonality}
              onValueChange={handlePersonalityChange}
              data-testid="select-personality"
            >
              <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {/* Preset Personalities */}
                <div className="px-2 py-1.5 text-xs font-medium text-gray-400 border-b border-gray-600">
                  Preset Personalities
                </div>
                {Object.entries(personalityPresets).map(([key, preset]) => (
                  <SelectItem key={key} value={key} className="text-white hover:bg-gray-700">
                    <div className="flex flex-col">
                      <span className="font-medium">{preset.name}</span>
                      <span className="text-xs text-gray-400">{preset.description}</span>
                    </div>
                  </SelectItem>
                ))}
                
                {/* Favorite Personalities */}
                {(favoritePersonalities as any)?.personalities?.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-medium text-gray-400 border-b border-gray-600 mt-2">
                      Saved Personalities
                    </div>
                    {(favoritePersonalities as any).personalities.map((personality: any) => (
                      <SelectItem key={personality.id} value={`favorite_${personality.id}`} className="text-white hover:bg-gray-700">
                        <div className="flex flex-col">
                          <div className="flex items-center space-x-2">
                            <Star className="h-3 w-3 text-yellow-400" />
                            <span className="font-medium">{personality.name}</span>
                          </div>
                          <span className="text-xs text-gray-400">{personality.description || 'Custom personality'}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}
                
                {/* Custom Option */}
                <div className="px-2 py-1.5 text-xs font-medium text-gray-400 border-b border-gray-600 mt-2">
                  Custom
                </div>
                <SelectItem value="custom" className="text-white hover:bg-gray-700">
                  <div className="flex flex-col">
                    <span className="font-medium">Custom Personality</span>
                    <span className="text-xs text-gray-400">Write your own personality instructions</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400 mt-1">
              Controls the tone and style of AI-generated banter responses
            </p>
          </div>

          {/* Custom Prompt for Custom or Favorite Personalities */}
          {(selectedPersonality === 'custom' || selectedPersonality.startsWith('favorite_')) && (
            <div>
              <Label className="text-sm font-medium text-gray-300 mb-2 block">
                Personality Instructions
              </Label>
              <Textarea
                value={customPrompt}
                onChange={(e) => handleCustomPromptChange(e.target.value)}
                placeholder="Describe how you want the AI to respond to events..."
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 resize-none"
                rows={3}
                data-testid="textarea-custom-prompt"
              />
              <p className="text-xs text-gray-400 mt-1">
                {selectedPersonality === 'custom' 
                  ? "Write a custom prompt to define exactly how the AI should respond"
                  : "Edit the instructions for your saved personality"
                }
              </p>
            </div>
          )}

          {/* Personality Action Buttons */}
          <div className="flex items-center space-x-3 pt-4 border-t border-gray-700">
            <Button
              onClick={handleSavePersonalitySettings}
              disabled={!hasUnsavedPersonalityChanges || updateSettingsMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-white"
              data-testid="button-save-personality-settings"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateSettingsMutation.isPending ? "Saving..." : "Save Personality Settings"}
            </Button>
          </div>

          {/* Personality Unsaved Changes Indicator */}
          {hasUnsavedPersonalityChanges && (
            <div className="text-xs text-yellow-400 flex items-center space-x-1">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
              <span>You have unsaved personality changes</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
