/**
 * WebAuthn (Face ID / Touch ID) for operator unlock.
 * Credentials live in shop_state key `operator_webauthn` (service role).
 */
import { createServerFn } from "@tanstack/react-start";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

import { issueOperatorSession, type UnlockResult } from "@/lib/operator-auth-server";

const STORE_KEY = "operator_webauthn";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

type StoredCredential = {
  id: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  createdAt: string;
};

type StoreValue = {
  credentials: StoredCredential[];
  challenges?: Record<string, { kind: "reg" | "auth"; expires: number }>;
};

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

function adminClient() {
  const url = env("VITE_SUPABASE_URL") || env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Server missing Supabase URL or SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requestHeaders(): Promise<Headers | undefined> {
  try {
    const mod = await import("@tanstack/react-start/server");
    const getRequest =
      (mod as { getRequest?: () => Request }).getRequest ??
      (mod as { getWebRequest?: () => Request }).getWebRequest;
    const req = typeof getRequest === "function" ? getRequest() : undefined;
    return req?.headers;
  } catch {
    return undefined;
  }
}

function rpFromHeaders(headers: Headers | undefined): { rpID: string; origin: string } {
  const hostRaw =
    headers?.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    headers?.get("host")?.trim() ||
    "localhost";
  const host = hostRaw.split(":")[0] || "localhost";
  const proto =
    headers?.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (host === "localhost" || host === "127.0.0.1" ? "http" : "https");
  return { rpID: host, origin: `${proto}://${hostRaw}` };
}

function toB64url(buf: Uint8Array): string {
  return Buffer.from(buf).toString("base64url");
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(s, "base64url");
  const out = new Uint8Array(buf.byteLength);
  out.set(buf);
  return out;
}

/** Strip non-JSON bits so TanStack Start accepts the payload. */
function asJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function pruneChallengeMap(
  challenges: Record<string, { kind: "reg" | "auth"; expires: number }> | undefined,
): Record<string, { kind: "reg" | "auth"; expires: number }> {
  const now = Date.now();
  const next: Record<string, { kind: "reg" | "auth"; expires: number }> = {};
  for (const [k, v] of Object.entries(challenges ?? {})) {
    if (v.expires >= now) next[k] = v;
  }
  return next;
}

async function loadStore(admin: ReturnType<typeof adminClient>): Promise<StoreValue> {
  const { data, error } = await admin
    .from("shop_state")
    .select("value")
    .eq("key", STORE_KEY)
    .maybeSingle();
  if (error) throw error;
  const val = data?.value as StoreValue | null;
  if (!val || !Array.isArray(val.credentials)) {
    return { credentials: [], challenges: {} };
  }
  return {
    credentials: val.credentials,
    challenges: pruneChallengeMap(val.challenges),
  };
}

async function saveStore(
  admin: ReturnType<typeof adminClient>,
  value: StoreValue,
): Promise<void> {
  const { error } = await admin.from("shop_state").upsert({
    key: STORE_KEY,
    value: {
      credentials: value.credentials,
      challenges: pruneChallengeMap(value.challenges),
    },
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

async function rememberChallenge(
  admin: ReturnType<typeof adminClient>,
  challenge: string,
  kind: "reg" | "auth",
) {
  const store = await loadStore(admin);
  store.challenges = pruneChallengeMap(store.challenges);
  store.challenges[challenge] = { kind, expires: Date.now() + CHALLENGE_TTL_MS };
  await saveStore(admin, store);
}

async function takeChallenge(
  admin: ReturnType<typeof adminClient>,
  challenge: string,
  kind: "reg" | "auth",
): Promise<boolean> {
  const store = await loadStore(admin);
  store.challenges = pruneChallengeMap(store.challenges);
  const entry = store.challenges[challenge];
  if (!entry || entry.kind !== kind) return false;
  delete store.challenges[challenge];
  await saveStore(admin, store);
  return true;
}

async function requireOperatorAccessToken(
  accessToken: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user) return { ok: false, error: "Session expired — unlock with PIN first" };
  const role =
    (data.user.app_metadata as { role?: string } | undefined)?.role ||
    (data.user.user_metadata as { role?: string } | undefined)?.role;
  if (role !== "operator") return { ok: false, error: "Not an operator session" };
  return { ok: true };
}

type FaceOptionsOk = { ok: true; optionsJson: string };
type FaceErr = { ok: false; error: string };

export const beginFaceIdRegister = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ accessToken: z.string().min(10) }).parse(data),
  )
  .handler(async ({ data }): Promise<FaceOptionsOk | FaceErr> => {
    try {
      const auth = await requireOperatorAccessToken(data.accessToken);
      if (!auth.ok) return auth;

      const headers = await requestHeaders();
      const { rpID } = rpFromHeaders(headers);
      const admin = adminClient();
      const store = await loadStore(admin);

      const options = await generateRegistrationOptions({
        rpName: "Parts Village",
        rpID,
        userName: "operator",
        userDisplayName: "Parts Village Operator",
        attestationType: "none",
        excludeCredentials: store.credentials.map((c) => ({
          id: c.id,
          transports: c.transports,
        })),
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          residentKey: "preferred",
          userVerification: "required",
        },
        preferredAuthenticatorType: "localDevice",
      });

      await rememberChallenge(admin, options.challenge, "reg");
      return { ok: true, optionsJson: JSON.stringify(asJson(options)) };
    } catch (e) {
      console.error(e);
      return { ok: false, error: "Face ID setup failed" };
    }
  });

export const finishFaceIdRegister = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        response: z.any(),
      })
      .parse(data),
  )
  .handler(
    async ({ data }): Promise<{ ok: true; credentialId: string } | FaceErr> => {
      try {
        const auth = await requireOperatorAccessToken(data.accessToken);
        if (!auth.ok) return auth;

        const headers = await requestHeaders();
        const { rpID, origin } = rpFromHeaders(headers);
        const response = data.response as RegistrationResponseJSON;

        let challenge = "";
        try {
          const json = JSON.parse(
            Buffer.from(response.response.clientDataJSON, "base64url").toString("utf8"),
          ) as { challenge?: string };
          challenge = json.challenge ?? "";
        } catch {
          return { ok: false, error: "Face ID setup expired — try again" };
        }

        const admin = adminClient();
        if (!challenge || !(await takeChallenge(admin, challenge, "reg"))) {
          return { ok: false, error: "Face ID setup expired — try again" };
        }

        const verification = await verifyRegistrationResponse({
          response,
          expectedChallenge: challenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          requireUserVerification: true,
        });

        if (!verification.verified || !verification.registrationInfo) {
          return { ok: false, error: "Face ID verification failed" };
        }

        const { credential } = verification.registrationInfo;
        const store = await loadStore(admin);
        store.credentials = store.credentials.filter((c) => c.id !== credential.id);
        store.credentials.push({
          id: credential.id,
          publicKey: toB64url(credential.publicKey),
          counter: credential.counter,
          transports: credential.transports,
          createdAt: new Date().toISOString(),
        });
        await saveStore(admin, store);

        return { ok: true, credentialId: credential.id };
      } catch (e) {
        console.error(e);
        return { ok: false, error: "Face ID setup failed" };
      }
    },
  );

export const beginFaceIdUnlock = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        credentialId: z.string().min(1).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }): Promise<FaceOptionsOk | FaceErr> => {
    try {
      const headers = await requestHeaders();
      const { rpID } = rpFromHeaders(headers);
      const admin = adminClient();
      const store = await loadStore(admin);
      if (store.credentials.length === 0) {
        return { ok: false, error: "Face ID not set up — unlock with PIN first" };
      }

      let allow = store.credentials;
      if (data.credentialId) {
        const match = store.credentials.filter((c) => c.id === data.credentialId);
        if (match.length) allow = match;
      }

      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: allow.map((c) => ({
          id: c.id,
          transports: c.transports,
        })),
        userVerification: "required",
      });

      await rememberChallenge(admin, options.challenge, "auth");
      return { ok: true, optionsJson: JSON.stringify(asJson(options)) };
    } catch (e) {
      console.error(e);
      return { ok: false, error: "Face ID unlock failed" };
    }
  });

export const finishFaceIdUnlock = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ response: z.any() }).parse(data))
  .handler(async ({ data }): Promise<UnlockResult> => {
    try {
      const headers = await requestHeaders();
      const { rpID, origin } = rpFromHeaders(headers);
      const response = data.response as AuthenticationResponseJSON;

      let challenge = "";
      try {
        const json = JSON.parse(
          Buffer.from(response.response.clientDataJSON, "base64url").toString("utf8"),
        ) as { challenge?: string };
        challenge = json.challenge ?? "";
      } catch {
        return { ok: false, error: "Face ID unlock failed" };
      }

      const admin = adminClient();
      if (!challenge || !(await takeChallenge(admin, challenge, "auth"))) {
        return { ok: false, error: "Face ID challenge expired — try again" };
      }

      const store = await loadStore(admin);
      const stored = store.credentials.find((c) => c.id === response.id);
      if (!stored) return { ok: false, error: "Unknown Face ID credential" };

      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: stored.id,
          publicKey: fromB64url(stored.publicKey),
          counter: stored.counter,
          transports: stored.transports,
        },
        requireUserVerification: true,
      });

      if (!verification.verified) {
        return { ok: false, error: "Face ID verification failed" };
      }

      stored.counter = verification.authenticationInfo.newCounter;
      await saveStore(admin, store);

      return issueOperatorSession();
    } catch (e) {
      console.error(e);
      return { ok: false, error: "Face ID unlock failed" };
    }
  });
