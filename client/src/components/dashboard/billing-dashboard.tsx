import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Crown, 
  Key, 
  Building, 
  Sparkles,
  BarChart3,
  Calendar,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Clock
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { BILLING_CONFIG, getTierConfig, formatPrice, type SubscriptionTier } from "@shared/billing";
import { getSubscriptionTier } from "@shared/subscription";
import { Link } from "wouter";

export default function BillingDashboard() {
  const { user } = useAuth();

  // Fetch subscription data
  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const response = await fetch('/api/billing/subscription');
      if (!response.ok) throw new Error('Failed to fetch subscription');
      return response.json();
    },
    enabled: !!user
  });

  // Fetch usage data
  const { data: usage } = useQuery({
    queryKey: ['usage'],
    queryFn: async () => {
      const response = await fetch('/api/billing/usage');
      if (!response.ok) throw new Error('Failed to fetch usage');
      return response.json();
    },
    enabled: !!user
  });

  const getCurrentTier = (): SubscriptionTier => {
    return subscription?.tier || getSubscriptionTier(user);
  };

  const getTierIcon = (tier: SubscriptionTier) => {
    switch (tier) {
      case 'free': return <Sparkles className="w-5 h-5 text-gray-400" />;
      case 'pro': return <Crown className="w-5 h-5 text-primary" />;
      case 'byok': return <Key className="w-5 h-5 text-green-400" />;
      case 'enterprise': return <Building className="w-5 h-5 text-purple-400" />;
      default: return <Sparkles className="w-5 h-5 text-gray-400" />;
    }
  };

  const getTierColor = (tier: SubscriptionTier) => {
    switch (tier) {
      case 'free': return 'text-gray-400';
      case 'pro': return 'text-primary';
      case 'byok': return 'text-green-400';
      case 'enterprise': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusBadge = () => {
    if (subscription?.isTrialing) {
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Trial</Badge>;
    }
    
    if (subscription?.isActive) {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>;
    }
    
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Inactive</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const currentTier = getCurrentTier();
  const tierConfig = getTierConfig(currentTier);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Billing & Subscription
          </h2>
          <p className="text-gray-400">
            Manage your subscription and view usage
          </p>
        </div>
        <Link href="/pricing">
          <Button className="bg-primary hover:bg-primary/80 text-white">
            <Crown className="w-4 h-4 mr-2" />
            Upgrade Plan
          </Button>
        </Link>
      </div>

      {/* Current Plan */}
      <Card className="bg-dark-lighter/50 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center space-x-2">
              {getTierIcon(currentTier)}
              <span>Current Plan: {tierConfig.name}</span>
            </CardTitle>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-gray-400 text-sm">Plan</p>
              <p className={`text-lg font-semibold ${getTierColor(currentTier)}`}>
                {tierConfig.name}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Price</p>
              <p className="text-lg font-semibold text-white">
                {tierConfig.monthlyPrice === 0 ? 'Free' : formatPrice(tierConfig.monthlyPrice) + '/month'}
              </p>
            </div>
            {subscription?.trialEndsAt && (
              <div>
                <p className="text-gray-400 text-sm">Trial Ends</p>
                <p className="text-lg font-semibold text-white">
                  {formatDate(subscription.trialEndsAt)}
                </p>
              </div>
            )}
            {subscription?.currentPeriodEnd && (
              <div>
                <p className="text-gray-400 text-sm">Next Billing</p>
                <p className="text-lg font-semibold text-white">
                  {formatDate(subscription.currentPeriodEnd)}
                </p>
              </div>
            )}
          </div>

          {/* Plan Features */}
          <div className="pt-4 border-t border-gray-700">
            <p className="text-gray-400 text-sm mb-3">Plan Features:</p>
            <div className="grid md:grid-cols-2 gap-2">
              {tierConfig.features.slice(0, 6).map((feature, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-gray-300">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Statistics */}
      {usage && (
        <Card className="bg-dark-lighter/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center space-x-2">
              <BarChart3 className="w-5 h-5" />
              <span>Usage This Month</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Daily Banters */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-300">Daily Banters</span>
                <span className="text-sm text-gray-400">
                  {usage.current.bantersGenerated} / {usage.limits.dailyBanters === 999999 ? '∞' : usage.limits.dailyBanters}
                </span>
              </div>
              <Progress 
                value={usage.percentages.bantersGenerated} 
                className="h-2"
              />
            </div>

            {/* OpenAI Tokens */}
            {usage.limits.openaiTokens > 0 && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-300">OpenAI Tokens</span>
                  <span className="text-sm text-gray-400">
                    {usage.current.openaiTokensUsed.toLocaleString()} / {usage.limits.openaiTokens === 999999999 ? '∞' : usage.limits.openaiTokens.toLocaleString()}
                  </span>
                </div>
                <Progress 
                  value={usage.percentages.openaiTokensUsed} 
                  className="h-2"
                />
              </div>
            )}

            {/* ElevenLabs Characters */}
            {usage.limits.elevenlabsCharacters > 0 && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-300">ElevenLabs Characters</span>
                  <span className="text-sm text-gray-400">
                    {usage.current.elevenlabsCharactersUsed.toLocaleString()} / {usage.limits.elevenlabsCharacters === 999999999 ? '∞' : usage.limits.elevenlabsCharacters.toLocaleString()}
                  </span>
                </div>
                <Progress 
                  value={usage.percentages.elevenlabsCharactersUsed} 
                  className="h-2"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upgrade Suggestions */}
      {currentTier === 'free' && (
        <Card className="bg-gradient-to-r from-primary/20 to-secondary/20 border-primary/30">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <Crown className="w-8 h-8 text-primary mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Ready to Level Up?
                </h3>
                <p className="text-gray-300 mb-4">
                  Upgrade to Pro for unlimited banters, premium voices, and advanced features.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href="/pricing">
                    <Button className="bg-primary hover:bg-primary/80 text-white">
                      View Plans
                    </Button>
                  </Link>
                  <Button variant="outline" className="border-gray-600 text-gray-300">
                    Learn More
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* BYOK Upgrade Suggestion */}
      {currentTier === 'pro' && (
        <Card className="bg-gradient-to-r from-green-400/20 to-green-600/20 border-green-400/30">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <Key className="w-8 h-8 text-green-400 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Save Money with BYOK
                </h3>
                <p className="text-gray-300 mb-4">
                  Use your own API keys and pay only $4.99/month instead of $9.99/month.
                </p>
                <Link href="/pricing">
                  <Button className="bg-green-400 hover:bg-green-500 text-white">
                    Switch to BYOK
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing Actions */}
      <Card className="bg-dark-lighter/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Billing Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <Button variant="outline" className="border-gray-600 text-gray-300">
              <CreditCard className="w-4 h-4 mr-2" />
              Update Payment Method
            </Button>
            <Button variant="outline" className="border-gray-600 text-gray-300">
              <Calendar className="w-4 h-4 mr-2" />
              View Billing History
            </Button>
            <Button variant="outline" className="border-gray-600 text-gray-300">
              <BarChart3 className="w-4 h-4 mr-2" />
              Download Invoice
            </Button>
            <Button variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Cancel Subscription
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
