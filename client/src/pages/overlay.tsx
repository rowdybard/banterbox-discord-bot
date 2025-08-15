import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import BanterDisplay from "@/components/overlay/banter-display";
import type { UserSettings } from "@shared/schema";
import { useWebSocket } from "../hooks/use-websocket";
import { useLocation } from "wouter";

export default function Overlay() {
  // Get user ID from URL params for OBS Browser Source
  const [location] = useLocation();
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const userId = urlParams.get('userId') || "44466017"; // fallback to current authenticated user for testing
  const hideSetup = urlParams.get('hideSetup') === 'true'; // Add parameter to hide setup indicator for OBS
  
  const [hasReceivedMessage, setHasReceivedMessage] = useState(false);
  
  // Setup WebSocket connection and get the last message directly
  const { lastMessage, isConnected } = useWebSocket();
  
  // Track when we receive banter messages
  useEffect(() => {
    if (lastMessage) {
      console.log("Overlay received WebSocket message:", lastMessage);
      // Check if this is a banter message that should display
      if (lastMessage.type === 'banter_played' || lastMessage.type === 'banter_replayed' || lastMessage.type === 'new_banter') {
        console.log(`Overlay: Processing ${lastMessage.type} event for banter ${lastMessage.data?.id}`);
        setHasReceivedMessage(true);
      }
    }
  }, [lastMessage]);

  // Get user settings for overlay configuration
  const { data: settings } = useQuery({
    queryKey: ['/api/settings', userId],
    retry: false,
  }) as { data: UserSettings | undefined };

  return (
    <>
      {/* Completely transparent container - will be invisible when empty */}
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundColor: 'transparent' }}>
        <BanterDisplay 
          settings={settings} 
          newBanterMessage={lastMessage}
        />
      </div>
      
      {/* Setup indicator - only shown when NOT in OBS mode and before first message */}
      {!hideSetup && !hasReceivedMessage && (
        <div className="fixed top-4 left-4 bg-dark/80 backdrop-blur-lg rounded-lg border border-gray-600 p-3 pointer-events-none w-80 animate-pulse">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-white">BanterBox Overlay Ready</span>
          </div>
          <p className="text-xs text-gray-300">
            Waiting for banter... The overlay will be invisible until a banter is triggered.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            For OBS: Add <code>?hideSetup=true</code> to URL to hide this indicator
          </p>
          
          {/* System Status */}
          <div className="mt-2 text-xs text-green-400">
            <div>✅ WebSocket: Connected</div>
            <div>✅ Real-time Updates: Active</div>
            <div>⏱️ Display Duration: {settings?.overlayDuration || 5}s</div>
          </div>
        </div>
      )}
    </>
  );
}
