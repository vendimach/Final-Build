import { createFileRoute, ErrorComponent, useRouter } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Truck, ShieldCheck, Leaf, Award, ArrowRight, Quote, Star, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HeroCarousel } from "@/components/HeroCarousel";
import { ProductCard } from "@/components/ProductCard";
import { NewsletterPopup } from "@/components/NewsletterPopup";
import { SupportBubble } from "@/components/SupportBubble";
import { supabase } from "@/integrations/supabase/client";
import { fetchProducts, dbToProduct } from "@/lib/db-products";
import hero3 from "@/assets/hero-3.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VendiMan — Premium Beef Jerky & Snack Sticks" },
      { name: "description", content: "Hand-cut, slow-smoked beef jerky and snack sticks. Bold flavors, clean ingredients, built for the bold." },
      { property: "og:title", content: "VendiMan — Premium Beef Jerky & Snack Sticks" },
      { property: "og:description", content: "Hand-cut, slow-smoked beef jerky for people who refuse the ordinary." },
    ],
  }),
  loader: async () => {
    const rows = await fetchProducts({ includeReviewStats: true });
    return { products: rows.map(dbToProduct) };
  },
  pendingComponent: () => (
    <div className="flex items-center justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  ),
  errorComponent: ({ error }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <ErrorComponent error={error} />
        <button onClick={() => router.invalidate()} className="btn-glow mt-6 rounded-full bg-gradient-ember px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground">Retry</button>
      </div>
    );
  },
  component: Index,
});

const TRUST = [
  { icon: Truck, title: "Free Shipping ₹499+", sub: "2–5 day pan-India delivery" },
  { icon: ShieldCheck, title: "7-Day Promise", sub: "Love it or money back" },
  { icon: Leaf, title: "Clean Sourced", sub: "No nitrates. No fillers." },
  { icon: Award, title: "Award Winning", sub: "Best Jerky 2024" },
];

function Index() {
  const { products } = Route.useLoaderData();
  const router = useRouter();
  const featured = products.slice(0, 6);
  const { averageRating, reviewCount } = useMemo(() => {
    const totalReviews = products.reduce((sum, product) => sum + product.reviews, 0);
    const totalRating = products.reduce((sum, product) => sum + product.rating * product.reviews, 0);
    return {
      averageRating: totalReviews > 0 ? +(totalRating / totalReviews).toFixed(1) : 0,
      reviewCount: totalReviews,
    };
  }, [products]);

  useEffect(() => {
    const channel = supabase
      .channel("homepage-review-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, async () => {
        await router.invalidate();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <HeroCarousel />

        {/* Trust strip */}
        <section className="border-y border-border bg-card/40">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-6 py-8 md:grid-cols-4">
            {TRUST.map((t, i) => (
              <motion.div
                key={t.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                  <t.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold">{t.title}</div>
                  <div className="text-xs text-muted-foreground">{t.sub}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Featured Products */}
        <section className="mx-auto max-w-7xl px-6 py-24">
          <div className="mb-12 flex items-end justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                The Lineup
              </div>
              <h2 className="font-display text-5xl tracking-wide md:text-6xl">Built for the bold.</h2>
              <p className="mt-3 max-w-lg text-muted-foreground">Six small-batch flavors. Every bag hand-cut, dry-rubbed, and slow-smoked over American hickory.</p>
            </div>
            <Link to="/shop" search={{ query: "" }} className="hidden items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary hover:gap-3 transition-all md:inline-flex">
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {featured.length === 0 ? (
            <p className="text-center text-muted-foreground">No products yet — add some from the admin center.</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </div>
          )}
        </section>

        {/* Build Your Box CTA */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <img src={hero3} alt="" aria-hidden="true" className="h-full w-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-r from-charcoal via-charcoal/80 to-charcoal/40" />
          </div>
          <div className="relative mx-auto grid max-w-7xl gap-10 px-6 py-28 md:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                Custom Box
              </div>
              <h2 className="font-display text-5xl leading-none text-white md:text-7xl">
                Build Your<br /><span className="text-primary">Perfect Lineup.</span>
              </h2>
              <p className="mt-5 max-w-md text-white/75">Pick 6 or 12 bags from our entire range. Save up to 20%. Ships in a custom-printed box, ready to gift or hoard.</p>
              <div className="mt-8 flex gap-3">
                <Link to="/build-your-box" className="btn-glow inline-flex items-center gap-2 rounded-full bg-gradient-ember px-7 py-4 text-sm font-bold uppercase tracking-wider text-primary-foreground">
                  Start Building <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
            <div className="grid grid-cols-2 gap-4 self-center">
              {[
                { n: "6", label: "Bag Box", price: "₹2,499", save: "Save 12%" },
                { n: "12", label: "Bag Box", price: "₹4,499", save: "Save 20%" },
              ].map((b, i) => (
                <motion.div
                  key={b.n}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.15 }}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md"
                >
                  <div className="font-display text-7xl text-white">{b.n}</div>
                  <div className="text-xs uppercase tracking-wider text-white/60">{b.label}</div>
                  <div className="mt-4 font-display text-3xl text-primary">{b.price}</div>
                  <div className="mt-1 inline-block rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">{b.save}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Reviews */}
        <section className="mx-auto max-w-7xl px-6 py-24">
          <div className="mb-12 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
              Verified Buyers
            </div>
            <h2 className="font-display text-5xl tracking-wide md:text-6xl">From the herd.</h2>
            <div className="mt-4 inline-flex items-center gap-2">
              {[1,2,3,4,5].map(i => <Star key={i} className="h-5 w-5 fill-accent text-accent" />)}
              <span className="ml-2 text-sm text-muted-foreground">
                {reviewCount > 0 ? `${averageRating.toFixed(1)} from ${reviewCount} reviews` : "Freshly launched — be the first to review"}
              </span>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {featured.slice(0, 3).map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="relative rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/40 hover:shadow-lift"
              >
                <Quote className="absolute right-5 top-5 h-8 w-8 text-primary/15" />
                <div className="flex gap-0.5">
                  {Array.from({ length: Math.max(1, Math.round(product.rating || 5)) }).map((_, j) => <Star key={j} className="h-4 w-4 fill-accent text-accent" />)}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-foreground">
                  {product.reviews > 0
                    ? `${product.name} is currently rated ${product.rating.toFixed(1)} out of 5 by ${product.reviews} customers.`
                    : `Be the first to rate ${product.name} and help other shoppers choose their next favourite.`}
                </p>
                <div className="mt-5 border-t border-border pt-4">
                  <div className="text-sm font-bold">{product.name}</div>
                  <div className="text-xs text-muted-foreground">{product.reviews > 0 ? "Live product rating" : "Awaiting first review"}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Manifesto */}
        <section className="relative overflow-hidden bg-gradient-dark py-28 text-white">
          <div className="bg-glow absolute inset-0" />
          <div className="relative mx-auto max-w-3xl px-6 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              Our Promise
            </div>
            <h2 className="font-display text-5xl leading-tight md:text-7xl text-balance">
              Real meat. Real fire.<br /><span className="text-primary">Zero compromise.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-white/70">
              We started VendiMan because mass-market jerky tasted like cardboard rubbed in MSG.
              Every bag we ship is sourced from grass-fed American cattle, dry-rubbed by hand, and smoked low for twelve hours over hickory.
            </p>
            <Link to="/shop" search={{ query: "" }} className="btn-glow mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-ember px-8 py-4 text-sm font-bold uppercase tracking-wider text-primary-foreground">
              Taste the difference <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
      <NewsletterPopup />
      <SupportBubble />
    </div>
  );
}
