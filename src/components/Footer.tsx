import { Flame, Instagram, Twitter, Youtube } from "lucide-react";

export function Footer() {
  return (
    <footer className="relative mt-32 border-t border-border bg-card/50">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-gradient-ember">
              <Flame className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-xl tracking-wider">VENDIMAN</span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            Hand-cut, slow-smoked jerky and snack sticks for people who refuse the ordinary.
          </p>
          <div className="mt-6 flex gap-3">
            {[Instagram, Twitter, Youtube].map((Icon, i) => (
              <a key={i} href="#" className="btn-glow inline-flex h-9 w-9 items-center justify-center rounded-full border border-border hover:border-primary/60">
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        {[
          { title: "Shop", links: ["All Jerky", "Snack Sticks", "Bundles", "Build Your Box"] },
          { title: "Help", links: ["Track Order", "Shipping", "Returns", "FAQ"] },
          { title: "Company", links: ["Our Story", "Sourcing", "Careers", "Press"] },
        ].map((col) => (
          <div key={col.title}>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-foreground">{col.title}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {col.links.map((l) => (
                <li key={l}><a href="#" className="hover:text-primary transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} VendiMan Provisions Co. — Smoked with intent.
      </div>
    </footer>
  );
}
