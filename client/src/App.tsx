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
import Pro from "@/pages/pro";
import Landing from "@/pages/landing";
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
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/tools" component={Tools} />
          <Route path="/settings" component={Settings} />
          <Route path="/pro" component={Pro} />
        </>
      )}
      {/* Overlay is always public for OBS integration */}
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
