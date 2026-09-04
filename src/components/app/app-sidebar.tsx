import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  Building2,
  ClipboardList,
  AlertTriangle,
  Ship,
  Wrench,
  Inbox,
  Search,
  ClipboardCheck,
  DatabaseBackup,
  Lock,
  Smartphone,
  Banknote,
  PackagePlus,
  TrendingUp,
  MessageCircle,
  Printer,
  MapPin,
} from "lucide-react";
import { useState } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import logo from "@/assets/parts-village-logo-clear.png";
import { BackupDialog } from "@/components/app/backup-dialog";
import { clearOperatorUnlock } from "@/components/app/operator-unlock-gate";
import { useShareInbox } from "@/components/app/share-inbox-context";
import { useCloudHealth, usePendingSyncCount } from "@/lib/cloud-store";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const items: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, exact: true },
  { title: "Search", url: "/search", icon: Search },
  { title: "Inventory", url: "/inventory", icon: Package },
  { title: "Stock take", url: "/stock-take", icon: ClipboardList },
  { title: "Stock map", url: "/stock-map", icon: MapPin },
  { title: "Counter", url: "/counter", icon: Smartphone },
  { title: "Daily close", url: "/daily-close", icon: Banknote },
  { title: "Insights", url: "/insights", icon: TrendingUp },
  { title: "Collections", url: "/collections", icon: MessageCircle },
  { title: "Labels", url: "/labels", icon: Printer },
  { title: "Low stock", url: "/low-stock", icon: AlertTriangle },
  { title: "Reorder", url: "/reorder", icon: PackagePlus },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Fleet", url: "/fleet", icon: Wrench },
  { title: "Pre-orders", url: "/pre-orders", icon: ClipboardCheck },
  { title: "Suppliers", url: "/suppliers", icon: Building2 },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Shipments", url: "/china-shipments", icon: Ship },
  { title: "Share inbox", url: "/share-inbox", icon: Inbox },
];

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useRouterState({
    select: (r) => ({ pathname: r.location.pathname }),
  });
  const { pendingCount } = useShareInbox();
  const cloudHealth = useCloudHealth();
  const pendingSync = usePendingSyncCount();
  const [backupOpen, setBackupOpen] = useState(false);

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.url;
    const path = item.url.split("?")[0];
    return pathname === path || pathname.startsWith(path + "/");
  };

  const go = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sidebar-accent p-1">
            <img src={logo} alt="Parts Village" className="h-full w-full object-contain" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold tracking-wide text-sidebar-foreground">
                PARTS VILLAGE
              </span>
              <span className="text-xs uppercase tracking-widest text-sidebar-foreground/60">
                Heavy Equipment Parts
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item)}
                    tooltip={item.title}
                    className="h-11 md:h-8"
                  >
                    <Link to={item.url} className="flex items-center gap-2" onClick={go}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && (
                        <span className="flex flex-1 items-center justify-between gap-2">
                          {item.title}
                          {item.url === "/share-inbox" && pendingCount > 0 && (
                            <span className="rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-foreground">
                              {pendingCount}
                            </span>
                          )}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="space-y-1 border-t border-sidebar-border p-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-11 w-full justify-start gap-2 px-2 text-sidebar-foreground/80 md:h-8"
          onClick={() => setBackupOpen(true)}
        >
          <DatabaseBackup className="h-3.5 w-3.5" />
          {!collapsed && <span>Backup</span>}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-11 w-full justify-start gap-2 px-2 text-sidebar-foreground/80 md:h-8"
          aria-label="Lock shop"
          onClick={() => {
            clearOperatorUnlock();
            toast.message("Shop locked");
            window.location.reload();
          }}
        >
          <Lock className="h-3.5 w-3.5" />
          {!collapsed && <span>Lock</span>}
        </Button>
        <div className="flex items-center gap-2 px-2 py-1 text-xs text-sidebar-foreground/70">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              cloudHealth === "error"
                ? "bg-destructive"
                : pendingSync > 0 || cloudHealth === "syncing"
                  ? "bg-amber-400"
                  : cloudHealth === "synced"
                    ? "bg-emerald-500"
                    : "bg-amber-400"
            }`}
          />
          {!collapsed && (
            <span>
              Depot #01 —{" "}
              {pendingSync > 0
                ? `${pendingSync} pending`
                : cloudHealth === "synced"
                  ? "Synced"
                  : cloudHealth === "syncing"
                    ? "Syncing…"
                    : cloudHealth === "error"
                      ? "Sync error"
                      : "Loading…"}
            </span>
          )}
        </div>
        <BackupDialog open={backupOpen} onOpenChange={setBackupOpen} />
      </SidebarFooter>
    </Sidebar>
  );
}
