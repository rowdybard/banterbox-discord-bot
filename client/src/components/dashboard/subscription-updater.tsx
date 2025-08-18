import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Crown, Zap, Key, Building, RefreshCw, AlertTriangle } from "lucide-react";

export default function SubscriptionUpdater() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTier, setSelectedTier] = useState(user?.subscriptionTier || 'free');

  const updateSubscriptionMutation = useMutation({
    mutationFn: async (tier: string) => {
      const response = await fetch('/api/billing/subscription', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tier, status: 'active' }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update subscription');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Subscription Updated!",
        description: `Successfully updated to ${data.tier} tier`,
      });
      // Invalidate user data to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update subscription tier",
        variant: "destructive",
      });
    },
  });

  const refreshUserData = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    toast({
      title: "Refreshed",
      description: "User data refreshed from server",
    });
  };

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

  const getTierOrder = (tier: string) => {
    switch (tier) {
      case 'free': return 0;
      case 'pro': return 1;
      case 'byok': return 2;
      case 'enterprise': return 3;
      default: return 0;
    }
  };

  const canUpgradeTo = (targetTier: string) => {
    const currentTier = user?.subscriptionTier || 'free';
    const currentOrder = getTierOrder(currentTier);
    const targetOrder = getTierOrder(targetTier);
    
    // Can only upgrade to higher tiers
    return targetOrder > currentOrder;
  };

  const isDowngrade = (targetTier: string) => {
    const currentTier = user?.subscriptionTier || 'free';
    const currentOrder = getTierOrder(currentTier);
    const targetOrder = getTierOrder(targetTier);
    
    return targetOrder < currentOrder;
  };

  return (
    <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white">Update Subscription Tier</CardTitle>
            <p className="text-gray-400 text-sm">
              Current tier: <span className={`${getTierColor(user?.subscriptionTier || 'free')} font-medium`}>
                {getTierIcon(user?.subscriptionTier || 'free')} {user?.subscriptionTier || 'free'}
              </span>
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshUserData}
            className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Select New Tier</label>
          <Select value={selectedTier} onValueChange={setSelectedTier}>
            <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="free">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-gray-400" />
                  <span>Free</span>
                </div>
              </SelectItem>
              <SelectItem value="pro" disabled={!canUpgradeTo('pro')}>
                <div className="flex items-center space-x-2">
                  <Crown className="w-4 h-4 text-yellow-400" />
                  <span>Pro</span>
                  {!canUpgradeTo('pro') && <span className="text-xs text-gray-500">(Payment Required)</span>}
                </div>
              </SelectItem>
              <SelectItem value="byok" disabled={!canUpgradeTo('byok')}>
                <div className="flex items-center space-x-2">
                  <Key className="w-4 h-4 text-green-400" />
                  <span>Bring Your Own Key</span>
                  {!canUpgradeTo('byok') && <span className="text-xs text-gray-500">(Payment Required)</span>}
                </div>
              </SelectItem>
              <SelectItem value="enterprise" disabled={!canUpgradeTo('enterprise')}>
                <div className="flex items-center space-x-2">
                  <Building className="w-4 h-4 text-purple-400" />
                  <span>Enterprise</span>
                  {!canUpgradeTo('enterprise') && <span className="text-xs text-gray-500">(Payment Required)</span>}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Warning for downgrades */}
        {isDowngrade(selectedTier) && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-yellow-400 font-medium">Downgrade Warning</span>
            </div>
            <p className="text-xs text-yellow-300 mt-1">
              You're downgrading from {user?.subscriptionTier} to {selectedTier}. This will remove access to premium features.
            </p>
          </div>
        )}

        <Button
          onClick={() => updateSubscriptionMutation.mutate(selectedTier)}
          disabled={updateSubscriptionMutation.isPending || selectedTier === user?.subscriptionTier}
          className="w-full bg-primary hover:bg-primary/90 text-white"
        >
          {updateSubscriptionMutation.isPending ? "Updating..." : "Update Subscription"}
        </Button>

        <div className="text-xs text-gray-500">
          This is for testing purposes. In production, upgrades would require payment through Stripe.
        </div>
      </CardContent>
    </Card>
  );
}
