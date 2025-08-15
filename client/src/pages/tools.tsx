import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { ExportData } from "@/components/dashboard/export-data";
import { BackupSystem } from "@/components/dashboard/backup-system";
import { LoadingState } from "@/components/ui/loading-state";

export default function Tools() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopMenuOpen, setIsDesktopMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const userId = user?.id || "demo-user";

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

  if (!user) {
    return <LoadingState />;
  }

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
                        className="w-full text-left px-4 py-3 text-sm text-white bg-primary/20 transition-colors flex items-center space-x-3"
                        data-testid="menu-tools"
                      >
                        <i className="fas fa-tools w-4"></i>
                        <span>Tools</span>
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
                      className="px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 rounded-lg transition-colors"
                      data-testid="button-upgrade"
                    >
                      <i className="fas fa-crown mr-2"></i>
                      Upgrade to Pro
                    </button>
                  </Link>
                )}
              </nav>

              {/* User Menu */}
              <div className="relative" ref={desktopMenuRef}>
                <button
                  onClick={() => setIsDesktopMenuOpen(!isDesktopMenuOpen)}
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-700 transition-colors"
                  data-testid="button-user-menu-desktop"
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
                  <i className="fas fa-chevron-down text-xs text-gray-400"></i>
                </button>

                {/* Desktop User Menu Dropdown */}
                {isDesktopMenuOpen && (
                  <div className="absolute right-0 top-12 w-64 bg-dark border border-gray-700 rounded-lg shadow-xl z-50">
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
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Data Management Tools</h2>
          <p className="text-gray-400">Export your banter history and manage backups</p>
        </div>

        {/* Tools Grid */}
        <section className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ExportData userId={userId} />
            <BackupSystem userId={userId} />
          </div>
        </section>
      </main>
    </div>
  );
}