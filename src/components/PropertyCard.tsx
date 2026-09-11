import Image from "next/image";
import Link from "next/link";
import type { Listing } from "@/lib/listings";
import { formatPrice } from "@/lib/format";

export function PropertyCard({ listing }: { listing: Listing }) {
  const sizeLabel = listing.landSize ?? listing.areaSqft?.toLocaleString();

  return (
    <article className="flex flex-col overflow-hidden rounded-md border border-border bg-surface shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
      <Link
        href={`/properties/${listing.slug}`}
        className={`relative flex aspect-[16/10] items-start justify-start bg-gradient-to-br p-4 ${listing.imageGradient}`}
      >
        {listing.image ? (
          <Image
            src={listing.image}
            alt={listing.name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : null}
        <span className="relative inline-block rounded-full border border-text-inverse/35 bg-text-inverse/15 px-3 py-1.5 text-[0.72rem] font-bold tracking-[0.06em] text-text-inverse uppercase">
          {listing.type}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-1 font-heading text-xl font-bold text-accent-dark tabular-nums">
          {formatPrice(listing.price, listing.currency)}
        </div>
        <h3 className="mb-0.5 text-lg">
          <Link href={`/properties/${listing.slug}`}>{listing.name}</Link>
        </h3>
        <p className="mb-3 text-sm text-text-muted">{listing.location}</p>
        <p className="flex-1 text-[0.92rem] text-text-muted">
          {listing.description}
        </p>
        {listing.bedrooms !== null ? (
          <p className="mt-3 text-xs text-text-muted tabular-nums">
            {listing.bedrooms} bd &middot; {listing.bathrooms} ba &middot;{" "}
            {sizeLabel}
            {listing.landSize ? "" : " sqft"}
          </p>
        ) : (
          <p className="mt-3 text-xs text-text-muted tabular-nums">
            {sizeLabel}
            {listing.landSize ? "" : " sqft"} lot
          </p>
        )}
        <Link
          href={`/properties/${listing.slug}`}
          className="mt-4 inline-flex w-full items-center justify-center rounded-sm border-[1.5px] border-border px-6 py-3 text-sm font-semibold text-primary transition-all hover:border-primary hover:shadow-sm"
        >
          View Details
        </Link>
      </div>
    </article>
  );
}
