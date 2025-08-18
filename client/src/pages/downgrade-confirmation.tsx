import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  ArrowLeft,
  X,
  Check,
  Zap,
  Crown,
  Mic,
  Palette,
  Infinity,
  Users,
  Clock,
  BarChart3,
  Settings,
  Shield,
  Star,
  TrendingDown,
  DollarSign,
  Calendar,
  FileText,
  Lock,
  Building
} from "lucide-react";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getTierConfig, formatPrice } from "@shared/billing";
import type { SubscriptionTier } from "@shared/types";

export default function DowngradeConfirmationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  
  // Get target tier from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const targetTierParam = urlParams.get('tier');
  const targetTier: SubscriptionTier = (targetTierParam as SubscriptionTier) || 'free';
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [showHiddenCosts, setShowHiddenCosts] = useState(false);
  const [confirmationStep, setConfirmationStep] = useState(1);
  
  const currentTier: SubscriptionTier = (user?.subscriptionTier as SubscriptionTier) || 'free';
  const currentTierConfig = getTierConfig(currentTier);
  const targetTierConfig = getTierConfig(targetTier);
  
  const downgradeMutation = useMutation({
    mutationFn: async (tier: SubscriptionTier) => {
      const response = await fetch('/api/billing/subscription', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tier }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to downgrade subscription');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['dailyStats'] });
      toast({
        title: "Downgrade Complete",
        description: `Your account has been downgraded to ${data.tier}. You may lose access to premium features.`,
        variant: "destructive",
      });
      setLocation('/dashboard');
    },
    onError: (error: any) => {
      toast({
        title: "Downgrade Failed",
        description: `Failed to downgrade: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleDowngrade = async () => {
    if (confirmationStep < 3) {
      setConfirmationStep(confirmationStep + 1);
      return;
    }
    
    setIsProcessing(true);
    await downgradeMutation.mutateAsync(targetTier);
    setIsProcessing(false);
  };

  const handleCancel = () => {
    setLocation('/dashboard');
  };

  const getCurrentTierIcon = (tier: string) => {
    switch (tier) {
      case 'pro': return <Crown className="w-6 h-6 text-yellow-400" />;
      case 'byok': return <Shield className="w-6 h-6 text-green-400" />;
      case 'enterprise': return <Building className="w-6 h-6 text-purple-400" />;
      default: return <Zap className="w-6 h-6 text-gray-400" />;
    }
  };

  const getTargetTierIcon = (tier: string) => {
    switch (tier) {
      case 'free': return <Zap className="w-6 h-6 text-gray-400" />;
      case 'pro': return <Crown className="w-6 h-6 text-yellow-400" />;
      default: return <Zap className="w-6 h-6 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-dark-lighter to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <Link href="/dashboard">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Warning Header */}
          <Card className="bg-red-500/10 border-red-500/30 backdrop-blur-lg">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <AlertTriangle className="w-8 h-8 text-red-400" />
                <h1 className="text-2xl font-bold text-red-400">⚠️ Downgrade Confirmation Required</h1>
              </div>
              <p className="text-red-300">
                You're about to downgrade from {currentTierConfig.name} to {targetTierConfig.name}
              </p>
            </CardHeader>
          </Card>

          {/* Confirmation Steps */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className={`p-4 rounded-lg border-2 ${confirmationStep >= 1 ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 bg-gray-800/50'}`}>
              <div className="text-center">
                <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ${confirmationStep >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-600 text-gray-400'}`}>
                  {confirmationStep >= 1 ? <Check className="w-4 h-4" /> : '1'}
                </div>
                <p className="text-sm font-medium">Step 1: Review Changes</p>
              </div>
            </div>
            <div className={`p-4 rounded-lg border-2 ${confirmationStep >= 2 ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 bg-gray-800/50'}`}>
              <div className="text-center">
                <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ${confirmationStep >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-600 text-gray-400'}`}>
                  {confirmationStep >= 2 ? <Check className="w-4 h-4" /> : '2'}
                </div>
                <p className="text-sm font-medium">Step 2: Acknowledge Risks</p>
              </div>
            </div>
            <div className={`p-4 rounded-lg border-2 ${confirmationStep >= 3 ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 bg-gray-800/50'}`}>
              <div className="text-center">
                <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ${confirmationStep >= 3 ? 'bg-blue-500 text-white' : 'bg-gray-600 text-gray-400'}`}>
                  {confirmationStep >= 3 ? <Check className="w-4 h-4" /> : '3'}
                </div>
                <p className="text-sm font-medium">Step 3: Final Confirmation</p>
              </div>
            </div>
          </div>

          {/* Step 1: Review Changes */}
          {confirmationStep === 1 && (
            <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <TrendingDown className="w-5 h-5 text-red-400" />
                  <span>What You'll Lose</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current vs Target Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      {getCurrentTierIcon(currentTier)}
                      <h3 className="text-lg font-semibold text-white">Current: {currentTierConfig.name}</h3>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2 text-green-400">
                        <Check className="w-4 h-4" />
                        <span>Unlimited daily banters</span>
                      </div>
                      <div className="flex items-center space-x-2 text-green-400">
                        <Check className="w-4 h-4" />
                        <span>Premium ElevenLabs voices</span>
                      </div>
                      <div className="flex items-center space-x-2 text-green-400">
                        <Check className="w-4 h-4" />
                        <span>Custom voice cloning</span>
                      </div>
                      <div className="flex items-center space-x-2 text-green-400">
                        <Check className="w-4 h-4" />
                        <span>Advanced personality settings</span>
                      </div>
                      <div className="flex items-center space-x-2 text-green-400">
                        <Check className="w-4 h-4" />
                        <span>Priority support</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      {getTargetTierIcon(targetTier)}
                      <h3 className="text-lg font-semibold text-white">Downgrading to: {targetTierConfig.name}</h3>
                    </div>
                    <div className="space-y-2 text-sm">
                                             <div className="flex items-center space-x-2 text-red-400">
                         <X className="w-4 h-4" />
                         <span>Only {targetTierConfig.limits.dailyBanters || 50} daily banters</span>
                       </div>
                      <div className="flex items-center space-x-2 text-red-400">
                        <X className="w-4 h-4" />
                        <span>Basic voices only</span>
                      </div>
                      <div className="flex items-center space-x-2 text-red-400">
                        <X className="w-4 h-4" />
                        <span>No custom voice cloning</span>
                      </div>
                      <div className="flex items-center space-x-2 text-red-400">
                        <X className="w-4 h-4" />
                        <span>Limited personality options</span>
                      </div>
                      <div className="flex items-center space-x-2 text-red-400">
                        <X className="w-4 h-4" />
                        <span>Standard support only</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hidden Costs Warning */}
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <DollarSign className="w-4 h-4 text-yellow-400" />
                    <span className="text-yellow-400 font-medium">Hidden Costs You May Not Have Considered</span>
                  </div>
                  <p className="text-sm text-yellow-300">
                    Downgrading may result in additional charges for exceeding limits, 
                    reduced productivity, and potential data loss. Are you sure this is what you want?
                  </p>
                </div>

                <div className="flex space-x-4">
                  <Button onClick={handleCancel} variant="outline" className="flex-1 border-gray-600 text-gray-300">
                    Cancel Downgrade
                  </Button>
                  <Button onClick={handleDowngrade} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                    Continue to Step 2
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Acknowledge Risks */}
          {confirmationStep === 2 && (
            <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <span>Risk Acknowledgment</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <h4 className="text-red-400 font-medium mb-2">⚠️ Critical Warnings</h4>
                    <ul className="text-sm text-red-300 space-y-1">
                      <li>• Your current settings and customizations may be lost</li>
                      <li>• Any ongoing processes will be interrupted</li>
                      <li>• You may lose access to premium features immediately</li>
                      <li>• Re-upgrading later may require additional setup</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <h4 className="text-orange-400 font-medium mb-2">📊 Impact on Your Workflow</h4>
                    <ul className="text-sm text-orange-300 space-y-1">
                      <li>• Reduced daily banter limit: {currentTierConfig.limits.dailyBanters === 999999 ? 'Unlimited' : currentTierConfig.limits.dailyBanters} → {targetTierConfig.limits.dailyBanters}</li>
                      <li>• Loss of premium voice options</li>
                      <li>• Limited personality customization</li>
                      <li>• Standard support response times</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <h4 className="text-blue-400 font-medium mb-2">💡 Consider This Instead</h4>
                    <p className="text-sm text-blue-300">
                      Many users find that staying on their current plan provides better value 
                      and avoids the hassle of re-upgrading later. Your current plan includes 
                      premium features that enhance your experience significantly.
                    </p>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <Button onClick={handleCancel} variant="outline" className="flex-1 border-gray-600 text-gray-300">
                    Keep Current Plan
                  </Button>
                  <Button onClick={handleDowngrade} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                    I Understand, Continue
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Final Confirmation */}
          {confirmationStep === 3 && (
            <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Lock className="w-5 h-5 text-red-400" />
                  <span>Final Confirmation</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-red-500/20 rounded-full mx-auto flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-red-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">Last Chance to Reconsider</h3>
                  <p className="text-gray-300">
                    You're about to permanently downgrade from <span className="text-yellow-400 font-medium">{currentTierConfig.name}</span> to <span className="text-gray-400 font-medium">{targetTierConfig.name}</span>.
                  </p>
                </div>

                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="text-center">
                    <p className="text-red-400 font-medium mb-2">This action cannot be easily undone</p>
                    <p className="text-sm text-red-300">
                      You'll need to go through the full upgrade process again if you change your mind later.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <input type="checkbox" id="confirm-downgrade" className="rounded" />
                    <label htmlFor="confirm-downgrade">
                      I understand that downgrading will remove premium features and may affect my workflow
                    </label>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <input type="checkbox" id="confirm-loss" className="rounded" />
                    <label htmlFor="confirm-loss">
                      I acknowledge that some settings and customizations may be lost
                    </label>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <input type="checkbox" id="confirm-final" className="rounded" />
                    <label htmlFor="confirm-final">
                      I want to proceed with the downgrade despite the warnings
                    </label>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <Button onClick={handleCancel} variant="outline" className="flex-1 border-gray-600 text-gray-300">
                    Cancel - Keep {currentTierConfig.name}
                  </Button>
                  <Button 
                    onClick={handleDowngrade}
                    disabled={isProcessing}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    {isProcessing ? "Processing..." : "Confirm Downgrade"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
