import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2, Package, MapPin, CreditCard, Receipt } from "lucide-react";
import { formatINR } from "@/lib/currency";

export const Route = createFileRoute("/order-confirmed")({
  validateSearch: (search: Record<string, unknown>) => ({
    order: typeof search.order === "string" ? search.order : "",
  }),
  head: () => ({
    meta: [
      { title: "Order Confirmed — VendiMan" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderConfirmed,
});

interface OrderRow {
  id: string;
  order_number: string;
  status: string;
  email: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  currency: string;
  payment_method: string | null;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  transaction_id: string | null;
  coupon_code: string | null;
  shipping_address: Record<string, unknown> | null;
  created_at: string;
}

interface ItemRow {
  id: string;
  name: string;
  unit_price: number;
  quantity: number;
}

function OrderConfirmed() {
  const { order: orderNumber } = Route.useSearch();
  const router = useRouter();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  // Poll for the order in case the insert/redirect race is brief
  useEffect(() => {
    if (!orderNumber) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const tryFetch = async (n: number): Promise<void> => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("order_number", orderNumber)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) {
        setOrder(data as OrderRow);
        const { data: it } = await supabase
          .from("order_items")
          .select("id, name, unit_price, quantity")
          .eq("order_id", (data as OrderRow).id);
        if (!cancelled) {
          setItems((it ?? []) as ItemRow[]);
          setLoading(false);
        }
        return;
      }
      if (n < 5) {
        setAttempt(n + 1);
        setTimeout(() => tryFetch(n + 1), 1500);
      } else {
        setLoading(false);
      }
    };
    tryFetch(0);
    return () => { cancelled = true; };
  }, [orderNumber, router]);

  if (!orderNumber) {
    return (
      <Shell>
        <p className="text-center text-muted-foreground">Missing order reference.</p>
        <div className="mt-4 text-center">
          <Link to="/shop" search={{ query: "" }} className="text-sm text-primary underline">Back to shop</Link>
        </div>
      </Shell>
    );
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Confirming your order{attempt > 0 ? ` (retry ${attempt}/5)` : ""}…</p>
        </div>
      </Shell>
    );
  }

  if (!order) {
    return (
      <Shell>
        <p className="text-center font-display text-2xl">We couldn't find order {orderNumber}.</p>
        <p className="mt-2 text-center text-sm text-muted-foreground">If you were charged, please contact support — your order ID is {orderNumber}.</p>
      </Shell>
    );
  }

  const addr = (order.shipping_address ?? {}) as {
    recipient?: string; street1?: string; landmark?: string; city?: string; region?: string; postal_code?: string; country?: string; phone?: string;
  };

  return (
    <Shell>
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
          <CheckCircle2 className="h-9 w-9 text-primary" />
        </div>
        <h1 className="mt-4 font-display text-3xl tracking-wide md:text-4xl">Order confirmed</h1>
        <p className="mt-2 text-sm text-muted-foreground">Thanks! A confirmation has been emailed to {order.email}.</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">Order ID: <span className="text-foreground">{order.order_number}</span></p>
      </div>

      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <Card icon={Receipt} title="Payment">
          <Row k="Method" v={(order.payment_method ?? "razorpay").toUpperCase()} />
          {order.razorpay_payment_id && <Row k="Razorpay payment ID" v={<span className="font-mono break-all">{order.razorpay_payment_id}</span>} />}
          {order.razorpay_order_id && <Row k="Razorpay order ID" v={<span className="font-mono break-all">{order.razorpay_order_id}</span>} />}
          {order.transaction_id && <Row k="Transaction ID" v={<span className="font-mono break-all">{order.transaction_id}</span>} />}
          {order.coupon_code && <Row k="Coupon" v={order.coupon_code} />}
          <Row k="Status" v={<span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">{order.status}</span>} />
        </Card>

        <Card icon={MapPin} title="Shipping to">
          <p className="text-sm font-semibold">{addr.recipient ?? "—"}</p>
          <p className="text-sm text-muted-foreground">{addr.street1}{addr.landmark ? `, ${addr.landmark}` : ""}</p>
          <p className="text-sm text-muted-foreground">{addr.city}{addr.region ? `, ${addr.region}` : ""} {addr.postal_code ?? ""}</p>
          <p className="text-sm text-muted-foreground">{addr.country ?? "IN"}</p>
          {addr.phone && <p className="mt-1 text-sm text-muted-foreground">📞 {addr.phone}</p>}
        </Card>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
          <Package className="h-4 w-4 text-primary" /> Items
        </div>
        <ul className="mt-4 divide-y divide-border">
          {items.map((it) => (
            <li key={it.id} className="flex justify-between py-3 text-sm">
              <div>
                <p className="font-semibold">{it.name}</p>
                <p className="text-xs text-muted-foreground">Qty {it.quantity} × {formatINR(it.unit_price)}</p>
              </div>
              <p className="font-display">{formatINR(it.unit_price * it.quantity)}</p>
            </li>
          ))}
          {items.length === 0 && <li className="py-3 text-sm text-muted-foreground">No line items recorded.</li>}
        </ul>
        <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
          <Row k="Subtotal" v={formatINR(order.subtotal)} />
          {order.discount > 0 && <Row k="Discount" v={`-${formatINR(order.discount)}`} />}
          <Row k="Shipping" v={order.shipping === 0 ? "FREE" : formatINR(order.shipping)} />
          <div className="mt-2 flex justify-between border-t border-border pt-3">
            <span className="font-semibold">Total paid</span>
            <span className="font-display text-2xl">{formatINR(order.total, { decimals: true })}</span>
          </div>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/shop" search={{ query: "" }} className="btn-glow rounded-full bg-gradient-ember px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground">
          Continue shopping
        </Link>
        <Link
          to="/track"
          search={{ order: order.order_number }}
          className="btn-glow rounded-full border border-border bg-card px-6 py-3 text-xs font-bold uppercase tracking-wider"
        >
          Track this order
        </Link>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>
      <Footer />
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </div>
      <div className="space-y-1.5 text-sm">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
