/**
 * Operator unlock — server verifies PIN, returns a Supabase Auth session
 * so RLS can require `authenticated` on shop_state.
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

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

function expectedPin(): string {
  return env("OPERATOR_PIN") || env("VITE_OPERATOR_PIN") || "partsvillage";
}

function operatorEmail(): string {
  return env("OPERATOR_EMAIL") || "operator@partsvillage.local";
}

function operatorPassword(): string {
  return env("OPERATOR_PASSWORD") || expectedPin();
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

export const unlockOperator = createServerFn({ method: "POST" })
  .validator((data: unknown) => unlockSchema.parse(data))
  .handler(async ({ data }): Promise<UnlockResult> => {
    if (data.pin !== expectedPin()) {
      return { ok: false, error: "Invalid PIN" };
    }

    const admin = adminClient();
    const email = operatorEmail();
    const password = operatorPassword();

    // Ensure operator user exists (idempotent).
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = listed.data?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (!existing) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: "operator" },
      });
      if (created.error) {
        return { ok: false, error: created.error.message };
      }
    } else {
      // Keep password in sync with env (PIN changes).
      await admin.auth.admin.updateUserById(existing.id, { password });
    }

    const { data: sess, error } = await admin.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !sess.session) {
      return { ok: false, error: error?.message || "Sign-in failed" };
    }

    return {
      ok: true,
      access_token: sess.session.access_token,
      refresh_token: sess.session.refresh_token,
      expires_in: sess.session.expires_in,
    };
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
    const admin = adminClient();
    const { data: partiesRow, error: pErr } = await admin
      .from("shop_state")
      .select("value")
      .eq("key", "parties")
      .maybeSingle();
    if (pErr) return { ok: false, error: pErr.message };

    const { data: docsRow, error: dErr } = await admin
      .from("shop_state")
      .select("value")
      .eq("key", "documents")
      .maybeSingle();
    if (dErr) return { ok: false, error: dErr.message };

    type Party = {
      id: string;
      name: string;
      portalToken?: string;
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
    if (!client?.portalToken || client.portalToken !== data.token) {
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
      if (inv.status === "Void" || inv.status === "Cancelled") continue;
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
  });
