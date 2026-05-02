import { useEffect, useState } from "react";
import { Loader2, Check, X, Smartphone, QrCode } from "lucide-react";

type Stage = "select" | "waiting" | "success" | "failed";

const UPI_APPS = [
  { id: "paytm", name: "Paytm", color: "#00BAF2", initial: "P" },
  { id: "phonepe", name: "PhonePe", color: "#5F259F", initial: "Pe" },
  { id: "gpay", name: "Google Pay", color: "#4285F4", initial: "G" },
  { id: "bhim", name: "BHIM UPI", color: "#F47B20", initial: "B" },
  { id: "razorpay", name: "Razorpay", color: "#3395FF", initial: "R" },
  { id: "card", name: "Card", color: "#0F172A", initial: "💳" },
];

interface Props {
  amount: number;
  open: boolean;
  onClose: () => void;
  onSuccess: (method: string, txnId: string) => void;
}

export function MockUpiPayment({ amount, open, onClose, onSuccess }: Props) {
  const [stage, setStage] = useState<Stage>("select");
  const [selected, setSelected] = useState<string | null>(null);
  const [vpa, setVpa] = useState("");
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    if (!open) {
      setStage("select");
      setSelected(null);
      setVpa("");
      setCountdown(15);
    }
  }, [open]);

  useEffect(() => {
    if (stage !== "waiting") return;
    if (countdown <= 0) {
      // Simulate ~92% success rate
      const success = Math.random() > 0.08;
      if (success) {
        const txnId = "TXN" + Date.now().toString(36).toUpperCase();
        setStage("success");
        setTimeout(() => {
          onSuccess(selected ?? "upi", txnId);
        }, 900);
      } else {
        setStage("failed");
      }
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, countdown, selected, onSuccess]);

  function startPayment(appId: string) {
    setSelected(appId);
    setCountdown(appId === "card" ? 4 : 8);
    setStage("waiting");
  }

  if (!open) return null;

  const app = UPI_APPS.find((a) => a.id === selected);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-background/40 px-5 py-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Secure Payment
            </div>
            <div className="font-display text-2xl">₹{(amount * 83).toFixed(0)} <span className="text-sm text-muted-foreground">(${amount.toFixed(2)})</span></div>
          </div>
          {stage === "select" && (
            <button onClick={onClose} className="rounded-full p-2 hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          {stage === "select" && (
            <>
              <h3 className="mb-4 font-display text-lg">Pay using</h3>
              <div className="grid grid-cols-3 gap-3">
                {UPI_APPS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => startPayment(a.id)}
                    className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-background p-4 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
                  >
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white"
                      style={{ background: a.color }}
                    >
                      {a.initial}
                    </div>
                    <span className="text-xs font-semibold">{a.name}</span>
                  </button>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-dashed border-border p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Smartphone className="h-3.5 w-3.5" /> Or pay via UPI ID
                </div>
                <div className="flex gap-2">
                  <input
                    value={vpa}
                    onChange={(e) => setVpa(e.target.value)}
                    placeholder="yourname@upi"
                    className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                  <button
                    disabled={!vpa.includes("@")}
                    onClick={() => startPayment("upi-vpa")}
                    className="rounded-xl bg-gradient-ember px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-40"
                  >
                    Pay
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <QrCode className="h-3 w-3" /> 100% Secure • Mock Sandbox
              </div>
            </>
          )}

          {stage === "waiting" && (
            <div className="flex flex-col items-center py-8 text-center">
              <div
                className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-bold text-white"
                style={{ background: app?.color ?? "#3395FF" }}
              >
                {app?.initial ?? "₹"}
              </div>
              <h3 className="font-display text-xl">Waiting for {app?.name ?? "UPI"}…</h3>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                {selected === "card"
                  ? "Authorizing card via secure gateway"
                  : "Approve the request in your UPI app to complete payment"}
              </p>
              <div className="mt-6 flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="font-mono text-sm tabular-nums">{countdown}s</span>
              </div>
              <button
                onClick={() => setStage("select")}
                className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-destructive"
              >
                Cancel
              </button>
            </div>
          )}

          {stage === "success" && (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/15">
                <Check className="h-10 w-10 text-green-500" strokeWidth={3} />
              </div>
              <h3 className="font-display text-2xl">Payment successful</h3>
              <p className="mt-1 text-sm text-muted-foreground">Placing your order…</p>
            </div>
          )}

          {stage === "failed" && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/15">
                <X className="h-10 w-10 text-destructive" strokeWidth={3} />
              </div>
              <h3 className="font-display text-xl">Payment failed</h3>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                The transaction could not be completed. Please try again.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setStage("select")}
                  className="rounded-full bg-gradient-ember px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground"
                >
                  Try again
                </button>
                <button
                  onClick={onClose}
                  className="rounded-full border border-border px-5 py-2 text-xs font-bold uppercase tracking-wider"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
