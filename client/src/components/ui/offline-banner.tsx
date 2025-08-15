import { useState } from "react";
import { WifiOff, Wifi, AlertTriangle, X } from "lucide-react";
import { useOffline } from "@/hooks/use-offline";

export function OfflineBanner() {
  const { isOffline, connectionQuality, hasPoorConnection } = useOffline();
  const [isDismissed, setIsDismissed] = useState(false);

  if (!isOffline && !hasPoorConnection) return null;
  if (isDismissed) return null;

  const isFullyOffline = isOffline;
  const showBanner = isFullyOffline || hasPoorConnection;

  if (!showBanner) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-white text-sm flex items-center justify-between ${
      isFullyOffline ? 'bg-red-600' : 'bg-orange-600'
    }`}>
      <div className="flex items-center gap-2">
        {isFullyOffline ? (
          <WifiOff className="h-4 w-4" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        )}
        <span>
          {isFullyOffline
            ? "You're offline. Some features may not work properly."
            : "Poor connection detected. Real-time features may be delayed."
          }
        </span>
      </div>
      
      <button
        onClick={() => setIsDismissed(true)}
        className="p-1 hover:bg-white/20 rounded"
        data-testid="button-dismiss-offline-banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

interface OfflineFallbackProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function OfflineFallback({ children, fallback }: OfflineFallbackProps) {
  const { isOffline } = useOffline();

  if (isOffline && fallback) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export function OfflineIndicator() {
  const { isOffline, connectionQuality } = useOffline();

  return (
    <div className="flex items-center gap-2 text-xs">
      {isOffline ? (
        <>
          <WifiOff className="h-3 w-3 text-red-400" />
          <span className="text-red-400">Offline</span>
        </>
      ) : (
        <>
          <Wifi className={`h-3 w-3 ${
            connectionQuality === 'good' ? 'text-green-400' : 
            connectionQuality === 'poor' ? 'text-orange-400' : 'text-red-400'
          }`} />
          <span className={
            connectionQuality === 'good' ? 'text-green-400' : 
            connectionQuality === 'poor' ? 'text-orange-400' : 'text-red-400'
          }>
            {connectionQuality === 'good' ? 'Online' : 'Poor Connection'}
          </span>
        </>
      )}
    </div>
  );
}