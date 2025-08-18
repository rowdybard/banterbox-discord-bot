import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Zap, Key, Building, User, Mail, Calendar } from "lucide-react";

export default function UserDebug() {
  const { user, isLoading } = useAuth();

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'free': return <Zap className="w-4 h-4" />;
      case 'pro': return <Crown className="w-4 h-4" />;
      case 'byok': return <Key className="w-4 h-4" />;
      case 'enterprise': return <Building className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'free': return 'text-gray-400';
      case 'pro': return 'text-yellow-400';
      case 'byok': return 'text-green-400';
      case 'enterprise': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">User Debug Info</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400">Loading user data...</p>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">User Debug Info</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-400">No user data available</p>
        </CardContent>
      </Card>
    );
  }

  const isPro = user.subscriptionTier === 'pro' || user.subscriptionTier === 'byok' || user.subscriptionTier === 'enterprise';

  return (
    <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
      <CardHeader>
        <CardTitle className="text-white">User Debug Info</CardTitle>
        <p className="text-gray-400 text-sm">Current user data from database</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic User Info */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">ID: {user.id}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">Email: {user.email || 'N/A'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-300">Name: {user.firstName || 'N/A'} {user.lastName || 'N/A'}</span>
          </div>
        </div>

        {/* Subscription Info */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-300">Subscription Tier:</span>
            <span className={`${getTierColor(user.subscriptionTier || 'free')} font-medium`}>
              {getTierIcon(user.subscriptionTier || 'free')} {user.subscriptionTier || 'free'}
            </span>
            {isPro && <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">PRO</Badge>}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-300">Status: {user.subscriptionStatus || 'active'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-300">Subscription ID: {user.subscriptionId || 'N/A'}</span>
          </div>
        </div>

        {/* Dates */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">Created: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">Updated: {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : 'N/A'}</span>
          </div>
          {user.trialEndsAt && (
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-300">Trial Ends: {new Date(user.trialEndsAt).toLocaleDateString()}</span>
            </div>
          )}
          {user.currentPeriodEnd && (
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-300">Period Ends: {new Date(user.currentPeriodEnd).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Pro Status */}
        <div className="p-3 bg-gray-800/50 rounded-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-300">Pro Status:</span>
            <Badge variant={isPro ? "default" : "secondary"} className={isPro ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}>
              {isPro ? "ACTIVE" : "INACTIVE"}
            </Badge>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {isPro ? "You have access to Pro features" : "Upgrade to Pro to unlock premium features"}
          </p>
        </div>

        {/* Raw Data */}
        <details className="mt-4">
          <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">
            Raw User Data (JSON)
          </summary>
          <pre className="mt-2 text-xs text-gray-500 bg-gray-900 p-2 rounded overflow-auto max-h-40">
            {JSON.stringify(user, null, 2)}
          </pre>
        </details>
      </CardContent>
    </Card>
  );
}
