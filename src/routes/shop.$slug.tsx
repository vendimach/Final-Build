import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { FlavorScale } from "@/components/FlavorScale";
import { ProductCard } from "@/components/ProductCard";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { fetchProducts, dbToProduct, imageForSlug, hoverImageForSlug, type DbProduct } from "@/lib/db-products";
import {
  Loader2, ShoppingBag, Star, Repeat, Bell, Check, Minus, Plus,
  Truck, ShieldCheck, Leaf, ChevronDown, Camera, Award, Flame, Upload, X, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { formatINR, FREE_SHIPPING_THRESHOLD } from "@/lib/currency";

export const Route = createFileRoute("/shop/$slug")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("slug", params.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw notFound();

    // Pull a few related items in parallel for "You may also like"
    const all = await fetchProducts({ includeReviewStats: true });
    const related = all
      .filter((p) => p.id !== data.id)
      .sort((a, b) => (a.flavor === data.flavor ? -1 : 0) - (b.flavor === data.flavor ? -1 : 0))
      .slice(0, 4);

    // Variant siblings: other products in the same flavor family — used as format swap
    const variants = all.filter(
      (p) => p.flavor === (data as DbProduct).flavor && p.format !== "bags",
    );

    return { product: data as DbProduct, related, variants };
  },
  head: ({ loaderData }) => {
    const og = loaderData?.product.image_url ?? undefined;
    return {
      meta: [
        { title: `${loaderData?.product.name ?? "Product"} — VendiMan` },
        { name: "description", content: loaderData?.product.description ?? "Premium beef jerky." },
        { property: "og:title", content: `${loaderData?.product.name} — VendiMan` },
        { property: "og:description", content: loaderData?.product.description ?? "" },
        ...(og ? [{ property: "og:image", content: og }, { name: "twitter:image", content: og }] : []),
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-4xl">Could not load product</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Link to="/shop" search={{ query: "" }} className="btn-glow mt-6 inline-flex rounded-full bg-gradient-ember px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground">Back to shop</Link>
      </main>
      <Footer />
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-4xl">Product not found</h1>
        <Link to="/shop" search={{ query: "" }} className="btn-glow mt-6 inline-flex rounded-full bg-gradient-ember px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground">Back to shop</Link>
      </main>
      <Footer />
    </div>
  ),
  component: PDP,
});

interface ReviewRow {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  verified_buyer: boolean;
  photo_urls: string[];
  taste_rating: number | null;
  quality_rating: number | null;
  texture_rating: number | null;
  value_rating: number | null;
  delivery_rating: number | null;
}

type ReviewFilterKey = "taste" | "quality" | "texture" | "value" | "delivery";

const REVIEW_FILTERS: { key: ReviewFilterKey; label: string }[] = [
  { key: "taste", label: "Taste" },
  { key: "quality", label: "Quality" },
  { key: "texture", label: "Texture" },
  { key: "value", label: "Value for Money" },
  { key: "delivery", label: "Delivery Experience" },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "How long does the jerky stay fresh?",
    a: "Sealed pouches stay fresh for 9 months from manufacture. Once opened, finish within 7 days for best flavour and refrigerate if your kitchen is warm.",
  },
  {
    q: "Is your jerky gluten-free?",
    a: "Most of our recipes are gluten-free, but always check the dietary tags on each product. We process all batches in a facility that handles soy and may contain traces.",
  },
  {
    q: "Where do you ship in India?",
    a: "We ship pan-India via reliable courier partners. Free shipping on every order over ₹499 — typical delivery is 2–5 business days.",
  },
  {
    q: "What if I don't like it?",
    a: "We back every order with a 100% satisfaction promise. If you're not happy, write to us within 7 days of delivery and we'll refund or replace it.",
  },
  {
    q: "Can I cancel my subscription anytime?",
    a: "Absolutely. Pause, skip a delivery, change frequency, or cancel from your dashboard — no questions asked, no fees.",
  },
];

function PDP() {
  const { product, related, variants } = Route.useLoaderData();
  const { addItem } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [qty, setQty] = useState(1);
  const [purchaseType, setPurchaseType] = useState<"once" | "subscribe">("once");
  const [frequency, setFrequency] = useState<"2weeks" | "monthly" | "6weeks" | "bimonthly" | "3months">("monthly");
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewPhotoUrls, setReviewPhotoUrls] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ReviewFilterKey[]>([]);
  const [tasteRating, setTasteRating] = useState<number | null>(null);
  const [qualityRating, setQualityRating] = useState<number | null>(null);
  const [textureRating, setTextureRating] = useState<number | null>(null);
  const [valueRating, setValueRating] = useState<number | null>(null);
  const [deliveryRating, setDeliveryRating] = useState<number | null>(null);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [activeImage, setActiveImage] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const baseImage = product.image_url || imageForSlug(product.slug);
  const hoverImg = product.hover_image_url || hoverImageForSlug(product.slug);
  const nutritionImg = (product as DbProduct & { nutrition_image_url?: string | null }).nutrition_image_url ?? null;

  const gallery = useMemo(() => {
    const list: string[] = [];
    const galleryUrls = (product as DbProduct & { gallery_urls?: string[] | null }).gallery_urls ?? [];
    for (const url of galleryUrls) {
      if (url && !list.includes(url)) list.push(url);
    }
    if (baseImage && !list.includes(baseImage)) list.push(baseImage);
    if (hoverImg && !list.includes(hoverImg)) list.push(hoverImg);
    if (nutritionImg && !list.includes(nutritionImg)) list.push(nutritionImg);
    return list.length ? list : [imageForSlug(product.slug)];
  }, [baseImage, hoverImg, nutritionImg, product]);

  const outOfStock = product.stock === 0;
  const lowStock = product.stock > 0 && product.stock <= 5;

  const subscribePrice = useMemo(() => Math.round(Number(product.price) * 0.9), [product.price]);
  const effectivePrice = purchaseType === "subscribe" ? subscribePrice : Number(product.price);

  useEffect(() => {
    setLoadingReviews(true);
    supabase
      .from("reviews")
      .select("id, rating, title, body, created_at, verified_buyer, photo_urls, taste_rating, quality_rating, texture_rating, value_rating, delivery_rating")
      .eq("product_id", product.id)
      .eq("is_approved", true)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setReviews((data ?? []) as ReviewRow[]);
        setLoadingReviews(false);
      });
  }, [product.id]);

  useEffect(() => {
    const channel = supabase
      .channel(`reviews-${product.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reviews", filter: `product_id=eq.${product.id}` },
        async () => {
          const { data } = await supabase
            .from("reviews")
            .select("id, rating, title, body, created_at, verified_buyer, photo_urls, taste_rating, quality_rating, texture_rating, value_rating, delivery_rating")
            .eq("product_id", product.id)
            .eq("is_approved", true)
            .order("created_at", { ascending: false })
            .limit(50);
          setReviews((data ?? []) as ReviewRow[]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [product.id]);

  const avgRating = reviews.length
    ? +(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  // Rating histogram (5..1)
  const histogram = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]; // index 0 = 1 star
    reviews.forEach((r) => {
      const i = Math.min(5, Math.max(1, Math.round(r.rating))) - 1;
      counts[i]++;
    });
    return counts.reverse(); // now index 0 = 5 stars
  }, [reviews]);

  const photoReviews = reviews.flatMap((r) => r.photo_urls ?? []).slice(0, 12);

  const filteredReviews = useMemo(() => {
    const base = activeFilters.length === 0 ? reviews : reviews.filter((review) =>
      activeFilters.every((filter) => {
        switch (filter) {
          case "taste": return (review.taste_rating ?? review.rating) >= 4;
          case "quality": return (review.quality_rating ?? review.rating) >= 4;
          case "texture": return (review.texture_rating ?? review.rating) >= 4;
          case "value": return (review.value_rating ?? review.rating) >= 4;
          case "delivery": return (review.delivery_rating ?? review.rating) >= 4;
          default: return true;
        }
      }),
    );
    return [...base].sort((a, b) => b.rating - a.rating || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [activeFilters, reviews]);

  const filterCounts = useMemo(() => {
    return {
      taste: reviews.filter((r) => (r.taste_rating ?? r.rating) >= 4).length,
      quality: reviews.filter((r) => (r.quality_rating ?? r.rating) >= 4).length,
      texture: reviews.filter((r) => (r.texture_rating ?? r.rating) >= 4).length,
      value: reviews.filter((r) => (r.value_rating ?? r.rating) >= 4).length,
      delivery: reviews.filter((r) => (r.delivery_rating ?? r.rating) >= 4).length,
    } as Record<ReviewFilterKey, number>;
  }, [reviews]);

  // Synthetic nutrition (until DB stores per-product values). Tweaks scale with format.
  const nutrition = useMemo(() => {
    const scale = product.format === "sticks" ? 0.6 : product.format === "bundles" ? 1.2 : 1;
    return {
      serving: product.format === "sticks" ? "1 stick (28g)" : "1 oz (28g)",
      calories: Math.round(110 * scale),
      protein: Math.round(13 * scale),
      fat: Math.round(3 * scale),
      carbs: Math.round(5 * scale),
      sugar: Math.max(0, Math.round((product.sweetness_level ?? 1) * 1.2 * scale)),
      sodium: Math.round(380 * scale),
    };
  }, [product.format, product.sweetness_level]);

  function handleAdd() {
    if (qty > product.stock) {
      toast.error(`Only ${product.stock} in stock`);
      return;
    }
    const ok = addItem(
      {
        id: purchaseType === "subscribe" ? `${product.id}-sub-${frequency}` : product.id,
        productId: product.id,
        name: purchaseType === "subscribe" ? `${product.name} (Subscribe • ${frequency})` : product.name,
        price: effectivePrice,
        image: baseImage,
        subscription: purchaseType === "subscribe" ? frequency : null,
        maxStock: product.stock,
      },
      qty,
    );
    if (ok) toast.success(`Added ${qty} × ${product.name}`);
  }

  async function startSubscription() {
    if (!user) {
      toast.info("Sign in to start a subscription");
      navigate({ to: "/auth" });
      return;
    }
    setSubmitting(true);
    try {
      // Map UI cadence to supported DB enum (monthly | bimonthly)
      const dbFrequency: "monthly" | "bimonthly" =
        frequency === "2weeks" || frequency === "monthly" || frequency === "6weeks"
          ? "monthly"
          : "bimonthly";
      const daysMap: Record<typeof frequency, number> = {
        "2weeks": 14,
        monthly: 30,
        "6weeks": 42,
        bimonthly: 60,
        "3months": 90,
      };
      const { error } = await supabase.from("subscriptions").insert({
        user_id: user.id,
        product_id: product.id,
        frequency: dbFrequency,
        quantity: qty,
        status: "active",
        next_ship_at: new Date(Date.now() + daysMap[frequency] * 86400000).toISOString(),
      });
      if (error) throw error;
      toast.success("Subscription started! Check your dashboard.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start subscription");
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadReviewPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!user) {
      toast.info("Sign in to upload review photos");
      navigate({ to: "/auth" });
      return;
    }

    const incoming = Array.from(files).slice(0, Math.max(0, 5 - reviewPhotoUrls.length));
    if (incoming.length === 0) {
      toast.error("You can attach up to 5 photos");
      return;
    }

    setUploadingPhotos(true);
    try {
      const uploaded: string[] = [];

      for (const file of incoming) {
        if (!file.type.startsWith("image/")) {
          toast.error("Only image files are allowed");
          continue;
        }

        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${product.slug}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("review-photos").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
        if (error) throw error;
        const { data } = supabase.storage.from("review-photos").getPublicUrl(path);
        if (data?.publicUrl) uploaded.push(data.publicUrl);
      }

      if (uploaded.length > 0) {
        setReviewPhotoUrls((prev) => [...prev, ...uploaded].slice(0, 5));
        toast.success(`${uploaded.length} photo${uploaded.length > 1 ? "s" : ""} uploaded`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload photos");
    } finally {
      setUploadingPhotos(false);
    }
  }

  function toggleReviewFilter(filter: ReviewFilterKey) {
    setActiveFilters((prev) =>
      prev.includes(filter) ? prev.filter((item) => item !== filter) : [...prev, filter],
    );
  }

  function removeReviewPhoto(url: string) {
    setReviewPhotoUrls((prev) => prev.filter((item) => item !== url));
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      toast.info("Sign in to leave a review");
      navigate({ to: "/auth" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("reviews")
        .insert({
          product_id: product.id,
          user_id: user.id,
          rating: reviewRating,
          title: reviewTitle || null,
          body: reviewBody || null,
          photo_urls: reviewPhotoUrls,
          taste_rating: tasteRating,
          quality_rating: qualityRating,
          texture_rating: textureRating,
          value_rating: valueRating,
          delivery_rating: deliveryRating,
        })
        .select("id, rating, title, body, created_at, verified_buyer, photo_urls, taste_rating, quality_rating, texture_rating, value_rating, delivery_rating")
        .single();
      if (error) throw error;
      setReviews((r) => [data as ReviewRow, ...r]);
      setReviewTitle(""); setReviewBody(""); setReviewRating(5); setReviewPhotoUrls([]);
      setTasteRating(null); setQualityRating(null); setTextureRating(null); setValueRating(null); setDeliveryRating(null);
      toast.success("Thanks for your review!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit review");
    } finally {
      setSubmitting(false);
    }
  }

  async function notifyMe() {
    if (!notifyEmail.includes("@")) return toast.error("Enter a valid email");
    const { error } = await supabase.from("stock_notifications").insert({
      product_id: product.id,
      email: notifyEmail.trim(),
    });
    if (error) toast.error("Could not subscribe");
    else { toast.success("We'll email you when it's back!"); setNotifyEmail(""); }
  }

  async function generateAiSummary() {
    if (reviews.length === 0) return;
    setLoadingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke("summarize-reviews", {
        body: {
          productName: product.name,
          reviews: reviews.map((r) => ({
            rating: r.rating,
            title: r.title,
            body: r.body,
            taste_rating: r.taste_rating,
            quality_rating: r.quality_rating,
            texture_rating: r.texture_rating,
            value_rating: r.value_rating,
            delivery_rating: r.delivery_rating,
          })),
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setAiSummary((data as { summary?: string })?.summary ?? "Couldn't generate a summary.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate summary");
    } finally {
      setLoadingSummary(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <Link to="/" className="hover:text-primary">Home</Link>
          <span>/</span>
          <Link to="/shop" search={{ query: "" }} className="hover:text-primary">Shop</Link>
          <span>/</span>
          <span className="truncate text-foreground">{product.name}</span>
        </nav>

        <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Gallery */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setLightbox(gallery[activeImage])}
              className="relative block aspect-square w-full overflow-hidden rounded-3xl border border-border bg-charcoal"
            >
              <img
                src={gallery[activeImage]}
                alt={product.name}
                className="h-full w-full object-cover transition duration-500"
              />
              {lowStock && (
                <span className="absolute left-4 top-4 rounded-full bg-destructive px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-destructive-foreground">
                  Only {product.stock} left
                </span>
              )}
              {product.is_featured && (
                <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-gradient-ember px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                  <Award className="h-3 w-3" /> Bestseller
                </span>
              )}
            </button>
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {gallery.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  className={`aspect-square overflow-hidden rounded-xl border-2 bg-charcoal transition ${
                    i === activeImage ? "border-primary" : "border-border hover:border-primary/50"
                  }`}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-1">{product.flavor}</span>
              <span className="rounded-full bg-muted px-2 py-1">{product.format}</span>
              {product.dietary_tags.map((t) => (
                <span key={t} className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                  <Leaf className="mr-1 inline h-3 w-3" />{t}
                </span>
              ))}
            </div>
            <h1 className="mt-3 font-display text-3xl tracking-wide sm:text-4xl md:text-5xl">{product.name}</h1>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <div className="flex">
                {[1,2,3,4,5].map((n) => (
                  <Star key={n} className={`h-4 w-4 ${n <= Math.round(avgRating) ? "fill-accent text-accent" : "text-muted"}`} />
                ))}
              </div>
              <span className="font-semibold">{avgRating || "—"}</span>
              <a href="#reviews" className="text-muted-foreground underline-offset-4 hover:text-primary hover:underline">
                ({reviews.length} review{reviews.length === 1 ? "" : "s"})
              </a>
            </div>
            <p className="mt-4 text-base text-muted-foreground">{product.description}</p>

            <div className="mt-5 flex items-center gap-6">
              <FlavorScale value={(product.spice_level || 1) as 1|2|3|4|5} type="spice" label />
              <FlavorScale value={(product.sweetness_level || 1) as 1|2|3|4|5} type="sweet" label />
            </div>

            {/* Variant selector */}
            {variants.length > 1 && (
              <div className="mt-6">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Format
                </div>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v) => {
                    const active = v.id === product.id;
                    const soldOut = v.stock === 0;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={active}
                        onClick={() => navigate({ to: "/shop/$slug", params: { slug: v.slug } })}
                        className={`rounded-xl border-2 px-4 py-2 text-left transition ${
                          active
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card hover:border-primary/50"
                        } ${soldOut ? "opacity-60" : ""}`}
                      >
                           <div className="text-sm font-semibold capitalize">{v.format}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {soldOut ? "Sold out" : formatINR(v.price)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Purchase options */}
            <div className="mt-8 space-y-3">
              <button
                type="button"
                onClick={() => setPurchaseType("once")}
                className={`w-full rounded-2xl border-2 p-4 text-left transition-all ${purchaseType === "once" ? "border-primary bg-primary/5" : "border-border bg-card"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${purchaseType === "once" ? "border-primary bg-primary" : "border-border"}`}>
                      {purchaseType === "once" && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <span className="font-semibold">One-time purchase</span>
                  </div>
                  <span className="font-display text-xl">{formatINR(product.price)}</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPurchaseType("subscribe")}
                className={`w-full rounded-2xl border-2 p-4 text-left transition-all ${purchaseType === "subscribe" ? "border-primary bg-primary/5" : "border-border bg-card"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${purchaseType === "subscribe" ? "border-primary bg-primary" : "border-border"}`}>
                      {purchaseType === "subscribe" && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 font-semibold"><Repeat className="h-4 w-4 text-primary" /> Subscribe & Save 10%</div>
                      <div className="text-xs text-muted-foreground">Free shipping. Skip or cancel anytime.</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-xl text-primary">{formatINR(subscribePrice)}</div>
                    <div className="text-[10px] text-muted-foreground line-through">{formatINR(product.price)}</div>
                  </div>
                </div>
                {purchaseType === "subscribe" && (
                  <div className="mt-3 grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quantity</span>
                      <select
                        value={qty}
                        onChange={(e) => setQty(parseInt(e.target.value))}
                        className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold uppercase tracking-wider"
                      >
                        {Array.from({ length: Math.min(15, Math.max(1, product.stock)) }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Frequency</span>
                      <select
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value as typeof frequency)}
                        className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold uppercase tracking-wider"
                      >
                        <option value="2weeks">Every 2 Weeks</option>
                        <option value="monthly">Every Month</option>
                        <option value="6weeks">Every 6 Weeks</option>
                        <option value="bimonthly">Every 2 Months</option>
                        <option value="3months">Every 3 Months</option>
                      </select>
                    </label>
                  </div>
                )}
              </button>
            </div>

            {/* Qty + CTA */}
            {!outOfStock ? (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <div className="flex items-center gap-3 rounded-full border border-border bg-card px-2">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-2"><Minus className="h-4 w-4" /></button>
                  <span className="min-w-[2ch] text-center font-display text-lg">{qty}</span>
                  <button
                    onClick={() => {
                      if (qty >= product.stock) {
                        toast.error(`Only ${product.stock} in stock`);
                        return;
                      }
                      if (qty >= 15) {
                        toast.error("Limit 15 per item");
                        return;
                      }
                      setQty((q) => q + 1);
                    }}
                    className="p-2"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <button
                  onClick={purchaseType === "subscribe" ? startSubscription : handleAdd}
                  disabled={submitting}
                  className="btn-glow flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-ember px-6 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
                  {purchaseType === "subscribe" ? "Start Subscription" : `Add to Cart • ${formatINR(effectivePrice * qty)}`}
                </button>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-5">
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-destructive">
                  <Bell className="h-4 w-4" /> Out of stock
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Get notified when it's back.</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} type="email" placeholder="you@example.com" className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm" />
                  <button onClick={notifyMe} className="rounded-full bg-gradient-ember px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground">Notify Me</button>
                </div>
              </div>
            )}

            {lowStock && <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-destructive">Only {product.stock} left in stock</p>}

            {/* Trust badges */}
            <div className="mt-6 grid grid-cols-3 gap-3 text-xs">
              <Trust icon={<Truck className="h-4 w-4 text-primary" />} label={`Free over ₹${FREE_SHIPPING_THRESHOLD}`} />
              <Trust icon={<ShieldCheck className="h-4 w-4 text-primary" />} label="Quality promise" />
              <Trust icon={<Repeat className="h-4 w-4 text-primary" />} label="Easy returns" />
            </div>
          </div>
        </div>

        {/* Highlights */}
        <section className="mt-16 grid gap-6 rounded-3xl border border-border bg-card p-6 md:p-8 lg:grid-cols-3">
          <Highlight
            icon={<Flame className="h-5 w-5" />}
            title="Crafted in small batches"
            desc="Every batch is hand-spiced and slow-dried for 6+ hours — no shortcuts, no fillers."
          />
          <Highlight
            icon={<Leaf className="h-5 w-5" />}
            title="Clean ingredients"
            desc="No MSG, no high-fructose syrup, no artificial colours. Just real meat and real spice."
          />
          <Highlight
            icon={<Award className="h-5 w-5" />}
            title="Loved by thousands"
            desc="Backed by 4.8★ ratings from snack lovers across India."
          />
        </section>

        {/* Nutrition & Ingredients */}
        <section id="nutrition" className="mt-16 grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-3xl border border-border bg-card p-6 md:p-8">
            <h2 className="font-display text-2xl tracking-wide">Nutrition Facts</h2>
            <p className="mt-1 text-xs text-muted-foreground">Per serving · {nutrition.serving}</p>
            <ul className="mt-5 divide-y divide-border text-sm">
              <NutriRow label="Calories" value={`${nutrition.calories} kcal`} bold />
              <NutriRow label="Protein" value={`${nutrition.protein} g`} />
              <NutriRow label="Total Fat" value={`${nutrition.fat} g`} />
              <NutriRow label="Carbohydrates" value={`${nutrition.carbs} g`} />
              <NutriRow label="of which Sugars" value={`${nutrition.sugar} g`} sub />
              <NutriRow label="Sodium" value={`${nutrition.sodium} mg`} />
            </ul>
            {nutritionImg && (
              <button
                type="button"
                onClick={() => setLightbox(nutritionImg)}
                className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary hover:underline"
              >
                View full label →
              </button>
            )}
            <p className="mt-4 text-[11px] text-muted-foreground">
              * Daily values based on a 2,000 kcal diet. Indicative figures — refer to pack for batch values.
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6 md:p-8">
            <h2 className="font-display text-2xl tracking-wide">Ingredients & Origin</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Premium grass-fed beef, sea salt, jaggery, garlic, onion, black pepper, and our signature
              {" "}{product.flavor.toLowerCase()} spice blend. Cured naturally — no nitrates added.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
              <Spec label="Origin" value="India" />
              <Spec label="Format" value={product.format} />
              <Spec label="Net weight" value={product.format === "sticks" ? "12 × 28g" : "100 g"} />
              <Spec label="Shelf life" value="9 months sealed" />
              <Spec label="Storage" value="Cool, dry place" />
              <Spec label="Allergens" value="May contain soy" />
            </div>
          </div>
        </section>

        {/* Reviews */}
        <section id="reviews" className="mt-16 border-t border-border pt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl tracking-wide">Customer Reviews</h2>
              <p className="mt-1 text-sm text-muted-foreground">Real reviews from verified VendiMan snackers.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1,2,3,4,5].map((n) => (
                  <Star key={n} className={`h-5 w-5 ${n <= Math.round(avgRating) ? "fill-accent text-accent" : "text-muted"}`} />
                ))}
              </div>
              <span className="font-display text-2xl">{avgRating || "—"}</span>
              <span className="text-xs text-muted-foreground">({reviews.length})</span>
            </div>
          </div>

          {/* 1. Your rating form */}
          {user ? (
            <form onSubmit={submitReview} className="mt-6 rounded-2xl border border-border bg-card p-6">
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Overall rating</div>
              <div className="flex gap-1">
                {[1,2,3,4,5].map((n) => (
                  <button key={n} type="button" onClick={() => setReviewRating(n)} aria-label={`${n} star${n>1?"s":""}`}>
                    <Star className={`h-7 w-7 ${n <= reviewRating ? "fill-accent text-accent" : "text-muted"}`} />
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-border bg-background p-3">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rate specific aspects (optional)</div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {([
                    { label: "Taste", val: tasteRating, set: setTasteRating },
                    { label: "Quality", val: qualityRating, set: setQualityRating },
                    { label: "Texture", val: textureRating, set: setTextureRating },
                    { label: "Value for Money", val: valueRating, set: setValueRating },
                    { label: "Delivery", val: deliveryRating, set: setDeliveryRating },
                  ] as const).map(({ label, val, set }) => (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map((n) => (
                          <button key={n} type="button" onClick={() => set(val === n ? null : n)} aria-label={`${label} ${n} stars`}>
                            <Star className={`h-4 w-4 ${val !== null && n <= val ? "fill-accent text-accent" : "text-muted"}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <input value={reviewTitle} onChange={(e) => setReviewTitle(e.target.value)} placeholder="Headline (optional)" className="mt-4 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              <textarea value={reviewBody} onChange={(e) => setReviewBody(e.target.value)} placeholder="Share your experience…" rows={3} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              <div className="mt-3 rounded-2xl border border-dashed border-border bg-background p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Review photos</div>
                    <p className="mt-1 text-xs text-muted-foreground">Upload up to 5 photos. They’ll be saved with your review and shown in the customer photo strip.</p>
                  </div>
                  <label className="btn-glow inline-flex cursor-pointer items-center gap-2 rounded-full bg-gradient-ember px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground">
                    {uploadingPhotos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Add photos
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      disabled={uploadingPhotos || reviewPhotoUrls.length >= 5}
                      onChange={(e) => {
                        void uploadReviewPhotos(e.target.files);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
                {reviewPhotoUrls.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {reviewPhotoUrls.map((src, i) => (
                      <div key={`${src}-${i}`} className="relative h-20 w-20 overflow-hidden rounded-xl border border-border">
                        <img src={src} alt={`Review upload ${i + 1}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeReviewPhoto(src)}
                          className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground shadow"
                          aria-label="Remove review photo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" disabled={submitting} className="btn-glow mt-3 rounded-full bg-gradient-ember px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50">
                {submitting && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />} Submit Review
              </button>
            </form>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-5 text-center text-sm text-muted-foreground">
              <Link to="/auth" className="font-semibold text-primary underline-offset-4 hover:underline">Sign in</Link> to leave a review.
            </div>
          )}

          {/* 2. Star percentage histogram */}
          {reviews.length > 0 && (
            <div className="mt-6 rounded-2xl border border-border bg-card p-5">
              {[5,4,3,2,1].map((star, i) => {
                const count = histogram[i];
                const pct = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-3 py-1 text-xs">
                    <span className="flex w-12 items-center gap-1 text-muted-foreground">
                      {star} <Star className="h-3 w-3 fill-accent text-accent" />
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-gradient-ember" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* 3. AI summary across taste / quality / texture / value */}
          {reviews.length > 0 && (
            <div className="mt-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-lg tracking-wide">AI Review Summary</h3>
                </div>
                {!aiSummary && !loadingSummary && (
                  <button
                    type="button"
                    onClick={generateAiSummary}
                    className="rounded-full bg-gradient-ember px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground"
                  >
                    Summarise reviews
                  </button>
                )}
              </div>
              {loadingSummary && (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Reading {reviews.length} reviews…
                </div>
              )}
              {aiSummary && (
                <div className="prose prose-sm mt-3 max-w-none whitespace-pre-wrap text-sm text-foreground/90">
                  {aiSummary}
                </div>
              )}
              {!aiSummary && !loadingSummary && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Get an AI-generated overview of what shoppers say about taste, quality, texture and value.
                </p>
              )}
            </div>
          )}

          {/* 4. Customer photo strip */}
          {photoReviews.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Camera className="h-3.5 w-3.5" /> Customer photos
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {photoReviews.map((src, i) => (
                  <button
                    key={`${src}-${i}`}
                    type="button"
                    onClick={() => setLightbox(src)}
                    className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-border"
                  >
                    <img src={src} alt={`Customer photo ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 5. Filters */}
          {reviews.length > 0 && (
            <div className="mt-6 rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Filter by highlights</div>
                  <p className="mt-1 text-sm text-muted-foreground">Show reviews that specifically praise the areas you care about.</p>
                </div>
                {activeFilters.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveFilters([])}
                    className="text-xs font-bold uppercase tracking-wider text-primary hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {REVIEW_FILTERS.filter((f) => filterCounts[f.key] > 0).map((filter) => {
                  const checked = activeFilters.includes(filter.key);
                  return (
                    <label
                      key={filter.key}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${checked ? "border-primary bg-primary/5" : "border-border bg-background"}`}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggleReviewFilter(filter.key)} />
                      <span className="text-sm font-medium">{filter.label}</span>
                      <Badge variant="secondary" className="ml-1">{filterCounts[filter.key]}</Badge>
                    </label>
                  );
                })}
              </div>
            </div>
          )}


          <div className="mt-8 space-y-4">
            {loadingReviews && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading reviews…
              </div>
            )}
            {!loadingReviews && reviews.length === 0 && (
              <p className="text-sm text-muted-foreground">No reviews yet. Be the first!</p>
            )}
            {!loadingReviews && reviews.length > 0 && filteredReviews.length === 0 && (
              <p className="text-sm text-muted-foreground">No reviews match the selected filters.</p>
            )}
            {filteredReviews.map((r) => (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map((n) => (
                      <Star key={n} className={`h-4 w-4 ${n <= r.rating ? "fill-accent text-accent" : "text-muted"}`} />
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.verified_buyer && <span className="mr-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">Verified</span>}
                    {new Date(r.created_at).toLocaleDateString("en-IN")}
                  </div>
                </div>
                {r.title && <h3 className="mt-2 font-semibold">{r.title}</h3>}
                {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
                {r.photo_urls && r.photo_urls.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.photo_urls.map((src, i) => (
                      <button
                        key={`${src}-${i}`}
                        type="button"
                        onClick={() => setLightbox(src)}
                        className="h-16 w-16 overflow-hidden rounded-lg border border-border"
                      >
                        <img src={src} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-16 border-t border-border pt-12">
          <h2 className="font-display text-3xl tracking-wide">Frequently Asked Questions</h2>
          <div className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card">
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              return (
                <div key={f.q}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="font-semibold">{f.q}</span>
                    <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open && <div className="px-5 pb-5 text-sm text-muted-foreground">{f.a}</div>}
                </div>
              );
            })}
          </div>
        </section>

        {/* You may also like */}
        {related.length > 0 && (
          <section className="mt-16 border-t border-border pt-12">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-display text-3xl tracking-wide">You may also like</h2>
              <Link to="/shop" search={{ query: "" }} className="text-xs font-bold uppercase tracking-wider text-primary hover:underline">View all →</Link>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p, i) => (
                <ProductCard key={p.id} product={dbToProduct(p)} index={i} />
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />

      {/* Lightbox */}
      {lightbox && (
        <button
          type="button"
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          aria-label="Close image"
        >
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />
        </button>
      )}
    </div>
  );
}

function Trust({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <div className="mx-auto flex justify-center">{icon}</div>
      <div className="mt-1 font-semibold">{label}</div>
    </div>
  );
}

function Highlight({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-ember text-primary-foreground shadow-ember">
        {icon}
      </div>
      <h3 className="mt-3 font-display text-lg">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function NutriRow({ label, value, bold, sub }: { label: string; value: string; bold?: boolean; sub?: boolean }) {
  return (
    <li className={`flex items-center justify-between py-2 ${sub ? "pl-4 text-xs text-muted-foreground" : ""}`}>
      <span className={bold ? "font-bold" : ""}>{label}</span>
      <span className={bold ? "font-display text-lg" : "font-semibold"}>{value}</span>
    </li>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-semibold">{value}</div>
    </div>
  );
}
