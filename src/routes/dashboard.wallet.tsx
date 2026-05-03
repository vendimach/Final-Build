import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Wallet, ArrowDownLeft, ArrowUpRight, Gift, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@/lib/currency";

export const Route = createFileRoute("/dashboard/wallet")({
  component: DashboardWallet,
});

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

const TXN_LABELS: Record<string, string> = {
  order_cashback: "Order Cashback",
  referral_credit: "Referral Bonus",
  manual_credit: "Store Credit",
  debit: "Redeemed",
};

const TYPE_FILTERS = ["all", "credits", "debits"] as const;
type TypeFilter = typeof TYPE_FILTERS[number];

function DashboardWallet() {
  const { user } = useAuth();
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [referralCode, setReferralCode] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase
        .from("wallet_transactions")
        .select("id, amount, type, description, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("referrals")
        .select("id, status, rewarded, created_at")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("referral_code")
        .eq("id", user.id)
        .maybeSingle(),
    ]).then(([t, r, p]) => {
      setTxns((t.data ?? []) as WalletTxn[]);
      setReferrals((r.data ?? []) as ReferralRow[]);
      if (p.data) setReferralCode(p.data.referral_code ?? "");
      setLoading(false);
    });

    const ch = supabase
      .channel(`wallet-page-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wallet_transactions", filter: `user_id=eq.${user.id}` }, (payload) => {
        const newTxn = payload.new as WalletTxn;
        setTxns((cur) => [newTxn, ...cur]);
        if (newTxn.amount > 0) toast.success(`+${formatINR(newTxn.amount)} added to your wallet`);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const referralLink = referralCode ? `${window.location.origin}/auth?ref=${referralCode}` : "";
  const hasBeenRewarded = referrals.some((r) => r.rewarded);

  const filtered = txns.filter((t) => {
    if (typeFilter === "credits") return t.amount > 0;
    if (typeFilter === "debits") return t.amount < 0;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Refer & Earn — hidden once the user has a rewarded referral */}
      {!hasBeenRewarded && referralLink && (
        <section className="rounded-2xl border border-border bg-gradient-to-br from-card to-primary/5 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
            <Gift className="h-4 w-4" /> Refer & Earn
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Share your link. When your friend signs up and their{" "}
            <span className="font-semibold text-foreground">first order is delivered</span>, you both get{" "}
            <span className="font-semibold text-foreground">₹50 wallet credits</span> — one referral reward per user.
          </p>

          {referrals.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-border bg-background px-3 py-1 font-semibold">
                {referrals.length} invited
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
            Credits are issued automatically when the referred friend's first order is delivered.
          </p>
        </section>
      )}

      {/* Wallet transaction history */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-2xl tracking-wide">
            <Wallet className="h-5 w-5 text-primary" /> Transaction History
          </h2>
          <div className="flex gap-1.5">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  typeFilter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-4 text-xs text-muted-foreground">
          Earn 10% cashback on orders above ₹799 · ₹50 bonus per successful referral
        </p>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {typeFilter === "all" ? "No transactions yet." : `No ${typeFilter} yet.`}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${t.amount >= 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                    {t.amount >= 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
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
    </div>
  );
}
