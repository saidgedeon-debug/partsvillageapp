import { useCallback, useEffect, useState, type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let askConfirm: ((options: ConfirmOptions) => Promise<boolean>) | null = null;

/** Styled confirm — use instead of window.confirm. */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (askConfirm) return askConfirm(options);
  // SSR / tests fallback
  if (typeof window !== "undefined") {
    return Promise.resolve(window.confirm(`${options.title}\n\n${options.description ?? ""}`));
  }
  return Promise.resolve(false);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const request = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  useEffect(() => {
    askConfirm = request;
    return () => {
      if (askConfirm === request) askConfirm = null;
    };
  }, [request]);

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <>
      {children}
      <AlertDialog open={pending != null} onOpenChange={(open) => !open && close(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
            {pending?.description ? (
              <AlertDialogDescription className="whitespace-pre-line">
                {pending.description}
              </AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>
              {pending?.cancelLabel ?? "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                pending?.destructive && buttonVariants({ variant: "destructive" }),
              )}
              onClick={() => close(true)}
            >
              {pending?.confirmLabel ?? "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
