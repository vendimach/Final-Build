import classic from "@/assets/product-classic.jpg";
import spicy from "@/assets/product-spicy.jpg";
import honey from "@/assets/product-honey.jpg";
import sticks from "@/assets/product-sticks.jpg";

export type Flavor = "Spicy" | "Sweet" | "Savory";
export type Format = "Sticks" | "Bags" | "Bundles";
export type Diet = "Keto" | "Paleo" | "Gluten-Free";

export interface Product {
  id: string;
  /** Optional DB UUID when the product comes from Supabase (used for order_items.product_id). */
  dbId?: string;
  name: string;
  tagline: string;
  price: number;
  image: string;
  hoverImage: string;
  flavor: Flavor;
  format: Format;
  diets: Diet[];
  spice: 1 | 2 | 3 | 4 | 5;
  sweet: 1 | 2 | 3 | 4 | 5;
  stock: number;
  rating: number;
  reviews: number;
  badge?: string;
}

export const PRODUCTS: Product[] = [
  {
    id: "original-smokehouse",
    name: "Original Smokehouse",
    tagline: "Hickory-smoked, hand-cut, slow-dried.",
    price: 449,
    image: classic,
    hoverImage: honey,
    flavor: "Savory",
    format: "Bags",
    diets: ["Keto", "Gluten-Free"],
    spice: 1,
    sweet: 2,
    stock: 24,
    rating: 4.9,
    reviews: 312,
    badge: "Bestseller",
  },
  {
    id: "ghost-pepper-inferno",
    name: "Ghost Pepper Inferno",
    tagline: "For those who chase the burn.",
    price: 549,
    image: spicy,
    hoverImage: classic,
    flavor: "Spicy",
    format: "Bags",
    diets: ["Keto", "Paleo", "Gluten-Free"],
    spice: 5,
    sweet: 1,
    stock: 3,
    rating: 4.8,
    reviews: 187,
    badge: "Limited",
  },
  {
    id: "honey-bourbon-glaze",
    name: "Honey Bourbon Glaze",
    tagline: "Sweet heat. Smooth finish.",
    price: 499,
    image: honey,
    hoverImage: classic,
    flavor: "Sweet",
    format: "Bags",
    diets: ["Gluten-Free"],
    spice: 2,
    sweet: 4,
    stock: 18,
    rating: 4.9,
    reviews: 256,
  },
  {
    id: "campfire-sticks",
    name: "Campfire Snack Sticks",
    tagline: "Trail-ready protein, packed twelve strong.",
    price: 699,
    image: sticks,
    hoverImage: spicy,
    flavor: "Savory",
    format: "Sticks",
    diets: ["Keto", "Paleo", "Gluten-Free"],
    spice: 2,
    sweet: 1,
    stock: 42,
    rating: 4.7,
    reviews: 421,
    badge: "New",
  },
  {
    id: "the-rancher-bundle",
    name: "The Rancher Bundle",
    tagline: "Six bags. One legendary box.",
    price: 2299,
    image: classic,
    hoverImage: sticks,
    flavor: "Savory",
    format: "Bundles",
    diets: ["Keto", "Gluten-Free"],
    spice: 3,
    sweet: 2,
    stock: 0,
    rating: 5.0,
    reviews: 98,
    badge: "Sold Out",
  },
  {
    id: "carolina-reaper",
    name: "Carolina Reaper Sticks",
    tagline: "Reaper-spiced. Not for the faint.",
    price: 599,
    image: sticks,
    hoverImage: spicy,
    flavor: "Spicy",
    format: "Sticks",
    diets: ["Keto", "Paleo"],
    spice: 5,
    sweet: 1,
    stock: 11,
    rating: 4.6,
    reviews: 142,
  },
];
