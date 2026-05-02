import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/coupons")({
  component: AdminCoupons,
});

interface Coupon {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  value: number;
  min_subtotal: number;
  max_uses: number | null;
  uses: number;
  is_active: boolean;
  expires_at: string | null;
}

function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Partial<Coupon>>({ discount_type: "percent", value: 10, min_subtotal: 0, is_active: true });

  async function load() {
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    setCoupons((data ?? []) as Coupon[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!draft.code) return toast.error("Code required");
    const { error } = await supabase.from("coupons").insert({
      code: draft.code.toUpperCase(),
      discount_type: draft.discount_type ?? "percent",
      value: draft.value ?? 0,
      min_subtotal: draft.min_subtotal ?? 0,
      max_uses: draft.max_uses ?? null,
      is_active: draft.is_active ?? true,
      expires_at: draft.expires_at ? new Date(draft.expires_at).toISOString() : null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Coupon created"); setDraft({ discount_type: "percent", value: 10, min_subtotal: 0, is_active: true }); load(); }
  }

  async function toggle(id: string, is_active: boolean) {
    await supabase.from("coupons").update({ is_active: !is_active }).eq("id", id);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this coupon?")) return;
    await supabase.from("coupons").delete().eq("id", id);
    load();
  }

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <h2 className="font-display text-3xl tracking-wide">Coupons</h2>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider">New coupon</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Code</span>
            <input placeholder="WELCOME10" value={draft.code ?? ""} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm uppercase" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Type</span>
            <select value={draft.discount_type} onChange={(e) => setDraft({ ...draft, discount_type: e.target.value as "percent" | "fixed" })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="percent">% off</option><option value="fixed">₹ off</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Value</span>
            <input type="number" step="0.01" placeholder="10" value={draft.value ?? ""} onChange={(e) => setDraft({ ...draft, value: parseFloat(e.target.value) })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Min subtotal (₹)</span>
            <input type="number" step="0.01" placeholder="0" value={draft.min_subtotal ?? 0} onChange={(e) => setDraft({ ...draft, min_subtotal: parseFloat(e.target.value) })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Max uses (blank = unlimited)</span>
            <input type="number" placeholder="100" value={draft.max_uses ?? ""} onChange={(e) => setDraft({ ...draft, max_uses: e.target.value ? parseInt(e.target.value) : null })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expires at (optional)</span>
            <input type="datetime-local" value={draft.expires_at ?? ""} onChange={(e) => setDraft({ ...draft, expires_at: e.target.value || null })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <label className="flex items-center gap-2 sm:col-span-2 lg:col-span-1">
            <input type="checkbox" checked={draft.is_active ?? true} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
            <span className="text-xs uppercase tracking-wider">Active</span>
          </label>
          <div className="flex items-end">
            <button onClick={create} className="btn-glow inline-flex w-full items-center justify-center gap-1 rounded-lg bg-gradient-ember px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground"><Plus className="h-3 w-3" /> Add coupon</button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-3 py-3 text-left">Code</th><th className="px-3 py-3 text-left">Discount</th><th className="px-3 py-3 text-right">Min</th><th className="px-3 py-3 text-right">Uses</th><th className="px-3 py-3 text-left">Expires</th><th className="px-3 py-3 text-left">Status</th><th></th></tr>
          </thead>
          <tbody>
            {coupons.map((c) => {
              const expired = c.expires_at ? new Date(c.expires_at) < new Date() : false;
              const usedUp = c.max_uses != null && c.uses >= c.max_uses;
              return (
              <tr key={c.id} className={`border-t border-border ${expired || usedUp ? "opacity-60" : ""}`}>
                <td className="px-3 py-3 font-mono">{c.code}</td>
                <td className="px-3 py-3">{c.discount_type === "percent" ? `${c.value}%` : `₹${c.value}`}</td>
                <td className="px-3 py-3 text-right">₹{Number(c.min_subtotal).toFixed(2)}</td>
                <td className="px-3 py-3 text-right">{c.uses}{c.max_uses ? ` / ${c.max_uses}` : ""}</td>
                <td className="px-3 py-3 text-xs">{c.expires_at ? new Date(c.expires_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}</td>
                <td className="px-3 py-3">
                  <button onClick={() => toggle(c.id, c.is_active)} className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${expired ? "bg-destructive/15 text-destructive" : usedUp ? "bg-muted text-muted-foreground" : c.is_active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {expired ? "Expired" : usedUp ? "Used up" : c.is_active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-3 py-3 text-right">
                  <button onClick={() => remove(c.id)} className="rounded-full border border-destructive/40 p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /></button>
                </td>
              </tr>
            );})}
          </tbody>
        </table>
        {coupons.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No coupons yet.</p>}
      </div>
    </div>
  );
}
