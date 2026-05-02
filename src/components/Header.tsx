import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ShoppingBag, Search, User, Flame, LogOut, Menu, X, LayoutDashboard, Shield } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { supabase } from "@/integrations/supabase/client";
import { fetchProducts, dbToProduct } from "@/lib/db-products";
import type { Product } from "@/lib/products";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export function Header() {
  const { user, signOut } = useAuth();
  const { count, setOpen } = useCart();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [productList, setProductList] = useState<Product[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(!!data);
    });
  }, [user]);

  // Lazy-load product list once when search is first opened
  useEffect(() => {
    if (!searchOpen || productList.length > 0) return;
    fetchProducts({ includeReviewStats: false })
      .then((rows) => setProductList(rows.map(dbToProduct)))
      .catch(() => {});
  }, [searchOpen, productList.length]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (menuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  useEffect(() => {
    if (searchOpen) {
      // small delay to allow render
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [searchOpen]);

  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return productList.slice(0, 5);
    return productList
      .filter((p) =>
        [p.name, p.tagline, p.flavor, p.format].some((v) => v.toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [productList, searchQuery]);

  const submitProductSearch = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    navigate({ to: "/shop", search: { query: searchQuery.trim() } });
    setSearchOpen(false);
    setMenuOpen(false);
  };

  const navLinks = (
    <>
      <Link to="/" activeOptions={{ exact: true }} activeProps={{ className: "text-primary" }} className="hover:text-primary transition-colors" onClick={() => setMenuOpen(false)}>Home</Link>
      <Link to="/shop" search={{ query: "" }} activeProps={{ className: "text-primary" }} className="hover:text-primary transition-colors" onClick={() => setMenuOpen(false)}>Shop</Link>
      <Link to="/subscribe" activeProps={{ className: "text-primary" }} className="hover:text-primary transition-colors" onClick={() => setMenuOpen(false)}>Subscribe</Link>
      <Link to="/build-your-box" activeProps={{ className: "text-primary" }} className="hover:text-primary transition-colors" onClick={() => setMenuOpen(false)}>Build a Box</Link>
      <Link to="/track" search={{ order: "" }} activeProps={{ className: "text-primary" }} className="hover:text-primary transition-colors" onClick={() => setMenuOpen(false)}>Track</Link>
    </>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-ember shadow-ember">
            <Flame className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl tracking-wider sm:text-2xl">
            VENDI<span className="text-primary">MAN</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium uppercase tracking-wider md:flex">
          {navLinks}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            aria-label="Search products"
            onClick={() => setSearchOpen((v) => !v)}
            className="btn-glow inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
          >
            {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </button>
          <ThemeToggle />

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button aria-label="Account" className="btn-glow inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
                  <User className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate text-xs">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/dashboard" })}>
                  <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}>
                    <Shield className="mr-2 h-4 w-4 text-primary" /> Admin Center
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    toast.success("Signed out");
                    navigate({ to: "/auth" });
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth" aria-label="Sign in" className="btn-glow inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
              <User className="h-4 w-4" />
            </Link>
          )}

          <button
            onClick={() => setOpen(true)}
            className="btn-glow relative inline-flex h-10 items-center gap-2 rounded-full bg-gradient-ember px-3 text-sm font-semibold text-primary-foreground sm:px-4"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Cart</span>
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                {count}
              </span>
            )}
          </button>

          <button
            aria-label="Open menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="btn-glow inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card md:hidden"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Search dropdown panel */}
      {searchOpen && (
        <>
          <div
            className="fixed inset-0 top-16 z-30 bg-black/40 backdrop-blur-sm"
            onClick={() => setSearchOpen(false)}
          />
          <div className="absolute inset-x-0 top-16 z-40 border-b border-border bg-background shadow-lg">
            <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
              <form onSubmit={submitProductSearch} className="flex items-center gap-3 rounded-full border border-border bg-card px-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search products, flavors, formats..."
                  className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button type="submit" className="text-xs font-bold uppercase tracking-wider text-primary hover:text-foreground">
                  Go
                </button>
              </form>

              {suggestions.length > 0 ? (
                <ul className="mt-3 max-h-[60vh] overflow-y-auto rounded-2xl border border-border bg-card">
                  {suggestions.map((p) => (
                    <li key={p.id}>
                      <Link
                        to="/shop/$slug"
                        params={{ slug: p.id }}
                        onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                        className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted"
                      >
                        {p.image && (
                          <img src={p.image} alt={p.name} className="h-10 w-10 flex-none rounded-md object-cover" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold normal-case">{p.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{p.flavor} • {p.format}</div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : searchQuery.trim() ? (
                <p className="mt-3 px-2 text-sm text-muted-foreground">No matches for “{searchQuery}”.</p>
              ) : null}
            </div>
          </div>
        </>
      )}

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 top-16 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMenuOpen(false)}
          />
          <nav className="fixed inset-x-0 top-16 z-50 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-border bg-background p-6 md:hidden">
            <div className="flex flex-col gap-4 text-base font-semibold uppercase tracking-wider">
              {navLinks}
              <div className="my-2 h-px bg-border" />
              {user ? (
                <>
                  <div className="truncate text-xs normal-case text-muted-foreground">{user.email}</div>
                  <Link to="/dashboard" className="flex items-center gap-2 hover:text-primary" onClick={() => setMenuOpen(false)}>
                    <LayoutDashboard className="h-4 w-4" /> Dashboard
                  </Link>
                  {isAdmin && (
                    <Link to="/admin" className="flex items-center gap-2 text-primary" onClick={() => setMenuOpen(false)}>
                      <Shield className="h-4 w-4" /> Admin Center
                    </Link>
                  )}
                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      await signOut();
                      toast.success("Signed out");
                      navigate({ to: "/auth" });
                    }}
                    className="flex items-center gap-2 text-left text-destructive"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </>
              ) : (
                <Link
                  to="/auth"
                  onClick={() => setMenuOpen(false)}
                  className="btn-glow inline-flex items-center justify-center gap-2 rounded-full bg-gradient-ember px-5 py-3 text-sm font-bold text-primary-foreground"
                >
                  <User className="h-4 w-4" /> Sign in / Create account
                </Link>
              )}
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
