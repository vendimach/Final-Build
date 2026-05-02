import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";

const FAQ_REPLIES: { match: RegExp; reply: string }[] = [
  { match: /ship|deliver|arrive/i, reply: "Free US shipping on orders over $40. Standard delivery: 2–4 business days." },
  { match: /return|refund/i, reply: "Not satisfied? Send it back within 30 days for a full refund. We stand by every batch." },
  { match: /ingredient|gluten|keto|paleo/i, reply: "Every product is gluten-free. Most are keto and paleo certified — check the dietary tags on each product card." },
  { match: /spice|hot|heat/i, reply: "Use the flame scale on each product (1-5). Ghost Pepper Inferno = 5/5. Originals sit comfortably at 1/5." },
  { match: /subscribe|subscription/i, reply: "Subscribe & Save gives you 15% off every order. Pause, swap, or cancel any time from your dashboard." },
];

interface Msg { from: "user" | "bot"; text: string }

export function SupportBubble() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: "bot", text: "Hey there! I'm Ember, your VendiMan guide. Ask about shipping, ingredients, or heat levels." },
  ]);
  const [input, setInput] = useState("");

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg: Msg = { from: "user", text: input };
    const found = FAQ_REPLIES.find((f) => f.match.test(input));
    const reply: Msg = { from: "bot", text: found?.reply ?? "Great question — I'll have a human teammate follow up at hello@vendiman.co." };
    setMsgs((m) => [...m, userMsg, reply]);
    setInput("");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open support"
        className="btn-glow fixed bottom-6 left-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-ember text-primary-foreground shadow-ember"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 left-6 z-40 flex h-[480px] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lift"
          >
            <div className="flex items-center justify-between bg-gradient-ember p-4 text-primary-foreground">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/20">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-display text-lg leading-none">Ember</div>
                  <div className="text-[10px] uppercase tracking-wider opacity-80">AI Concierge</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    m.from === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <button type="submit" className="btn-glow inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-ember text-primary-foreground" aria-label="Send">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
