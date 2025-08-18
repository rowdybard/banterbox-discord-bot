import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import ControlPanel from "@/components/dashboard/control-panel";
import { BanterHistory } from "@/components/dashboard/banter-history";
import BanterQueue from "@/components/dashboard/banter-queue";
import StatsUpgrade from "@/components/dashboard/stats-upgrade";
import { UsageDashboard } from "@/components/dashboard/usage-dashboard";
import BillingDashboard from "@/components/dashboard/billing-dashboard";
import UserDebug from "@/components/dashboard/user-debug";
import { AuthDebug } from "@/components/ui/auth-debug";
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
                  <i className="fas fa-chart-line text-white text-lg"></i>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    Dashboard
                  </h1>
                  <p className="text-xs text-gray-400">Monitor and control your BanterBox</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Control Panel */}
          <div className="lg:col-span-2 xl:col-span-1">
            <ControlPanel userId={userId} user={user} />
          </div>

          {/* User Debug (for testing) */}
          <div className="lg:col-span-2 xl:col-span-1">
            <UserDebug />
          </div>

          {/* Auth Debug (for testing) */}
          <div className="lg:col-span-2 xl:col-span-1">
            <AuthDebug />
          </div>



          {/* Banter Queue */}
          <div className="lg:col-span-2 xl:col-span-1">
            <BanterQueue userId={userId} />
          </div>

          {/* Usage Dashboard */}
          <div className="lg:col-span-2 xl:col-span-1">
            <UsageDashboard userId={userId} user={user} />
          </div>

          {/* Stats & Upgrade */}
          <div className="lg:col-span-2 xl:col-span-1">
            <StatsUpgrade />
          </div>

          {/* Billing Dashboard */}
          <div className="lg:col-span-2 xl:col-span-1">
            <BillingDashboard />
          </div>

          {/* Banter History */}
          <div className="lg:col-span-2 xl:col-span-3">
            <BanterHistory userId={userId} />
          </div>
        </div>
      </main>
    </div>
  );
}
