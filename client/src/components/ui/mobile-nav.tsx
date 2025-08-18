import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

export default function MobileNav() {
  const [location, setLocation] = useLocation();

  const navItems = [
    { path: "/dashboard", icon: "fas fa-tachometer-alt", label: "Dashboard" },
    { path: "/tools", icon: "fas fa-tools", label: "Tools" },
    { path: "/voice-marketplace", icon: "fas fa-microphone", label: "Voices" },
    { path: "/marketplace", icon: "fas fa-store", label: "Market" },
    { path: "/personality-builder", icon: "fas fa-brain", label: "AI" },
    { path: "/voice-builder", icon: "fas fa-microphone-alt", label: "Build" },
    { path: "/pricing", icon: "fas fa-crown", label: "Pricing" },
    { path: "/settings", icon: "fas fa-cog", label: "Settings" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-dark/95 backdrop-blur-lg border-t border-gray-800 px-2 py-2 z-40">
      <div className="flex items-center justify-around">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => setLocation(item.path)}
            className={cn(
              "flex flex-col items-center space-y-1 py-2 px-2 transition-colors touch-manipulation min-w-0",
              location === item.path || (item.path === "/dashboard" && location === "/")
                ? "text-primary"
                : "text-gray-400 hover:text-white"
            )}
            data-testid={`nav-${item.label.toLowerCase()}`}
          >
            <i className={`${item.icon} text-lg`}></i>
            <span className="text-xs font-medium truncate w-full text-center">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
