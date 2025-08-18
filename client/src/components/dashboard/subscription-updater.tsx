import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Crown, Zap, Key, Building, RefreshCw, AlertTriangle, ExternalLink, Lock, Clock, Calendar } from "lucide-react";
import { Link, useLocation } from "wouter";
import { getTierOrder, isDowngrade as checkIsDowngrade, canChangePlan, getPlanChangeInfo } from "@shared/billing";
import type { SubscriptionTier } from "@shared/types";

export default function SubscriptionUpdater() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
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

  // Get plan change information
  const planChangeInfo = getPlanChangeInfo(
    user?.lastPlanChangeAt ? new Date(user.lastPlanChangeAt) : null,
    user?.planChangeCount || 0
  );

  const canDowngradeTo = (targetTier: string) => {
    const currentTier = user?.subscriptionTier || 'free';
    return checkIsDowngrade(currentTier as SubscriptionTier, targetTier as SubscriptionTier);
  };

  const isDowngrade = (targetTier: string) => {
    const currentTier = user?.subscriptionTier || 'free';
    return checkIsDowngrade(currentTier as SubscriptionTier, targetTier as SubscriptionTier);
  };

  const canChangeToTier = (targetTier: string) => {
    const currentTier = user?.subscriptionTier || 'free';
    const result = canChangePlan(
      currentTier as SubscriptionTier,
      targetTier as SubscriptionTier,
      user?.lastPlanChangeAt ? new Date(user.lastPlanChangeAt) : null,
      user?.planChangeCount || 0
    );
    return result;
  };

  const isRestrictedTier = (tier: string) => {
    return tier === 'enterprise' || tier === 'byok';
  };

  const getTierDescription = (tier: string) => {
    switch (tier) {
      case 'free': return 'Basic features, 50 daily banters';
      case 'pro': return 'Premium features, unlimited banters';
      case 'byok': return 'Bring your own API keys (contact support)';
      case 'enterprise': return 'Custom enterprise solution (contact sales)';
      default: return '';
    }
  };

  return (
    <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white">Subscription Management</CardTitle>
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
        {/* Upgrade Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-300">Upgrade Options</h3>
          <div className="space-y-2">
            <Link href="/pricing">
              <Button className="w-full bg-primary hover:bg-primary/90 text-white">
                <ExternalLink className="w-4 h-4 mr-2" />
                View Pricing & Upgrade
              </Button>
            </Link>
            <p className="text-xs text-gray-500 text-center">
              All upgrades require payment and are handled through our secure billing system
            </p>
          </div>
        </div>

        {/* Plan Change Limits */}
        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-400">Plan Change Limits</span>
          </div>
          <div className="text-xs text-blue-300 space-y-1">
            <p>Changes this month: {planChangeInfo.changesThisMonth}/{planChangeInfo.maxChangesPerMonth}</p>
            {planChangeInfo.daysUntilNextChange && (
              <p>Next change allowed in: {planChangeInfo.daysUntilNextChange} days</p>
            )}
            {!planChangeInfo.canChangeNow && planChangeInfo.reason && (
              <p className="text-yellow-300 font-medium">⚠️ {planChangeInfo.reason}</p>
            )}
          </div>
        </div>

        {/* Downgrade Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-300">Downgrade Options</h3>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Select New Tier</label>
            <Select value={selectedTier} onValueChange={setSelectedTier}>
              <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="free" disabled={!canDowngradeTo('free')}>
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-gray-400" />
                    <span>Free</span>
                    {!canDowngradeTo('free') && <span className="text-xs text-gray-500">(Current or Higher)</span>}
                  </div>
                </SelectItem>
                <SelectItem value="pro" disabled={!canDowngradeTo('pro')}>
                  <div className="flex items-center space-x-2">
                    <Crown className="w-4 h-4 text-yellow-400" />
                    <span>Pro</span>
                    {!canDowngradeTo('pro') && <span className="text-xs text-gray-500">(Current or Higher)</span>}
                  </div>
                </SelectItem>
                <SelectItem value="byok" disabled={true}>
                  <div className="flex items-center space-x-2">
                    <Lock className="w-4 h-4 text-gray-500" />
                    <span>Bring Your Own Key</span>
                    <span className="text-xs text-gray-500">(Contact Support)</span>
                  </div>
                </SelectItem>
                <SelectItem value="enterprise" disabled={true}>
                  <div className="flex items-center space-x-2">
                    <Lock className="w-4 h-4 text-gray-500" />
                    <span>Enterprise</span>
                    <span className="text-xs text-gray-500">(Contact Sales)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
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

        {/* Action Button */}
        <Button
          onClick={() => {
            const changeResult = canChangeToTier(selectedTier);
            
            if (!changeResult.allowed) {
              toast({
                title: "Plan Change Restricted",
                description: changeResult.reason || "Cannot change to this plan at this time",
                variant: "destructive",
              });
              return;
            }

            if (isDowngrade(selectedTier)) {
              // Redirect to downgrade confirmation page
              setLocation(`/downgrade-confirmation?tier=${selectedTier}`);
            } else {
              // Direct update for same tier or upgrades (shouldn't happen)
              updateSubscriptionMutation.mutate(selectedTier);
            }
          }}
          disabled={
            updateSubscriptionMutation.isPending || 
            selectedTier === user?.subscriptionTier || 
            isRestrictedTier(selectedTier) ||
            !planChangeInfo.canChangeNow
          }
          className="w-full bg-gray-600 hover:bg-gray-500 text-white"
        >
          {updateSubscriptionMutation.isPending ? "Updating..." : 
           !planChangeInfo.canChangeNow ? `Plan Changes Restricted (${planChangeInfo.reason?.split('.')[0]})` :
           "Downgrade Subscription"}
        </Button>

        <div className="text-xs text-gray-500">
          <p>• Upgrades must be done through the pricing page</p>
          <p>• BYOK and Enterprise tiers require manual setup</p>
          <p>• Downgrades take effect immediately</p>
        </div>
      </CardContent>
    </Card>
  );
}
