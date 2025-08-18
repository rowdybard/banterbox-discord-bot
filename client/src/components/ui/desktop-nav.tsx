import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

export default function DesktopNav() {
  const [location, setLocation] = useLocation();

  const navItems = [
    { path: "/dashboard", icon: "fas fa-tachometer-alt", label: "Dashboard" },
    { path: "/tools", icon: "fas fa-tools", label: "Tools" },
    { path: "/voice-marketplace", icon: "fas fa-microphone", label: "Voice Marketplace" },
    { path: "/marketplace", icon: "fas fa-store", label: "Personality Marketplace" },
    { path: "/personality-builder", icon: "fas fa-brain", label: "AI Personality Builder" },
    { path: "/voice-builder", icon: "fas fa-microphone-alt", label: "Voice Builder" },
    { path: "/pricing", icon: "fas fa-crown", label: "Pricing" },
    { path: "/settings", icon: "fas fa-cog", label: "Settings" },
  ];

  return (
    <nav className="hidden md:block fixed left-0 top-0 h-full w-64 bg-dark/95 backdrop-blur-lg border-r border-gray-800 z-30">
      <div className="flex flex-col h-full">
        {/* Logo/Brand */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center">
              <i className="fas fa-microphone-alt text-white text-lg"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                BanterBox
              </h1>
              <p className="text-xs text-gray-400">AI Stream Companion</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={cn(
                "w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 text-left",
                location === item.path || (item.path === "/dashboard" && location === "/")
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-gray-300 hover:text-white hover:bg-gray-800/50"
              )}
              data-testid={`desktop-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <i className={`${item.icon} text-lg w-5`}></i>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <div className="text-xs text-gray-500 text-center">
            <p>Powered by AI</p>
            <p className="mt-1">Stream smarter, not harder</p>
          </div>
        </div>
      </div>
    </nav>
  );
}
