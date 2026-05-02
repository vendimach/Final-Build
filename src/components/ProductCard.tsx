import { motion } from "framer-motion";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShoppingBag, Star, Bell, Plus, Minus } from "lucide-react";
import type { Product } from "@/lib/products";
import { FlavorScale } from "./FlavorScale";
import { useCart } from "@/lib/cart-context";
import { toast } from "sonner";
import { formatINR } from "@/lib/currency";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const [hover, setHover] = useState(false);
  const { addItem, items, updateQty, removeItem } = useCart();
  const outOfStock = product.stock === 0;
  const lowStock = product.stock > 0 && product.stock <= 5;
  const cartId = product.dbId ?? product.id;
  const inCart = items.find((i) => i.id === cartId);

  const handleAdd = () => {
    const ok = addItem({
      id: cartId,
      productId: cartId,
      name: product.name,
      price: product.price,
      image: product.image,
      maxStock: product.stock,
    });
    if (ok && !inCart) toast.success(`${product.name} added to cart`);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-500 hover:border-primary/50 hover:shadow-lift"
    >
      {/* Badges */}
      {product.badge && (
        <div className={`absolute left-4 top-4 z-10 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
          product.badge === "Sold Out" ? "bg-muted text-muted-foreground"
          : product.badge === "Limited" ? "bg-destructive text-destructive-foreground"
          : product.badge === "New" ? "bg-accent text-accent-foreground"
          : "bg-gradient-ember text-primary-foreground"
        }`}>
          {product.badge}
        </div>
      )}
      {lowStock && (
        <div className="absolute right-4 top-4 z-10 animate-pulse rounded-full bg-destructive/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-destructive-foreground backdrop-blur">
          Only {product.stock} left
        </div>
      )}

      {/* Image */}
      <Link
        to="/shop/$slug"
        params={{ slug: product.id }}
        aria-label={`View details for ${product.name}`}
        className="relative block aspect-square overflow-hidden bg-charcoal"
      >
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ${hover ? "scale-110 opacity-0" : "scale-100 opacity-100"}`}
        />
        <img
          src={product.hoverImage}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ${hover ? "scale-100 opacity-100" : "scale-110 opacity-0"}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>{product.flavor}</span>
          <span>•</span>
          <span>{product.format}</span>
        </div>
        <Link to="/shop/$slug" params={{ slug: product.id }} className="font-display text-xl leading-tight tracking-wide hover:text-primary">{product.name}</Link>
        <p className="mt-1 text-sm text-muted-foreground">{product.tagline}</p>

        <div className="mt-3 flex items-center gap-3">
          <FlavorScale value={product.spice} type="spice" />
          <FlavorScale value={product.sweet} type="sweet" />
        </div>

        <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3 w-3 fill-accent text-accent" />
          <span className="font-semibold text-foreground">{product.rating > 0 ? product.rating.toFixed(1) : "New"}</span>
          <span>({product.reviews})</span>
        </div>

        <div className="mt-auto flex items-end justify-between pt-5">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">From</div>
            <div className="font-display text-2xl text-foreground">{formatINR(product.price)}</div>
          </div>
          {outOfStock ? (
            <button className="btn-glow inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:border-primary/50 hover:text-foreground">
              <Bell className="h-3.5 w-3.5" /> Notify Me
            </button>
          ) : inCart ? (
            <div className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10">
              <button
                onClick={() =>
                  inCart.quantity <= 1 ? removeItem(cartId) : updateQty(cartId, inCart.quantity - 1)
                }
                aria-label="Decrease"
                className="p-2 text-primary hover:text-foreground"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-6 text-center text-xs font-bold text-foreground">{inCart.quantity}</span>
              <button
                onClick={handleAdd}
                aria-label="Increase"
                className="p-2 text-primary hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button onClick={handleAdd} className="btn-glow inline-flex items-center gap-2 rounded-full bg-gradient-ember px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground">
              <ShoppingBag className="h-3.5 w-3.5" /> Add
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
