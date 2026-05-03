import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Truck, Wifi } from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@/lib/currency";

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrders,
});

interface OrderRow {
  id: string;
  order_number: string;
  email: string;
  total: number;
  status: string;
  tracking_number: string | null;
  carrier: string | null;
  created_at: string;
}

const STATUSES = ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"] as const;

function AdminOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState({ number: "", carrier: "" });

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function load() {
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, email, total, status, tracking_number, carrier, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    setOrders((data ?? []) as OrderRow[]);
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("orders").update({ status: status as OrderRow["status"] as never }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Status updated");
    if (status === "delivered") {
      // Credit referral bonus (₹50 each) and order cashback on delivery
      await supabase.rpc("process_first_order_referral", { p_order_id: id });
      await supabase.rpc("credit_order_wallet", { p_order_id: id });
    }
  }

  async function saveTracking(id: string) {
    const { error } = await supabase
      .from("orders")
      .update({ tracking_number: trackingInput.number || null, carrier: trackingInput.carrier || null, status: "shipped" })
      .eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Tracking saved"); setEditing(null); }
  }

  const filtered = orders.filter((o) =>
    !search || o.order_number.toLowerCase().includes(search.toLowerCase()) || o.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl tracking-wide">Orders</h2>
          <p className="flex items-center gap-1 text-xs text-primary"><Wifi className="h-3 w-3" /> Live updates enabled</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order # or email"
            className="rounded-full border border-border bg-card py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-3 text-left">Order</th>
              <th className="px-3 py-3 text-left">Customer</th>
              <th className="px-3 py-3 text-left">Date</th>
              <th className="px-3 py-3 text-right">Total</th>
              <th className="px-3 py-3 text-left">Status</th>
              <th className="px-3 py-3 text-left">Tracking</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-t border-border align-top">
                <td className="px-3 py-3 font-mono text-xs">{o.order_number}</td>
                <td className="px-3 py-3 text-xs">{o.email}</td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                <td className="px-3 py-3 text-right font-display">{formatINR(Number(o.total))}</td>
                <td className="px-3 py-3">
                  <select
                    value={o.status}
                    onChange={(e) => updateStatus(o.id, e.target.value)}
                    className="rounded-full border border-border bg-background text-foreground px-2 py-1 text-[11px] font-bold uppercase tracking-wider"
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-3 py-3">
                  {editing === o.id ? (
                    <div className="flex flex-col gap-1">
                      <input value={trackingInput.number} onChange={(e) => setTrackingInput((s) => ({ ...s, number: e.target.value }))} placeholder="Tracking #" className="rounded border border-border bg-background px-2 py-1 text-xs" />
                      <input value={trackingInput.carrier} onChange={(e) => setTrackingInput((s) => ({ ...s, carrier: e.target.value }))} placeholder="Carrier" className="rounded border border-border bg-background px-2 py-1 text-xs" />
                      <div className="flex gap-1">
                        <button onClick={() => saveTracking(o.id)} className="rounded bg-primary px-2 py-1 text-[10px] font-bold uppercase text-primary-foreground">Save</button>
                        <button onClick={() => setEditing(null)} className="rounded border border-border px-2 py-1 text-[10px] font-bold uppercase">Cancel</button>
                      </div>
                    </div>
                  ) : o.tracking_number ? (
                    <button onClick={() => { setEditing(o.id); setTrackingInput({ number: o.tracking_number ?? "", carrier: o.carrier ?? "" }); }} className="text-left">
                      <div className="font-mono text-xs">{o.tracking_number}</div>
                      <div className="text-[10px] text-muted-foreground">{o.carrier}</div>
                    </button>
                  ) : (
                    <button onClick={() => { setEditing(o.id); setTrackingInput({ number: "", carrier: "" }); }} className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-1 text-[10px] font-bold uppercase tracking-wider hover:border-primary">
                      <Truck className="h-3 w-3" /> Add
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No orders match.</p>}
      </div>
    </div>
  );
}
