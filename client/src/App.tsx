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
import Pro from "@/pages/pro";
import Landing from "@/pages/landing";
import Auth from "@/pages/auth";
import NotFound from "@/pages/not-found";
import MobileNav from "./components/ui/mobile-nav";
import { OfflineBanner } from "@/components/ui/offline-banner";

function AuthenticatedMobileNav() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <MobileNav /> : null;
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
          <Route path="/pro" component={Pro} />
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
          <Router />
          <AuthenticatedMobileNav />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
