import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Menu,
  Package,
  Smartphone,
  Users,
} from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const tabs = [
  { title: "Home", to: "/", icon: LayoutDashboard, exact: true },
  { title: "Counter", to: "/counter", icon: Smartphone },
  { title: "Stock", to: "/inventory", icon: Package },
  { title: "Clients", to: "/clients", icon: Users },
] as const;

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { setOpenMobile } = useSidebar();

  // Counter has its own fixed checkout bar — avoid stacking two bars.
  if (pathname.startsWith("/counter") || pathname.startsWith("/portal")) {
    return null;
  }

  const isActive = (to: string, exact?: boolean) => {
    if (exact) return pathname === to;
    return pathname === to || pathname.startsWith(`${to}/`);
  };

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {tabs.map((tab) => {
          const active = isActive(tab.to, "exact" in tab ? tab.exact : false);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <tab.icon className={cn("h-5 w-5", active && "text-primary")} />
              {tab.title}
            </Link>
          );
        })}
        <button
          type="button"
          className="flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium text-muted-foreground"
          onClick={() => setOpenMobile(true)}
        >
          <Menu className="h-5 w-5" />
          More
        </button>
      </div>
    </nav>
  );
}
