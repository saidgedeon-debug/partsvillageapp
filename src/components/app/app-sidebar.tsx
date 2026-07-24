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
  Receipt,
  StickyNote,
} from "lucide-react";

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
import { useShareInbox } from "@/components/app/share-inbox-context";

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  search?: { tab: "quotations" | "invoices" | "receipts" | "inquiries" };
  match?: (pathname: string, search: string) => boolean;
};

const items: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, exact: true },
  { title: "Stock / Inventory", url: "/inventory", icon: Package },
  { title: "Stock take", url: "/stock-take", icon: ClipboardList },
  { title: "Low stock", url: "/low-stock", icon: AlertTriangle },
  { title: "Clients CRM", url: "/clients", icon: Users },
  { title: "Suppliers CRM", url: "/suppliers", icon: Building2 },
  {
    title: "Quotation",
    url: "/documents",
    search: { tab: "quotations" as const },
    icon: FileText,
    match: (pathname, search) =>
      pathname === "/documents" &&
      (search.includes("tab=quotations") ||
        (!search.includes("tab=invoices") &&
          !search.includes("tab=receipts") &&
          !search.includes("tab=inquiries"))),
  },
  {
    title: "Invoice",
    url: "/documents",
    search: { tab: "invoices" as const },
    icon: StickyNote,
    match: (pathname, search) =>
      pathname === "/documents" && search.includes("tab=invoices"),
  },
  {
    title: "Receipt",
    url: "/documents",
    search: { tab: "receipts" as const },
    icon: Receipt,
    match: (pathname, search) =>
      pathname === "/documents" && search.includes("tab=receipts"),
  },
  { title: "Shipments", url: "/china-shipments", icon: Ship },
  { title: "Share inbox", url: "/share-inbox", icon: Inbox },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname, searchStr } = useRouterState({
    select: (r) => {
      const search = r.location.search;
      const searchStr =
        typeof search === "string"
          ? search
          : new URLSearchParams(
              Object.entries((search ?? {}) as Record<string, unknown>)
                .filter(([, v]) => v != null && v !== "")
                .map(([k, v]) => [k, String(v)]),
            ).toString();
      return {
        pathname: r.location.pathname,
        searchStr,
      };
    },
  });
  const { pendingCount } = useShareInbox();

  const isActive = (item: NavItem) => {
    if (item.match) return item.match(pathname, searchStr);
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
              <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">
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
                    <Link
                      to={item.url}
                      search={item.search}
                      className="flex items-center gap-2"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && (
                        <span className="flex flex-1 items-center justify-between gap-2">
                          {item.title}
                          {item.url === "/share-inbox" && pendingCount > 0 && (
                            <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-foreground">
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

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2 text-xs text-sidebar-foreground/70">
          <Wrench className="h-3.5 w-3.5 text-accent" />
          {!collapsed && <span>Depot #01 — Online</span>}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
