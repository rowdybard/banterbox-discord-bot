import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import ControlPanel from "@/components/dashboard/control-panel";
import { BanterHistory } from "@/components/dashboard/banter-history";
import BanterQueue from "@/components/dashboard/banter-queue";
import StatsUpgrade from "@/components/dashboard/stats-upgrade";
import { UsageDashboard } from "@/components/dashboard/usage-dashboard";
import BillingDashboard from "@/components/dashboard/billing-dashboard";
import { LoadingState } from "@/components/ui/loading-state";

export default function Dashboard() {
  const { user } = useAuth();
  const [location] = useLocation();
  const userId = user?.id || "demo-user";

  if (!user) {
    return (
      <LoadingState isLoading={true}>
        <div>Loading...</div>
      </LoadingState>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-dark/95 backdrop-blur-lg border-b border-gray-800 sticky top-0 z-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Title */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center">
                  <i className="fas fa-tachometer-alt text-white text-lg"></i>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    Dashboard
                  </h1>
                  <p className="text-xs text-gray-400">Welcome back, {user?.firstName || 'User'}! 🎉</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Control Panel */}
          <ControlPanel userId={userId} />
          
          {/* Stats and Usage */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <StatsUpgrade userId={userId} />
            <UsageDashboard userId={userId} />
          </div>
          
          {/* Billing Dashboard */}
          <BillingDashboard />
          
          {/* Banter History and Queue */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <BanterHistory userId={userId} />
            <BanterQueue userId={userId} />
          </div>
        </div>
      </main>
    </div>
  );
}
