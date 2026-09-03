import { createClient } from "@supabase/supabase-js";
import { useEffect, useState, type ReactNode } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { unlockOperator } from "@/lib/operator-auth-server";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const SESSION_FLAG = "pv-operator-unlocked-v1";

function hasLocalUnlock(): boolean {
  try {
    return sessionStorage.getItem(SESSION_FLAG) === "1";
  } catch {
    return false;
  }
}

function markLocalUnlock() {
  try {
    sessionStorage.setItem(SESSION_FLAG, "1");
  } catch {
    // ignore
  }
}

export function clearOperatorUnlock() {
  try {
    sessionStorage.removeItem(SESSION_FLAG);
  } catch {
    // ignore
  }
  void supabase?.auth.signOut();
}

/**
 * Blocks the operator app until PIN unlock. Establishes a Supabase Auth
 * session so RLS can require `authenticated` on shop_state.
 */
export function OperatorUnlockGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!isSupabaseConfigured || !supabase) {
        if (!cancelled) {
          setUnlocked(false);
          setReady(true);
        }
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        markLocalUnlock();
        setUnlocked(true);
      } else if (hasLocalUnlock()) {
        // Stale flag without session — force re-entry.
        clearOperatorUnlock();
        setUnlocked(false);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async () => {
    if (!pin.trim()) {
      toast.error("Enter operator PIN");
      return;
    }
    setBusy(true);
    try {
      const result = await unlockOperator({ data: { pin: pin.trim() } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (!supabase) {
        toast.error("Supabase not configured");
        return;
      }
      const { error } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      markLocalUnlock();
      setUnlocked(true);
      toast.success("Unlocked");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unlock failed");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-4 rounded-lg border border-border p-6">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-accent" />
            <h1 className="text-lg font-semibold tracking-tight">Operator unlock</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Enter the shop PIN to open Parts Village. Client portal links do not need this PIN.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="operator-pin">PIN</Label>
            <Input
              id="operator-pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              placeholder="Shop PIN"
            />
          </div>
          <Button className="w-full" disabled={busy} onClick={() => void submit()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Unlock
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/** Dev helper — not used by portal. */
export function createAuthedBrowserClient() {
  return createClient(
    import.meta.env.VITE_SUPABASE_URL as string,
    import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  );
}
