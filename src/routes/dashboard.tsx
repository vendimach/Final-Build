import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Package, Gift, Repeat, Copy, Check, Wallet, ArrowDownLeft, ArrowUpRight, MapPin, Plus, Pencil, Trash2, X, Save } from "lucide-react";
import { toast } from "sonner";
import { formatINR, INDIAN_STATES } from "@/lib/currency";

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
  email: string;
}

interface SavedAddress {
  id: string;
  label: string | null;
  recipient: string;
  street1: string;
  street2: string | null;
  city: string;
  region: string | null;
  postal_code: string;
  phone: string | null;
  is_default: boolean;
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
  const { addItem } = useCart();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [reordering, setReordering] = useState<string | null>(null);

  // Address editing state
  const [addrFormOpen, setAddrFormOpen] = useState(false);
  const [editingAddr, setEditingAddr] = useState<SavedAddress | null>(null);
  const [addrDraft, setAddrDraft] = useState({
    label: "", recipient: "", street1: "", street2: "", city: "",
    region: "Maharashtra", postal_code: "", phone: "", is_default: false,
  });
  const [addrSaving, setAddrSaving] = useState(false);

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
        .select("id, order_number, status, total, created_at, email")
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
      supabase
        .from("addresses")
        .select("id, label, recipient, street1, street2, city, region, postal_code, phone, is_default")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false }),
    ]).then(([p, o, t, r, a]) => {
      if (p.data) setProfile(p.data as Profile);
      if (o.data) setOrders(o.data as OrderRow[]);
      if (t.data) setTxns(t.data as WalletTxn[]);
      if (r.data) setReferrals(r.data as ReferralRow[]);
      if (a.data) setAddresses(a.data as SavedAddress[]);
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
        const { data: prods } = await supabase
          .from("products").select("id, image_url, stock").in("id", productIds);
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
          image: info?.image_url,
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

  function openAddAddr(existing?: SavedAddress) {
    setEditingAddr(existing ?? null);
    setAddrDraft(existing ? {
      label: existing.label ?? "",
      recipient: existing.recipient,
      street1: existing.street1,
      street2: existing.street2 ?? "",
      city: existing.city,
      region: existing.region ?? "Maharashtra",
      postal_code: existing.postal_code,
      phone: existing.phone ?? "",
      is_default: existing.is_default,
    } : { label: "", recipient: "", street1: "", street2: "", city: "", region: "Maharashtra", postal_code: "", phone: "", is_default: addresses.length === 0 });
    setAddrFormOpen(true);
  }

  async function saveAddr() {
    if (!user) return;
    if (!addrDraft.recipient || !addrDraft.street1 || !addrDraft.city || !addrDraft.postal_code) {
      toast.error("Recipient, address, city and PIN are required"); return;
    }
    setAddrSaving(true);
    try {
      if (editingAddr) {
        const { error } = await supabase.from("addresses").update({ ...addrDraft, updated_at: new Date().toISOString() }).eq("id", editingAddr.id);
        if (error) throw error;
        setAddresses((prev) => prev.map((a) => a.id === editingAddr.id ? { ...a, ...addrDraft } : a));
      } else {
        if (addresses.length >= 4) { toast.error("Max 4 addresses allowed"); return; }
        const { data, error } = await supabase.from("addresses").insert({ ...addrDraft, user_id: user.id, country: "IN" }).select().single();
        if (error) throw error;
        setAddresses((prev) => [...prev, data as SavedAddress]);
      }
      toast.success(editingAddr ? "Address updated" : "Address saved");
      setAddrFormOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save address");
    } finally {
      setAddrSaving(false);
    }
  }

  async function deleteAddr(id: string) {
    const { error } = await supabase.from("addresses").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setAddresses((prev) => prev.filter((a) => a.id !== id));
    toast.success("Address removed");
  }

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

  const referralLink = profile ? `${window.location.origin}/auth?ref=${profile.referral_code}` : "";

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
                  {orders.map((o) => {
                    const isDelivered = o.status === "delivered";
                    const isTrackable = ["paid", "processing", "shipped"].includes(o.status);
                    return (
                      <tr key={o.id} className="border-t border-border">
                        <td className="px-4 py-3 font-mono text-xs">{o.order_number}</td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(o.created_at).toLocaleDateString("en-IN")}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            isDelivered ? "bg-primary/10 text-primary" :
                            isTrackable ? "bg-amber-500/10 text-amber-600" :
                            "bg-muted text-muted-foreground"
                          }`}>
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
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Saved Addresses */}
        <section className="mt-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="flex items-center gap-2 font-display text-2xl tracking-wide">
              <MapPin className="h-5 w-5 text-primary" /> Saved Addresses
            </h2>
            {!addrFormOpen && (
              <button
                onClick={() => openAddAddr()}
                disabled={addresses.length >= 4}
                className="btn-glow inline-flex items-center gap-1.5 rounded-full bg-gradient-ember px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                {addresses.length >= 4 ? "Limit reached" : "Add Address"}
              </button>
            )}
          </div>

          {/* Add / Edit form */}
          {addrFormOpen && (
            <div className="mt-4 rounded-2xl border border-primary/30 bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold">{editingAddr ? "Edit Address" : "New Address"}</h3>
                <button onClick={() => setAddrFormOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="addr-label">Label (optional)</span>
                  <input value={addrDraft.label} onChange={(e) => setAddrDraft((d) => ({ ...d, label: e.target.value }))} placeholder="Home, Office…" className="addr-input mt-1" />
                </label>
                <label className="block">
                  <span className="addr-label">Recipient *</span>
                  <input value={addrDraft.recipient} onChange={(e) => setAddrDraft((d) => ({ ...d, recipient: e.target.value }))} placeholder="Full name" className="addr-input mt-1" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="addr-label">Street line 1 *</span>
                  <input value={addrDraft.street1} onChange={(e) => setAddrDraft((d) => ({ ...d, street1: e.target.value }))} placeholder="House / flat / building" className="addr-input mt-1" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="addr-label">Street line 2</span>
                  <input value={addrDraft.street2} onChange={(e) => setAddrDraft((d) => ({ ...d, street2: e.target.value }))} placeholder="Area / landmark" className="addr-input mt-1" />
                </label>
                <label className="block">
                  <span className="addr-label">City *</span>
                  <input value={addrDraft.city} onChange={(e) => setAddrDraft((d) => ({ ...d, city: e.target.value }))} placeholder="City" className="addr-input mt-1" />
                </label>
                <label className="block">
                  <span className="addr-label">PIN Code *</span>
                  <input value={addrDraft.postal_code} onChange={(e) => setAddrDraft((d) => ({ ...d, postal_code: e.target.value }))} placeholder="400001" className="addr-input mt-1" maxLength={6} />
                </label>
                <label className="block">
                  <span className="addr-label">State</span>
                  <select value={addrDraft.region} onChange={(e) => setAddrDraft((d) => ({ ...d, region: e.target.value }))} className="addr-input mt-1">
                    {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="addr-label">Phone</span>
                  <input value={addrDraft.phone} onChange={(e) => setAddrDraft((d) => ({ ...d, phone: e.target.value }))} placeholder="+91 98765 43210" className="addr-input mt-1" />
                </label>
              </div>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={addrDraft.is_default} onChange={(e) => setAddrDraft((d) => ({ ...d, is_default: e.target.checked }))} className="h-4 w-4 accent-primary" />
                Set as default address
              </label>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={saveAddr}
                  disabled={addrSaving}
                  className="btn-glow inline-flex items-center gap-2 rounded-full bg-gradient-ember px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
                >
                  {addrSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {editingAddr ? "Update" : "Save Address"}
                </button>
                <button onClick={() => setAddrFormOpen(false)} className="rounded-full border border-border px-4 py-2 text-xs font-semibold">Cancel</button>
              </div>
            </div>
          )}

          {addresses.length === 0 && !addrFormOpen ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border p-10 text-center">
              <MapPin className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No saved addresses. Add one for faster checkout.</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {addresses.map((addr) => (
                <div key={addr.id} className={`rounded-2xl border bg-card p-4 ${addr.is_default ? "border-primary/40" : "border-border"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {addr.label && <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">{addr.label}</div>}
                      <div className="font-semibold leading-tight">{addr.recipient}</div>
                      <div className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {addr.street1}{addr.street2 ? `, ${addr.street2}` : ""}<br />
                        {addr.city}{addr.region ? `, ${addr.region}` : ""} — {addr.postal_code}
                        {addr.phone && <><br />{addr.phone}</>}
                      </div>
                    </div>
                    {addr.is_default && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase text-primary">Default</span>
                    )}
                  </div>
                  <div className="mt-3 flex gap-1.5">
                    <button
                      onClick={() => openAddAddr(addr)}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider hover:bg-muted"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => deleteAddr(addr.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-destructive"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}

const addrInputCss = `
  .addr-label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted-foreground); }
  .addr-input { width: 100%; border-radius: 0.75rem; border: 1px solid var(--border); background: var(--background); color: var(--foreground); padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }
  .addr-input:focus { border-color: var(--primary); }
`;

// inject once
if (typeof document !== "undefined" && !document.getElementById("addr-styles")) {
  const s = document.createElement("style");
  s.id = "addr-styles";
  s.textContent = addrInputCss;
  document.head.appendChild(s);
}
