import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudio } from "../../hooks/use-audio";
import type { UserSettings, BanterItem } from "@shared/schema";

interface BanterDisplayProps {
  settings?: UserSettings;
  newBanterMessage?: any;
}

export default function BanterDisplay({ settings, newBanterMessage }: BanterDisplayProps) {
  const [currentBanter, setCurrentBanter] = useState<BanterItem | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hideTimeoutId, setHideTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const { playAudio } = useAudio();

  useEffect(() => {
    // Only process if we have a new message
    if (!newBanterMessage) return;
    
    console.log('BanterDisplay received message:', newBanterMessage);
    
    // Handle all banter message types that should display in overlay
    if (newBanterMessage.type === 'new_banter' || newBanterMessage.type === 'banter_played' || newBanterMessage.type === 'banter_replayed') {
      const banter = newBanterMessage.data || newBanterMessage.banter;
      console.log('Processing banter:', banter, 'Type:', newBanterMessage.type);
      
      // Only show banter if it has text content
      if (banter && banter.banterText) {
        // Clear any existing timeout
        if (hideTimeoutId) {
          clearTimeout(hideTimeoutId);
          setHideTimeoutId(null);
        }
        
        setCurrentBanter(banter);
        setIsVisible(true);

        // Play audio if available and autoplay is enabled
        if (banter.audioUrl && settings?.autoPlay) {
          console.log('Playing audio:', banter.audioUrl, 'Volume:', settings?.volume);
          // Convert database volume (0-100) to audio volume (0-1)
          const audioVolume = (settings?.volume || 70) / 100;
          playAudio(banter.audioUrl, banter.id, audioVolume);
        }

        // Hide after duration - default to 12 seconds for better readability
        const duration = (settings?.overlayDuration || 12) * 1000;
        console.log('Banter will hide after', duration, 'ms');
        const newTimeoutId = setTimeout(() => {
          console.log('Hiding banter');
          setIsVisible(false);
          setTimeout(() => {
            console.log('Clearing banter');
            setCurrentBanter(null);
          }, 500); // Clear after animation
        }, duration);
        
        setHideTimeoutId(newTimeoutId);
      }
    }
  }, [newBanterMessage, settings?.autoPlay, settings?.overlayDuration, playAudio]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutId) {
        clearTimeout(hideTimeoutId);
      }
    };
  }, [hideTimeoutId]);

  if (!currentBanter || !isVisible) {
    return null;
  }

  // Fixed position for OBS - streamers will position the browser source
  const getPositionClasses = () => {
    return 'top-4 left-4'; // Simple top-left positioning for OBS
  };

  const getAnimationVariants = () => {
    switch (settings?.overlayAnimation) {
      case 'slide':
        return {
          initial: { y: 50, opacity: 0 },
          animate: { y: 0, opacity: 1 },
          exit: { y: 50, opacity: 0 }
        };
      case 'scale':
        return {
          initial: { scale: 0.8, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          exit: { scale: 0.8, opacity: 0 }
        };
      default: // fade
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 }
        };
    }
  };

  return (
    <div className={`fixed pointer-events-none z-50 ${getPositionClasses()}`}>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            {...getAnimationVariants()}
            transition={{ duration: 0.5 }}
            className="bg-dark/90 backdrop-blur-lg rounded-2xl border border-gray-700 p-4 w-80 shadow-2xl"
            data-testid="overlay-banter-display"
          >
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center">
                <i className="fas fa-microphone-alt text-white text-sm"></i>
              </div>
              <div>
                <p className="text-sm font-medium text-white">BanterBox</p>
                <p className="text-xs text-gray-400">
                  {(currentBanter.eventData as any)?.username && `Responding to @${(currentBanter.eventData as any).username}`}
                </p>
              </div>
            </div>
            
            {/* Animated Waveform */}
            <div className="flex items-center space-x-1 mb-4">
              {[12, 24, 18, 30, 15, 28, 20, 32].map((height, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full animate-pulse ${
                    i % 3 === 0 ? 'bg-primary' : i % 3 === 1 ? 'bg-secondary' : 'bg-accent'
                  }`}
                  style={{ 
                    height: `${height}px`,
                    animationDelay: `${i * 0.1}s`
                  }}
                ></div>
              ))}
            </div>
            
            <p className="text-lg font-medium text-white leading-relaxed" data-testid="text-current-banter">
              "{currentBanter.banterText}"
            </p>
            
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-gray-400">
                Powered by {settings?.voiceProvider === 'elevenlabs' ? 'ElevenLabs' : 'OpenAI'}
              </span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-400">Playing</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
