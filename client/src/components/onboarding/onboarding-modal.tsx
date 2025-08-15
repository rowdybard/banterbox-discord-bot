import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, X, Play, Settings, Twitch, Mic } from "lucide-react";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const onboardingSteps = [
  {
    id: 1,
    title: "Welcome to BanterBox!",
    content: "Your AI-powered streaming companion that generates witty responses to chat interactions, subscriptions, and donations in real-time.",
    icon: <Mic className="w-8 h-8 text-primary" />,
    highlight: "Get started with intelligent stream banter"
  },
  {
    id: 2,
    title: "Connect Your Twitch",
    content: "Link your Twitch account to automatically generate banters from chat messages, follows, subscriptions, and raids.",
    icon: <Twitch className="w-8 h-8 text-purple-500" />,
    highlight: "Real-time event processing",
    action: "Go to Settings → Twitch to connect"
  },
  {
    id: 3,
    title: "Set Up Your Overlay",
    content: "Add the overlay URL to OBS as a Browser Source. Position and resize it wherever you want on your stream.",
    icon: <Play className="w-8 h-8 text-green-500" />,
    highlight: "Seamless OBS integration",
    action: "Copy overlay URL from dashboard"
  },
  {
    id: 4,
    title: "Configure Your Voice",
    content: "Choose your preferred voice settings. Pro users get access to premium ElevenLabs voices with natural-sounding speech.",
    icon: <Settings className="w-8 h-8 text-blue-500" />,
    highlight: "Customize audio experience",
    action: "Adjust voice settings in Control Panel"
  },
  {
    id: 5,
    title: "You're All Set!",
    content: "Start streaming and watch as BanterBox automatically generates engaging responses to keep your audience entertained.",
    icon: <div className="w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center text-white font-bold">✓</div>,
    highlight: "Ready to enhance your stream!",
    limits: "Free tier: 50 banters per day"
  }
];

export function OnboardingModal({ isOpen, onClose, onComplete }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
    onClose();
  };

  const step = onboardingSteps[currentStep];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-dark border-gray-700">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-xl font-bold text-white">
            Getting Started
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress indicator */}
          <div className="flex justify-center space-x-2">
            {onboardingSteps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep ? 'bg-primary' :
                  index < currentStep ? 'bg-primary/60' : 'bg-gray-600'
                }`}
              />
            ))}
          </div>

          {/* Step content */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              {step.icon}
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-white">
                {step.title}
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                {step.content}
              </p>
            </div>

            {step.highlight && (
              <Badge className="bg-primary/20 text-primary border-primary/30">
                {step.highlight}
              </Badge>
            )}

            {step.action && (
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                <p className="text-xs text-gray-400 font-medium">
                  Quick Action:
                </p>
                <p className="text-sm text-white">
                  {step.action}
                </p>
              </div>
            )}

            {step.limits && (
              <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/30">
                <p className="text-xs text-amber-400 font-medium">
                  Usage Limits:
                </p>
                <p className="text-sm text-amber-300">
                  {step.limits}
                </p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="text-gray-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>

            <span className="text-xs text-gray-500">
              {currentStep + 1} of {onboardingSteps.length}
            </span>

            <Button
              size="sm"
              onClick={handleNext}
              className="bg-primary hover:bg-primary/80"
            >
              {currentStep === onboardingSteps.length - 1 ? (
                "Get Started"
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>

          {/* Skip option */}
          {currentStep < onboardingSteps.length - 1 && (
            <div className="text-center pt-2">
              <Button
                variant="link"
                size="sm"
                onClick={handleSkip}
                className="text-xs text-gray-500 hover:text-gray-400"
              >
                Skip tutorial
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}