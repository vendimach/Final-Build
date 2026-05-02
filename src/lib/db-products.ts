import { supabase } from "@/integrations/supabase/client";
import classic from "@/assets/product-classic.jpg";
import spicy from "@/assets/product-spicy.jpg";
import honey from "@/assets/product-honey.jpg";
import sticks from "@/assets/product-sticks.jpg";

export interface DbProduct {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  format: "sticks" | "bags" | "bundles";
  flavor: "spicy" | "sweet" | "savory";
  spice_level: number;
  sweetness_level: number;
  dietary_tags: string[];
  image_url: string | null;
  hover_image_url: string | null;
  gallery_urls?: string[] | null;
  stock: number;
  is_active: boolean;
  is_featured: boolean;
  review_count?: number;
  rating_average?: number;
}

// Local image fallback by slug
export function imageForSlug(slug: string): string {
  if (slug.includes("spicy") || slug.includes("reaper") || slug.includes("ghost")) return spicy;
  if (slug.includes("honey") || slug.includes("maple") || slug.includes("bourbon")) return honey;
  if (slug.includes("stick")) return sticks;
  return classic;
}

export function hoverImageForSlug(slug: string): string {
  const all = [classic, honey, spicy, sticks];
  const i = Math.abs(slug.split("").reduce((s, c) => s + c.charCodeAt(0), 0)) % all.length;
  return all[(i + 1) % all.length];
}

export async function fetchProducts(options?: { includeReviewStats?: boolean }): Promise<DbProduct[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;

  const products = ((data ?? []) as DbProduct[]);

  if (!options?.includeReviewStats || products.length === 0) {
    return products;
  }

  const { data: reviewRows, error: reviewError } = await supabase
    .from("reviews")
    .select("product_id, rating")
    .eq("is_approved", true)
    .in("product_id", products.map((product) => product.id));

  if (reviewError) throw reviewError;

  const stats = new Map<string, { total: number; count: number }>();
  for (const row of reviewRows ?? []) {
    const current = stats.get(row.product_id) ?? { total: 0, count: 0 };
    current.total += Number(row.rating) || 0;
    current.count += 1;
    stats.set(row.product_id, current);
  }

  return products.map((product) => {
    const productStats = stats.get(product.id);
    return {
      ...product,
      review_count: productStats?.count ?? 0,
      rating_average: productStats?.count ? +(productStats.total / productStats.count).toFixed(1) : 0,
    };
  });
}

import type { Product, Flavor, Format, Diet } from "./products";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function dbToProduct(p: DbProduct): Product {
  const stock = Math.max(0, p.stock);
  let badge: Product["badge"] | undefined;
  if (stock === 0) badge = "Sold Out";
  else if (p.is_featured) badge = "Bestseller";
  return {
    id: p.slug, // use slug as id for routing /shop/$slug
    dbId: p.id, // real DB uuid for order_items
    name: p.name,
    tagline: p.description ?? "",
    price: Number(p.price),
    image: p.image_url || imageForSlug(p.slug),
    hoverImage: p.hover_image_url || hoverImageForSlug(p.slug),
    flavor: cap(p.flavor) as Flavor,
    format: cap(p.format) as Format,
    diets: (p.dietary_tags ?? []) as Diet[],
    spice: Math.min(5, Math.max(1, p.spice_level || 1)) as Product["spice"],
    sweet: Math.min(5, Math.max(1, p.sweetness_level || 1)) as Product["sweet"],
    stock,
    rating: p.rating_average ?? 0,
    reviews: p.review_count ?? 0,
    badge,
  };
}
