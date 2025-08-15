import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

export default function MobileNav() {
  const [location, setLocation] = useLocation();

  const navItems = [
    { path: "/dashboard", icon: "fas fa-tachometer-alt", label: "Dashboard" },
    { path: "/overlay", icon: "fas fa-layer-group", label: "Overlay" },
    { path: "/settings", icon: "fas fa-cog", label: "Settings" },
    { path: "/pro", icon: "fas fa-crown", label: "Pro" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-dark/95 backdrop-blur-lg border-t border-gray-800 px-4 py-2 z-40">
      <div className="flex items-center justify-around">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => setLocation(item.path)}
            className={cn(
              "flex flex-col items-center space-y-1 py-2 px-3 transition-colors touch-manipulation",
              location === item.path || (item.path === "/dashboard" && location === "/")
                ? "text-primary"
                : "text-gray-400 hover:text-white"
            )}
            data-testid={`nav-${item.label.toLowerCase()}`}
          >
            <i className={`${item.icon} text-lg`}></i>
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
