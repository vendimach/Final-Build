import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Package, Wallet, MapPin, User } from "lucide-react";
import { formatINR } from "@/lib/currency";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — VendiMan" }, { name: "robots", content: "noindex" }] }),
  component: DashboardLayout,
});

const NAV = [
  { to: "/dashboard/orders" as const, label: "Orders", icon: Package },
  { to: "/dashboard/wallet" as const, label: "Wallet", icon: Wallet },
  { to: "/dashboard/addresses" as const, label: "Addresses", icon: MapPin },
  { to: "/dashboard/profile" as const, label: "Profile", icon: User },
];

function DashboardLayout() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, wallet_balance")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name);
          setWalletBalance(Number(data.wallet_balance) || 0);
        }
      });

    // Update wallet balance on realtime wallet transaction
    const ch = supabase
      .channel(`dash-wallet-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wallet_transactions", filter: `user_id=eq.${user.id}` }, (payload) => {
        const txn = payload.new as { amount: number };
        setWalletBalance((prev) => (prev ?? 0) + txn.amount);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Page header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">My Account</p>
            <h1 className="mt-1 font-display text-4xl tracking-wide">
              {displayName || user?.email?.split("@")[0] || "Dashboard"}
            </h1>
          </div>
          <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-primary/5 px-5 py-3 text-right">
            <div className="flex items-center justify-end gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              <Wallet className="h-3 w-3" /> Wallet
            </div>
            <div className="mt-0.5 font-display text-2xl text-primary">
              {walletBalance === null ? "—" : formatINR(walletBalance, { decimals: true })}
            </div>
          </div>
        </div>

        {/* Tab nav */}
        <nav className="mb-6 flex gap-1 rounded-2xl border border-border bg-card p-1.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeProps={{ className: "bg-gradient-ember text-primary-foreground shadow-ember" }}
              inactiveProps={{ className: "text-muted-foreground hover:text-foreground hover:bg-muted/60" }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors"
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>

        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
