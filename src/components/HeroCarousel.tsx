import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Flame } from "lucide-react";
import { Link } from "@tanstack/react-router";
import hero1 from "@/assets/hero-1.jpg";
import hero2 from "@/assets/hero-2.jpg";
import hero3 from "@/assets/hero-3.jpg";

const SLIDES = [
  {
    image: hero1,
    eyebrow: "New Drop",
    title: "Smoked Low.\nServed Loud.",
    sub: "Hand-cut beef. Twelve hours over hickory. Zero shortcuts.",
    cta: "Shop Originals",
  },
  {
    image: hero2,
    eyebrow: "Heat Series",
    title: "Born From\nThe Fire.",
    sub: "Ghost pepper, reaper, and habanero — for the bold of palate.",
    cta: "Bring The Heat",
  },
  {
    image: hero3,
    eyebrow: "Build Your Own",
    title: "Six Flavors.\nOne Legendary Box.",
    sub: "Curate your perfect lineup and save 20% on every bundle.",
    cta: "Build Your Box",
  },
];

export function HeroCarousel() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 6000, stopOnInteraction: false }),
  ]);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  return (
    <section className="relative h-[88vh] min-h-[600px] w-full overflow-hidden bg-charcoal">
      <div className="h-full" ref={emblaRef}>
        <div className="flex h-full">
          {SLIDES.map((slide, i) => (
            <div key={i} className="relative h-full min-w-0 flex-[0_0_100%]">
              <motion.img
                key={`${i}-${selected === i}`}
                src={slide.image}
                alt={slide.title}
                className="absolute inset-0 h-full w-full object-cover"
                initial={{ scale: 1.08, opacity: 0 }}
                animate={selected === i ? { scale: 1, opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-charcoal via-charcoal/70 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal/90 via-transparent to-transparent" />
            </div>
          ))}
        </div>
      </div>

      {/* Overlay copy */}
      <div className="pointer-events-none absolute inset-0 flex items-center">
        <div className="mx-auto w-full max-w-7xl px-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={selected}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto max-w-2xl"
            >
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary backdrop-blur">
                <Flame className="h-3 w-3" /> {SLIDES[selected].eyebrow}
              </div>
              <h1 className="whitespace-pre-line font-display text-6xl leading-[0.95] tracking-tight text-white sm:text-7xl md:text-8xl">
                {SLIDES[selected].title}
              </h1>
              <p className="mt-6 max-w-md text-lg text-white/75">{SLIDES[selected].sub}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/shop"
                  search={{ query: "" }}
                  className="btn-glow group inline-flex items-center gap-2 rounded-full bg-gradient-ember px-7 py-4 text-sm font-bold uppercase tracking-wider text-primary-foreground"
                >
                  {SLIDES[selected].cta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  to="/shop"
                  search={{ query: "" }}
                  className="btn-glow inline-flex items-center rounded-full border border-white/30 bg-white/5 px-7 py-4 text-sm font-bold uppercase tracking-wider text-white backdrop-blur hover:bg-white/10"
                >
                  Explore the Range
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Slide indicators */}
      <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => emblaApi?.scrollTo(i)}
            aria-label={`Slide ${i + 1}`}
            className={`h-1 rounded-full transition-all duration-500 ${
              selected === i ? "w-12 bg-primary" : "w-6 bg-white/30 hover:bg-white/60"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
