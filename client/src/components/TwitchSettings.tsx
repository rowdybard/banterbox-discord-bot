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

interface TwitchSettingsData {
  // Add the interface definition here
  [key: string]: any;
}

export default function TwitchSettings() {
  const { user } = useAuth();
  const userId = user?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // Get Twitch settings
  const { data: twitchSettings, isLoading } = useQuery<TwitchSettingsData>({
    queryKey: ['/api/twitch', userId],
    enabled: Boolean(userId),
    retry: false,
  });

  // Connect to Twitch
  const connectMutation = useMutation({
    mutationFn: async () => {
      // Redirect to Twitch OAuth
      window.location.href = `/api/twitch/auth/login?userId=${userId}`;
    },
    onError: () => {
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Twitch. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Disconnect from Twitch
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/twitch/${userId}/disconnect`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/twitch', userId] });
      toast({
        title: "Disconnected",
        description: "Successfully disconnected from Twitch.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to disconnect from Twitch.",
        variant: "destructive",
      });
    },
  });

  // Update event settings
  const updateEventsMutation = useMutation({
    mutationFn: async (enabledEvents: string[]) => {
      const response = await apiRequest("PUT", `/api/twitch/${userId}/events`, {
        enabledEvents,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/twitch', userId] });
      toast({
        title: "Events Updated",
        description: "Twitch event settings have been updated.",
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
    if (!twitchSettings) return;
    
    const currentEvents = twitchSettings.enabledEvents || [];
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
            <i className="fab fa-twitch text-purple-500"></i>
            <span>Twitch Integration</span>
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
          <i className="fab fa-twitch text-purple-500"></i>
          <span>Twitch Integration</span>
          {twitchSettings?.isConnected && (
            <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
              Connected
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {!twitchSettings?.isConnected ? (
          <div className="text-center py-4">
            <p className="text-gray-400 mb-4">
              Connect your Twitch account to enable live stream event integration.
            </p>
            <Button
              onClick={handleConnect}
              disabled={isConnecting || connectMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              data-testid="button-connect-twitch"
            >
              {isConnecting || connectMutation.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Connecting...
                </>
              ) : (
                <>
                  <i className="fab fa-twitch mr-2"></i>
                  Connect Twitch
                </>
              )}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-300">
                  Connected as: <span className="text-purple-400">{twitchSettings.twitchUsername}</span>
                </p>
                <p className="text-xs text-gray-500">
                  Monitoring live stream events
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
                data-testid="button-disconnect-twitch"
              >
                {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
              </Button>
            </div>

            {/* Twitch Event Settings */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Twitch Events
              </label>
              <div className="space-y-3">
                {[
                  { id: 'chat', label: 'Chat Messages' },
                  { id: 'subscribe', label: 'Subscriptions' },
                  { id: 'cheer', label: 'Bits/Cheers' },
                  { id: 'raid', label: 'Raids' },
                  { id: 'follow', label: 'Follows' }
                ].map((event) => (
                  <div key={event.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`twitch-${event.id}`}
                      checked={twitchSettings.enabledEvents?.includes(event.id) || false}
                      onCheckedChange={(checked) => handleEventToggle(event.id, !!checked)}
                      className="border-gray-700 data-[state=checked]:bg-purple-600"
                      data-testid={`checkbox-twitch-${event.id}`}
                    />
                    <label 
                      htmlFor={`twitch-${event.id}`}
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