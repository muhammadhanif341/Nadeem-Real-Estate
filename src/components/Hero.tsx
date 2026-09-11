import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/lib/site";

export function Hero() {
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

        <div className="order-first lg:order-last">
          <div className="relative aspect-[16/9] overflow-hidden rounded-lg shadow-lg lg:aspect-[4/3.2]">
            <Image
              src="/images/team/hero.jpg"
              alt="Exterior of a Nadeem Real Estate property in Attock"
              fill
              sizes="(min-width: 1024px) 45vw, (min-width: 640px) 90vw, 100vw"
              className="object-cover"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
