import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Loader2, ShoppingBag, Tag, Check, ShieldCheck, Wallet, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RazorpayCheckout } from "@/components/RazorpayCheckout";
import {
  formatINR,
  validateIndianPhone,
  validateIndianPincode,
  INDIAN_STATES,
  FREE_SHIPPING_THRESHOLD,
  FLAT_SHIPPING_FEE,
} from "@/lib/currency";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — VendiMan" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});

interface CouponState {
  code: string;
  discount_type: "percent" | "fixed";
  value: number;
  applied: number;
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

function Checkout() {
  const { items, subtotal, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState(user?.email ?? "");
  const [recipient, setRecipient] = useState("");
  const [street1, setStreet1] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("Maharashtra");
  const [postal, setPostal] = useState("");
  const [phone, setPhone] = useState("");

  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<CouponState | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(null);
  const [saveAddress, setSaveAddress] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("wallet_balance")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setWalletBalance(Number(data.wallet_balance) || 0); });
    supabase
      .from("addresses")
      .select("id, label, recipient, street1, street2, city, region, postal_code, phone, is_default")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .then(({ data }) => {
        if (!data?.length) return;
        const addrs = data as SavedAddress[];
        setSavedAddresses(addrs);
        const def = addrs.find((a) => a.is_default) ?? addrs[0];
        if (def) {
          applyAddress(def);
          setSelectedAddrId(def.id);
        }
      });
  }, [user]);

  function applyAddress(addr: SavedAddress) {
    setRecipient(addr.recipient);
    setStreet1(addr.street1);
    setLandmark(addr.street2 ?? "");
    setCity(addr.city);
    setRegion(addr.region ?? "Maharashtra");
    setPostal(addr.postal_code);
    if (addr.phone) setPhone(addr.phone);
  }

  async function deleteSavedAddr(id: string) {
    const { error } = await supabase.from("addresses").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setSavedAddresses((prev) => prev.filter((a) => a.id !== id));
    if (selectedAddrId === id) setSelectedAddrId(null);
  }

  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_FEE;
  const discount = coupon?.applied ?? 0;
  const preWalletTotal = Math.max(0, subtotal + shipping - discount);
  const walletApplied = useWallet ? Math.min(walletBalance, preWalletTotal) : 0;
  const total = Math.max(0, preWalletTotal - walletApplied);

  async function applyCoupon() {
    if (!couponInput.trim()) return;
    setValidatingCoupon(true);
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("code, discount_type, value, min_subtotal, expires_at, max_uses, uses, is_active")
        .eq("code", couponInput.trim().toUpperCase())
        .maybeSingle();
      if (error) throw error;
      if (!data || !data.is_active) {
        toast.error("Invalid coupon code");
        return;
      }
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        toast.error(`Coupon expired on ${new Date(data.expires_at).toLocaleDateString("en-IN")}`);
        return;
      }
      if (data.max_uses && data.uses >= data.max_uses) {
        toast.error("Coupon usage limit reached");
        return;
      }
      if (subtotal < Number(data.min_subtotal)) {
        toast.error(`Minimum subtotal of ${formatINR(data.min_subtotal)} required`);
        return;
      }
      const applied =
        data.discount_type === "percent"
          ? +(subtotal * (Number(data.value) / 100)).toFixed(2)
          : Number(data.value);
      setCoupon({
        code: data.code,
        discount_type: data.discount_type as "percent" | "fixed",
        value: Number(data.value),
        applied,
      });
      toast.success(`Coupon applied: −${formatINR(applied)}`);
    } catch {
      toast.error("Could not validate coupon");
    } finally {
      setValidatingCoupon(false);
    }
  }

  function startCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    if (!email || !recipient || !street1 || !city || !postal) {
      toast.error("Please complete shipping details");
      return;
    }
    const phoneCheck = validateIndianPhone(phone);
    if (!phoneCheck.ok) {
      toast.error(phoneCheck.error);
      return;
    }
    if (!validateIndianPincode(postal)) {
      toast.error("Enter a valid 6-digit PIN code");
      return;
    }
    if (total === 0) {
      void placeOrder({ method: "wallet", txnId: `wallet_${Date.now()}` });
      return;
    }
    setPayOpen(true);
  }

  async function placeOrder(payment: {
    method: string;
    txnId: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
  }) {
    setPayOpen(false);
    setSubmitting(true);
    try {
      const phoneE164 = validateIndianPhone(phone);
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          user_id: user?.id ?? null,
          email,
          status: "paid",
          subtotal,
          discount,
          shipping,
          tax: 0,
          total,
          currency: "INR",
          coupon_code: coupon?.code ?? null,
          payment_method: payment.method,
          transaction_id: payment.txnId,
          razorpay_order_id: payment.razorpay_order_id ?? null,
          razorpay_payment_id: payment.razorpay_payment_id ?? null,
          notes: `Paid via ${payment.method.toUpperCase()} • Txn ${payment.txnId}`,
          shipping_address: {
            recipient,
            street1,
            landmark: landmark || null,
            city,
            region,
            postal_code: postal,
            country: "IN",
            phone: phoneE164.ok ? phoneE164.e164 : phone,
          },
        })
        .select("id, order_number")
        .single();
      if (orderErr) throw orderErr;

      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const orderItems = items.map((i) => ({
        order_id: order.id,
        product_id: !i.isBundle && UUID_RE.test(i.productId) ? i.productId : null,
        name: i.name,
        unit_price: i.price,
        quantity: i.quantity,
        is_bundle: !!i.isBundle,
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
      if (itemsErr) throw itemsErr;

      // Debit wallet credits if used
      if (user?.id && walletApplied > 0) {
        await supabase.from("wallet_transactions").insert({
          user_id: user.id,
          amount: -walletApplied,
          type: "debit",
          description: `Redeemed for order ${order.order_number}`,
          reference_id: order.id,
        });
        await supabase
          .from("profiles")
          .update({ wallet_balance: walletBalance - walletApplied })
          .eq("id", user.id);
      }

      // Decrement stock for each purchased product
      try {
        for (const item of items) {
          if (!item.productId || !UUID_RE.test(item.productId)) continue;
          const { data: prod } = await supabase
            .from("products")
            .select("stock, description, format")
            .eq("id", item.productId)
            .single();
          if (!prod) continue;
          await supabase
            .from("products")
            .update({ stock: Math.max(0, (prod.stock as number) - item.quantity) })
            .eq("id", item.productId);
          // Pre-made bundles: also decrement constituent products
          if (item.isBundle && (prod.format as string) === "bundles" && prod.description) {
            for (const line of (prod.description as string).split("\n").filter(Boolean)) {
              const m = line.match(/^(\d+)[×x]\s+(.+)$/);
              if (!m) continue;
              const qty = parseInt(m[1]) * item.quantity;
              const { data: c } = await supabase.from("products").select("id, stock").eq("name", m[2].trim()).maybeSingle();
              if (c) await supabase.from("products").update({ stock: Math.max(0, (c.stock as number) - qty) }).eq("id", c.id);
            }
          }
        }
      } catch {
        // Non-critical — order is already placed
      }

      // Save manually entered address for future use
      if (user?.id && saveAddress && selectedAddrId === null && recipient && street1 && city && postal) {
        await supabase.from("addresses").insert({
          user_id: user.id, label: null, recipient, street1,
          street2: landmark || null, city, region,
          postal_code: postal, phone: phone || null, is_default: savedAddresses.length === 0, country: "IN",
        });
      }

      clear();
      toast.success(`Payment confirmed • Order ${order.order_number}`);
      navigate({ to: "/order-confirmed", search: { order: order.order_number } });
    } catch (err) {
      console.error("Order placement failed:", err);
      toast.error(err instanceof Error ? err.message : "Could not place order");
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="mx-auto max-w-2xl px-6 py-24 text-center">
          <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 font-display text-4xl">Your cart is empty</h1>
          <Link to="/shop" search={{ query: "" }} className="btn-glow mt-6 inline-flex rounded-full bg-gradient-ember px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground">
            Shop the lineup
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="font-display text-4xl tracking-wide md:text-5xl">Checkout</h1>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px]">
          <form onSubmit={startCheckout} className="space-y-6">
            <Section title="Contact">
              <Input label="Email" type="email" value={email} onChange={setEmail} required />
              <Input label="Mobile (+91)" value={phone} onChange={setPhone} required placeholder="10-digit mobile number" />
            </Section>
            {savedAddresses.length > 0 && (
              <Section title="Saved addresses">
                <div className="grid gap-2 sm:grid-cols-2">
                  {savedAddresses.map((addr) => (
                    <div
                      key={addr.id}
                      onClick={() => { applyAddress(addr); setSelectedAddrId(addr.id); }}
                      className={`group relative cursor-pointer rounded-xl border p-3 transition-colors ${
                        selectedAddrId === addr.id
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {addr.label && <div className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">{addr.label}</div>}
                          <div className="truncate text-sm font-semibold">{addr.recipient}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                            {addr.street1}{addr.street2 ? `, ${addr.street2}` : ""}, {addr.city}, {addr.postal_code}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {addr.is_default && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-primary">Default</span>}
                          {selectedAddrId === addr.id && <Check className="h-3.5 w-3.5 text-primary" />}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); void deleteSavedAddr(addr.id); }}
                        className="absolute bottom-2 right-2 hidden rounded-full p-1 text-destructive hover:bg-destructive/10 group-hover:flex"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <div
                    onClick={() => { setSelectedAddrId(null); setRecipient(""); setStreet1(""); setLandmark(""); setCity(""); setPostal(""); }}
                    className={`cursor-pointer rounded-xl border p-3 text-center transition-colors ${
                      selectedAddrId === null
                        ? "border-primary bg-primary/5"
                        : "border-dashed border-border bg-background text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    <MapPin className="mx-auto h-4 w-4 mb-1" />
                    <div className="text-xs font-semibold">Enter manually</div>
                  </div>
                </div>
              </Section>
            )}
            <Section title="Shipping address">
              <Input label="Full name" value={recipient} onChange={setRecipient} required />
              <Input label="House no., Building, Street" value={street1} onChange={setStreet1} required />
              <Input label="Landmark (optional)" value={landmark} onChange={setLandmark} />
              <div className="grid gap-3 sm:grid-cols-3">
                <Input label="City / Town" value={city} onChange={setCity} required />
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">State *</span>
                  <select
                    required
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                  >
                    {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <Input label="PIN code" value={postal} onChange={setPostal} required placeholder="6-digit" />
              </div>
              <div className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                Country: <span className="font-semibold text-foreground">India 🇮🇳</span> (we currently ship within India only)
              </div>
              {user && selectedAddrId === null && savedAddresses.length < 4 && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(e) => setSaveAddress(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  <MapPin className="h-4 w-4 text-primary" />
                  Save this address for future orders
                </label>
              )}
            </Section>
            <Section title="Payment">
              <div className="rounded-xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 text-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="font-semibold">Razorpay Secure Checkout</span>
                </div>
                <p className="mt-2">
                  UPI • Cards • Netbanking • Wallets — pay securely on the next screen. Your payment is verified server-side before the order is created.
                </p>
              </div>
            </Section>

            <button
              type="submit"
              disabled={submitting}
              className="btn-glow flex w-full items-center justify-center gap-2 rounded-full bg-gradient-ember py-4 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Pay {formatINR(total, { decimals: true })}
            </button>
          </form>

          {/* Summary */}
          <aside className="h-fit space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-xl">Order Summary</h2>
            <div className="space-y-3 border-b border-border pb-4">
              {items.map((i) => (
                <div key={i.id} className="flex gap-3 text-sm">
                  {i.image && <img src={i.image} alt={i.name} className="h-12 w-12 rounded object-cover" />}
                  <div className="flex flex-1 justify-between gap-2">
                    <div>
                      <div className="font-semibold leading-tight">{i.name}</div>
                      <div className="text-xs text-muted-foreground">Qty {i.quantity}</div>
                    </div>
                    <div className="font-display">{formatINR(i.price * i.quantity)}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Coupon */}
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Coupon code
              </label>
              {coupon ? (
                <div className="flex items-center justify-between rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 font-semibold">
                    <Check className="h-4 w-4 text-primary" /> {coupon.code}
                  </span>
                  <button type="button" onClick={() => setCoupon(null)} className="text-xs text-muted-foreground hover:text-destructive">
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void applyCoupon(); } }}
                    placeholder="WELCOME10"
                    className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm uppercase focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={validatingCoupon}
                    className="btn-glow inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 text-xs font-bold uppercase tracking-wider"
                  >
                    {validatingCoupon ? <Loader2 className="h-3 w-3 animate-spin" /> : <Tag className="h-3 w-3" />}
                    Apply
                  </button>
                </div>
              )}
            </div>

            {/* Wallet credits */}
            {user && walletBalance > 0 && (
              <div className="border-t border-border pt-4">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={useWallet}
                    onChange={(e) => setUseWallet(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  <Wallet className="h-4 w-4 text-primary" />
                  <span className="flex-1">
                    Use wallet credits
                    <span className="ml-1 text-xs text-muted-foreground">({formatINR(walletBalance)} available)</span>
                  </span>
                </label>
                {useWallet && walletApplied > 0 && (
                  <p className="mt-1 pl-6 text-xs font-semibold text-primary">
                    −{formatINR(walletApplied)} will be applied
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5 border-t border-border pt-4 text-sm">
              <Row label="Subtotal" value={formatINR(subtotal)} />
              {discount > 0 && <Row label="Discount" value={`-${formatINR(discount)}`} accent />}
              {walletApplied > 0 && <Row label="Wallet credits" value={`-${formatINR(walletApplied)}`} accent />}
              <Row label="Shipping" value={shipping === 0 ? "FREE" : formatINR(shipping)} />
              {shipping > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Add {formatINR(FREE_SHIPPING_THRESHOLD - subtotal)} more for free shipping
                </p>
              )}
              <div className="mt-2 flex justify-between border-t border-border pt-3">
                <span className="font-semibold">Total</span>
                <span className="font-display text-2xl">{formatINR(total, { decimals: true })}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">All taxes included.</p>
            </div>
          </aside>
        </div>
      </main>
      <RazorpayCheckout
        amount={total}
        prefill={{ name: recipient, email, contact: phone }}
        receipt={`vm_${Date.now()}`.slice(0, 40)}
        open={payOpen}
        onClose={() => setPayOpen(false)}
        onSuccess={placeOrder}
      />
      <Footer />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-6">
      <h2 className="font-display text-xl tracking-wide">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}{required && " *"}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
      />
    </label>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={accent ? "font-semibold text-primary" : ""}>{value}</span>
    </div>
  );
}
