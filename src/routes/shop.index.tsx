import { createFileRoute, ErrorComponent, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { fetchProducts, dbToProduct } from "@/lib/db-products";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/shop/")({
  validateSearch: (search: Record<string, unknown>) => ({
    query: typeof search.query === "string" ? search.query : "",
  }),
  head: () => ({
    meta: [
      { title: "Shop — VendiMan" },
      { name: "description", content: "Browse the full VendiMan lineup of premium beef jerky and snack sticks." },
    ],
  }),
  loader: async () => {
    const rows = await fetchProducts({ includeReviewStats: true });
    return { products: rows.map(dbToProduct) };
  },
  pendingComponent: () => (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </div>
  ),
  errorComponent: ({ error }) => {
    const router = useRouter();
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <ErrorComponent error={error} />
          <button onClick={() => router.invalidate()} className="btn-glow mt-6 rounded-full bg-gradient-ember px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground">
            Retry
          </button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => <div>Not found</div>,
  component: Shop,
});

function Shop() {
  const { products } = Route.useLoaderData();
  const { query } = Route.useSearch();
  const searchTerm = query.trim().toLowerCase();
  const filteredProducts = searchTerm
    ? products.filter((product) =>
        [product.name, product.tagline, product.flavor, product.format].some((value) =>
          value.toLowerCase().includes(searchTerm),
        ),
      )
    : products;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-16">
        <h1 className="font-display text-5xl tracking-wide md:text-6xl">The Full Lineup</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">Filter by flavor, format, or dietary need. Every bag, ready to ship.</p>
        {query && <p className="mt-4 text-sm text-muted-foreground">Showing results for “{query}”.</p>}
        {filteredProducts.length === 0 ? (
          <p className="mt-12 text-center text-muted-foreground">No products available yet.</p>
        ) : (
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
