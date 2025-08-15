import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { DailyStats } from "@shared/schema";

interface StatsUpgradeProps {
  stats?: DailyStats;
}

export default function StatsUpgrade({ stats }: StatsUpgradeProps) {
  const usagePercentage = stats ? ((stats.bantersGenerated || 0) / 50) * 100 : 0;
  const audioMinutes = stats ? Math.floor((stats.audioGenerated || 0) / 60) : 0;

  return (
    <>
      {/* Usage Stats */}
      <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
        <CardContent className="p-6">
          <h3 className="text-xl font-semibold text-white mb-6">Today's Stats</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-800/50 rounded-lg">
              <div className="text-2xl font-bold text-primary" data-testid="text-banters-generated">
                {stats?.bantersGenerated || 0}
              </div>
              <div className="text-sm text-gray-400">Banters Generated</div>
            </div>
            <div className="text-center p-4 bg-gray-800/50 rounded-lg">
              <div className="text-2xl font-bold text-secondary" data-testid="text-chat-responses">
                {stats?.chatResponses || 0}
              </div>
              <div className="text-sm text-gray-400">Chat Responses</div>
            </div>
            <div className="text-center p-4 bg-gray-800/50 rounded-lg">
              <div className="text-2xl font-bold text-accent" data-testid="text-audio-generated">
                {audioMinutes}m
              </div>
              <div className="text-sm text-gray-400">Audio Generated</div>
            </div>
            <div className="text-center p-4 bg-gray-800/50 rounded-lg">
              <div className="text-2xl font-bold text-neon-purple" data-testid="text-viewer-engagement">
                {stats?.viewerEngagement || 0}%
              </div>
              <div className="text-sm text-gray-400">Viewer Engagement</div>
            </div>
          </div>
          
          {/* Free Tier Limits */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <i className="fas fa-exclamation-triangle text-yellow-500"></i>
              <span className="text-sm font-medium text-yellow-400">Free Tier Limits</span>
            </div>
            <p className="text-sm text-gray-300 mb-2" data-testid="text-usage-limit">
              You've used {stats?.bantersGenerated || 0}/50 daily banters
            </p>
            <Progress 
              value={usagePercentage} 
              className="w-full h-2 bg-gray-800"
              data-testid="progress-usage"
            />
          </div>
        </CardContent>
      </Card>

      {/* Upgrade to Pro */}
      <Card className="bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 border-primary/30">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-primary to-secondary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-crown text-white text-xl"></i>
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-2">Upgrade to Pro</h3>
            <p className="text-gray-300 mb-6">
              Unlock premium voices, unlimited banters, and advanced customization
            </p>
            
            {/* Feature List */}
            <div className="space-y-3 mb-6 text-left">
              {[
                'Unlimited daily banters',
                'ElevenLabs premium voices',
                'Custom voice cloning',
                'Advanced overlay customization',
                'Priority support'
              ].map((feature, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <i className="fas fa-check text-accent"></i>
                  <span className="text-sm text-gray-300">{feature}</span>
                </div>
              ))}
            </div>
            
            {/* Pricing */}
            <div className="bg-dark/50 rounded-lg p-4 mb-6">
              <div className="flex items-baseline justify-center space-x-1">
                <span className="text-3xl font-bold text-white" data-testid="text-price">$9.99</span>
                <span className="text-gray-400">/month</span>
              </div>
              <p className="text-sm text-gray-400 mt-1">Cancel anytime</p>
            </div>
            
            <Button
              className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-white font-semibold"
              data-testid="button-start-trial"
            >
              Start 7-Day Free Trial
            </Button>
            
            <p className="text-xs text-gray-400 mt-3">No credit card required</p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
