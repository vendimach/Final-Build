import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { fetchProducts, type DbProduct } from "@/lib/db-products";
import { formatINR } from "@/lib/currency";
import { Loader2, Repeat, Truck, Tag, Pause, X, CheckCircle2, Calendar } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/subscribe")({
  head: () => ({
    meta: [
      { title: "Subscribe & Save — VendiMan" },
      { name: "description", content: "Save 10% on every order with auto-delivery. Choose monthly or bi-monthly. Skip, pause, or cancel anytime." },
      { property: "og:title", content: "Subscribe & Save — VendiMan" },
      { property: "og:description", content: "Save 10% on every order with auto-delivery. Free shipping over ₹499." },
    ],
  }),
  loader: async () => ({ products: await fetchProducts() }),
  component: SubscribePage,
});

type Frequency = "monthly" | "bimonthly";
const SUBSCRIBE_DISCOUNT = 0.1; // 10% off

interface SubRow {
  id: string;
  product_id: string;
  frequency: Frequency;
  quantity: number;
  status: "active" | "paused" | "cancelled";
  next_ship_at: string | null;
}

function SubscribePage() {
  const { products } = Route.useLoaderData();
  const { user } = useAuth();
  const navigate = useNavigate();

  const activeProducts = useMemo(() => products.filter((p) => p.is_active && p.stock > 0), [products]);

  const [selectedId, setSelectedId] = useState<string>(activeProducts[0]?.id ?? "");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [subs, setSubs] = useState<SubRow[] | null>(null);
  const [loadingSubs, setLoadingSubs] = useState(false);

  const selected = activeProducts.find((p) => p.id === selectedId) ?? activeProducts[0];

  // Load existing subs
  useEffect(() => {
    if (!user) {
      setSubs(null);
      return;
    }
    setLoadingSubs(true);
    supabase
      .from("subscriptions")
      .select("id, product_id, frequency, quantity, status, next_ship_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setSubs((data ?? []) as SubRow[]);
        setLoadingSubs(false);
      });
  }, [user]);

  function nextShipDate(freq: Frequency): string {
    const d = new Date();
    d.setDate(d.getDate() + (freq === "monthly" ? 30 : 60));
    return d.toISOString();
  }

  async function handleSubscribe() {
    if (!user) {
      toast.error("Please sign in to subscribe");
      navigate({ to: "/auth" });
      return;
    }
    if (!selected) {
      toast.error("Pick a product first");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .insert({
          user_id: user.id,
          product_id: selected.id,
          frequency,
          quantity,
          status: "active",
          next_ship_at: nextShipDate(frequency),
        })
        .select("id, product_id, frequency, quantity, status, next_ship_at")
        .single();
      if (error) throw error;
      setSubs((s) => [data as SubRow, ...(s ?? [])]);
      toast.success("Subscription created — first delivery soon!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create subscription");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateSub(id: string, patch: Partial<Pick<SubRow, "status" | "frequency" | "quantity">>) {
    const { error } = await supabase.from("subscriptions").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSubs((s) => (s ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x)));
    toast.success("Subscription updated");
  }

  const unitPrice = selected ? Number(selected.price) : 0;
  const lineTotal = unitPrice * quantity;
  const discount = +(lineTotal * SUBSCRIBE_DISCOUNT).toFixed(2);
  const youPay = +(lineTotal - discount).toFixed(2);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* Hero */}
        <section className="rounded-3xl border border-border bg-card p-8 md:p-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
            <Repeat className="h-3 w-3" /> Subscribe & Save
          </div>
          <h1 className="mt-4 font-display text-4xl tracking-wide md:text-5xl">
            Never run out. Save 10% on every box.
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
            Pick your favourite snack, choose monthly or bi-monthly delivery, and we'll ship it to your door
            automatically. Pause, skip, or cancel anytime — no commitments.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Perk icon={<Tag className="h-5 w-5" />} title="10% off every order" desc="Locked-in subscriber price" />
            <Perk icon={<Truck className="h-5 w-5" />} title="Free shipping over ₹499" desc="On every recurring delivery" />
            <Perk icon={<Pause className="h-5 w-5" />} title="Total flexibility" desc="Pause / cancel anytime" />
          </div>
        </section>

        {/* Configurator */}
        <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-2xl tracking-wide">1. Pick your snack</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {activeProducts.map((p) => (
                  <ProductCardOption
                    key={p.id}
                    product={p}
                    selected={p.id === selectedId}
                    onSelect={() => setSelectedId(p.id)}
                  />
                ))}
                {activeProducts.length === 0 && (
                  <p className="text-sm text-muted-foreground">No products available right now. Check back soon.</p>
                )}
              </div>
            </div>

            <div>
              <h2 className="font-display text-2xl tracking-wide">2. Pick a frequency</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <FrequencyCard
                  value="monthly"
                  label="Every month"
                  desc="Best for daily snackers"
                  selected={frequency === "monthly"}
                  onSelect={() => setFrequency("monthly")}
                />
                <FrequencyCard
                  value="bimonthly"
                  label="Every 2 months"
                  desc="Great for occasional cravings"
                  selected={frequency === "bimonthly"}
                  onSelect={() => setFrequency("bimonthly")}
                />
              </div>
            </div>

            <div>
              <h2 className="font-display text-2xl tracking-wide">3. Quantity per delivery</h2>
              <div className="mt-4 inline-flex items-center gap-4 rounded-2xl border border-border bg-card p-3">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="h-9 w-9 rounded-full border border-border bg-background text-lg font-bold hover:border-primary"
                >
                  −
                </button>
                <span className="min-w-[2ch] text-center font-display text-2xl">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(selected?.stock ?? 10, q + 1))}
                  className="h-9 w-9 rounded-full border border-border bg-background text-lg font-bold hover:border-primary"
                >
                  +
                </button>
                {selected && (
                  <span className="text-xs text-muted-foreground">
                    Max {Math.min(selected.stock, 10)} per delivery
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Summary */}
          <aside className="h-fit rounded-2xl border border-border bg-card p-6">
            <h3 className="font-display text-xl">Your plan</h3>
            {selected ? (
              <>
                <div className="mt-4 flex gap-3">
                  <img
                    src={selected.image_url ?? ""}
                    alt={selected.name}
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <div className="font-semibold leading-tight">{selected.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {frequency === "monthly" ? "Every month" : "Every 2 months"} · Qty {quantity}
                    </div>
                  </div>
                </div>
                <div className="mt-5 space-y-1.5 border-t border-border pt-4 text-sm">
                  <Row label="Subtotal" value={formatINR(lineTotal)} />
                  <Row label="Subscriber discount (10%)" value={`−${formatINR(discount)}`} accent />
                  <Row label="Shipping" value={lineTotal >= 499 ? "FREE" : formatINR(49)} />
                  <div className="mt-3 flex justify-between border-t border-border pt-3">
                    <span className="font-semibold">Per delivery</span>
                    <span className="font-display text-2xl">
                      {formatINR(youPay + (lineTotal >= 499 ? 0 : 49), { decimals: true })}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleSubscribe}
                  disabled={submitting || !selected}
                  className="btn-glow mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-ember py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Repeat className="h-4 w-4" />}
                  {user ? "Start subscription" : "Sign in to subscribe"}
                </button>
                <p className="mt-3 text-center text-[11px] text-muted-foreground">
                  No charge today — billing kicks in on your first ship date. Cancel anytime.
                </p>
              </>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Pick a product to see your plan summary.</p>
            )}
          </aside>
        </section>

        {/* My subscriptions */}
        {user && (
          <section className="mt-12">
            <h2 className="font-display text-2xl tracking-wide">My subscriptions</h2>
            {loadingSubs ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : !subs || subs.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                You have no subscriptions yet. Start one above to get 10% off recurring deliveries.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {subs.map((s) => {
                  const product = products.find((p) => p.id === s.product_id);
                  return (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-center gap-3">
                        {product?.image_url && (
                          <img src={product.image_url} alt={product.name} className="h-12 w-12 rounded object-cover" />
                        )}
                        <div>
                          <div className="font-semibold">{product?.name ?? "Product"}</div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Repeat className="h-3 w-3" />
                              {s.frequency === "monthly" ? "Monthly" : "Bi-monthly"} · Qty {s.quantity}
                            </span>
                            {s.next_ship_at && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Next: {new Date(s.next_ship_at).toLocaleDateString("en-IN")}
                              </span>
                            )}
                            <StatusPill status={s.status} />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {s.status === "active" && (
                          <button
                            onClick={() => updateSub(s.id, { status: "paused" })}
                            className="btn-glow inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:border-primary"
                          >
                            <Pause className="h-3 w-3" /> Pause
                          </button>
                        )}
                        {s.status === "paused" && (
                          <button
                            onClick={() => updateSub(s.id, { status: "active" })}
                            className="btn-glow inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-primary"
                          >
                            <CheckCircle2 className="h-3 w-3" /> Resume
                          </button>
                        )}
                        {s.status !== "cancelled" && (
                          <button
                            onClick={() => updateSub(s.id, { status: "cancelled" })}
                            className="btn-glow inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-destructive hover:border-destructive"
                          >
                            <X className="h-3 w-3" /> Cancel
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {!user && (
          <p className="mt-10 rounded-2xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
            <Link to="/auth" className="font-semibold text-primary underline-offset-4 hover:underline">Sign in</Link>{" "}
            to manage your subscriptions and unlock 10% recurring savings.
          </p>
        )}
      </main>
      <Footer />
    </div>
  );
}

function Perk({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-ember text-primary-foreground shadow-ember">
        {icon}
      </div>
      <div className="mt-2 font-semibold">{title}</div>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function ProductCardOption({
  product,
  selected,
  onSelect,
}: {
  product: DbProduct;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-3 rounded-2xl border bg-card p-3 text-left transition ${
        selected ? "border-primary shadow-ember" : "border-border hover:border-primary/50"
      }`}
    >
      <img
        src={product.image_url ?? ""}
        alt={product.name}
        className="h-16 w-16 rounded-lg object-cover"
      />
      <div className="flex-1 min-w-0">
        <div className="truncate font-semibold">{product.name}</div>
        <div className="text-xs text-muted-foreground line-clamp-1">{product.description}</div>
        <div className="mt-1 flex items-center gap-2">
          <span className="font-display text-base">{formatINR(product.price)}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            −10% subscriber
          </span>
        </div>
      </div>
    </button>
  );
}

function FrequencyCard({
  label,
  desc,
  selected,
  onSelect,
}: {
  value: Frequency;
  label: string;
  desc: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-2xl border bg-card p-4 text-left transition ${
        selected ? "border-primary shadow-ember" : "border-border hover:border-primary/50"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-lg">{label}</span>
        {selected && <CheckCircle2 className="h-5 w-5 text-primary" />}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </button>
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

function StatusPill({ status }: { status: SubRow["status"] }) {
  const map = {
    active: "border-primary/40 bg-primary/10 text-primary",
    paused: "border-amber-500/40 bg-amber-500/10 text-amber-600",
    cancelled: "border-border bg-muted text-muted-foreground",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${map[status]}`}>
      {status}
    </span>
  );
}
