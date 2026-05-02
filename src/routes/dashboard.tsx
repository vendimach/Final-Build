import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Package, Gift, Repeat, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@/lib/currency";

interface Profile {
  display_name: string | null;
  referral_code: string;
  loyalty_points: number;
}
interface OrderRow {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
}

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — VendiMan" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("profiles").select("display_name, referral_code, loyalty_points").eq("id", user.id).maybeSingle(),
      supabase.from("orders").select("id, order_number, status, total, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
    ])
      .then(([p, o]) => {
        if (p.data) setProfile(p.data as Profile);
        if (o.data) setOrders(o.data as OrderRow[]);
      })
      .finally(() => setLoading(false));

    // Realtime: subscribe to status changes on this user's orders
    const channel = supabase
      .channel(`user-orders-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` }, (payload) => {
        const updated = payload.new as OrderRow;
        setOrders((cur) => cur.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
        toast.info(`Order ${updated.order_number} → ${updated.status}`);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const referralLink = profile ? `${window.location.origin}/?ref=${profile.referral_code}` : "";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Welcome back</p>
            <h1 className="mt-1 font-display text-4xl tracking-wide md:text-5xl">
              {profile?.display_name || user?.email}
            </h1>
          </div>
          <div className="rounded-2xl border border-border bg-card px-5 py-3 text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Loyalty Points</div>
            <div className="font-display text-3xl text-primary">{profile?.loyalty_points ?? 0}</div>
          </div>
        </div>

        {/* Referral */}
        <section className="mt-8 rounded-2xl border border-border bg-gradient-to-br from-card to-primary/5 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
            <Gift className="h-4 w-4" /> Refer & Earn
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Share your link. Friends get 10% off — you get ₹100 in store credit per successful referral.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              readOnly
              value={referralLink}
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-xs"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(referralLink);
                setCopied(true);
                toast.success("Copied!");
                setTimeout(() => setCopied(false), 2000);
              }}
              className="btn-glow inline-flex items-center gap-2 rounded-xl bg-gradient-ember px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </section>

        {/* Orders */}
        <section className="mt-8">
          <h2 className="flex items-center gap-2 font-display text-2xl tracking-wide">
            <Package className="h-5 w-5 text-primary" /> Recent Orders
          </h2>
          {orders.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border p-12 text-center">
              <p className="text-sm text-muted-foreground">No orders yet.</p>
              <Link to="/shop" search={{ query: "" }} className="btn-glow mt-4 inline-flex rounded-full bg-gradient-ember px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground">
                Shop the Lineup
              </Link>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border border-border">
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
                  {orders.map((o) => (
                    <tr key={o.id} className="border-t border-border">
                      <td className="px-4 py-3 font-mono text-xs">{o.order_number}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-display">{formatINR(o.total)}</td>
                      <td className="px-4 py-3 text-right">
                        <button className="btn-glow inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider">
                          <Repeat className="h-3 w-3" /> Reorder
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
