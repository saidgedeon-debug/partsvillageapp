import { Search, ShoppingCart } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSearch } from "./search-context";
import { useCart } from "./cart-context";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const { query, setQuery } = useSearch();
  const { itemCount, setCartOpen, documentKind } = useCart();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 px-4 backdrop-blur md:px-6">
      <div className="flex min-h-16 items-center gap-3 py-2">
        <SidebarTrigger />
        <Separator orientation="vertical" className="hidden h-6 sm:block" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
          {subtitle ? (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="hidden shrink-0 items-center gap-2 sm:flex">{actions}</div> : null}
        <div className="relative hidden w-full max-w-md md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim()) {
                void navigate({ to: "/search", search: { q: query.trim() } });
              }
            }}
            placeholder="Search part #, serial #, or client…"
            className="h-10 pl-9"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative shrink-0"
          onClick={() => setCartOpen(true)}
          aria-label="Open cart"
        >
          <ShoppingCart className="h-4 w-4" />
          {itemCount > 0 && (
            <Badge className="absolute -right-2 -top-2 h-5 min-w-5 px-1 text-xs">
              {itemCount}
            </Badge>
          )}
        </Button>
        {documentKind ? (
          <span className="hidden text-xs capitalize text-muted-foreground sm:inline">
            {documentKind}
          </span>
        ) : null}
      </div>
      <div className="relative pb-3 md:hidden">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) {
              void navigate({ to: "/search", search: { q: query.trim() } });
            }
          }}
          placeholder="Search part #, serial #, or client…"
          className="h-10 pl-9"
        />
      </div>
    </header>
  );
}
