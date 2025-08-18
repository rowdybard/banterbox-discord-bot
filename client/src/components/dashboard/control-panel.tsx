import { useState, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UserSettings, User } from "@shared/schema";
import { isProUser } from "@shared/subscription";
import { Crown } from "lucide-react";


interface ControlPanelProps {
  userId: string;
  settings?: UserSettings;
  user?: User;
}

export default function ControlPanel({ userId, settings, user }: ControlPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Cooldown system for toast notifications
  const lastToastRef = useRef<{ [key: string]: number }>({});
  const TOAST_COOLDOWN = 2000; // 2 seconds
  
  const [enabledEvents, setEnabledEvents] = useState<string[]>(
    (settings?.enabledEvents as string[]) || ['chat']
  );
  
  const showToastWithCooldown = (settingType: string) => {
    const now = Date.now();
    const lastToastTime = lastToastRef.current[settingType] || 0;
    
    if (now - lastToastTime >= TOAST_COOLDOWN) {
      toast({
        title: "Settings updated",
        description: "Your preferences have been saved.",
      });
      lastToastRef.current[settingType] = now;
    }
  };



  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async ({ updates, settingType }: { updates: Partial<UserSettings>, settingType: string }) => {
      const response = await apiRequest("PUT", `/api/settings/${userId}`, updates);
      return { data: await response.json(), settingType };
    },
    onSuccess: ({ settingType }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings', userId] });
      showToastWithCooldown(settingType);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings.",
        variant: "destructive",
      });
    },
  });

  // Generate test banter mutation
  const generateTestMutation = useMutation({
    mutationFn: async () => {
      try {
        const response = await apiRequest("POST", `/api/banter/${userId}/test`, {
          message: "This is a test message for BanterBox!"
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Test banter generation failed:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('Test banter generated successfully:', data);
      toast({
        title: "Test banter generated!",
        description: "Check the banter queue for the response.",
      });
    },
    onError: (error: any) => {
      console.error('Test banter mutation error:', error);
      toast({
        title: "Error", 
        description: `Failed to generate test banter: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });



  const handleEventToggle = (eventType: string, checked: boolean) => {
    const newEvents = checked
      ? [...enabledEvents, eventType]
      : enabledEvents.filter(e => e !== eventType);
    
    setEnabledEvents(newEvents);
    updateSettingsMutation.mutate({ updates: { enabledEvents: newEvents as any }, settingType: 'events' });
  };



  return (
    <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-semibold text-white">Control Panel</h2>
            {isProUser(user) && (
              <div className="flex items-center space-x-2 text-yellow-400">
                <Crown className="w-4 h-4" />
                <span className="text-sm">Pro Feature</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-400">Live</span>
          </div>
        </div>
        

        
        {/* Event Types */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Trigger Events
          </label>
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
        </div>
        



        
        {/* Generate Test Banter Button */}
        <Button
          onClick={() => generateTestMutation.mutate()}
          disabled={generateTestMutation.isPending}
          className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-white font-medium"
          data-testid="button-generate-test"
        >
          {generateTestMutation.isPending ? (
            <>
              <i className="fas fa-spinner fa-spin mr-2"></i>
              Generating...
            </>
          ) : (
            <>
              <i className="fas fa-play mr-2"></i>
              Generate Test Banter
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
