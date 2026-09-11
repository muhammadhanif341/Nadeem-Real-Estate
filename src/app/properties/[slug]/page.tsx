import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllListings, getListingBySlug } from "@/lib/listings";
import { formatPrice } from "@/lib/format";
import { siteConfig } from "@/lib/site";
import { PropertyGallery } from "@/components/PropertyGallery";
import { MortgageCalculator } from "@/components/MortgageCalculator";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { MapPlaceholder } from "@/components/MapPlaceholder";
import { JsonLd } from "@/components/JsonLd";

export function generateStaticParams() {
  return getAllListings().map((listing) => ({ slug: listing.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const listing = getListingBySlug(slug);
  if (!listing) return {};

  return {
    title: `${listing.name} | ${siteConfig.fullName}`,
    description: listing.description,
    openGraph: {
      title: listing.name,
      description: listing.description,
      type: "website",
    },
  };
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = getListingBySlug(slug);
  if (!listing) notFound();

  const listingUrl = `${siteConfig.url}/properties/${listing.slug}`;

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "RealEstateListing",
          name: listing.name,
          description: listing.longDescription,
          url: listingUrl,
          datePosted: new Date().toISOString().slice(0, 10),
          offers: {
            "@type": "Offer",
            price: listing.price,
            priceCurrency: listing.currency,
            availability: "https://schema.org/InStock",
          },
          address: {
            "@type": "PostalAddress",
            addressLocality: listing.location,
          },
          ...(listing.bedrooms !== null
            ? { numberOfRooms: listing.bedrooms }
            : {}),
          ...(listing.areaSqft !== undefined
            ? {
                floorSize: {
                  "@type": "QuantitativeValue",
                  value: listing.areaSqft,
                  unitCode: "FTK",
                },
              }
            : {}),
        }}
      />

      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
        <Link href="/properties" className="hover:text-primary">
          Properties
        </Link>
        <span className="mx-2">/</span>
        <span>{listing.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <PropertyGallery listing={listing} />

          <div className="mt-8">
            <span className="mb-3 inline-block rounded-full border border-border bg-bg-alt px-3 py-1.5 text-xs font-bold tracking-[0.06em] text-text-muted uppercase">
              {listing.type}
            </span>
            <h1 className="text-[clamp(1.6rem,2vw+1rem,2.2rem)] text-balance">
              {listing.name}
            </h1>
            <p className="mt-1 text-text-muted">{listing.location}</p>

            <div className="mt-4 font-heading text-3xl font-bold tabular-nums text-accent-dark">
              {formatPrice(listing.price, listing.currency)}
            </div>

            {listing.bedrooms !== null ? (
              <dl className="mt-6 flex flex-wrap gap-8 border-t border-b border-border py-5 text-sm tabular-nums">
                <div>
                  <dt className="text-text-muted uppercase">Bedrooms</dt>
                  <dd className="text-lg font-semibold">
                    {listing.bedrooms}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted uppercase">Bathrooms</dt>
                  <dd className="text-lg font-semibold">
                    {listing.bathrooms}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted uppercase">
                    {listing.landSize ? "Size" : "Area"}
                  </dt>
                  <dd className="text-lg font-semibold">
                    {listing.landSize ?? `${listing.areaSqft?.toLocaleString()} sqft`}
                  </dd>
                </div>
              </dl>
            ) : (
              <dl className="mt-6 flex flex-wrap gap-8 border-t border-b border-border py-5 text-sm tabular-nums">
                <div>
                  <dt className="text-text-muted uppercase">Lot size</dt>
                  <dd className="text-lg font-semibold">
                    {listing.landSize ?? `${listing.areaSqft?.toLocaleString()} sqft`}
                  </dd>
                </div>
              </dl>
            )}

            {listing.features && listing.features.length > 0 ? (
              <ul className="mt-5 flex flex-wrap gap-2">
                {listing.features.map((feature) => (
                  <li
                    key={feature}
                    className="rounded-full border border-border bg-bg-alt px-3 py-1.5 text-xs font-semibold text-text-muted"
                  >
                    {feature}
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="mt-6 text-text-muted">{listing.longDescription}</p>
          </div>

          <div className="mt-8">
            <h2 className="mb-3 text-lg">Location</h2>
            <MapPlaceholder location={listing.location} />
          </div>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            <h3 className="mb-1 text-lg">Interested in this property?</h3>
            <p className="mb-4 text-sm text-text-muted">
              Nadeem typically replies within the hour during office hours.
            </p>
            <div className="flex flex-col gap-3">
              <WhatsAppButton
                listingName={listing.name}
                listingUrl={listingUrl}
              />
              <a
                href="tel:+923339357378"
                className="flex w-full items-center justify-center rounded-sm border-[1.5px] border-border px-8 py-4 text-base font-semibold text-primary transition-all hover:border-primary hover:shadow-sm"
              >
                Call Now
              </a>
            </div>
          </div>

          <MortgageCalculator price={listing.price} currency={listing.currency} />
        </aside>
      </div>
    </main>
  );
}
