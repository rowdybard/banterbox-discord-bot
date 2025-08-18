import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Dashboard from "@/pages/dashboard";
import Tools from "@/pages/tools";
import Overlay from "@/pages/overlay";
import Settings from "@/pages/settings";

import Marketplace from "@/pages/marketplace";
import PersonalityBuilder from "@/pages/personality-builder";
import VoiceBuilder from "@/pages/voice-builder";
import VoiceMarketplace from "@/pages/voice-marketplace";
import ProPage from "@/pages/pro";
import PricingPage from "@/pages/pricing";
import BillingPage from "@/pages/billing";
import Landing from "@/pages/landing";
import Auth from "@/pages/auth";
import NotFound from "@/pages/not-found";
import MobileNav from "./components/ui/mobile-nav";
import DesktopNav from "./components/ui/desktop-nav";
import { OfflineBanner } from "@/components/ui/offline-banner";

function AuthenticatedNav() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? (
    <>
      <DesktopNav />
      <MobileNav />
    </>
  ) : null;
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <>{children}</>;
  }
  
  return (
    <div className="md:ml-64 pb-20 md:pb-0">
      {children}
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/auth" component={Auth} />
        </>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/tools" component={Tools} />
          <Route path="/settings" component={Settings} />
          <Route path="/marketplace" component={Marketplace} />
          <Route path="/voice-marketplace" component={VoiceMarketplace} />
          <Route path="/personality-builder" component={PersonalityBuilder} />
          <Route path="/voice-builder" component={VoiceBuilder} />
          <Route path="/pro" component={ProPage} />
          <Route path="/pricing" component={PricingPage} />
          <Route path="/billing" component={BillingPage} />
        </>
      )}
      {/* Auth page is always accessible */}
      <Route path="/auth" component={Auth} />
      {/* Overlay is always public */}
      <Route path="/overlay" component={Overlay} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-gradient-to-br from-dark via-dark-lighter to-gray-900">
          <OfflineBanner />
          <Toaster />
          <AuthenticatedLayout>
            <Router />
          </AuthenticatedLayout>
          <AuthenticatedNav />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
