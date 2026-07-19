import { CloudOff, Loader2 } from "lucide-react";
import { type ReactNode, useState } from "react";

import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Gates the whole app behind a configured Supabase project. This app is
 * online-only — there is no localStorage fallback, so without env vars
 * there is nowhere to read or write data.
 */
export function CloudGate({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <CloudOff className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
            Supabase connection required
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Parts Village is an online-only app — it stores everything in Supabase so your phone and
            PC always see the same data. Set{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">VITE_SUPABASE_URL</code> and{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">VITE_SUPABASE_ANON_KEY</code> in
            your environment, then reload.
          </p>
        </div>
      </div>
    );
  }

  return <CloudGateBanner>{children}</CloudGateBanner>;
}

function CloudGateBanner({ children }: { children: ReactNode }) {
  const [dismissed, setDismissed] = useState(false);

  return (
    <>
      {!dismissed && <SyncBanner onDismiss={() => setDismissed(true)} />}
      {children}
    </>
  );
}

function SyncBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
      onAnimationEnd={onDismiss}
      style={{ animation: "cloud-gate-banner-fade 2.4s ease forwards" }}
    >
      <div className="pointer-events-auto mt-2 flex items-center gap-2 rounded-full bg-foreground/90 px-3 py-1 text-xs font-medium text-background shadow-lg">
        <Loader2 className="h-3 w-3 animate-spin" />
        Online · syncing…
      </div>
      <style>
        {`@keyframes cloud-gate-banner-fade { 0% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; } }`}
      </style>
    </div>
  );
}
