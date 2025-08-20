import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Crown, 
  Key, 
  Building, 
  ArrowLeft,
  CreditCard,
  Shield,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Eye,
  EyeOff
} from "lucide-react";
import { Link } from "wouter";
import { BILLING_CONFIG, getTierConfig, formatPrice } from "@shared/billing";
import type { SubscriptionTier } from "@shared/types";
import { useToast } from "@/hooks/use-toast";

export default function BillingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  
  // Get tier from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const selectedTier = (urlParams.get('tier') as SubscriptionTier) || 'pro';
  const setupMode = urlParams.get('setup') || 'normal';
  
  const [isLoading, setIsLoading] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    elevenlabs: ''
  });

  const tierConfig = getTierConfig(selectedTier);
  const isBYOK = selectedTier === 'byok';
  const isEnterprise = selectedTier === 'enterprise';

  const handleUpgrade = async () => {
    setIsLoading(true);
    
    try {
      if (isBYOK && setupMode === 'keys') {
        // Validate API keys first
        if (!apiKeys.openai || !apiKeys.elevenlabs) {
          toast({
            title: "Missing API Keys",
            description: "Please provide both OpenAI and ElevenLabs API keys",
            variant: "destructive",
          });
          return;
        }
        
        // Store API keys securely
        await storeApiKeys(apiKeys);
      }
      
      // Redirect to Stripe checkout
      const response = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier: selectedTier,
          setupMode: setupMode
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }
      
      const { url } = await response.json();
      window.location.href = url;
      
    } catch (error) {
      console.error('Upgrade error:', error);
      toast({
        title: "Upgrade Failed",
        description: "Failed to process upgrade. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const storeApiKeys = async (keys: { openai: string; elevenlabs: string }) => {
    const response = await fetch('/api/settings/api-keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(keys),
    });
    
    if (!response.ok) {
      throw new Error('Failed to store API keys');
    }
  };

  const handleSkipKeys = () => {
    setLocation('/dashboard');
    toast({
      title: "Keys Skipped",
      description: "You can add your API keys later in Settings",
    });
  };

  if (isEnterprise) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark via-dark-lighter to-gray-900">
        <div className="container mx-auto px-4 py-8">
          <Link href="/pricing">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Pricing
            </Button>
          </Link>
          
          <Card className="max-w-2xl mx-auto bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
            <CardHeader className="text-center">
              <Building className="w-16 h-16 text-purple-400 mx-auto mb-4" />
              <CardTitle className="text-2xl text-white">Enterprise Solution</CardTitle>
              <p className="text-gray-400">
                Custom enterprise solutions require direct consultation
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-4">
                <p className="text-gray-300">
                  Our enterprise solutions include custom integrations, dedicated support, 
                  and tailored pricing for your specific needs.
                </p>
                <div className="space-y-2">
                  <Button 
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => window.open('mailto:sales@banterbox.ai?subject=Enterprise%20Inquiry', '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Contact Sales Team
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full border-gray-600 text-gray-300"
                    onClick={() => setLocation('/pricing')}
                  >
                    Back to Pricing
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-dark-lighter to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <Link href="/pricing">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Pricing
          </Button>
        </Link>
        
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Tier Summary */}
          <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
            <CardHeader>
              <div className="flex items-center space-x-3">
                {selectedTier === 'pro' && <Crown className="w-8 h-8 text-yellow-400" />}
                {selectedTier === 'byok' && <Key className="w-8 h-8 text-green-400" />}
                <div>
                  <CardTitle className="text-xl text-white">{tierConfig.name}</CardTitle>
                  <p className="text-gray-400">{tierConfig.description}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-white">
                  {formatPrice(tierConfig.monthlyPrice)}/month
                </div>
                <p className="text-sm text-gray-400">
                  {tierConfig.monthlyPrice === 0 ? 'Free forever' : 'Billed monthly'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* API Key Setup for BYOK */}
          {isBYOK && setupMode === 'keys' && (
            <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Key className="w-5 h-5 text-green-400" />
                  <span>API Key Setup</span>
                </CardTitle>
                <p className="text-gray-400 text-sm">
                  Provide your API keys to use your own OpenAI and ElevenLabs accounts
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="openai-key" className="text-white">OpenAI API Key</Label>
                  <div className="relative">
                    <Input
                      id="openai-key"
                      type={showKeys ? "text" : "password"}
                      placeholder="sk-..."
                      value={apiKeys.openai}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, openai: e.target.value }))}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                      onClick={() => setShowKeys(!showKeys)}
                    >
                      {showKeys ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="elevenlabs-key" className="text-white">ElevenLabs API Key</Label>
                  <div className="relative">
                    <Input
                      id="elevenlabs-key"
                      type={showKeys ? "text" : "password"}
                      placeholder="..."
                      value={apiKeys.elevenlabs}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, elevenlabs: e.target.value }))}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>
                
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-blue-400 font-medium">Secure Storage</span>
                  </div>
                  <p className="text-xs text-blue-300 mt-1">
                    Your API keys are encrypted and stored securely. We never store them in plain text.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Section */}
          <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <CreditCard className="w-5 h-5" />
                <span>Payment</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Plan</span>
                  <span className="text-white">{tierConfig.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Price</span>
                  <span className="text-white">{formatPrice(tierConfig.monthlyPrice)}/month</span>
                </div>
                {tierConfig.monthlyPrice > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Free Trial</span>
                    <span className="text-green-400">7 days</span>
                  </div>
                )}
                <div className="border-t border-gray-700 pt-2">
                  <div className="flex justify-between font-medium">
                    <span className="text-white">Total</span>
                    <span className="text-white">
                      {tierConfig.monthlyPrice === 0 ? 'Free' : `${formatPrice(tierConfig.monthlyPrice)}/month`}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                {isBYOK && setupMode === 'keys' ? (
                  <Button 
                    onClick={handleUpgrade}
                    disabled={isLoading || !apiKeys.openai || !apiKeys.elevenlabs}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isLoading ? "Processing..." : "Upgrade with API Keys"}
                  </Button>
                ) : (
                  <Button 
                    onClick={handleUpgrade}
                    disabled={isLoading}
                    className="w-full bg-primary hover:bg-primary/90 text-white"
                  >
                    {isLoading ? "Processing..." : "Start Free Trial"}
                  </Button>
                )}
                
                {isBYOK && setupMode === 'keys' && (
                  <Button 
                    variant="outline" 
                    onClick={handleSkipKeys}
                    className="w-full border-gray-600 text-gray-300"
                  >
                    Skip Keys for Now
                  </Button>
                )}
              </div>
              
              <div className="text-xs text-gray-500 text-center space-y-1">
                <p>• Secure payment processing by Stripe</p>
                <p>• Cancel anytime, no commitment</p>
                <p>• 7-day free trial on all paid plans</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
