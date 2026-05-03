import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Package, Gift, Repeat, Copy, Check, Wallet, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@/lib/currency";

interface Profile {
  display_name: string | null;
  referral_code: string;
  wallet_balance: number;
}

interface OrderRow {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
}

interface WalletTxn {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

interface ReferralRow {
  id: string;
  status: string;
  rewarded: boolean;
  created_at: string;
}

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — VendiMan" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

const TXN_LABELS: Record<string, string> = {
  order_cashback: "Order Cashback",
  referral_credit: "Referral Bonus",
  manual_credit: "Store Credit",
  debit: "Redeemed",
};

function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase
        .from("profiles")
        .select("display_name, referral_code, wallet_balance")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("orders")
        .select("id, order_number, status, total, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("wallet_transactions")
        .select("id, amount, type, description, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("referrals")
        .select("id, status, rewarded, created_at")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false }),
    ]).then(([p, o, t, r]) => {
      if (p.data) setProfile(p.data as Profile);
      if (o.data) setOrders(o.data as OrderRow[]);
      if (t.data) setTxns(t.data as WalletTxn[]);
      if (r.data) setReferrals(r.data as ReferralRow[]);
    }).finally(() => setLoading(false));

    const channel = supabase
      .channel(`user-orders-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` }, (payload) => {
        const updated = payload.new as OrderRow;
        setOrders((cur) => cur.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
        toast.info(`Order ${updated.order_number} → ${updated.status}`);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wallet_transactions", filter: `user_id=eq.${user.id}` }, (payload) => {
        const newTxn = payload.new as WalletTxn;
        setTxns((cur) => [newTxn, ...cur]);
        setProfile((p) => p ? { ...p, wallet_balance: p.wallet_balance + newTxn.amount } : p);
        if (newTxn.amount > 0) toast.success(`+${formatINR(newTxn.amount)} added to your wallet`);
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
          {/* Company Wallet Balance */}
          <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-primary/5 px-5 py-4 text-right">
            <div className="flex items-center justify-end gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              <Wallet className="h-3 w-3" /> Company Wallet
            </div>
            <div className="mt-1 font-display text-3xl text-primary">
              {formatINR(profile?.wallet_balance ?? 0, { decimals: true })}
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">Available credits</div>
          </div>
        </div>

        {/* Wallet Transaction History */}
        <section className="mt-8 rounded-2xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 font-display text-2xl tracking-wide">
            <Wallet className="h-5 w-5 text-primary" /> Wallet History
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Earn 10% cashback on orders above ₹799 · ₹100 bonus per successful referral
          </p>
          {txns.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">No transactions yet. Place an order above ₹799 to earn cashback!</p>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {txns.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${t.amount >= 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                      {t.amount >= 0
                        ? <ArrowDownLeft className="h-4 w-4" />
                        : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{TXN_LABELS[t.type] ?? t.type}</div>
                      {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-display text-lg ${t.amount >= 0 ? "text-primary" : "text-destructive"}`}>
                      {t.amount >= 0 ? "+" : ""}{formatINR(t.amount, { decimals: true })}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Referral */}
        <section className="mt-6 rounded-2xl border border-border bg-gradient-to-br from-card to-primary/5 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
            <Gift className="h-4 w-4" /> Refer & Earn
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Share your link. When your friend signs up and their <span className="font-semibold text-foreground">first order is delivered</span>, you both get{" "}
            <span className="font-semibold text-foreground">₹50 wallet credits</span> — one referral reward per user.
          </p>

          {referrals.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <span className="rounded-full border border-border bg-background px-3 py-1 font-semibold">
                {referrals.length} invited
              </span>
              <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-semibold text-primary">
                {referrals.filter((r) => r.rewarded).length} rewarded
              </span>
              {referrals.filter((r) => !r.rewarded).length > 0 && (
                <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 font-semibold text-amber-600">
                  {referrals.filter((r) => !r.rewarded).length} pending delivery
                </span>
              )}
            </div>
          )}

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
          <p className="mt-2 text-[11px] text-muted-foreground">
            Referral credits are issued automatically when the referred friend's first order is marked as delivered.
          </p>
        </section>

        {/* Orders */}
        <section className="mt-6">
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
                      <td className="px-4 py-3 text-muted-foreground">{new Date(o.created_at).toLocaleDateString("en-IN")}</td>
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
