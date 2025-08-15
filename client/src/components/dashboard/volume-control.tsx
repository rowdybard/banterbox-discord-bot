import { useState, useEffect } from "react";
import { Volume2, VolumeX, Volume1 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

interface VolumeControlProps {
  onVolumeChange?: (volume: number) => void;
  currentVolume?: number;
}

export function VolumeControl({ onVolumeChange, currentVolume }: VolumeControlProps) {
  const [volume, setVolume] = useState(currentVolume ? Math.round(currentVolume * 100) : 80);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(80);

  // Sync with external volume changes
  useEffect(() => {
    if (currentVolume !== undefined) {
      const volPercent = Math.round(currentVolume * 100);
      setVolume(volPercent);
      setIsMuted(volPercent === 0);
    }
  }, [currentVolume]);

  // Load volume from localStorage on mount
  useEffect(() => {
    const savedVolume = localStorage.getItem('banterbox-volume');
    const savedMuted = localStorage.getItem('banterbox-muted');
    
    if (savedVolume) {
      const vol = parseInt(savedVolume, 10);
      setVolume(vol);
      onVolumeChange?.(vol / 100);
    }
    
    if (savedMuted === 'true') {
      setIsMuted(true);
      onVolumeChange?.(0);
    }
  }, [onVolumeChange]);

  const handleVolumeChange = (newVolume: number[]) => {
    const vol = newVolume[0];
    setVolume(vol);
    
    if (vol === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
    
    // Save to localStorage
    localStorage.setItem('banterbox-volume', vol.toString());
    localStorage.setItem('banterbox-muted', (vol === 0).toString());
    
    // Notify parent component
    onVolumeChange?.(vol / 100);
  };

  const toggleMute = () => {
    if (isMuted) {
      // Unmute: restore previous volume
      const restoreVolume = previousVolume || 80;
      setVolume(restoreVolume);
      setIsMuted(false);
      localStorage.setItem('banterbox-volume', restoreVolume.toString());
      localStorage.setItem('banterbox-muted', 'false');
      onVolumeChange?.(restoreVolume / 100);
    } else {
      // Mute: save current volume and set to 0
      setPreviousVolume(volume);
      setVolume(0);
      setIsMuted(true);
      localStorage.setItem('banterbox-muted', 'true');
      onVolumeChange?.(0);
    }
  };

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return VolumeX;
    if (volume < 50) return Volume1;
    return Volume2;
  };

  const VolumeIcon = getVolumeIcon();

  return (
    <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <VolumeIcon className="h-4 w-4" />
          Audio Volume
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2 space-y-4">
        <div className="flex items-center space-x-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleMute}
            className="w-8 h-8 p-0 rounded-full"
            data-testid="button-volume-toggle"
          >
            <VolumeIcon className="w-4 h-4" />
          </Button>
          
          <div className="flex-1">
            <Slider
              value={[isMuted ? 0 : volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={5}
              className="w-full"
              data-testid="slider-volume"
            />
          </div>
          
          <span className="text-xs text-gray-400 min-w-[3ch]">
            {isMuted ? '0%' : `${volume}%`}
          </span>
        </div>
        
        {/* Quick Volume Presets */}
        <div className="flex justify-between">
          {[25, 50, 75, 100].map((preset) => (
            <Button
              key={preset}
              size="sm"
              variant="ghost"
              onClick={() => handleVolumeChange([preset])}
              className={`text-xs px-2 py-1 h-6 ${volume === preset ? 'bg-primary/20 text-primary' : 'text-gray-400'}`}
              data-testid={`button-volume-preset-${preset}`}
            >
              {preset}%
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}