import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import ControlPanel from "@/components/dashboard/control-panel";
import BanterQueue from "@/components/dashboard/banter-queue";
import OverlayPreview from "@/components/dashboard/overlay-preview";
import StatsUpgrade from "@/components/dashboard/stats-upgrade";
import { UsageDashboard } from "@/components/dashboard/usage-dashboard";
import { OnboardingModal } from "@/components/onboarding/onboarding-modal";
import { BanterHistory } from "@/components/dashboard/banter-history";
import UnifiedSettings from "@/components/dashboard/unified-settings";


import { LoadingState } from "@/components/ui/loading-state";
import { ErrorDisplay } from "@/components/ui/error-display";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import type { UserSettings, DailyStats, User } from "@shared/schema";
import { useWebSocket } from "../hooks/use-websocket";
import { useAudio } from "@/hooks/use-audio";

export default function Dashboard() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopMenuOpen, setIsDesktopMenuOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const userId = user?.id || "demo-user";

  // Check if user should see onboarding
  useEffect(() => {
    if (user && !user.hasCompletedOnboarding) {
      setIsOnboardingOpen(true);
    }
  }, [user]);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
      if (desktopMenuRef.current && !desktopMenuRef.current.contains(event.target as Node)) {
        setIsDesktopMenuOpen(false);
      }
    }

    if (isMobileMenuOpen || isDesktopMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMobileMenuOpen, isDesktopMenuOpen]);
  
  // Setup WebSocket connection and audio
  useWebSocket();
  const { updateVolume, volume } = useAudio();

  // Get user settings
  const { data: settings } = useQuery({
    queryKey: ['/api/settings', userId],
  }) as { data: UserSettings | undefined };

  // Get daily stats
  const { data: stats } = useQuery({
    queryKey: ['/api/stats', userId],
  }) as { data: DailyStats | undefined };

  // Complete onboarding mutation
  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/user/complete-onboarding");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
  });

  const handleOnboardingComplete = () => {
    completeOnboardingMutation.mutate();
    setIsOnboardingOpen(false);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-dark/80 backdrop-blur-lg border-b border-gray-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center">
                  <i className="fas fa-microphone-alt text-white text-sm"></i>
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  BanterBox
                </h1>
              </div>
            </div>
            
            {/* Mobile Menu Button */}
            <div className="md:hidden relative" ref={mobileMenuRef}>
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="w-10 h-10 rounded-lg bg-dark-lighter border border-gray-700 flex items-center justify-center hover:bg-gray-700 transition-colors"
                data-testid="button-mobile-menu"
              >
                <i className={`fas ${isMobileMenuOpen ? 'fa-times' : 'fa-bars'} text-gray-300`}></i>
              </button>

              {/* Mobile Menu Dropdown */}
              {isMobileMenuOpen && (
                <div className="absolute right-0 top-12 w-64 bg-dark border border-gray-700 rounded-lg shadow-xl z-50">
                  {/* User Info Section */}
                  <div className="p-4 border-b border-gray-700">
                    <div className="flex items-center space-x-3">
                      {user?.profileImageUrl ? (
                        <img 
                          src={user.profileImageUrl} 
                          alt="Profile" 
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold">
                            {user?.firstName?.[0] || user?.email?.[0] || 'U'}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {user?.firstName || 'User'}
                          {user?.lastName && ` ${user.lastName}`}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {user?.email || 'user@example.com'}
                        </p>
                        {user?.isPro && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gradient-to-r from-primary to-secondary text-white">
                            <i className="fas fa-crown text-xs mr-1"></i>
                            Pro
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Navigation Links */}
                  <div className="py-2">
                    <Link href="/dashboard">
                      <button 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center space-x-3"
                        data-testid="menu-dashboard"
                      >
                        <i className="fas fa-tachometer-alt w-4"></i>
                        <span>Dashboard</span>
                      </button>
                    </Link>
                    <Link href="/tools">
                      <button 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center space-x-3"
                        data-testid="menu-tools"
                      >
                        <i className="fas fa-tools w-4"></i>
                        <span>Tools</span>
                      </button>
                    </Link>
                    <Link href="/marketplace">
                      <button 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center space-x-3"
                        data-testid="menu-marketplace"
                      >
                        <i className="fas fa-store w-4"></i>
                        <span>Marketplace</span>
                      </button>
                    </Link>
                    <Link href="/personality-builder">
                      <button 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center space-x-3"
                        data-testid="menu-personality-builder"
                      >
                        <i className="fas fa-brain w-4"></i>
                        <span>AI Builder</span>
                      </button>
                    </Link>
                    <Link href="/overlay">
                      <button 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center space-x-3"
                        data-testid="menu-overlay"
                      >
                        <i className="fas fa-layer-group w-4"></i>
                        <span>Overlay</span>
                      </button>
                    </Link>
                    <Link href="/settings">
                      <button 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center space-x-3"
                        data-testid="menu-settings"
                      >
                        <i className="fas fa-cog w-4"></i>
                        <span>Settings</span>
                      </button>
                    </Link>
                    {!user?.isPro && (
                      <Link href="/pro">
                        <button 
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="w-full text-left px-4 py-3 text-sm text-primary hover:bg-primary/10 transition-colors flex items-center space-x-3"
                          data-testid="menu-upgrade"
                        >
                          <i className="fas fa-crown w-4"></i>
                          <span>Upgrade to Pro</span>
                        </button>
                      </Link>
                    )}
                  </div>

                  {/* Logout Section */}
                  <div className="border-t border-gray-700 py-2">
                    <button 
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        window.location.href = '/api/logout';
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center space-x-3"
                      data-testid="button-logout"
                    >
                      <i className="fas fa-sign-out-alt w-4"></i>
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              <nav className="flex items-center space-x-6">
                <Link href="/dashboard">
                  <button 
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      location === '/dashboard' || location === '/' 
                        ? 'text-white bg-primary/20' 
                        : 'text-gray-300 hover:text-white'
                    }`}
                    data-testid="button-dashboard"
                  >
                    Dashboard
                  </button>
                </Link>
                <Link href="/tools">
                  <button 
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      location === '/tools' 
                        ? 'text-white bg-primary/20' 
                        : 'text-gray-300 hover:text-white'
                    }`}
                    data-testid="button-tools"
                  >
                    Tools
                  </button>
                </Link>
                <Link href="/marketplace">
                  <button 
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      location === '/marketplace' 
                        ? 'text-white bg-primary/20' 
                        : 'text-gray-300 hover:text-white'
                    }`}
                    data-testid="button-marketplace"
                  >
                    Marketplace
                  </button>
                </Link>
                <Link href="/personality-builder">
                  <button 
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      location === '/personality-builder' 
                        ? 'text-white bg-primary/20' 
                        : 'text-gray-300 hover:text-white'
                    }`}
                    data-testid="button-personality-builder"
                  >
                    AI Builder
                  </button>
                </Link>
                <Link href="/overlay">
                  <button 
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      location === '/overlay' 
                        ? 'text-white bg-primary/20' 
                        : 'text-gray-300 hover:text-white'
                    }`}
                    data-testid="button-overlay"
                  >
                    Overlay
                  </button>
                </Link>
                <Link href="/settings">
                  <button 
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      location === '/settings' 
                        ? 'text-white bg-primary/20' 
                        : 'text-gray-300 hover:text-white'
                    }`}
                    data-testid="button-settings"
                  >
                    Settings
                  </button>
                </Link>
                {!user?.isPro && (
                  <Link href="/pro">
                    <button 
                      className="px-6 py-2 bg-gradient-to-r from-primary to-secondary rounded-lg text-white font-medium hover:shadow-lg hover:shadow-primary/25 transition-all"
                      data-testid="button-upgrade"
                    >
                      Upgrade to Pro
                    </button>
                  </Link>
                )}
              </nav>

              {/* Desktop User Menu */}
              <div className="relative" ref={desktopMenuRef}>
                <button 
                  onClick={() => setIsDesktopMenuOpen(!isDesktopMenuOpen)}
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-700 transition-colors"
                  data-testid="button-user-menu"
                >
                  {user?.profileImageUrl ? (
                    <img 
                      src={user.profileImageUrl} 
                      alt="Profile" 
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-semibold">
                        {user?.firstName?.[0] || user?.email?.[0] || 'U'}
                      </span>
                    </div>
                  )}
                  {user?.isPro && (
                    <i className="fas fa-crown text-primary text-xs"></i>
                  )}
                  <i className={`fas fa-chevron-down text-xs text-gray-400 transition-transform ${isDesktopMenuOpen ? 'rotate-180' : ''}`}></i>
                </button>

                {/* Desktop User Dropdown */}
                {isDesktopMenuOpen && (
                  <div className="absolute right-0 top-12 w-56 bg-dark border border-gray-700 rounded-lg shadow-xl z-50">
                    {/* User Info */}
                    <div className="p-4 border-b border-gray-700">
                      <p className="text-sm font-medium text-white">
                        {user?.firstName || 'User'}
                        {user?.lastName && ` ${user.lastName}`}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {user?.email || 'user@example.com'}
                      </p>
                      {user?.isPro && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gradient-to-r from-primary to-secondary text-white mt-2">
                          <i className="fas fa-crown text-xs mr-1"></i>
                          Pro Member
                        </span>
                      )}
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <Link href="/settings">
                        <button 
                          onClick={() => setIsDesktopMenuOpen(false)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center space-x-3"
                          data-testid="menu-settings-desktop"
                        >
                          <i className="fas fa-cog w-4"></i>
                          <span>Settings</span>
                        </button>
                      </Link>
                      {!user?.isPro && (
                        <Link href="/pro">
                          <button 
                            onClick={() => setIsDesktopMenuOpen(false)}
                            className="w-full text-left px-4 py-2 text-sm text-primary hover:bg-primary/10 transition-colors flex items-center space-x-3"
                            data-testid="menu-upgrade-desktop"
                          >
                            <i className="fas fa-crown w-4"></i>
                            <span>Upgrade to Pro</span>
                          </button>
                        </Link>
                      )}
                    </div>

                    {/* Logout */}
                    <div className="border-t border-gray-700 py-2">
                      <button 
                        onClick={() => {
                          setIsDesktopMenuOpen(false);
                          window.location.href = '/api/logout';
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center space-x-3"
                        data-testid="button-logout-desktop"
                      >
                        <i className="fas fa-sign-out-alt w-4"></i>
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">


        {/* Dashboard Controls */}
        <section className="mb-8">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:w-1/3">
              <ControlPanel userId={userId} settings={settings} user={user} />
            </div>
            <div className="lg:w-2/3">
              <BanterQueue userId={userId} />
            </div>
          </div>
        </section>

        {/* Unified Settings */}
        <section className="mb-8">
          <UnifiedSettings userId={userId} settings={settings} user={user} />
        </section>

        {/* Overlay Preview */}
        <section className="mb-8">
          <OverlayPreview />
        </section>

        {/* Usage Dashboard */}
        <section className="mb-8">
          <UsageDashboard userId={userId} />
        </section>

        {/* Banter Search History */}
        <section className="mb-8">
          <BanterHistory userId={userId} />
        </section>
      </main>

        {/* Onboarding Modal */}
        {user && !user.hasCompletedOnboarding && (
          <OnboardingModal
            isOpen={isOnboardingOpen}
            onClose={() => setIsOnboardingOpen(false)}
            onComplete={handleOnboardingComplete}
          />
        )}
    </div>
  );
}
