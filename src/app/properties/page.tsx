import type { Metadata } from "next";
import { PropertiesBrowser } from "@/components/PropertiesBrowser";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: `Browse Properties | ${siteConfig.fullName}`,
  description:
    "Search and filter available properties by price, location, bedrooms, bathrooms, and property type.",
};

export default function PropertiesPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-10 max-w-[640px]">
        <p className="mb-3 inline-block text-[0.8rem] font-bold tracking-[0.14em] text-accent-text uppercase">
          All Listings
        </p>
        <h1 className="text-[clamp(1.7rem,2.5vw+1rem,2.4rem)] text-balance">
          Browse Available Properties
        </h1>
        <p className="mt-3 text-[1.05rem] text-text-muted">
          Filter by price, property type, and bedrooms to find a match —
          instant search (Algolia/Meilisearch) is the recommended upgrade
          once the catalog grows past a page or two.
        </p>
      </div>

      <PropertiesBrowser />
    </main>
  );
}
