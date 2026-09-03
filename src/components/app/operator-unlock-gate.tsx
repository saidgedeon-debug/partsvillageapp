import { createClient } from "@supabase/supabase-js";
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Fingerprint, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { unlockOperator } from "@/lib/operator-auth-server";
import {
  beginFaceIdRegister,
  beginFaceIdUnlock,
  finishFaceIdRegister,
  finishFaceIdUnlock,
} from "@/lib/operator-webauthn-server";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";

const SESSION_FLAG = "pv-operator-unlocked-v1";
const SESSION_AT = "pv-operator-unlocked-at-v1";
const FACE_ID_CRED = "pv-face-id-cred-v1";
const SESSION_MAX_MS = 12 * 60 * 60 * 1000;

function hasLocalUnlock(): boolean {
  try {
    return sessionStorage.getItem(SESSION_FLAG) === "1";
  } catch {
    return false;
  }
}

function unlockTimestamp(): number | null {
  try {
    const raw = sessionStorage.getItem(SESSION_AT);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function isUnlockFresh(): boolean {
  const at = unlockTimestamp();
  if (at == null) return false;
  return Date.now() - at <= SESSION_MAX_MS;
}

function markLocalUnlock() {
  try {
    sessionStorage.setItem(SESSION_FLAG, "1");
    sessionStorage.setItem(SESSION_AT, String(Date.now()));
  } catch {
    // ignore
  }
}

function getStoredFaceIdCred(): string | null {
  try {
    return localStorage.getItem(FACE_ID_CRED);
  } catch {
    return null;
  }
}

function setStoredFaceIdCred(id: string) {
  try {
    localStorage.setItem(FACE_ID_CRED, id);
  } catch {
    // ignore
  }
}

function clearStoredFaceIdCred() {
  try {
    localStorage.removeItem(FACE_ID_CRED);
  } catch {
    // ignore
  }
}

function isApplePhone(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function biometricLabel(): string {
  if (isApplePhone()) return "Face ID";
  if (/Mac/i.test(navigator.userAgent)) return "Touch ID";
  return "Biometrics";
}

export function clearOperatorUnlock() {
  try {
    sessionStorage.removeItem(SESSION_FLAG);
    sessionStorage.removeItem(SESSION_AT);
  } catch {
    // ignore
  }
  void supabase?.auth.signOut();
}

async function applySessionTokens(access_token: string, refresh_token: string) {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (error) throw error;
}

async function enrollFaceId(accessToken: string): Promise<boolean> {
  const begin = (await beginFaceIdRegister({ data: { accessToken } })) as
    | { ok: true; optionsJson: string }
    | { ok: false; error: string };
  if (!begin.ok) {
    toast.error(begin.error);
    return false;
  }
  try {
    const optionsJSON = JSON.parse(
      begin.optionsJson,
    ) as PublicKeyCredentialCreationOptionsJSON;
    const attestation = await startRegistration({ optionsJSON });
    const finish = (await finishFaceIdRegister({
      data: {
        accessToken,
        response: attestation,
      },
    })) as { ok: true; credentialId: string } | { ok: false; error: string };
    if (!finish.ok) {
      toast.error(finish.error);
      return false;
    }
    setStoredFaceIdCred(finish.credentialId);
    toast.success(`${biometricLabel()} enabled for this device`);
    return true;
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "NotAllowedError") {
      toast.message(`${biometricLabel()} canceled`);
      return false;
    }
    toast.error(e instanceof Error ? e.message : `${biometricLabel()} setup failed`);
    return false;
  }
}

/**
 * Blocks the operator app until PIN / Face ID unlock. Establishes a Supabase Auth
 * session so RLS can require `authenticated` on shop_state.
 */
export function OperatorUnlockGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [expiredMessage, setExpiredMessage] = useState(false);
  const [faceAvailable, setFaceAvailable] = useState(false);
  const [faceCredId, setFaceCredId] = useState<string | null>(null);
  const autoFaceTried = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supports =
        browserSupportsWebAuthn() && (await platformAuthenticatorIsAvailable().catch(() => false));
      const cred = getStoredFaceIdCred();
      if (!cancelled) {
        setFaceAvailable(supports);
        setFaceCredId(cred);
      }

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
        if (isUnlockFresh()) {
          setUnlocked(true);
        } else {
          clearOperatorUnlock();
          setExpiredMessage(true);
          setUnlocked(false);
        }
      } else if (hasLocalUnlock()) {
        clearOperatorUnlock();
        setUnlocked(false);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyUnlockSuccess = () => {
    markLocalUnlock();
    setExpiredMessage(false);
    setUnlocked(true);
    toast.success("Unlocked");
  };

  const submitPin = async () => {
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
      await applySessionTokens(result.access_token, result.refresh_token);
      applyUnlockSuccess();

      if (
        faceAvailable &&
        !getStoredFaceIdCred() &&
        typeof window !== "undefined" &&
        window.confirm(`Enable ${biometricLabel()} for faster unlock on this device?`)
      ) {
        await enrollFaceId(result.access_token);
        setFaceCredId(getStoredFaceIdCred());
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unlock failed");
    } finally {
      setBusy(false);
    }
  };

  const submitFaceId = async () => {
    setBusy(true);
    try {
      const begin = (await beginFaceIdUnlock({
        data: { credentialId: faceCredId ?? undefined },
      })) as
        | { ok: true; optionsJson: string }
        | { ok: false; error: string };
      if (!begin.ok) {
        toast.error(begin.error);
        if (begin.error.toLowerCase().includes("not set up")) {
          clearStoredFaceIdCred();
          setFaceCredId(null);
        }
        return;
      }
      const optionsJSON = JSON.parse(
        begin.optionsJson,
      ) as PublicKeyCredentialRequestOptionsJSON;
      const assertion = await startAuthentication({ optionsJSON });
      const finish = (await finishFaceIdUnlock({
        data: { response: assertion },
      })) as
        | {
            ok: true;
            access_token: string;
            refresh_token: string;
          }
        | { ok: false; error: string };
      if (!finish.ok) {
        toast.error(finish.error);
        return;
      }
      await applySessionTokens(finish.access_token, finish.refresh_token);
      applyUnlockSuccess();
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      if (name === "NotAllowedError") {
        toast.message(`${biometricLabel()} canceled`);
        return;
      }
      toast.error(e instanceof Error ? e.message : `${biometricLabel()} unlock failed`);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!ready || unlocked || busy || !faceAvailable || !faceCredId) return;
    if (autoFaceTried.current) return;
    autoFaceTried.current = true;
    void submitFaceId();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot auto Face ID on mount
  }, [ready, unlocked, faceAvailable, faceCredId]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!unlocked) {
    const bio = biometricLabel();
    const showFace = faceAvailable && Boolean(faceCredId);

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-4 rounded-lg border border-border p-6">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-accent" />
            <h1 className="text-lg font-semibold tracking-tight">Operator unlock</h1>
          </div>
          {expiredMessage ? (
            <p className="text-sm text-destructive">
              Session expired — use {showFace ? bio : "PIN"} again
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {showFace
                ? `Unlock with ${bio}, or enter the shop PIN. Client portal links do not need this.`
                : "Enter the shop PIN to open Parts Village. Client portal links do not need this PIN."}
            </p>
          )}

          {showFace ? (
            <Button
              className="w-full"
              disabled={busy}
              onClick={() => void submitFaceId()}
              type="button"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Fingerprint className="mr-2 h-4 w-4" />
              )}
              Unlock with {bio}
            </Button>
          ) : null}

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
                if (e.key === "Enter") void submitPin();
              }}
              placeholder="Shop PIN"
            />
          </div>
          <Button
            className="w-full"
            variant={showFace ? "outline" : "default"}
            disabled={busy}
            onClick={() => void submitPin()}
          >
            {busy && !showFace ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Unlock with PIN
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
