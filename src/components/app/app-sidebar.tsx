import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Package, Users, FileText, Wrench, Building2, ClipboardList, AlertTriangle } from "lucide-react";

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

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, exact: true },
  { title: "Stock / Inventory", url: "/inventory", icon: Package },
  { title: "Stock take", url: "/stock-take", icon: ClipboardList },
  { title: "Low stock", url: "/low-stock", icon: AlertTriangle },
  { title: "Clients CRM", url: "/clients", icon: Users },
  { title: "Suppliers CRM", url: "/suppliers", icon: Building2 },
  { title: "Documents", url: "/documents", icon: FileText },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");

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
                  <SidebarMenuButton asChild isActive={isActive(item.url, item.exact)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
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