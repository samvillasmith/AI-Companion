"use client";

import { Home, Plus, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { usePremiumModal } from "../hooks/use-premium-modal";
import { cn } from "../lib/utils";

interface SidebarPremium {
  isPremium: boolean;
}

export const Sidebar = ({ isPremium }: SidebarPremium) => {
  const pathname = usePathname();
  const premiumModal = usePremiumModal();

  const routes = [
    { icon: Home, href: "/", label: "Home", premium: false },
    { icon: Plus, href: "/companion/new", label: "Create", premium: true },
    { icon: Settings, href: "/settings", label: "Settings", premium: false },
  ];

  const onNavigate = (url: string, premium: boolean) => {
    if (premium && !isPremium) {
      return premiumModal.onOpen();
    }
    // Use consistent navigation for all routes
    window.location.href = url;
  };

  return (
    <div className="flex h-full flex-col bg-background text-foreground/90">
      <div className="p-3 flex flex-1 justify-center">
        <nav className="space-y-2">
          {routes.map((route) => {
            const active = pathname === route.href;
            return (
              <button
                key={route.href}
                onClick={() => onNavigate(route.href, route.premium)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative group w-full select-none rounded-xl p-3 text-xs font-medium",
                  "flex items-center justify-center transition",
                  "text-foreground/70 hover:text-foreground",
                  active ? "bg-muted/40" : "hover:bg-muted/30",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40"
                )}
              >
                {/* active gradient bar (dark only) */}
                <span
                  className={cn(
                    "absolute left-1.5 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full",
                    active ? "hidden dark:block bg-gradient-to-b from-sky-400 via-indigo-500 to-fuchsia-500" : "bg-transparent"
                  )}
                />
                <span className="flex flex-col items-center gap-y-2">
                  <route.icon className="h-5 w-5 drop-shadow-sm" />
                  <span className="text-foreground/80">{route.label}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;