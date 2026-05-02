import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, IndianRupee, ShoppingCart, Users, TrendingUp, Star, Package, AlertTriangle, Repeat } from "lucide-react";
import { formatINR } from "@/lib/currency";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

interface Metrics {
  totalRevenue: number;
  orderCount: number;
  customerCount: number;
  aov: number;
  csatAvg: number;
  csatCount: number;
  activeSubs: number;
  lowStockCount: number;
  conversionRate: number;
  topProducts: { name: string; revenue: number; qty: number }[];
  revenueByDay: { day: string; revenue: number }[];
  recentOrders: { order_number: string; total: number; status: string; created_at: string; email: string }[];
}

function AdminOverview() {
  const [m, setM] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [ordersRes, itemsRes, customersRes, subsRes, productsRes, visitsRes] = await Promise.all([
        supabase.from("orders").select("id, order_number, total, status, created_at, email, csat_score, user_id").gte("created_at", since).order("created_at", { ascending: false }),
        supabase.from("order_items").select("name, unit_price, quantity, order_id"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("products").select("id, name, stock"),
        supabase.from("newsletter_signups").select("id", { count: "exact", head: true }),
      ]);

      const orders = (ordersRes.data ?? []).filter((o) => o.status !== "cancelled" && o.status !== "refunded");
      const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0);
      const orderCount = orders.length;
      const aov = orderCount ? totalRevenue / orderCount : 0;

      const csatOrders = orders.filter((o) => o.csat_score);
      const csatAvg = csatOrders.length ? csatOrders.reduce((s, o) => s + Number(o.csat_score), 0) / csatOrders.length : 0;

      // Top products
      const orderIds = new Set(orders.map((o) => o.id));
      const items = (itemsRes.data ?? []).filter((i) => orderIds.has(i.order_id));
      const productMap = new Map<string, { revenue: number; qty: number }>();
      items.forEach((i) => {
        const cur = productMap.get(i.name) ?? { revenue: 0, qty: 0 };
        cur.revenue += Number(i.unit_price) * i.quantity;
        cur.qty += i.quantity;
        productMap.set(i.name, cur);
      });
      const topProducts = [...productMap.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Revenue by day (last 14)
      const dayMap = new Map<string, number>();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        dayMap.set(d.toISOString().slice(0, 10), 0);
      }
      orders.forEach((o) => {
        const day = new Date(o.created_at).toISOString().slice(0, 10);
        if (dayMap.has(day)) dayMap.set(day, (dayMap.get(day) ?? 0) + Number(o.total));
      });
      const revenueByDay = [...dayMap.entries()].map(([day, revenue]) => ({ day, revenue }));

      const lowStockCount = (productsRes.data ?? []).filter((p) => p.stock > 0 && p.stock <= 5).length;
      const visitors = visitsRes.count ?? 0;
      const conversionRate = visitors ? (orderCount / visitors) * 100 : 0;

      setM({
        totalRevenue,
        orderCount,
        customerCount: customersRes.count ?? 0,
        aov,
        csatAvg,
        csatCount: csatOrders.length,
        activeSubs: subsRes.count ?? 0,
        lowStockCount,
        conversionRate,
        topProducts,
        revenueByDay,
        recentOrders: orders.slice(0, 5).map((o) => ({
          order_number: o.order_number,
          total: Number(o.total),
          status: o.status,
          created_at: o.created_at,
          email: o.email,
        })),
      });
      setLoading(false);
    })();
  }, []);

  if (loading || !m) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const maxRev = Math.max(...m.revenueByDay.map((d) => d.revenue), 1);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl tracking-wide">Overview</h2>
        <p className="text-sm text-muted-foreground">Last 30 days</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Kpi icon={IndianRupee} label="Revenue" value={formatINR(m.totalRevenue)} accent />
        <Kpi icon={ShoppingCart} label="Orders" value={m.orderCount.toString()} />
        <Kpi icon={TrendingUp} label="Avg Order Value" value={formatINR(m.aov)} />
        <Kpi icon={Star} label="CSAT" value={m.csatAvg ? `${m.csatAvg.toFixed(1)} / 5` : "—"} sub={`${m.csatCount} ratings`} />
        <Kpi icon={Users} label="Customers" value={m.customerCount.toString()} />
        <Kpi icon={Repeat} label="Active Subs" value={m.activeSubs.toString()} />
        <Kpi icon={AlertTriangle} label="Low Stock" value={m.lowStockCount.toString()} warn={m.lowStockCount > 0} />
        <Kpi icon={TrendingUp} label="Conversion" value={`${m.conversionRate.toFixed(1)}%`} sub="visits → order" />
      </div>

      {/* Revenue chart */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="font-display text-xl">Revenue — 14 days</h3>
        <div className="mt-6 flex h-48 items-end gap-1.5">
          {m.revenueByDay.map((d) => (
            <div key={d.day} className="group flex flex-1 flex-col items-center gap-1">
              <div className="relative flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t bg-gradient-ember transition-all hover:opacity-80"
                  style={{ height: `${(d.revenue / maxRev) * 100}%`, minHeight: d.revenue > 0 ? "4px" : "0" }}
                />
                <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-0.5 text-[10px] font-bold text-background opacity-0 group-hover:opacity-100">
                  {formatINR(d.revenue)}
                </div>
              </div>
              <span className="text-[9px] text-muted-foreground">{d.day.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top products */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="flex items-center gap-2 font-display text-xl"><Package className="h-5 w-5 text-primary" /> Top Products</h3>
          {m.topProducts.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No sales yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {m.topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold">{i + 1}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.qty} sold</div>
                  </div>
                  <div className="font-display">{formatINR(p.revenue)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent orders */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="flex items-center gap-2 font-display text-xl"><ShoppingCart className="h-5 w-5 text-primary" /> Recent Orders</h3>
          {m.recentOrders.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No recent orders.</p>
          ) : (
            <div className="mt-4 space-y-2 text-sm">
              {m.recentOrders.map((o) => (
                <div key={o.order_number} className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs">{o.order_number}</div>
                    <div className="truncate text-xs text-muted-foreground">{o.email}</div>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">{o.status}</span>
                  <span className="font-display">{formatINR(o.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, accent, warn }: { icon: typeof IndianRupee; label: string; value: string; sub?: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-primary/40 bg-gradient-to-br from-primary/10 to-card" : warn ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${warn ? "text-destructive" : "text-primary"}`} />
      </div>
      <div className="mt-2 font-display text-2xl">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
