"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Listing } from "@/lib/listings";

/**
 * Photo gallery for a listing detail page. Most listings have no real
 * photos yet (see Listing.imageGradient), so their slides render the same
 * brand-toned gradient placeholder. A listing with a real Listing.image
 * gets a single real photo slide instead.
 */
export function PropertyGallery({ listing }: { listing: Listing }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selected, setSelected] = useState(0);

  const slides = listing.image ? [1] : [1, 2, 3, 4];

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

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
    <div className="relative overflow-hidden rounded-lg shadow-md">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {slides.map((n) => (
            <div
              key={n}
              className={`relative aspect-[16/10] min-w-0 flex-[0_0_100%] ${
                listing.image ? "" : `bg-gradient-to-br ${listing.imageGradient}`
              }`}
            >
              {listing.image ? (
                <Image
                  src={listing.image}
                  alt={listing.name}
                  fill
                  sizes="(min-width: 1024px) 56vw, 100vw"
                  className="object-cover"
                  priority
                />
              ) : (
                <span className="absolute right-4 bottom-4 rounded-full bg-text-inverse/15 px-3 py-1 text-xs text-text-inverse">
                  {listing.name} &middot; {n} of {slides.length}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {slides.length > 1 ? (
        <>
          <button
            type="button"
            onClick={scrollPrev}
            aria-label="Previous photo"
            className="absolute top-1/2 left-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 shadow-md"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={scrollNext}
            aria-label="Next photo"
            className="absolute top-1/2 right-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 shadow-md"
          >
            <ChevronRight size={20} />
          </button>

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {slides.map((n, i) => (
              <span
                key={n}
                className={`h-1.5 w-1.5 rounded-full ${
                  i === selected ? "bg-accent" : "bg-text-inverse/50"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
