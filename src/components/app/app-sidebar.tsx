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
  Smartphone,
  Banknote,
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
import { useShareInbox } from "@/components/app/share-inbox-context";
import { useCloudHealth } from "@/lib/cloud-store";
import { Button } from "@/components/ui/button";

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
  { title: "Counter", url: "/counter", icon: Smartphone },
  { title: "Daily close", url: "/daily-close", icon: Banknote },
  { title: "Low stock", url: "/low-stock", icon: AlertTriangle },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Fleet", url: "/fleet", icon: Wrench },
  { title: "Pre-orders", url: "/pre-orders", icon: ClipboardCheck },
  { title: "Suppliers", url: "/suppliers", icon: Building2 },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Shipments", url: "/china-shipments", icon: Ship },
  { title: "Share inbox", url: "/share-inbox", icon: Inbox },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useRouterState({
    select: (r) => ({ pathname: r.location.pathname }),
  });
  const { pendingCount } = useShareInbox();
  const cloudHealth = useCloudHealth();
  const [backupOpen, setBackupOpen] = useState(false);

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.url;
    const path = item.url.split("?")[0];
    return pathname === path || pathname.startsWith(path + "/");
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
                  <SidebarMenuButton asChild isActive={isActive(item)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
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
          className="h-8 w-full justify-start gap-2 px-2 text-sidebar-foreground/80"
          onClick={() => setBackupOpen(true)}
        >
          <DatabaseBackup className="h-3.5 w-3.5" />
          {!collapsed && <span>Backup</span>}
        </Button>
        <div className="flex items-center gap-2 px-2 py-1 text-xs text-sidebar-foreground/70">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              cloudHealth === "synced"
                ? "bg-emerald-500"
                : cloudHealth === "error"
                  ? "bg-destructive"
                  : "bg-amber-400"
            }`}
          />
          {!collapsed && (
            <span>
              Depot #01 —{" "}
              {cloudHealth === "synced"
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
