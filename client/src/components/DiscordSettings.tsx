import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface DiscordSettingsData {
  isConnected: boolean;
  discordUsername?: string;
  enabledEvents?: string[];
}

export default function DiscordSettings() {
  const { user } = useAuth();
  const userId = user?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // Get Discord settings
  const { data: discordSettings, isLoading } = useQuery<DiscordSettingsData>({
    queryKey: ['/api/discord', userId],
    enabled: Boolean(userId),
    retry: false,
  });

  // Connect to Discord
  const connectMutation = useMutation({
    mutationFn: async () => {
      // Use window.location.href to preserve authentication cookies
      window.location.href = '/api/discord/auth/login';
    },
    onError: () => {
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Discord. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Disconnect from Discord
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/discord/${userId}/disconnect`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/discord', userId] });
      toast({
        title: "Disconnected",
        description: "Successfully disconnected from Discord.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to disconnect from Discord.",
        variant: "destructive",
      });
    },
  });

  // Update event settings
  const updateEventsMutation = useMutation({
    mutationFn: async (enabledEvents: string[]) => {
      const response = await apiRequest("PUT", `/api/discord/${userId}/events`, {
        enabledEvents,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/discord', userId] });
      toast({
        title: "Events Updated",
        description: "Discord event settings have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update event settings.",
        variant: "destructive",
      });
    },
  });

  const handleEventToggle = (eventType: string, checked: boolean) => {
    if (!discordSettings) return;
    
    const currentEvents = discordSettings.enabledEvents || [];
    const newEvents = checked
      ? [...currentEvents, eventType]
      : currentEvents.filter((e: string) => e !== eventType);
    
    updateEventsMutation.mutate(newEvents);
  };

  const handleConnect = () => {
    setIsConnecting(true);
    connectMutation.mutate();
  };

  if (isLoading) {
    return (
      <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <i className="fab fa-discord text-indigo-500"></i>
            <span>Discord Integration</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center space-x-2">
          <i className="fab fa-discord text-indigo-500"></i>
          <span>Discord Integration</span>
          {discordSettings?.isConnected && (
            <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
              Connected
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {!discordSettings?.isConnected ? (
          <div className="text-center py-4">
            <p className="text-gray-400 mb-4">
              Connect your Discord account to enable server event integration.
            </p>
            <a 
              href="/api/discord/auth/login"
              className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium transition-colors"
              data-testid="link-connect-discord"
            >
              <i className="fab fa-discord mr-2"></i>
              Connect Discord
            </a>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-300">
                  Connected as: <span className="text-indigo-400">{discordSettings.discordUsername}</span>
                </p>
                <p className="text-xs text-gray-500">
                  Monitoring Discord server events
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
                data-testid="button-disconnect-discord"
              >
                {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
              </Button>
            </div>

            {/* Discord Event Settings */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Discord Events
              </label>
              <div className="space-y-3">
                {[
                  { id: 'discord_message', label: 'Discord Messages' },
                  { id: 'discord_member_join', label: 'Member Joins' },
                  { id: 'discord_reaction', label: 'Message Reactions' }
                ].map((event) => (
                  <div key={event.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`discord-${event.id}`}
                      checked={discordSettings.enabledEvents?.includes(event.id) || false}
                      onCheckedChange={(checked) => handleEventToggle(event.id, !!checked)}
                      className="border-gray-700 data-[state=checked]:bg-indigo-600"
                      data-testid={`checkbox-discord-${event.id}`}
                    />
                    <label 
                      htmlFor={`discord-${event.id}`}
                      className="text-sm text-gray-300 cursor-pointer"
                    >
                      {event.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}