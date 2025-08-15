import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UserSettings } from "@shared/schema";

interface OverlayPreviewProps {
  settings?: UserSettings;
  userId?: string;
}

export default function OverlayPreview({ settings, userId = "demo-user" }: OverlayPreviewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<UserSettings>) => {
      const response = await apiRequest("PUT", `/api/settings/${userId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings', userId] });
      toast({
        title: "Settings updated",
        description: "Overlay settings have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update overlay settings.",
        variant: "destructive",
      });
    },
  });
  const copyOverlayUrl = () => {
    const url = `${window.location.origin}/overlay?userId=${userId}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "URL Copied", 
      description: "Overlay URL with your user ID copied to clipboard. Add this as a Browser Source in OBS.",
    });
  };

  const openCustomize = () => {
    setIsCustomizeOpen(true);
  };

  return (
    <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Overlay Preview</h2>
          <div className="flex items-center space-x-3">
            <Dialog open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen}>
              <DialogTrigger asChild>
                <button 
                  onClick={openCustomize}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                  data-testid="button-customize"
                >
                  Customize
                </button>
              </DialogTrigger>
              <DialogContent className="bg-dark border-gray-800 text-white max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Overlay Customization</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 p-6">
                  {/* Theme Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Overlay Theme
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 border border-gray-700 rounded-lg cursor-pointer hover:border-primary transition-colors">
                        <div className="text-sm font-medium text-white mb-1">Default</div>
                        <div className="text-xs text-gray-400">Gradient background with animations</div>
                      </div>
                      <div className="p-3 border border-gray-700 rounded-lg cursor-pointer hover:border-primary transition-colors opacity-50">
                        <div className="text-sm font-medium text-white mb-1">Minimal (Pro)</div>
                        <div className="text-xs text-gray-400">Clean text-only design</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Color Customization */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Brand Colors (Pro)
                    </label>
                    <div className="grid grid-cols-3 gap-3 opacity-50">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Primary</label>
                        <div className="w-full h-8 bg-primary rounded border border-gray-700"></div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Secondary</label>
                        <div className="w-full h-8 bg-secondary rounded border border-gray-700"></div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Accent</label>
                        <div className="w-full h-8 bg-accent rounded border border-gray-700"></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Size Options */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Size
                    </label>
                    <Select defaultValue="medium">
                      <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="text-center pt-4">
                    <p className="text-sm text-gray-400 mb-4">
                      Advanced customization options available with Pro
                    </p>
                    <Button className="bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80">
                      Upgrade to Pro
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              onClick={copyOverlayUrl}
              variant="outline"
              size="sm"
              className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700"
              data-testid="button-copy-url"
            >
              Copy URL
            </Button>
          </div>
        </div>
        
        {/* Overlay Simulator */}
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          {/* Simulated Stream Background */}
          <img 
            src="https://images.unsplash.com/photo-1542751371-adc38448a05e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1920&h=1080" 
            alt="Gaming setup background" 
            className="absolute inset-0 w-full h-full object-cover opacity-40" 
          />
          
          {/* Overlay Elements */}
          <div className="absolute inset-0 flex items-end justify-center p-6">
            <div className="bg-dark/90 backdrop-blur-lg rounded-2xl border border-gray-700 p-6 max-w-2xl mx-auto transform transition-all duration-500">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center">
                  <i className="fas fa-microphone-alt text-white text-sm"></i>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">BanterBox</p>
                  <p className="text-xs text-gray-400">Responding to @viewer123</p>
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
              
              <p className="text-lg font-medium text-white leading-relaxed" data-testid="text-preview-banter">
                "Oh really? Unlike your chat game which is absolutely riveting! 😄"
              </p>
              
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-gray-400">Powered by OpenAI</span>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
                  <span className="text-xs text-gray-400">Playing</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Overlay Settings */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Position
            </label>
            <Select 
              defaultValue={settings?.overlayPosition || "bottom-center"} 
              onValueChange={(value) => updateSettingsMutation.mutate({ overlayPosition: value })}
              data-testid="select-position"
            >
              <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="bottom-center">Bottom Center</SelectItem>
                <SelectItem value="bottom-left">Bottom Left</SelectItem>
                <SelectItem value="bottom-right">Bottom Right</SelectItem>
                <SelectItem value="top-center">Top Center</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Duration
            </label>
            <Select 
              defaultValue={`${settings?.overlayDuration || 5}`} 
              onValueChange={(value) => updateSettingsMutation.mutate({ overlayDuration: parseInt(value) })}
              data-testid="select-duration"
            >
              <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="3">3 seconds</SelectItem>
                <SelectItem value="5">5 seconds</SelectItem>
                <SelectItem value="7">7 seconds</SelectItem>
                <SelectItem value="10">10 seconds</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Animation
            </label>
            <Select 
              defaultValue={settings?.overlayAnimation || "fade"} 
              onValueChange={(value) => updateSettingsMutation.mutate({ overlayAnimation: value })}
              data-testid="select-animation"
            >
              <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="fade">Fade In/Out</SelectItem>
                <SelectItem value="slide">Slide Up</SelectItem>
                <SelectItem value="scale">Scale In</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
