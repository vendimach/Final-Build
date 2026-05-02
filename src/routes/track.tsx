import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Package, Truck, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@/lib/currency";

interface TrackedOrder {
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  tracking_number: string | null;
  carrier: string | null;
}

export const Route = createFileRoute("/track")({
  validateSearch: (search: Record<string, unknown>) => ({
    order: typeof search.order === "string" ? search.order : "",
  }),
  head: () => ({
    meta: [
      { title: "Track Order — VendiMan" },
      { name: "description", content: "Enter your order ID and email to see real-time shipping status." },
    ],
  }),
  component: TrackPage,
});

function TrackPage() {
  const search = Route.useSearch();
  const [orderId, setOrderId] = useState(search.order ?? "");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  async function lookup(e?: React.FormEvent) {
    e?.preventDefault();
    if (!orderId || !email) {
      toast.error("Order number and email required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("order_number, status, total, created_at, tracking_number, carrier")
        .eq("order_number", orderId.trim().toUpperCase())
        .eq("email", email.trim())
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("Order not found. Check your order number and email.");
        setOrder(null);
        return;
      }
      setOrder(data as TrackedOrder);
    } catch {
      toast.error("Could not look up order");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (search.order && email) lookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const steps: { key: string; label: string; icon: typeof Clock }[] = [
    { key: "pending", label: "Order Placed", icon: Clock },
    { key: "paid", label: "Payment Confirmed", icon: CheckCircle2 },
    { key: "processing", label: "Preparing", icon: Package },
    { key: "shipped", label: "Shipped", icon: Truck },
    { key: "delivered", label: "Delivered", icon: CheckCircle2 },
  ];
  const currentStep = order ? steps.findIndex((s) => s.key === order.status) : -1;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-5xl tracking-wide">Track My Order</h1>
        <p className="mt-2 text-sm text-muted-foreground">Enter your order number and email to see status.</p>

        <form onSubmit={lookup} className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-6">
          <input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            className="w-full rounded-full border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none"
            placeholder="Order ID (e.g. VM-XXXXX)"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="w-full rounded-full border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none"
            placeholder="Email"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-glow flex w-full items-center justify-center gap-2 rounded-full bg-gradient-ember py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Track
          </button>
        </form>

        {order && (
          <div className="mt-8 space-y-6 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Order</div>
                <div className="font-mono text-lg">{order.order_number}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Total</div>
                <div className="font-display text-2xl">{formatINR(order.total, { decimals: true })}</div>
              </div>
            </div>

            <div className="space-y-3">
              {steps.map((s, idx) => {
                const Icon = s.icon;
                const done = idx <= currentStep;
                const active = idx === currentStep;
                return (
                  <div key={s.key} className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                        done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-muted-foreground"
                      } ${active ? "shadow-ember" : ""}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className={done ? "text-sm font-semibold" : "text-sm text-muted-foreground"}>{s.label}</span>
                  </div>
                );
              })}
            </div>

            {order.tracking_number && (
              <div className="rounded-xl border border-border bg-background p-4 text-sm">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Tracking</div>
                <div className="mt-1 font-mono">{order.tracking_number}</div>
                {order.carrier && <div className="text-xs text-muted-foreground">via {order.carrier}</div>}
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
