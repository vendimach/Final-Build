import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCart } from "@/lib/cart-context";
import { Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { formatINR } from "@/lib/currency";

export function CartDrawer() {
  const { open, setOpen, items, updateQty, removeItem, subtotal } = useCart();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="flex w-full flex-col bg-background sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl tracking-wide">Your Cart</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <ShoppingBag className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Your cart's empty. Time to fix that.</p>
            <Link
              to="/shop"
              search={{ query: "" }}
              onClick={() => setOpen(false)}
              className="btn-glow mt-2 inline-flex items-center gap-2 rounded-full bg-gradient-ember px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground"
            >
              Browse the Shop
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto py-4">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                  {item.image && (
                    <img src={item.image} alt={item.name} className="h-20 w-20 rounded-lg object-cover" />
                  )}
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold leading-tight">{item.name}</h4>
                        {item.subscription && (
                          <span className="mt-1 inline-block rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">
                            Subscribe • {item.subscription}
                          </span>
                        )}
                        {item.isBundle && item.bundleItems && (
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {item.bundleItems.length} items
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        aria-label="Remove"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                      <div className="inline-flex items-center rounded-full border border-border">
                        <button
                          onClick={() => updateQty(item.id, item.quantity - 1)}
                          className="p-2 hover:text-primary"
                          aria-label="Decrease"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.id, item.quantity + 1)}
                          className="p-2 hover:text-primary"
                          aria-label="Increase"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="font-display text-base">{formatINR(item.price * item.quantity)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-display text-lg">{formatINR(subtotal)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Shipping calculated at checkout. Free over ₹499.</p>
              <Link
                to="/checkout"
                onClick={() => setOpen(false)}
                className="btn-glow flex w-full items-center justify-center rounded-full bg-gradient-ember py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground"
              >
                Checkout
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
