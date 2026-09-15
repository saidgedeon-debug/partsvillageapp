import { useNavigate } from "@tanstack/react-router";
import { Loader2, MessageCircle, Send } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { useCart } from "@/components/app/cart-context";
import { useDocuments } from "@/components/app/documents-context";
import { useInventory } from "@/components/app/inventory-context";
import { useParties } from "@/components/app/parties-context";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatConfirmPayment, runShopChatTool } from "@/lib/shop-chat-execute";
import { runShopChat, type ShopChatAssistantMessage } from "@/lib/shop-chat-server";
import { SHOP_CHAT_CONFIRM_TOOLS } from "@/lib/shop-chat-tools";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type ApiMessage = {
  role: "user" | "assistant" | "tool";
  content?: string | null;
  tool_call_id?: string;
  tool_calls?: ShopChatAssistantMessage["tool_calls"];
};

type Bubble = { id: string; role: "user" | "assistant"; text: string };

type ShopChatCtx = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const ShopChatContext = createContext<ShopChatCtx | null>(null);

export function ShopChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return <ShopChatContext.Provider value={value}>{children}</ShopChatContext.Provider>;
}

export function useShopChat() {
  const ctx = useContext(ShopChatContext);
  if (!ctx) throw new Error("useShopChat must be used within ShopChatProvider");
  return ctx;
}

function trimApiMessages(msgs: ApiMessage[]): ApiMessage[] {
  const sliced = msgs.slice(-20);
  while (sliced.length && sliced[0]?.role === "tool") sliced.shift();
  if (sliced[0]?.role === "assistant" && sliced[0].tool_calls?.length) {
    const idx = sliced.findIndex((m) => m.role === "user");
    return idx > 0 ? sliced.slice(idx) : sliced;
  }
  return sliced;
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function ShopChat() {
  const { open, setOpen } = useShopChat();
  const navigate = useNavigate();
  const { clients } = useParties();
  const { parts } = useInventory();
  const { documents, invoices, creditNotes, recordAccountPayment, recordInvoicePayment } =
    useDocuments();
  const { addPart, documentKind, setDocumentKind, setCartOpen, setCartParty } = useCart();

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([
    {
      id: "hello",
      role: "assistant",
      text: "Hi — English or Arabic. Ask dues, stock, what a client received, or tell me to add a part / record a payment.",
    },
  ]);
  const [apiMessages, setApiMessages] = useState<ApiMessage[]>([]);
  const [confirmText, setConfirmText] = useState<string | null>(null);
  const confirmWait = useRef<{ resolve: (ok: boolean) => void } | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const toolCtx = useMemo(
    () => ({
      clients,
      parts,
      documents,
      invoices,
      creditNotes,
      addToCart: (part: (typeof parts)[number], qty: number) => {
        if (!documentKind) setDocumentKind("invoice");
        addPart(part, qty);
        setCartOpen(true);
        toast.success(`Cart: ${part.partNumber} × ${qty}`);
      },
      recordAccountPayment,
      recordInvoicePayment,
      openClient: (clientId: string) => {
        setOpen(false);
        void navigate({ to: "/clients/$clientId", params: { clientId } });
      },
    }),
    [
      addPart,
      clients,
      creditNotes,
      documentKind,
      documents,
      invoices,
      navigate,
      parts,
      recordAccountPayment,
      recordInvoicePayment,
      setCartOpen,
      setDocumentKind,
      setOpen,
    ],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bubbles, busy, confirmText]);

  const askConfirm = useCallback((text: string) => {
    setConfirmText(text);
    return new Promise<boolean>((resolve) => {
      confirmWait.current = { resolve };
    });
  }, []);

  const finishConfirm = useCallback((ok: boolean) => {
    setConfirmText(null);
    confirmWait.current?.resolve(ok);
    confirmWait.current = null;
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const userBubble: Bubble = { id: `u-${Date.now()}`, role: "user", text };
    setBubbles((prev) => [...prev, userBubble]);
    setBusy(true);
    try {
      const session = await supabase?.auth.getSession();
      const accessToken = session?.data.session?.access_token;
      if (!accessToken) {
        setBubbles((prev) => [
          ...prev,
          { id: `e-${Date.now()}`, role: "assistant", text: "Unlock the shop first, then try ChatGPT." },
        ]);
        return;
      }

      let current: ApiMessage[] = [...apiMessages, { role: "user", content: text }];
      for (let round = 0; round < 6; round += 1) {
        const result = await runShopChat({ data: { accessToken, messages: current } });
        if (!result.ok) {
          setBubbles((prev) => [
            ...prev,
            { id: `e-${Date.now()}`, role: "assistant", text: result.error },
          ]);
          setApiMessages(current);
          return;
        }
        const msg = result.message;
        current = [...current, msg];
        if (msg.tool_calls?.length) {
          const toolMsgs: ApiMessage[] = [];
          for (const call of msg.tool_calls) {
            const args = parseArgs(call.function.arguments);
            if (SHOP_CHAT_CONFIRM_TOOLS.has(call.function.name)) {
              const ok = await askConfirm(formatConfirmPayment(args));
              if (!ok) {
                toolMsgs.push({
                  role: "tool",
                  tool_call_id: call.id,
                  content: JSON.stringify({ cancelled: true }),
                });
                continue;
              }
            }
            if (call.function.name === "add_to_cart") {
              const clientName = typeof args.clientName === "string" ? args.clientName : "";
              if (clientName) {
                const match = clients.find(
                  (c) => c.name.toLowerCase() === clientName.trim().toLowerCase(),
                );
                if (match) setCartParty(match.id, match.name);
              }
            }
            toolMsgs.push({
              role: "tool",
              tool_call_id: call.id,
              content: runShopChatTool(call.function.name, args, toolCtx),
            });
          }
          current = [...current, ...toolMsgs];
          continue;
        }
        const reply = (msg.content ?? "").trim() || "Done.";
        setBubbles((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", text: reply }]);
        setApiMessages(trimApiMessages(current));
        return;
      }
      setBubbles((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, role: "assistant", text: "I had to stop after several lookups. Try a shorter question." },
      ]);
      setApiMessages(current);
    } catch (err) {
      setBubbles((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          text: err instanceof Error ? err.message : "ChatGPT failed",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }, [apiMessages, askConfirm, busy, clients, input, setCartParty, toolCtx]);

  return (
    <>
      <Button
        type="button"
        size="lg"
        className="fixed z-40 h-12 w-12 rounded-full p-0 shadow-lg end-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6 md:end-6"
        aria-label="ChatGPT"
        onClick={() => setOpen(true)}
      >
        <MessageCircle className="h-5 w-5" />
      </Button>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) finishConfirm(false);
          setOpen(next);
        }}
      >
        <SheetContent side="right" className="flex w-full flex-col gap-3 p-4 sm:max-w-md">
          <SheetHeader className="pr-8 text-left">
            <SheetTitle>ChatGPT</SheetTitle>
            <SheetDescription>English and Arabic. She can look up the shop and do what you tell her.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-3 pe-3">
              {bubbles.map((b) => (
                <div
                  key={b.id}
                  dir="auto"
                  className={cn(
                    "max-w-[95%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    b.role === "user"
                      ? "ms-auto bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {b.text}
                </div>
              ))}
              {busy && !confirmText ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Working…
                </div>
              ) : null}
              <div ref={endRef} />
            </div>
          </ScrollArea>
          {confirmText ? (
            <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950/40">
              <p dir="auto">{confirmText}</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={() => finishConfirm(true)}>
                  Do it
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => finishConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="English or العربية…"
                className="min-h-[52px] flex-1"
                dir="auto"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <Button type="button" size="icon" disabled={busy || !input.trim()} onClick={() => void send()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
