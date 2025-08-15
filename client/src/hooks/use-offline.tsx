import { useState, useEffect } from "react";

export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'offline'>('good');

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      setConnectionQuality('good');
    }

    function handleOffline() {
      setIsOnline(false);
      setConnectionQuality('offline');
    }

    // Test connection quality periodically
    const testConnection = async () => {
      if (!navigator.onLine) {
        setConnectionQuality('offline');
        return;
      }

      try {
        const start = Date.now();
        const response = await fetch('/api/health', { 
          method: 'HEAD',
          cache: 'no-cache',
        });
        const duration = Date.now() - start;

        if (response.ok) {
          setConnectionQuality(duration > 3000 ? 'poor' : 'good');
        } else {
          setConnectionQuality('poor');
        }
      } catch {
        setConnectionQuality('poor');
      }
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Test connection quality every 30 seconds
    const connectionTest = setInterval(testConnection, 30000);

    // Initial test
    testConnection();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(connectionTest);
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    connectionQuality,
    hasGoodConnection: connectionQuality === 'good',
    hasPoorConnection: connectionQuality === 'poor',
  };
}