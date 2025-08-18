import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorDisplay } from "@/components/ui/error-display";
import { 
  BarChart3, 
  Crown, 
  Zap, 
  TrendingUp, 
  Users, 
  Clock,
  AlertTriangle,
  Infinity
} from "lucide-react";
import { Link } from "wouter";
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

  const isProUser = user?.subscriptionTier === 'pro' || user?.subscriptionTier === 'byok' || user?.subscriptionTier === 'enterprise';
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold text-white flex items-center space-x-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <span>Daily Usage</span>
          {isProUser && (
            <Badge className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white border-0">
              <Crown className="w-3 h-3 mr-1" />
              Pro
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">Resets daily</span>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Usage Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Banter Generation</span>
            <span className={`text-sm font-medium ${getUsageColor()}`}>
              {currentUsage}{!isProUser && ` / ${dailyLimit}`}
            </span>
          </div>
          
          {!isProUser && (
            <Progress 
              value={usagePercentage} 
              className="h-2"
              style={{
                '--progress-background': getProgressColor()
              } as React.CSSProperties}
            />
          )}
          
          {isProUser && (
            <div className="flex items-center space-x-2 text-yellow-400">
              <Infinity className="w-4 h-4" />
              <span className="text-sm font-medium">Unlimited</span>
            </div>
          )}
        </div>

        {/* Usage Stats */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{currentUsage}</div>
            <div className="text-xs text-gray-400">Generated Today</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{stats?.bantersPlayed || 0}</div>
            <div className="text-xs text-gray-400">Played Today</div>
          </div>
        </div>

        {/* Pro Upgrade CTA */}
        {!isProUser && usagePercentage >= 80 && (
          <div className="bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 rounded-lg p-4 border border-yellow-500/30">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-yellow-400">Approaching Daily Limit</span>
            </div>
            <p className="text-xs text-gray-300 mb-3">
              You've used {usagePercentage.toFixed(0)}% of your daily banter limit. Upgrade to Pro for unlimited generation.
            </p>
            <Link href="/pro">
              <Button size="sm" className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white">
                <Crown className="w-3 h-3 mr-2" />
                Upgrade to Pro
              </Button>
            </Link>
          </div>
        )}

        {/* Pro Benefits */}
        {isProUser && (
          <div className="bg-gradient-to-r from-green-500/10 to-green-600/10 rounded-lg p-4 border border-green-500/30">
            <div className="flex items-center space-x-2 mb-2">
              <Zap className="w-4 h-4 text-green-400" />
              <span className="text-sm font-medium text-green-400">Pro Benefits Active</span>
            </div>
            <div className="text-xs text-gray-300 space-y-1">
              <div>• Unlimited daily banter generation</div>
              <div>• Priority processing speed</div>
              <div>• Advanced voice options</div>
              <div>• Premium support</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}