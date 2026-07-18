import { Search, ShoppingCart } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSearch } from "./search-context";
import { useCart } from "./cart-context";

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { query, setQuery } = useSearch();
  const { itemCount, setCartOpen, documentKind } = useCart();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:px-6">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="hidden min-w-0 md:block">
          <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="relative ml-auto w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
            <Badge className="absolute -right-2 -top-2 h-5 min-w-5 px-1 text-[10px]">
              {itemCount}
            </Badge>
          )}
        </Button>
        {documentKind && (
          <span className="hidden text-xs capitalize text-muted-foreground sm:inline">
            {documentKind}
          </span>
        )}
      </div>
    </header>
  );
}