import Link from "next/link";
import { siteConfig } from "@/lib/site";

export function Hero() {
  const bars = [46, 78, 58, 96, 66, 88, 50, 72];

  return (
    <section
      id="home"
      className="scroll-mt-24 bg-gradient-to-b from-bg to-bg-alt px-6 py-16 sm:py-20"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="mb-3 inline-block text-[0.8rem] font-bold tracking-[0.14em] text-accent-text uppercase">
            Trusted Real Estate Guidance
          </p>
          <h1 className="text-[clamp(2.1rem,4vw+1rem,3.4rem)] text-balance">
            Find the Right Property, With Confidence and Clarity
          </h1>
          <p className="mt-5 max-w-[52ch] text-lg text-text-muted">
            {siteConfig.fullName} helps buyers, sellers, and investors make
            confident property decisions — backed by honest advice, deep
            market knowledge, and a fully personalized approach from search to
            signing.
          </p>

          <div className="mt-8 mb-12 flex flex-wrap gap-4">
            <Link
              href="/properties"
              className="inline-flex items-center justify-center rounded-sm border-[1.5px] border-accent bg-accent px-8 py-4 text-base font-semibold text-primary-dark transition-all hover:-translate-y-0.5 hover:border-accent-dark hover:bg-accent-dark hover:text-white hover:shadow-md"
            >
              Explore Properties
            </Link>
            <Link
              href="/#contact"
              className="inline-flex items-center justify-center rounded-sm border-[1.5px] border-border bg-transparent px-8 py-4 text-base font-semibold text-primary transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-sm"
            >
              Book a Consultation
            </Link>
          </div>

          <dl className="flex flex-wrap gap-10 border-t border-border pt-7">
            {siteConfig.stats.map((stat) => (
              <div key={stat.label}>
                <dt className="font-heading text-2xl font-bold text-primary">
                  {stat.value}
                </dt>
                <dd className="mt-1 text-[0.85rem] text-text-muted">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div aria-hidden="true" className="order-first lg:order-last">
          <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-gradient-to-br from-primary via-primary-light to-accent-dark shadow-lg lg:aspect-[4/3.2]">
            <div className="absolute top-8 right-11 h-14 w-14 rounded-full bg-[radial-gradient(circle,var(--color-accent-light),var(--color-accent)_70%)] opacity-90" />
            <div className="absolute right-7 bottom-7 left-7 flex h-[58%] items-end gap-2.5">
              {bars.map((height, i) => (
                <span
                  key={i}
                  className="block flex-1 rounded-t-sm border-t-2 border-accent-light/55 bg-text-inverse/15"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
