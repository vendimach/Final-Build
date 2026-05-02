import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — VendiMan" },
      { name: "description", content: "How VendiMan collects, uses, and protects your personal information." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-5xl tracking-wide">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-IN")}</p>

        <div className="prose prose-invert mt-10 max-w-none space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="font-display text-2xl text-foreground">1. Information we collect</h2>
            <p>We collect information you provide directly — name, email, phone number, shipping address — when you create an account or place an order. We also collect order history, product reviews, and payment confirmation tokens (we do not store card or UPI credentials).</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">2. How we use it</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>To process orders, payments, and shipping</li>
              <li>To send order updates, tracking information, and (with consent) marketing emails</li>
              <li>To improve our products and customer experience</li>
              <li>To prevent fraud and comply with legal obligations</li>
            </ul>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">3. Sharing</h2>
            <p>We share data only with payment processors (Razorpay), shipping partners, and service providers strictly necessary to fulfill your order. We never sell your data.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">4. Your rights</h2>
            <p>Under Indian law (DPDP Act, 2023), you may request access, correction, or deletion of your personal data at any time by emailing privacy@vendiman.com.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">5. Security</h2>
            <p>Data is stored on secure servers with encryption in transit and at rest. Payment processing is handled exclusively by PCI-DSS-compliant Razorpay.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">6. Contact</h2>
            <p>For privacy questions, email <a href="mailto:privacy@vendiman.com" className="text-primary">privacy@vendiman.com</a>.</p>
          </section>
        </div>

        <Link to="/" className="mt-12 inline-block text-sm text-muted-foreground hover:text-primary">← Back to home</Link>
      </main>
      <Footer />
    </div>
  );
}
