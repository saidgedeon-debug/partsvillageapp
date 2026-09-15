import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { SHOP_CHAT_SYSTEM, SHOP_CHAT_TOOLS } from "@/lib/shop-chat-tools";

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

const toolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "tool"]),
  content: z.string().nullable().optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z.array(toolCallSchema).optional(),
});

const inputSchema = z.object({
  accessToken: z.string().min(8),
  messages: z.array(messageSchema).min(1).max(24),
});

export type ShopChatAssistantMessage = {
  role: "assistant";
  content: string | null;
  tool_calls?: z.infer<typeof toolCallSchema>[];
};

export type ShopChatResult =
  | { ok: true; message: ShopChatAssistantMessage }
  | { ok: false; error: string };

async function requireOperator(accessToken: string): Promise<boolean> {
  try {
    const admin = adminClient();
    const { data, error } = await admin.auth.getUser(accessToken);
    return Boolean(!error && data.user);
  } catch {
    return false;
  }
}

export const runShopChat = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<ShopChatResult> => {
    if (!(await requireOperator(data.accessToken))) {
      return { ok: false, error: "Unlock the shop to use ChatGPT" };
    }
    const key = env("OPENAI_API_KEY");
    if (!key) {
      return {
        ok: false,
        error: "ChatGPT is not connected yet. Add OPENAI_API_KEY on the server (Vercel env).",
      };
    }

    const messages = [
      { role: "system" as const, content: SHOP_CHAT_SYSTEM },
      ...data.messages.map((m) => {
        if (m.role === "tool") {
          return {
            role: "tool" as const,
            tool_call_id: m.tool_call_id ?? "",
            content: (m.content ?? "").slice(0, 8000),
          };
        }
        if (m.role === "assistant" && m.tool_calls?.length) {
          return {
            role: "assistant" as const,
            content: m.content ?? null,
            tool_calls: m.tool_calls,
          };
        }
        return {
          role: m.role,
          content: (m.content ?? "").slice(0, 4000),
        };
      }),
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env("OPENAI_MODEL") || "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 900,
        messages,
        tools: SHOP_CHAT_TOOLS,
      }),
    });

    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
      choices?: Array<{ message?: ShopChatAssistantMessage }>;
    } | null;

    if (!res.ok) {
      const msg = body?.error?.message?.trim() || `OpenAI HTTP ${res.status}`;
      return { ok: false, error: msg };
    }

    const message = body?.choices?.[0]?.message;
    if (!message) return { ok: false, error: "ChatGPT returned an empty reply" };
    return {
      ok: true,
      message: {
        role: "assistant",
        content: message.content ?? null,
        tool_calls: message.tool_calls,
      },
    };
  });
