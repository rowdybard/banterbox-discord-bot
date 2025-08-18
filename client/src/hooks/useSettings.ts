import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { UserSettings } from "@shared/schema";

export function useSettings(userId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get settings
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['/api/settings', userId],
    enabled: !!userId,
  }) as { data: UserSettings | undefined, isLoading: boolean, error: any };

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<UserSettings>) => {
      const response = await apiRequest("PUT", `/api/settings/${userId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings', userId] });
      toast({
        title: "Settings saved",
        description: "Your preferences have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings.",
        variant: "destructive",
      });
    },
  });

  // Get default settings
  const getDefaultSettings = (): UserSettings => ({
    id: '',
    userId,
    voiceProvider: 'openai',
    voiceId: null,
    autoPlay: true,
    volume: 75,
    enabledEvents: ['chat'],
    overlayPosition: 'bottom-center',
    overlayDuration: 12,
    overlayAnimation: 'fade',
    banterPersonality: 'witty',
    customPersonalityPrompt: null,
    favoritePersonalities: [],
    favoriteVoices: [],
    updatedAt: new Date(),
  });

  // Get current settings with defaults
  const getCurrentSettings = (): UserSettings => {
    return settings || getDefaultSettings();
  };

  // Update specific setting
  const updateSetting = (key: keyof UserSettings, value: any) => {
    const updates = { [key]: value };
    updateSettingsMutation.mutate(updates);
  };

  // Update multiple settings
  const updateSettings = (updates: Partial<UserSettings>) => {
    updateSettingsMutation.mutate(updates);
  };

  return {
    settings: getCurrentSettings(),
    isLoading,
    error,
    updateSetting,
    updateSettings,
    isUpdating: updateSettingsMutation.isPending,
  };
}
