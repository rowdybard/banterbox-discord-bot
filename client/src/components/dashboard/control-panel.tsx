import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UserSettings, User } from "@shared/schema";
import { Crown } from "lucide-react";
import UnifiedSettings from "./unified-settings";

interface ControlPanelProps {
  userId: string;
  user?: User;
}

export default function ControlPanel({ userId, user }: ControlPanelProps) {
  const { toast } = useToast();

  // Fetch user settings
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['/api/settings', userId],
    enabled: !!userId,
  }) as { data: UserSettings | undefined, isLoading: boolean, error: any };

  if (isLoading) {
    return (
      <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Loading Control Panel...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Error Loading Control Panel</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-400">Failed to load control panel settings.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-semibold text-white">Control Panel</h2>
          {(user?.subscriptionTier === 'pro' || user?.subscriptionTier === 'byok' || user?.subscriptionTier === 'enterprise') && (
            <div className="flex items-center space-x-2 text-yellow-400">
              <Crown className="w-4 h-4" />
              <span className="text-sm">Pro Feature</span>
            </div>
          )}
        </div>
        <p className="text-gray-400 text-sm">
          Manage your voice settings, personality preferences, and banter generation controls
        </p>
      </CardHeader>
      <CardContent>
        <UnifiedSettings userId={userId} settings={settings} user={user} />
      </CardContent>
    </Card>
  );
}
