import { Mic, MicOff, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useCart } from "@/components/app/cart-context";
import { useInventory } from "@/components/app/inventory-context";
import { Button } from "@/components/ui/button";
import {
  parseVoiceCartTranscript,
  speechRecognitionSupported,
} from "@/lib/voice-cart";
import { partNumbersOf, type Part } from "@/lib/mock-data";

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string }; isFinal?: boolean }> }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function createRecognition(): RecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Ctor();
}

function findPart(parts: Part[], code: string): Part | undefined {
  const needle = code.replace(/\s+/g, "").toLowerCase();
  return parts.find((p) =>
    partNumbersOf(p).some((n) => n.replace(/\s+/g, "").toLowerCase() === needle) ||
    p.partNumber.replace(/\s+/g, "").toLowerCase().includes(needle) ||
    (p.name || "").toLowerCase().includes(needle),
  );
}

export function VoiceCartButton() {
  const { parts } = useInventory();
  const { addPart, setDocumentKind, documentKind, setCartOpen } = useCart();
  const [listening, setListening] = useState(false);
  const recRef = useRef<RecognitionLike | null>(null);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  if (!speechRecognitionSupported()) return null;

  const toggle = () => {
    if (listening) {
      try {
        recRef.current?.stop();
      } catch {
        // ignore
      }
      setListening(false);
      return;
    }

    const rec = createRecognition();
    if (!rec) {
      toast.error("Voice not supported on this browser");
      return;
    }
    recRef.current = rec;
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const transcript = Array.from(ev.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (!transcript) return;
      const intents = parseVoiceCartTranscript(transcript);
      if (!intents.length) {
        toast.message(`Heard: “${transcript}” — try “add PART qty 2”`);
        return;
      }
      if (!documentKind) setDocumentKind("invoice");
      let added = 0;
      for (const intent of intents) {
        const part = findPart(parts, intent.code);
        if (!part) {
          toast.error(`No match for ${intent.code}`);
          continue;
        }
        addPart(part, intent.qty);
        added += 1;
      }
      if (added) {
        setCartOpen(true);
        toast.success(`Added ${added} line${added === 1 ? "" : "s"} from voice`);
      }
    };
    rec.onerror = (ev) => {
      setListening(false);
      if (ev.error === "not-allowed") toast.error("Microphone permission denied");
      else if (ev.error !== "aborted") toast.error("Voice recognition failed");
    };
    rec.onend = () => setListening(false);
    try {
      rec.start();
      setListening(true);
      toast.message("Listening… say a part number and qty");
    } catch {
      toast.error("Could not start microphone");
      setListening(false);
    }
  };

  return (
    <Button
      type="button"
      variant={listening ? "default" : "outline"}
      size="sm"
      className="gap-1.5"
      onClick={toggle}
    >
      {listening ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
      {listening ? "Listening" : "Voice add"}
      {listening ? <MicOff className="h-3.5 w-3.5 opacity-70" /> : null}
    </Button>
  );
}
