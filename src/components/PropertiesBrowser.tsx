"use client";

import { useMemo, useState } from "react";
import { PropertyCard } from "@/components/PropertyCard";
import { getAllListings, propertyTypes, type PropertyType } from "@/lib/listings";

const ALL_TYPES = "All types";

export function PropertiesBrowser() {
  const listings = useMemo(() => getAllListings(), []);

  const [query, setQuery] = useState("");
  const [type, setType] = useState<PropertyType | typeof ALL_TYPES>(
    ALL_TYPES,
  );
  const [maxPrice, setMaxPrice] = useState(2_500_000);
  const [minBedrooms, setMinBedrooms] = useState(0);

  const filtered = listings.filter((listing) => {
    const matchesQuery =
      query.trim().length === 0 ||
      `${listing.name} ${listing.location}`
        .toLowerCase()
        .includes(query.trim().toLowerCase());
    const matchesType = type === ALL_TYPES || listing.type === type;
    const matchesPrice = listing.price <= maxPrice;
    const matchesBedrooms =
      minBedrooms === 0 ||
      (listing.bedrooms !== null && listing.bedrooms >= minBedrooms);

    return matchesQuery && matchesType && matchesPrice && matchesBedrooms;
  });

  return (
    <div>
      <div className="mb-10 grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm sm:col-span-2 lg:col-span-1">
          <span className="mb-1.5 block font-semibold">
            Search location or name
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Marina, Villa…"
            className="w-full rounded-sm border border-border bg-bg px-3 py-2.5"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold">Property type</span>
          <select
            value={type}
            onChange={(e) =>
              setType(e.target.value as PropertyType | typeof ALL_TYPES)
            }
            className="w-full rounded-sm border border-border bg-bg px-3 py-2.5"
          >
            <option>{ALL_TYPES}</option>
            {propertyTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold tabular-nums">
            Max price: ${maxPrice.toLocaleString()}
          </span>
          <input
            type="range"
            min={200_000}
            max={2_500_000}
            step={50_000}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="w-full accent-[var(--color-accent)]"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold">
            Min bedrooms
          </span>
          <select
            value={minBedrooms}
            onChange={(e) => setMinBedrooms(Number(e.target.value))}
            className="w-full rounded-sm border border-border bg-bg px-3 py-2.5"
          >
            <option value={0}>Any</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}+
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mb-6 text-sm text-text-muted">
        {filtered.length} {filtered.length === 1 ? "property" : "properties"}{" "}
        found
      </p>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((listing) => (
            <PropertyCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-text-muted">
          No properties match those filters yet — try widening your search.
        </p>
      )}
    </div>
  );
}
