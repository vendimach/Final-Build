import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Package, Repeat, Star } from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@/lib/currency";

export const Route = createFileRoute("/dashboard/orders")({
  component: DashboardOrders,
});

interface OrderRow {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  email: string;
  csat_score: number | null;
}

const STATUS_FILTERS = ["all", "pending", "paid", "processing", "shipped", "delivered", "cancelled"];

const STATUS_COLORS: Record<string, string> = {
  delivered: "bg-primary/10 text-primary",
  shipped:   "bg-amber-500/10 text-amber-600",
  processing:"bg-amber-500/10 text-amber-600",
  paid:      "bg-amber-500/10 text-amber-600",
  pending:   "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

function DashboardOrders() {
  const { user } = useAuth();
  const { addItem } = useCart();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [reordering, setReordering] = useState<string | null>(null);
  const [ratingOrder, setRatingOrder] = useState<string | null>(null);
  const [hoverStar, setHoverStar] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("orders")
      .select("id, order_number, status, total, created_at, email, csat_score")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setOrders((data ?? []) as OrderRow[]); setLoading(false); });

    const ch = supabase
      .channel(`orders-page-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` }, (payload) => {
        const updated = payload.new as OrderRow;
        setOrders((cur) => cur.map((o) => o.id === updated.id ? { ...o, ...updated } : o));
        toast.info(`Order ${updated.order_number} → ${updated.status}`);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  async function submitCsat(orderId: string, score: number) {
    const { error } = await supabase.from("orders").update({ csat_score: score }).eq("id", orderId);
    if (error) { toast.error(error.message); return; }
    setOrders((cur) => cur.map((o) => o.id === orderId ? { ...o, csat_score: score } : o));
    setRatingOrder(null);
    toast.success("Thanks for your feedback!");
  }

  async function reorder(orderId: string) {
    setReordering(orderId);
    try {
      const { data: items } = await supabase
        .from("order_items")
        .select("product_id, name, unit_price, quantity, is_bundle")
        .eq("order_id", orderId);
      if (!items?.length) { toast.error("Could not load order items"); return; }

      const productIds = items.filter((i) => !i.is_bundle && i.product_id).map((i) => i.product_id as string);
      let stockMap: Record<string, { image_url: string | null; stock: number }> = {};
      if (productIds.length > 0) {
        const { data: prods } = await supabase.from("products").select("id, image_url, stock").in("id", productIds);
        if (prods) stockMap = Object.fromEntries(prods.map((p) => [p.id, p]));
      }

      let added = 0;
      for (const item of items) {
        const info = item.product_id ? stockMap[item.product_id] : null;
        const ok = addItem({
          id: item.product_id ?? `bundle-${item.name}`,
          productId: item.product_id ?? "",
          name: item.name,
          price: Number(item.unit_price),
          image: info?.image_url ?? undefined,
          isBundle: !!item.is_bundle,
          maxStock: info?.stock,
        }, item.quantity);
        if (ok) added++;
      }
      if (added > 0) toast.success(`${added} item${added > 1 ? "s" : ""} added to cart`);
      else toast.error("Items may be out of stock");
    } catch {
      toast.error("Could not load order items");
    } finally {
      setReordering(null);
    }
  }

  const filtered = statusFilter === "all" ? orders : orders.filter((o) => o.status === statusFilter);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-2xl tracking-wide">
          <Package className="h-5 w-5 text-primary" /> Order History
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {statusFilter === "all" ? "No orders yet." : `No ${statusFilter} orders.`}
          </p>
          {statusFilter === "all" && (
            <Link
              to="/shop"
              search={{ query: "" }}
              className="btn-glow mt-4 inline-flex rounded-full bg-gradient-ember px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground"
            >
              Shop the Lineup
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const isDelivered = o.status === "delivered";
                const isTrackable = ["paid", "processing", "shipped"].includes(o.status);
                return (
                  <tr key={o.id} className="border-t border-border">
                    <td className="px-4 py-3 font-mono text-xs">{o.order_number}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[o.status] ?? "bg-muted text-muted-foreground"}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-display">{formatINR(o.total)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isTrackable && (
                          <Link
                            to="/track"
                            search={{ order: o.order_number, email: o.email }}
                            className="btn-glow inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600"
                          >
                            Track
                          </Link>
                        )}
                        {isDelivered && (
                          <button
                            onClick={() => reorder(o.id)}
                            disabled={reordering === o.id}
                            className="btn-glow inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
                          >
                            {reordering === o.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Repeat className="h-3 w-3" />}
                            Reorder
                          </button>
                        )}
                        {isDelivered && !o.csat_score && ratingOrder !== o.id && (
                          <button
                            onClick={() => setRatingOrder(o.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600"
                          >
                            <Star className="h-3 w-3" /> Rate
                          </button>
                        )}
                        {ratingOrder === o.id && (
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <button
                                key={s}
                                onClick={() => submitCsat(o.id, s)}
                                onMouseEnter={() => setHoverStar(s)}
                                onMouseLeave={() => setHoverStar(0)}
                                className="p-0.5"
                              >
                                <Star className={`h-4 w-4 transition-colors ${s <= (hoverStar || 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                              </button>
                            ))}
                          </div>
                        )}
                        {isDelivered && o.csat_score && (
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} className={`h-3 w-3 ${s <= o.csat_score! ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
