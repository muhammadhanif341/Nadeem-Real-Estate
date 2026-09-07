import Link from "next/link";
import { PropertyCard } from "@/components/PropertyCard";
import { getFeaturedListings } from "@/lib/listings";

export function FeaturedProperties() {
  const featured = getFeaturedListings();

  return (
    <section id="properties" className="scroll-mt-24 bg-surface px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-14 max-w-[640px] text-center">
          <p className="mb-3 inline-block text-[0.8rem] font-bold tracking-[0.14em] text-accent-text uppercase">
            Featured Listings
          </p>
          <h2 className="text-[clamp(1.7rem,2.5vw+1rem,2.4rem)] text-balance">
            Explore Available Properties
          </h2>
          <p className="mt-3 text-[1.05rem] text-text-muted">
            A curated selection of homes, condos, and investment properties
            currently available.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((listing) => (
            <PropertyCard key={listing.id} listing={listing} />
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/properties"
            className="inline-flex items-center justify-center rounded-sm border-[1.5px] border-accent bg-accent px-8 py-4 text-base font-semibold text-primary-dark transition-all hover:-translate-y-0.5 hover:border-accent-dark hover:bg-accent-dark hover:text-white hover:shadow-md"
          >
            View All Properties &amp; Filters
          </Link>
        </div>
      </div>
    </section>
  );
}
