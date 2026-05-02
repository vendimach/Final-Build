import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface CartItem {
  id: string; // product id OR bundle synthetic id
  productId: string;
  name: string;
  price: number;
  image?: string | null;
  quantity: number;
  isBundle?: boolean;
  bundleItems?: { productId: string; name: string }[];
  subscription?: string | null;
  /** When set, addItem/updateQty enforces this max units allowed. */
  maxStock?: number;
}

interface CartContextValue {
  items: CartItem[];
  open: boolean;
  setOpen: (v: boolean) => void;
  addItem: (item: Omit<CartItem, "quantity">, qty?: number) => boolean;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clear: () => void;
  subtotal: number;
  count: number;
}

const CartContext = createContext<CartContextValue | null>(null);

const GUEST_KEY = "vendiman.cart.guest";
const userKey = (uid: string) => `vendiman.cart.user.${uid}`;
export const MAX_PER_ITEM = 15;

function safeRead(key: string): CartItem[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(key: string, items: CartItem[]) {
  try {
    if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(items));
  } catch {}
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  // null = unknown, string = uid, "" = guest
  const ownerRef = useRef<string | null>(null);

  // Bind cart storage to the current auth user (or guest)
  useEffect(() => {
    let mounted = true;

    const applyOwner = (uid: string | null) => {
      if (!mounted) return;
      const newOwner = uid ?? "";
      if (ownerRef.current === newOwner) return;
      ownerRef.current = newOwner;
      const key = uid ? userKey(uid) : GUEST_KEY;
      setItems(safeRead(key));
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      applyOwner(session?.user?.id ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        // Wipe in-memory cart immediately on logout
        ownerRef.current = "";
        setItems([]);
        return;
      }
      applyOwner(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Persist on change for the current owner
  useEffect(() => {
    const owner = ownerRef.current;
    if (owner === null) return; // not initialised yet
    const key = owner ? userKey(owner) : GUEST_KEY;
    safeWrite(key, items);
  }, [items]);

  const addItem: CartContextValue["addItem"] = (item, qty = 1) => {
    let added = false;
    setItems((cur) => {
      const existing = cur.find((i) => i.id === item.id);
      const currentQty = existing?.quantity ?? 0;
      const stockMax = item.maxStock ?? existing?.maxStock;
      const max = stockMax !== undefined ? Math.min(stockMax, MAX_PER_ITEM) : MAX_PER_ITEM;

      if (currentQty >= max) {
        toast.error(
          stockMax !== undefined && stockMax < MAX_PER_ITEM
            ? `Only ${max} in stock — already at the limit`
            : `Limit ${MAX_PER_ITEM} per item`,
        );
        return cur;
      }
      const allowed = Math.max(0, Math.min(qty, max - currentQty));
      if (allowed === 0) return cur;
      if (allowed < qty) {
        toast.warning(`Only ${max - currentQty} more allowed — added what we could`);
      }
      qty = allowed;

      added = true;
      if (existing) {
        return cur.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + qty, maxStock: max ?? i.maxStock } : i,
        );
      }
      return [...cur, { ...item, quantity: qty }];
    });
    if (added) setOpen(true);
    return added;
  };

  const removeItem = (id: string) => setItems((c) => c.filter((i) => i.id !== id));

  const updateQty = (id: string, qty: number) =>
    setItems((c) =>
      c.map((i) => {
        if (i.id !== id) return i;
        const stockMax = i.maxStock ?? Infinity;
        const max = Math.min(stockMax, MAX_PER_ITEM);
        const next = Math.max(1, Math.min(qty, max));
        if (qty > max) {
          toast.error(
            stockMax < MAX_PER_ITEM ? `Only ${stockMax} in stock` : `Limit ${MAX_PER_ITEM} per item`,
          );
        }
        return { ...i, quantity: next };
      }),
    );

  const clear = () => {
    setItems([]);
    // Also wipe persisted copy for current owner immediately
    const owner = ownerRef.current;
    if (owner !== null) {
      const key = owner ? userKey(owner) : GUEST_KEY;
      safeWrite(key, []);
    }
  };

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, open, setOpen, addItem, removeItem, updateQty, clear, subtotal, count }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
