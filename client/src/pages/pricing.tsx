import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Crown, 
  Check, 
  X, 
  Mic, 
  Infinity, 
  Palette, 
  Zap,
  ArrowLeft,
  Star,
  Users,
  Clock,
  Key,
  Building,
  Sparkles,
  Shield,
  Headphones,
  BarChart3,
  Settings
} from "lucide-react";
import { BILLING_CONFIG, getTierConfig, formatPrice, calculateYearlySavings } from "@shared/billing";
import type { SubscriptionTier } from "@shared/types";
import { AuthDebug } from "@/components/ui/auth-debug";

export default function PricingPage() {
  const { user } = useAuth();
  const [isYearly, setIsYearly] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('pro');

  const handleUpgrade = (tier: SubscriptionTier) => {
    setSelectedTier(tier);
    
    if (tier === 'enterprise') {
      // Enterprise requires contact sales
      window.open('mailto:sales@banterbox.ai?subject=Enterprise%20Inquiry', '_blank');
      return;
    }
    
    if (tier === 'byok') {
      // BYOK requires API key setup
      const hasKeys = confirm(
        'BYOK (Bring Your Own Key) requires you to provide your own API keys.\n\n' +
        'You will need:\n' +
        '• OpenAI API Key\n' +
        '• ElevenLabs API Key\n\n' +
        'Would you like to proceed with BYOK setup?'
      );
      
      if (hasKeys) {
        // Redirect to billing with BYOK flag
        window.location.href = '/billing?tier=byok&setup=keys';
        return;
      } else {
        // Redirect to billing without BYOK flag
        window.location.href = '/billing?tier=byok&setup=later';
        return;
      }
    }
    
    // Regular upgrade flow
    if (tier === 'pro') {
      // Redirect to billing page for Pro upgrade
      window.location.href = '/billing?tier=pro';
      return;
    }
    
    // TODO: Implement Stripe checkout for other tiers
    console.log(`Upgrading to ${tier} tier`);
  };

  const getCurrentTier = () => {
    return user?.subscriptionTier || 'free';
  };

  const isCurrentTier = (tier: SubscriptionTier) => {
    return getCurrentTier() === tier;
  };

  const canUpgrade = (tier: SubscriptionTier) => {
    const currentTier = getCurrentTier();
    const tierOrder = ['free', 'pro', 'byok', 'enterprise'];
    const currentIndex = tierOrder.indexOf(currentTier);
    const targetIndex = tierOrder.indexOf(tier);
    return targetIndex > currentIndex;
  };

  // Check if user is already Pro or higher
  const isAlreadyPro = user?.subscriptionTier === 'pro' || user?.subscriptionTier === 'byok' || user?.subscriptionTier === 'enterprise';

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-dark-lighter to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <Link href="/dashboard">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          
          <h1 className="text-4xl font-bold text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Start free, upgrade when you're ready to unlock premium features
          </p>

          {/* Show current plan status */}
          {isAlreadyPro && (
            <div className="bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 rounded-lg p-4 border border-yellow-500/30 mb-8">
              <div className="flex items-center justify-center space-x-2">
                <Crown className="w-5 h-5 text-yellow-400" />
                <span className="text-yellow-400 font-medium">
                  You're currently on the {getCurrentTier()} plan
                </span>
              </div>
            </div>
          )}

          {/* Billing Toggle */}
          <div className="flex items-center justify-center space-x-4 mb-8">
            <span className={`text-sm ${!isYearly ? 'text-white' : 'text-gray-400'}`}>Monthly</span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isYearly ? 'bg-primary' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isYearly ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm ${isYearly ? 'text-white' : 'text-gray-400'}`}>
              Yearly
              {isYearly && (
                <Badge variant="secondary" className="ml-2">
                  Save {calculateYearlySavings(BILLING_CONFIG.tiers.pro.monthlyPrice, BILLING_CONFIG.tiers.pro.yearlyPrice)}%
                </Badge>
              )}
            </span>
          </div>
        </div>

        {/* Auth Debug (for testing) */}
        <div className="mb-8">
          <AuthDebug />
        </div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-4 gap-6 mb-12">
          {Object.values(BILLING_CONFIG.tiers).map((tier) => {
            const price = isYearly ? tier.yearlyPrice : tier.monthlyPrice;
            const monthlyEquivalent = isYearly ? tier.yearlyPrice / 12 : tier.monthlyPrice;
            
            return (
              <Card 
                key={tier.id}
                className={`relative ${
                  tier.popular 
                    ? 'border-primary bg-gradient-to-b from-primary/10 to-transparent' 
                    : 'bg-dark-lighter/50 border-gray-700'
                } ${isCurrentTier(tier.id) ? 'ring-2 ring-accent' : ''}`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-white px-3 py-1">
                      <Star className="w-3 h-3 mr-1" />
                      Most Popular
                    </Badge>
                  </div>
                )}

                {isCurrentTier(tier.id) && (
                  <div className="absolute -top-3 right-4">
                    <Badge variant="secondary" className="bg-accent text-white">
                      Current Plan
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-6">
                  <div className="flex items-center justify-center mb-2">
                    {tier.id === 'free' && <Sparkles className="w-6 h-6 text-gray-400 mr-2" />}
                    {tier.id === 'pro' && <Crown className="w-6 h-6 text-primary mr-2" />}
                    {tier.id === 'byok' && <Key className="w-6 h-6 text-green-400 mr-2" />}
                    {tier.id === 'enterprise' && <Building className="w-6 h-6 text-purple-400 mr-2" />}
                    <CardTitle className="text-2xl text-white">{tier.name}</CardTitle>
                  </div>
                  
                  <p className="text-gray-400 text-sm mb-4">{tier.description}</p>
                  
                  <div className="space-y-2">
                    <div className="text-4xl font-bold text-white">
                      {tier.monthlyPrice === 0 ? 'Free' : formatPrice(price)}
                    </div>
                    {tier.monthlyPrice > 0 && (
                      <div className="text-sm text-gray-400">
                        {isYearly ? 'per year' : 'per month'}
                        {isYearly && (
                          <div className="text-xs text-green-400">
                            {formatPrice(monthlyEquivalent)}/mo when billed yearly
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Features */}
                  <div className="space-y-3">
                    {tier.features.map((feature, index) => (
                      <div key={index} className="flex items-center text-green-400">
                        <Check className="w-4 h-4 mr-3 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Restrictions */}
                  {tier.restrictions.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-gray-700">
                      {tier.restrictions.map((restriction, index) => (
                        <div key={index} className="flex items-center text-gray-500">
                          <X className="w-4 h-4 mr-3 flex-shrink-0" />
                          <span className="text-sm">{restriction}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="pt-4">
                    {isCurrentTier(tier.id) ? (
                      <Button 
                        className="w-full bg-gray-600 text-white" 
                        disabled
                      >
                        Current Plan
                      </Button>
                    ) : canUpgrade(tier.id) ? (
                      <Button 
                        className={`w-full ${
                          tier.popular 
                            ? 'bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80' 
                            : 'bg-gray-600 hover:bg-gray-500'
                        } text-white font-semibold`}
                        onClick={() => handleUpgrade(tier.id)}
                      >
                        {tier.id === 'enterprise' ? 'Contact Sales' : 'Upgrade Now'}
                      </Button>
                    ) : (
                      <Button 
                        className="w-full bg-gray-600 text-white" 
                        disabled
                      >
                        Downgrade
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Feature Comparison */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            Feature Comparison
          </h2>
          
          <div className="bg-dark-lighter/30 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left p-4 text-white font-semibold">Feature</th>
                    <th className="text-center p-4 text-gray-400 font-semibold">Free</th>
                    <th className="text-center p-4 text-primary font-semibold">Pro</th>
                    <th className="text-center p-4 text-green-400 font-semibold">BYOK</th>
                    <th className="text-center p-4 text-purple-400 font-semibold">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-700">
                    <td className="p-4 text-white">Daily Banters</td>
                    <td className="text-center p-4 text-gray-400">50</td>
                    <td className="text-center p-4 text-primary">Unlimited</td>
                    <td className="text-center p-4 text-green-400">Unlimited</td>
                    <td className="text-center p-4 text-purple-400">Unlimited</td>
                  </tr>
                  <tr className="border-b border-gray-700">
                    <td className="p-4 text-white">ElevenLabs Voices</td>
                    <td className="text-center p-4 text-gray-400">❌</td>
                    <td className="text-center p-4 text-primary">✅</td>
                    <td className="text-center p-4 text-green-400">✅</td>
                    <td className="text-center p-4 text-purple-400">✅</td>
                  </tr>
                  <tr className="border-b border-gray-700">
                    <td className="p-4 text-white">Custom Voices</td>
                    <td className="text-center p-4 text-gray-400">❌</td>
                    <td className="text-center p-4 text-primary">10</td>
                    <td className="text-center p-4 text-green-400">50</td>
                    <td className="text-center p-4 text-purple-400">Unlimited</td>
                  </tr>
                  <tr className="border-b border-gray-700">
                    <td className="p-4 text-white">Discord Servers</td>
                    <td className="text-center p-4 text-gray-400">1</td>
                    <td className="text-center p-4 text-primary">Unlimited</td>
                    <td className="text-center p-4 text-green-400">Unlimited</td>
                    <td className="text-center p-4 text-purple-400">Unlimited</td>
                  </tr>
                  <tr className="border-b border-gray-700">
                    <td className="p-4 text-white">Priority Support</td>
                    <td className="text-center p-4 text-gray-400">❌</td>
                    <td className="text-center p-4 text-primary">✅</td>
                    <td className="text-center p-4 text-green-400">✅</td>
                    <td className="text-center p-4 text-purple-400">✅</td>
                  </tr>
                  <tr className="border-b border-gray-700">
                    <td className="p-4 text-white">API Keys</td>
                    <td className="text-center p-4 text-gray-400">Ours</td>
                    <td className="text-center p-4 text-primary">Ours</td>
                    <td className="text-center p-4 text-green-400">Yours</td>
                    <td className="text-center p-4 text-purple-400">Yours</td>
                  </tr>
                  <tr>
                    <td className="p-4 text-white">Custom Integrations</td>
                    <td className="text-center p-4 text-gray-400">❌</td>
                    <td className="text-center p-4 text-gray-400">❌</td>
                    <td className="text-center p-4 text-gray-400">❌</td>
                    <td className="text-center p-4 text-purple-400">✅</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            Frequently Asked Questions
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-dark-lighter/30 border-gray-700">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-3">
                  What's the difference between Pro and BYOK?
                </h3>
                <p className="text-gray-300 text-sm">
                  Pro uses our API keys (included in price), while BYOK lets you use your own OpenAI and ElevenLabs API keys for maximum control and cost efficiency.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-dark-lighter/30 border-gray-700">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-3">
                  Can I switch between plans?
                </h3>
                <p className="text-gray-300 text-sm">
                  Yes! You can upgrade or downgrade at any time. Changes take effect immediately, and we'll prorate your billing.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-dark-lighter/30 border-gray-700">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-3">
                  Is there a free trial?
                </h3>
                <p className="text-gray-300 text-sm">
                  Yes! All paid plans come with a 7-day free trial. No credit card required to start.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-dark-lighter/30 border-gray-700">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-3">
                  How do I set up my own API keys?
                </h3>
                <p className="text-gray-300 text-sm">
                  After upgrading to BYOK, you'll get access to our API key management dashboard where you can securely add your OpenAI and ElevenLabs keys.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Card className="bg-gradient-to-r from-primary/20 to-secondary/20 border-primary/30">
            <CardContent className="p-8">
              <h2 className="text-3xl font-bold text-white mb-4">
                Ready to Level Up Your Stream?
              </h2>
              <p className="text-xl text-gray-300 mb-6">
                Join thousands of streamers who've already upgraded to Pro
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  className="bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-white font-semibold px-8 py-3"
                  onClick={() => handleUpgrade('pro')}
                >
                  Start Free Trial
                </Button>
                <Button 
                  variant="outline" 
                  className="border-green-400 text-green-400 hover:bg-green-400/10 px-8 py-3"
                  onClick={() => handleUpgrade('byok')}
                >
                  Try BYOK Plan
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
