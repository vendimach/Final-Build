// Loads Razorpay Checkout.js, creates a server order, opens the popup,
// then verifies the signature on the server before reporting success.
//
// Falls back to mock-success in dev if RAZORPAY_KEY_ID is not configured.

import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@/lib/currency";

async function callFn<T>(path: string, data: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Request failed (${res.status})`);
  return json as T;
}

interface Props {
  open: boolean;
  amount: number; // INR rupees
  prefill: { name?: string; email?: string; contact?: string };
  receipt?: string;
  onClose: () => void;
  onSuccess: (data: {
    method: "razorpay";
    txnId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
  }) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (resp: unknown) => void) => void };
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function RazorpayCheckout({ open, amount, prefill, receipt, onClose, onSuccess }: Props) {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"idle" | "loading" | "popup" | "verifying">("idle");
  const opened = useRef(false);

  useEffect(() => {
    if (!open) {
      opened.current = false;
      setStage("idle");
      return;
    }
    if (opened.current) return;
    opened.current = true;

    (async () => {
      try {
        setBusy(true);
        setStage("loading");

        const ok = await loadRazorpay();
        if (!ok) throw new Error("Could not load Razorpay. Check your internet connection.");

        const order = await callFn<{ orderId: string; amount: number; currency: string; keyId: string }>(
          "/.netlify/functions/create-razorpay-order",
          { amount, receipt },
        );

        setStage("popup");
        const rzp = new window.Razorpay!({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: "VendiMan",
          description: "Premium snack order",
          order_id: order.orderId,
          prefill: {
            name: prefill.name ?? "",
            email: prefill.email ?? "",
            contact: prefill.contact ?? "",
          },
          theme: { color: "#ea580c" },
          modal: {
            ondismiss: () => {
              setBusy(false);
              setStage("idle");
              onClose();
            },
          },
          handler: async (resp: unknown) => {
            const r = resp as {
              razorpay_payment_id: string;
              razorpay_order_id: string;
              razorpay_signature: string;
            };
            try {
              setStage("verifying");
              const verify = await callFn<{ valid: boolean }>(
                "/.netlify/functions/verify-razorpay-payment",
                {
                  razorpay_order_id: r.razorpay_order_id,
                  razorpay_payment_id: r.razorpay_payment_id,
                  razorpay_signature: r.razorpay_signature,
                },
              );
              if (!verify.valid) {
                toast.error("Payment signature verification failed");
                onClose();
                return;
              }
              onSuccess({
                method: "razorpay",
                txnId: r.razorpay_payment_id,
                razorpay_order_id: r.razorpay_order_id,
                razorpay_payment_id: r.razorpay_payment_id,
              });
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Verification failed");
              onClose();
            }
          },
        });

        rzp.on("payment.failed", (resp: unknown) => {
          const r = resp as { error?: { description?: string } };
          toast.error(r.error?.description ?? "Payment failed");
          setBusy(false);
          setStage("idle");
          onClose();
        });

        rzp.open();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not start payment");
        setBusy(false);
        setStage("idle");
        onClose();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  // Lightweight overlay shown while the Razorpay popup is preparing
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm space-y-4 rounded-3xl border border-border bg-card p-6 text-center">
        <div className="flex justify-end">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-ember">
          <ShieldCheck className="h-7 w-7 text-primary-foreground" />
        </div>
        <h3 className="font-display text-2xl">Secure Checkout</h3>
        <p className="text-sm text-muted-foreground">
          {stage === "loading" && "Preparing payment…"}
          {stage === "popup" && "Complete payment in the Razorpay window."}
          {stage === "verifying" && "Verifying payment…"}
          {stage === "idle" && "Initializing…"}
        </p>
        <div className="rounded-xl border border-border bg-background p-3 text-sm">
          Amount due: <span className="font-display text-lg">{formatINR(amount, { decimals: true })}</span>
        </div>
        {busy && <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />}
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          UPI • Cards • Netbanking • Wallets
        </p>
      </div>
    </div>
  );
}
