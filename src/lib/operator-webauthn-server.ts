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
import {
  checkDurableRateLimit,
  hashRateKey,
  recordDurableFailure,
} from "@/lib/durable-rate-limit";

const STORE_KEY = "operator_webauthn";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const FACE_RATE_WINDOW_MS = 15 * 60 * 1000;
const FACE_RATE_MAX = 30;

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

type StoreRow = { value: StoreValue; updatedAt: string | null };

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
  const pinnedRp = env("WEBAUTHN_RP_ID");
  const pinnedOrigin = env("WEBAUTHN_ORIGIN");
  if (pinnedRp && pinnedOrigin) {
    return { rpID: pinnedRp, origin: pinnedOrigin };
  }

  const hostRaw =
    headers?.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    headers?.get("host")?.trim() ||
    "localhost";
  const host = hostRaw.split(":")[0] || "localhost";
  const allow = (env("WEBAUTHN_ALLOWED_HOSTS") || "partsvillageapp.vercel.app,localhost,127.0.0.1")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length && !allow.includes(host.toLowerCase())) {
    // Fall back to production host rather than accepting arbitrary forwarded hosts.
    return {
      rpID: pinnedRp || "partsvillageapp.vercel.app",
      origin: pinnedOrigin || "https://partsvillageapp.vercel.app",
    };
  }
  const proto =
    headers?.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (host === "localhost" || host === "127.0.0.1" ? "http" : "https");
  return { rpID: host, origin: `${proto}://${hostRaw}` };
}

async function faceRateKey(): Promise<string> {
  const headers = await requestHeaders();
  const forwarded = headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headers?.get("x-real-ip")?.trim();
  const ip = forwarded || realIp || "global";
  return `face:${hashRateKey(ip)}`;
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

async function loadStoreRow(admin: ReturnType<typeof adminClient>): Promise<StoreRow> {
  const { data, error } = await admin
    .from("shop_state")
    .select("value, updated_at")
    .eq("key", STORE_KEY)
    .maybeSingle();
  if (error) throw error;
  const val = data?.value as StoreValue | null;
  if (!val || !Array.isArray(val.credentials)) {
    return {
      value: { credentials: [], challenges: {} },
      updatedAt: (data?.updated_at as string | undefined) ?? null,
    };
  }
  return {
    value: {
      credentials: val.credentials,
      challenges: pruneChallengeMap(val.challenges),
    },
    updatedAt: (data?.updated_at as string | undefined) ?? null,
  };
}

async function saveStore(
  admin: ReturnType<typeof adminClient>,
  value: StoreValue,
  expectedUpdatedAt: string | null,
): Promise<{ saved: boolean; updatedAt: string }> {
  if (expectedUpdatedAt) {
    const remote = await loadStoreRow(admin);
    if (remote.updatedAt && remote.updatedAt !== expectedUpdatedAt) {
      return { saved: false, updatedAt: remote.updatedAt };
    }
  }
  const updatedAt = new Date().toISOString();
  const { error } = await admin.from("shop_state").upsert({
    key: STORE_KEY,
    value: {
      credentials: value.credentials,
      challenges: pruneChallengeMap(value.challenges),
    },
    updated_at: updatedAt,
  });
  if (error) throw error;
  return { saved: true, updatedAt };
}

async function mutateStore(
  admin: ReturnType<typeof adminClient>,
  mutator: (store: StoreValue) => StoreValue | null,
): Promise<StoreValue> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await loadStoreRow(admin);
    const next = mutator({
      credentials: [...row.value.credentials],
      challenges: { ...(row.value.challenges ?? {}) },
    });
    if (next == null) return row.value;
    const result = await saveStore(admin, next, row.updatedAt);
    if (result.saved) return next;
  }
  throw new Error("Face ID store busy — try again");
}

async function rememberChallenge(
  admin: ReturnType<typeof adminClient>,
  challenge: string,
  kind: "reg" | "auth",
) {
  await mutateStore(admin, (store) => {
    store.challenges = pruneChallengeMap(store.challenges);
    store.challenges[challenge] = { kind, expires: Date.now() + CHALLENGE_TTL_MS };
    return store;
  });
}

async function takeChallenge(
  admin: ReturnType<typeof adminClient>,
  challenge: string,
  kind: "reg" | "auth",
): Promise<boolean> {
  let ok = false;
  await mutateStore(admin, (store) => {
    store.challenges = pruneChallengeMap(store.challenges);
    const entry = store.challenges[challenge];
    if (!entry || entry.kind !== kind) {
      ok = false;
      return null;
    }
    delete store.challenges[challenge];
    ok = true;
    return store;
  });
  return ok;
}

async function requireOperatorAccessToken(
  accessToken: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user) return { ok: false, error: "Session expired — unlock with PIN first" };
  const role = (data.user.app_metadata as { role?: string } | undefined)?.role;
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
      const store = (await loadStoreRow(admin)).value;

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
        await mutateStore(admin, (store) => {
          store.credentials = store.credentials.filter((c) => c.id !== credential.id);
          store.credentials.push({
            id: credential.id,
            publicKey: toB64url(credential.publicKey),
            counter: credential.counter,
            transports: credential.transports,
            createdAt: new Date().toISOString(),
          });
          return store;
        });

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
      const rateKey = await faceRateKey();
      const rate = await checkDurableRateLimit(rateKey, {
        windowMs: FACE_RATE_WINDOW_MS,
        maxFailures: FACE_RATE_MAX,
      });
      if (!rate.ok) return rate;

      const headers = await requestHeaders();
      const { rpID } = rpFromHeaders(headers);
      const admin = adminClient();
      const store = (await loadStoreRow(admin)).value;
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
      const rateKey = await faceRateKey();
      const rate = await checkDurableRateLimit(rateKey, {
        windowMs: FACE_RATE_WINDOW_MS,
        maxFailures: FACE_RATE_MAX,
      });
      if (!rate.ok) return rate;

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
        await recordDurableFailure(rateKey, {
          windowMs: FACE_RATE_WINDOW_MS,
          maxFailures: FACE_RATE_MAX,
        });
        return { ok: false, error: "Face ID unlock failed" };
      }

      const admin = adminClient();
      if (!challenge || !(await takeChallenge(admin, challenge, "auth"))) {
        await recordDurableFailure(rateKey, {
          windowMs: FACE_RATE_WINDOW_MS,
          maxFailures: FACE_RATE_MAX,
        });
        return { ok: false, error: "Face ID challenge expired — try again" };
      }

      const store = (await loadStoreRow(admin)).value;
      const stored = store.credentials.find((c) => c.id === response.id);
      if (!stored) {
        await recordDurableFailure(rateKey, {
          windowMs: FACE_RATE_WINDOW_MS,
          maxFailures: FACE_RATE_MAX,
        });
        return { ok: false, error: "Unknown Face ID credential" };
      }

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
        await recordDurableFailure(rateKey, {
          windowMs: FACE_RATE_WINDOW_MS,
          maxFailures: FACE_RATE_MAX,
        });
        return { ok: false, error: "Face ID verification failed" };
      }

      const newCounter = verification.authenticationInfo.newCounter;
      await mutateStore(admin, (s) => {
        const cred = s.credentials.find((c) => c.id === stored.id);
        if (cred) cred.counter = newCounter;
        return s;
      });

      return issueOperatorSession();
    } catch (e) {
      console.error(e);
      return { ok: false, error: "Face ID unlock failed" };
    }
  });
