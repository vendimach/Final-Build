import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — VendiMan" },
      { name: "description", content: "Terms of use governing your purchases and use of VendiMan." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-5xl tracking-wide">Terms & Conditions</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-IN")}</p>

        <div className="mt-10 space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="font-display text-2xl text-foreground">1. Acceptance</h2>
            <p>By using VendiMan, you agree to these terms. If you do not agree, please do not use the site or place orders.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">2. Orders & pricing</h2>
            <p>All prices are in Indian Rupees (₹) and inclusive of applicable taxes. We reserve the right to refuse or cancel any order due to product unavailability, pricing errors, or suspected fraud.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">3. Payments</h2>
            <p>Payments are processed securely via Razorpay. Your order is confirmed only after successful payment verification.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">4. Shipping</h2>
            <p>We currently ship within India. Delivery timelines are estimates; we are not liable for carrier delays. Free shipping on orders ₹499+.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">5. Returns & refunds</h2>
            <p>Due to the perishable nature of our products, returns are accepted only for damaged or defective items reported within 48 hours of delivery with photo evidence. Refunds are processed to the original payment method within 7-10 business days.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">6. Subscriptions</h2>
            <p>Subscribe & Save plans renew automatically at the chosen frequency. You can pause, skip, or cancel anytime from your dashboard before the next ship date.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">7. Limitation of liability</h2>
            <p>VendiMan's liability is limited to the value of the order in question. We are not liable for indirect or consequential damages.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">8. Governing law</h2>
            <p>These terms are governed by the laws of India. Disputes are subject to the jurisdiction of courts in Mumbai, Maharashtra.</p>
          </section>
        </div>

        <Link to="/" className="mt-12 inline-block text-sm text-muted-foreground hover:text-primary">← Back to home</Link>
      </main>
      <Footer />
    </div>
  );
}
