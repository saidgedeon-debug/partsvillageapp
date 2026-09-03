/**
 * Operator unlock — server verifies PIN, returns a Supabase Auth session
 * so RLS can require `authenticated` on shop_state.
 */
import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { verifyPortalToken } from "@/lib/portal-token";

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

type PinResult = { ok: true; pin: string } | { ok: false; error: string };

function expectedPin(): PinResult {
  const pin = env("OPERATOR_PIN");
  if (!pin) return { ok: false, error: "Server misconfigured: OPERATOR_PIN" };
  return { ok: true, pin };
}

function operatorEmails(): string[] {
  const primary = env("OPERATOR_EMAIL");
  const listed = env("OPERATOR_EMAILS");
  const fromList = listed
    ? listed
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean)
    : [];
  const emails: string[] = [];
  const add = (e: string) => {
    if (!emails.some((x) => x.toLowerCase() === e.toLowerCase())) emails.push(e);
  };
  if (primary) add(primary);
  for (const e of fromList) add(e);
  if (emails.length === 0) add("operator@partsvillage.local");
  return emails;
}

function unlockSignInEmail(emails: string[]): string {
  return env("OPERATOR_EMAIL") || emails[0]!;
}

function operatorPassword(pin: string): string {
  return env("OPERATOR_PASSWORD") || pin;
}

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_FAILURES = 5;

type RateEntry = { failures: number[]; lockedUntil?: number };
const unlockAttempts = new Map<string, RateEntry>();

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

function rateLimitKeyFromHeaders(headers: Headers | undefined): string {
  if (!headers) return "global";
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headers.get("x-real-ip")?.trim();
  const ip = forwarded || realIp;
  if (!ip) return "global";
  return hashIp(ip);
}

async function unlockRateKey(): Promise<string> {
  try {
    const mod = await import("@tanstack/react-start/server");
    const getRequest =
      (mod as { getRequest?: () => Request }).getRequest ??
      (mod as { getWebRequest?: () => Request }).getWebRequest;
    const req = typeof getRequest === "function" ? getRequest() : undefined;
    return rateLimitKeyFromHeaders(req?.headers);
  } catch {
    return "global";
  }
}

function checkRateLimit(key: string): { ok: true } | { ok: false; error: string } {
  const now = Date.now();
  const entry = unlockAttempts.get(key);
  if (!entry) return { ok: true };
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return { ok: false, error: "Too many attempts — try again in 15 minutes" };
  }
  entry.failures = entry.failures.filter((t) => now - t < RATE_WINDOW_MS);
  if (entry.failures.length >= RATE_MAX_FAILURES) {
    entry.lockedUntil = now + RATE_WINDOW_MS;
    unlockAttempts.set(key, entry);
    return { ok: false, error: "Too many attempts — try again in 15 minutes" };
  }
  return { ok: true };
}

function recordUnlockFailure(key: string) {
  const now = Date.now();
  const entry = unlockAttempts.get(key) ?? { failures: [] };
  entry.failures = entry.failures.filter((t) => now - t < RATE_WINDOW_MS);
  entry.failures.push(now);
  if (entry.failures.length >= RATE_MAX_FAILURES) {
    entry.lockedUntil = now + RATE_WINDOW_MS;
  }
  unlockAttempts.set(key, entry);
}

function clearUnlockFailures(key: string) {
  unlockAttempts.delete(key);
}

async function ensureOperatorUser(
  admin: ReturnType<typeof adminClient>,
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listed.error) {
    console.error(listed.error);
    return { ok: false, error: "Unlock failed" };
  }

  const existing = listed.data?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );

  const meta = {
    user_metadata: { role: "operator" },
    app_metadata: { role: "operator" },
  };

  if (!existing) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      ...meta,
    });
    if (created.error) {
      console.error(created.error);
      return { ok: false, error: "Unlock failed" };
    }
    return { ok: true };
  }

  const updated = await admin.auth.admin.updateUserById(existing.id, {
    password,
    ...meta,
  });
  if (updated.error) {
    console.error(updated.error);
    return { ok: false, error: "Unlock failed" };
  }
  return { ok: true };
}

const unlockSchema = z.object({
  pin: z.string().min(1),
});

export type UnlockResult =
  | {
      ok: true;
      access_token: string;
      refresh_token: string;
      expires_in?: number;
    }
  | { ok: false; error: string };

/** Shared session issuance after PIN or Face ID verification. */
export async function issueOperatorSession(): Promise<UnlockResult> {
  try {
    const pinCfg = expectedPin();
    if (!pinCfg.ok) return pinCfg;

    const admin = adminClient();
    const emails = operatorEmails();
    const password = operatorPassword(pinCfg.pin);
    const signInEmail = unlockSignInEmail(emails);

    for (const email of emails) {
      const ensured = await ensureOperatorUser(admin, email, password);
      if (!ensured.ok) return ensured;
    }

    const { data: sess, error } = await admin.auth.signInWithPassword({
      email: signInEmail,
      password,
    });
    if (error || !sess.session) {
      console.error(error ?? new Error("Sign-in failed"));
      return { ok: false, error: "Unlock failed" };
    }

    return {
      ok: true,
      access_token: sess.session.access_token,
      refresh_token: sess.session.refresh_token,
      expires_in: sess.session.expires_in,
    };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Unlock failed" };
  }
}

export const unlockOperator = createServerFn({ method: "POST" })
  .validator((data: unknown) => unlockSchema.parse(data))
  .handler(async ({ data }): Promise<UnlockResult> => {
    const pinCfg = expectedPin();
    if (!pinCfg.ok) return pinCfg;

    const rateKey = await unlockRateKey();
    const rate = checkRateLimit(rateKey);
    if (!rate.ok) return rate;

    if (data.pin !== pinCfg.pin) {
      recordUnlockFailure(rateKey);
      return { ok: false, error: "Invalid PIN" };
    }

    const result = await issueOperatorSession();
    if (result.ok) clearUnlockFailures(rateKey);
    return result;
  });

const portalSchema = z.object({
  clientId: z.string().min(1),
  token: z.string().min(8),
});

export type PortalStatementPayload = {
  ok: true;
  client: {
    id: string;
    name: string;
    promisedPayDate?: string;
    preferredPaymentMethod?: string;
  };
  statement: {
    current: number;
    days31To60: number;
    days61Plus: number;
    netDue: number;
    unappliedCredits: number;
    rows: {
      invoiceId: string;
      date: string;
      ageDays: number;
      remaining: number;
    }[];
  };
  openQuotes: {
    id: string;
    date: string;
    total: number;
    status: string;
  }[];
};

export type PortalStatementResult =
  | PortalStatementPayload
  | { ok: false; error: string };

/**
 * Server-scoped portal: uses service role, returns ONLY the matching client's
 * AR summary — never the full shop_state blob to the browser.
 */
export const fetchPortalStatement = createServerFn({ method: "POST" })
  .validator((data: unknown) => portalSchema.parse(data))
  .handler(async ({ data }): Promise<PortalStatementResult> => {
    try {
      const admin = adminClient();
      const { data: partiesRow, error: pErr } = await admin
        .from("shop_state")
        .select("value")
        .eq("key", "parties")
        .maybeSingle();
      if (pErr) {
        console.error(pErr);
        return { ok: false, error: "Portal unavailable" };
      }

      const { data: docsRow, error: dErr } = await admin
        .from("shop_state")
        .select("value")
        .eq("key", "documents")
        .maybeSingle();
      if (dErr) {
        console.error(dErr);
        return { ok: false, error: "Portal unavailable" };
      }

      type Party = {
        id: string;
        name: string;
        portalToken?: string;
        portalTokenExpiresAt?: string;
        promisedPayDate?: string;
        preferredPaymentMethod?: string;
      };
      type Doc = {
        id: string;
        kind: string;
        partyId?: string;
        partyName: string;
        partyKind?: string;
        date: string;
        total: number;
        status: string;
        amountPaid?: number;
      };

      const partiesVal = partiesRow?.value as { clients?: Party[] } | null;
      const clients = partiesVal?.clients ?? [];
      const client = clients.find((c) => c.id === data.clientId);
      if (
        !client ||
        !verifyPortalToken(
          data.clientId,
          data.token,
          client.portalToken,
          client.portalTokenExpiresAt,
        )
      ) {
        return { ok: false, error: "invalid" };
      }

      const docsVal = docsRow?.value as { documents?: Doc[] } | null;
      const documents = docsVal?.documents ?? [];

      const belongs = (doc: Doc) => {
        if (doc.partyKind && doc.partyKind !== "client") return false;
        if (doc.partyId) return doc.partyId === client.id;
        return doc.partyName.trim().toLowerCase() === client.name.trim().toLowerCase();
      };

      const invoices = documents.filter((d) => d.kind === "invoice" && belongs(d));
      const creditNotes = documents.filter((d) => d.kind === "credit_note" && belongs(d));
      const quotations = documents.filter(
        (d) =>
          d.kind === "quotation" &&
          belongs(d) &&
          (d.status === "Draft" || d.status === "Sent"),
      );

      const now = Date.now();
      const ageDays = (date: string) =>
        Math.max(0, Math.floor((now - new Date(`${date}T00:00:00`).getTime()) / 86_400_000));

      const round2 = (n: number) => Math.round(n * 100) / 100;

      let current = 0;
      let days31To60 = 0;
      let days61Plus = 0;
      const rows: PortalStatementPayload["statement"]["rows"] = [];

      for (const inv of invoices) {
        const paid = typeof inv.amountPaid === "number" ? inv.amountPaid : 0;
        const cnLinked = creditNotes.filter((c) => {
          const linked = (c as Doc & { invoiceId?: string }).invoiceId;
          return linked === inv.id;
        });
        const creditSum = cnLinked.reduce((s, c) => s + Number(c.total || 0), 0);
        const remaining = Math.max(0, round2(Number(inv.total || 0) - paid - creditSum));
        if (remaining <= 0.005) continue;
        const age = ageDays(inv.date);
        rows.push({
          invoiceId: inv.id,
          date: inv.date,
          ageDays: age,
          remaining,
        });
        if (age <= 30) current += remaining;
        else if (age <= 60) days31To60 += remaining;
        else days61Plus += remaining;
      }

      const unappliedCredits = creditNotes
        .filter((c) => !(c as Doc & { invoiceId?: string }).invoiceId)
        .reduce((s, c) => s + Number(c.total || 0), 0);

      const gross = current + days31To60 + days61Plus;
      const netDue = Math.max(0, round2(gross - unappliedCredits));

      return {
        ok: true,
        client: {
          id: client.id,
          name: client.name,
          promisedPayDate: client.promisedPayDate,
          preferredPaymentMethod: client.preferredPaymentMethod,
        },
        statement: {
          current: round2(current),
          days31To60: round2(days31To60),
          days61Plus: round2(days61Plus),
          netDue,
          unappliedCredits: round2(unappliedCredits),
          rows: rows.sort((a, b) => b.ageDays - a.ageDays),
        },
        openQuotes: quotations
          .map((q) => ({
            id: q.id,
            date: q.date,
            total: Number(q.total || 0),
            status: q.status,
          }))
          .sort((a, b) => b.date.localeCompare(a.date)),
      };
    } catch (e) {
      console.error(e);
      return { ok: false, error: "Portal unavailable" };
    }
  });
