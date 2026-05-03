import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Mail, Award } from "lucide-react";
import { formatINR } from "@/lib/currency";

export const Route = createFileRoute("/admin/customers")({
  component: AdminCustomers,
});

interface CustomerRow {
  id: string;
  display_name: string | null;
  wallet_balance: number;
  referral_code: string;
  created_at: string;
  orderCount: number;
  totalSpent: number;
  email: string;
}

function AdminCustomers() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const [profilesRes, ordersRes] = await Promise.all([
        supabase.from("profiles").select("id, display_name, wallet_balance, referral_code, created_at"),
        supabase.from("orders").select("user_id, total, email").not("user_id", "is", null),
      ]);
      const orderMap = new Map<string, { count: number; total: number; email: string }>();
      (ordersRes.data ?? []).forEach((o) => {
        if (!o.user_id) return;
        const cur = orderMap.get(o.user_id) ?? { count: 0, total: 0, email: o.email };
        cur.count += 1;
        cur.total += Number(o.total);
        orderMap.set(o.user_id, cur);
      });
      const merged = (profilesRes.data ?? []).map((p) => {
        const stats = orderMap.get(p.id);
        return {
          ...p,
          orderCount: stats?.count ?? 0,
          totalSpent: stats?.total ?? 0,
          email: stats?.email ?? "—",
        };
      });
      merged.sort((a, b) => b.totalSpent - a.totalSpent);
      setRows(merged as CustomerRow[]);
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter((r) => !search || (r.display_name ?? "").toLowerCase().includes(search.toLowerCase()) || r.email.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-3xl tracking-wide">Customers</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="rounded-full border border-border bg-card py-2 pl-10 pr-4 text-sm" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-3 text-left">Name</th>
              <th className="px-3 py-3 text-left">Email</th>
              <th className="px-3 py-3 text-left">Joined</th>
              <th className="px-3 py-3 text-right">Orders</th>
              <th className="px-3 py-3 text-right">Spent</th>
              <th className="px-3 py-3 text-right">Loyalty</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-3 font-semibold">{r.display_name ?? "—"}</td>
                <td className="px-3 py-3 text-xs text-muted-foreground"><Mail className="mr-1 inline h-3 w-3" />{r.email}</td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="px-3 py-3 text-right">{r.orderCount}</td>
                <td className="px-3 py-3 text-right font-display">{formatINR(r.totalSpent)}</td>
                <td className="px-3 py-3 text-right text-primary"><Award className="mr-1 inline h-3 w-3" />{r.wallet_balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No customers yet.</p>}
      </div>
    </div>
  );
}
