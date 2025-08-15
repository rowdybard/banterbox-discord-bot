import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorDisplay } from "@/components/ui/error-display";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, TrendingUp, Clock, Target } from "lucide-react";
import type { DailyStats, User } from "@shared/schema";

interface UsageDashboardProps {
  userId: string;
  user?: User;
}

export function UsageDashboard({ userId, user }: UsageDashboardProps) {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['/api/stats', userId],
    retry: 2,
  }) as { data: DailyStats | undefined, isLoading: boolean, error: any };

  const isProUser = user?.isPro;
  const dailyLimit = isProUser ? Infinity : 50;
  const currentUsage = stats?.bantersGenerated || 0;
  const usagePercentage = isProUser ? 0 : Math.min((currentUsage / dailyLimit) * 100, 100);
  
  const getUsageColor = () => {
    if (isProUser) return "text-yellow-400";
    if (usagePercentage >= 90) return "text-red-400";
    if (usagePercentage >= 70) return "text-orange-400";
    return "text-green-400";
  };

  const getProgressColor = () => {
    if (isProUser) return "bg-yellow-400";
    if (usagePercentage >= 90) return "bg-red-500";
    if (usagePercentage >= 70) return "bg-orange-500";
    return "bg-green-500";
  };

  if (error && error.message !== "Stats not found") {
    return (
      <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
        <CardContent className="p-6">
          <ErrorDisplay error={error} />
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
        <CardHeader>
          <Skeleton className="h-6 w-32 bg-gray-700" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full bg-gray-700" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-12 bg-gray-700" />
            <Skeleton className="h-12 bg-gray-700" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Daily Usage
          </CardTitle>
          {isProUser && (
            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
              <Crown className="w-3 h-3 mr-1" />
              Pro
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Usage Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">
              Banters Generated Today
            </span>
            <span className={`text-lg font-bold ${getUsageColor()}`}>
              {currentUsage}{!isProUser && ` / ${dailyLimit}`}
            </span>
          </div>
          
          {!isProUser && (
            <div className="space-y-2">
              <Progress 
                value={usagePercentage} 
                className="h-2 bg-gray-700"
                style={{
                  '--progress-foreground': getProgressColor()
                } as React.CSSProperties}
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>Free Tier Limit</span>
                <span>{Math.round(usagePercentage)}% used</span>
              </div>
            </div>
          )}
          
          {isProUser && (
            <div className="text-center py-2">
              <span className="text-sm text-yellow-400 font-medium">
                ✨ Unlimited banters with Pro
              </span>
            </div>
          )}
        </div>

        {/* Daily Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-medium text-gray-400">Played</span>
            </div>
            <span className="text-lg font-bold text-blue-400">
              {stats?.bantersPlayed || 0}
            </span>
          </div>
          
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-medium text-gray-400">Peak Hour</span>
            </div>
            <span className="text-lg font-bold text-purple-400">
              {stats?.peakHour ? `${stats.peakHour}:00` : 'N/A'}
            </span>
          </div>
        </div>

        {/* Upgrade Prompt for Free Users */}
        {!isProUser && usagePercentage >= 80 && (
          <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg p-4 border border-primary/30">
            <div className="text-center space-y-2">
              <h4 className="font-semibold text-white">
                {usagePercentage >= 100 ? "Daily limit reached!" : "Almost at your daily limit"}
              </h4>
              <p className="text-sm text-gray-300">
                Upgrade to Pro for unlimited banters and premium voices
              </p>
              <Button 
                size="sm" 
                className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                onClick={() => window.location.href = '/pro'}
              >
                <Crown className="w-4 h-4 mr-2" />
                Upgrade to Pro
              </Button>
            </div>
          </div>
        )}

        {/* Reset Time Info */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            Usage resets daily at midnight UTC
          </p>
        </div>
      </CardContent>
    </Card>
  );
}