import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { fetchProducts, imageForSlug, type DbProduct } from "@/lib/db-products";
import { useCart } from "@/lib/cart-context";
import { Check, Plus, Minus, Package, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { formatINR } from "@/lib/currency";

export const Route = createFileRoute("/build-your-box")({
  head: () => ({
    meta: [
      { title: "Build Your Box — VendiMan" },
      { name: "description", content: "Pick 6 or 12 of your favorite jerky and snack stick flavors at a flat discounted rate." },
    ],
  }),
  component: BuildYourBox,
});

const BOX_OPTIONS = [
  { size: 6, price: 2499, savings: 15 },
  { size: 12, price: 4499, savings: 25 },
];

function BuildYourBox() {
  const [boxSize, setBoxSize] = useState<6 | 12>(6);
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const { addItem, setOpen } = useCart();

  useEffect(() => {
    fetchProducts()
      .then((p) => setProducts(p.filter((x) => x.format !== "bundles")))
      .catch(() => toast.error("Couldn't load products"))
      .finally(() => setLoading(false));
  }, []);

  const totalPicked = Object.values(picks).reduce((s, n) => s + n, 0);
  const remaining = boxSize - totalPicked;
  const selectedBox = BOX_OPTIONS.find((b) => b.size === boxSize)!;

  function pick(id: string) {
    if (totalPicked >= boxSize) return;
    const product = products.find((item) => item.id === id);
    if (!product) return;
    setPicks((p) => {
      const nextQty = (p[id] ?? 0) + 1;
      if (nextQty > product.stock) {
        toast.error(`Only ${product.stock} in stock`);
        return p;
      }
      return { ...p, [id]: nextQty };
    });
  }
  function unpick(id: string) {
    setPicks((p) => {
      const next = { ...p };
      if (!next[id]) return p;
      next[id] -= 1;
      if (next[id] <= 0) delete next[id];
      return next;
    });
  }

  function addBoxToCart() {
    if (totalPicked !== boxSize) {
      toast.error(`Pick ${remaining} more item${remaining === 1 ? "" : "s"}`);
      return;
    }
    const bundleItems = Object.entries(picks).flatMap(([id, qty]) => {
      const p = products.find((pr) => pr.id === id);
      if (!p) return [];
      return Array.from({ length: qty }, () => ({ productId: id, name: p.name }));
    });
    addItem({
      id: `bundle-${boxSize}-${Date.now()}`,
      productId: "build-your-box",
      name: `Build-Your-Own ${boxSize}-Pack`,
      price: selectedBox.price,
      isBundle: true,
      bundleItems,
      subscription: null,
    });
    setPicks({});
    setOpen(true);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <span className="inline-block rounded-full bg-primary/10 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
            Bundle Builder
          </span>
          <h1 className="mt-4 font-display text-5xl tracking-wide md:text-6xl">Build Your Own Box</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Pick your favorites. Save up to 25%. Same flat rate, your flavors.
          </p>
        </motion.div>

        {/* Box size selector */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {BOX_OPTIONS.map((opt) => {
            const active = boxSize === opt.size;
            return (
              <button
                key={opt.size}
                onClick={() => {
                  setBoxSize(opt.size as 6 | 12);
                  setPicks({});
                }}
                className={`btn-glow rounded-2xl border p-6 text-left transition ${
                  active ? "border-primary bg-primary/5 shadow-ember" : "border-border bg-card"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Package className={`h-7 w-7 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <div className="font-display text-2xl">{opt.size} items</div>
                      <div className="text-xs text-muted-foreground">Save {opt.savings}%</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl">{formatINR(opt.price)}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Flat</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Progress + checkout bar */}
        <div className="sticky top-16 z-30 mt-8 rounded-2xl border border-border bg-card/95 p-4 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs uppercase tracking-wider">
                <span className="text-muted-foreground">{totalPicked} / {boxSize} picked</span>
                {remaining === 0 && (
                  <span className="flex items-center gap-1 font-bold text-primary">
                    <Check className="h-3 w-3" /> Ready to add
                  </span>
                )}
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-gradient-ember transition-all duration-300"
                  style={{ width: `${(totalPicked / boxSize) * 100}%` }}
                />
              </div>
            </div>
            <button
              onClick={addBoxToCart}
              disabled={totalPicked !== boxSize}
              className="btn-glow rounded-full bg-gradient-ember px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add Box • {formatINR(selectedBox.price)}
            </button>
          </div>
        </div>

        {/* Product grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : products.length === 0 ? (
          <p className="mt-12 text-center text-muted-foreground">No products available.</p>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => {
              const qty = picks[p.id] ?? 0;
              const atStockLimit = qty >= p.stock;
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className={`group relative overflow-hidden rounded-2xl border bg-card transition ${
                    qty > 0 ? "border-primary shadow-ember" : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="relative aspect-square overflow-hidden">
                    <img
                      src={p.image_url ?? imageForSlug(p.slug)}
                      alt={p.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {qty > 0 && (
                      <div className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-ember text-sm font-bold text-primary-foreground">
                        {qty}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h4 className="text-sm font-semibold leading-tight">{p.name}</h4>
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{p.flavor}</div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <button
                        onClick={() => unpick(p.id)}
                        disabled={qty === 0}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-30"
                        aria-label="Remove"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => pick(p.id)}
                        disabled={remaining === 0 || atStockLimit}
                        className="btn-glow flex h-8 flex-1 items-center justify-center rounded-full bg-foreground text-xs font-bold uppercase tracking-wider text-background disabled:opacity-30"
                      >
                        <Plus className="mr-1 h-3 w-3" /> Add
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Want a curated set? <Link to="/shop" search={{ query: "" }} className="text-primary underline-offset-4 hover:underline">Browse pre-made bundles →</Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}
