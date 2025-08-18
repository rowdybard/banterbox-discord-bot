import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { UserSettings } from "@shared/schema";
import TwitchSettings from "@/components/TwitchSettings";
import { DiscordBotSettings } from "@/components/DiscordBotSettings";

export default function Settings() {
  const { user } = useAuth();
  const userId = user?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get user settings
  const { data: settings } = useQuery({
    queryKey: ['/api/settings', userId],
  }) as { data: UserSettings | undefined };

  const [enabledEvents, setEnabledEvents] = useState<string[]>(
    (settings?.enabledEvents as string[]) || ['chat']
  );

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<UserSettings>) => {
      const response = await apiRequest("PUT", `/api/settings/${userId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings', userId] });
      toast({
        title: "Settings updated",
        description: "Your preferences have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings.",
        variant: "destructive",
      });
    },
  });



  const handleEventToggle = (eventType: string, checked: boolean) => {
    const newEvents = checked
      ? [...enabledEvents, eventType]
      : enabledEvents.filter(e => e !== eventType);
    
    setEnabledEvents(newEvents);
    updateSettingsMutation.mutate({ enabledEvents: newEvents as any });
  };

  return (
    <div className="min-h-screen pb-20 md:pb-6">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-dark/80 backdrop-blur-lg border-b border-gray-800 md:ml-64">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center">
                  <i className="fas fa-cog text-white text-sm"></i>
                </div>
                <h1 className="text-xl font-bold text-white">Settings</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="md:ml-64">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-2xl mx-auto space-y-6">
          
          {/* Platform Integrations */}
          <TwitchSettings />
          <DiscordBotSettings />
          




          {/* Event Settings */}
          <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Event Triggers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { id: 'chat', label: 'Chat Messages' },
                  { id: 'subscription', label: 'Subscriptions' },
                  { id: 'donation', label: 'Donations' },
                  { id: 'raid', label: 'Raids' }
                ].map((event) => (
                  <div key={event.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={event.id}
                      checked={enabledEvents.includes(event.id)}
                      onCheckedChange={(checked) => handleEventToggle(event.id, !!checked)}
                      className="border-gray-700 data-[state=checked]:bg-primary"
                      data-testid={`checkbox-${event.id}`}
                    />
                    <label 
                      htmlFor={event.id}
                      className="text-sm text-gray-300 cursor-pointer"
                    >
                      {event.label}
                    </label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Overlay Settings */}
          <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Overlay Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Position */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  OBS Positioning
                </label>
                <p className="text-sm text-gray-400 bg-gray-800/50 p-3 rounded border border-gray-700">
                  Position the overlay using OBS Browser Source controls. The banter box will appear at a fixed location that you can move and resize in OBS to fit your stream layout.
                </p>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Display Duration
                </label>
                <Select 
                  defaultValue={`${settings?.overlayDuration || 5}`}
                  onValueChange={(value) => updateSettingsMutation.mutate({ overlayDuration: parseInt(value) })}
                  data-testid="select-duration"
                >
                  <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="3">3 seconds</SelectItem>
                    <SelectItem value="5">5 seconds</SelectItem>
                    <SelectItem value="7">7 seconds</SelectItem>
                    <SelectItem value="10">10 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Animation */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Animation Style
                </label>
                <Select 
                  defaultValue={settings?.overlayAnimation || "fade"}
                  onValueChange={(value) => updateSettingsMutation.mutate({ overlayAnimation: value })}
                  data-testid="select-animation"
                >
                  <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="fade">Fade In/Out</SelectItem>
                    <SelectItem value="slide">Slide Up</SelectItem>
                    <SelectItem value="scale">Scale In</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  </div>
  );
}