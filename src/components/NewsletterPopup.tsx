import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Flame, Check } from "lucide-react";

export function NewsletterPopup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("vm-newsletter")) return;
    const t = setTimeout(() => setOpen(true), 8000);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    setOpen(false);
    localStorage.setItem("vm-newsletter", "1");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
    localStorage.setItem("vm-newsletter", "1");
    setTimeout(() => setOpen(false), 2200);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 28 }}
          className="fixed bottom-6 right-6 z-50 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-lift"
        >
          <div className="relative bg-gradient-ember p-5 text-primary-foreground">
            <button onClick={close} className="absolute right-3 top-3 text-primary-foreground/80 hover:text-primary-foreground" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest">
              <Flame className="h-3 w-3" /> Welcome Drop
            </div>
            <div className="font-display text-3xl leading-tight">Get 10% off your first bag.</div>
          </div>
          <div className="p-5">
            {submitted ? (
              <div className="flex items-center gap-2 py-2 text-sm text-success">
                <Check className="h-4 w-4" /> Code <span className="font-mono font-bold">SMOKE10</span> sent to your inbox.
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <p className="text-sm text-muted-foreground">Join the herd. New drops, restocks, and exclusive batches.</p>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
                />
                <button type="submit" className="btn-glow w-full rounded-full bg-gradient-ember py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground">
                  Claim My 10%
                </button>
              </form>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
