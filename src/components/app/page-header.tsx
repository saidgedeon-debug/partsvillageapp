import { Search, ShoppingCart } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
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

  const goSearch = () => {
    if (query.trim()) {
      void navigate({ to: "/search", search: { q: query.trim() } });
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex min-h-14 items-center gap-2 px-3 py-2 sm:gap-3 md:min-h-16 md:px-6">
        <SidebarTrigger className="h-11 w-11 shrink-0 md:h-9 md:w-9" />
        <div className="min-w-0 flex-1 md:flex-none md:max-w-[14rem] lg:max-w-none">
          <h1 className="truncate text-base font-semibold leading-tight text-foreground">
            {title}
          </h1>
          {subtitle ? (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="hidden shrink-0 items-center gap-2 md:flex">{actions}</div>
        ) : null}
        <div className="relative hidden min-w-0 flex-1 max-w-md md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") goSearch();
            }}
            placeholder="Search part #, serial #, or client…"
            className="h-10 pl-9"
            aria-label="Search"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative h-11 w-11 shrink-0 md:h-9 md:w-9"
          onClick={() => setCartOpen(true)}
          aria-label="Open cart"
        >
          <ShoppingCart className="h-5 w-5 md:h-4 md:w-4" />
          {itemCount > 0 && (
            <Badge className="absolute -right-1.5 -top-1.5 h-5 min-w-5 px-1 text-xs">
              {itemCount}
            </Badge>
          )}
        </Button>
        {documentKind ? (
          <span className="hidden text-xs capitalize text-muted-foreground lg:inline">
            {documentKind}
          </span>
        ) : null}
      </div>
      <div className="px-3 pb-3 md:hidden">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") goSearch();
            }}
            placeholder="Search part #, serial #, or client…"
            className="h-11 pl-9 text-base"
            aria-label="Search"
            enterKeyHint="search"
          />
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap gap-2 px-3 pb-3 md:hidden">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
