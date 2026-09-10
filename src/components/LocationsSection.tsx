import Image from "next/image";
import Link from "next/link";

interface LocationCard {
  name: string;
  image: string;
  eyebrow: string;
  description: string;
  alt: string;
}

const locations: LocationCard[] = [
  {
    name: "Mehria Town",
    image: "/images/locations/mehria-town.jpg",
    eyebrow: "Properties & investment opportunities in Mehria Town",
    description:
      "Nadeem Real Estate helps clients find, evaluate, and secure property in Mehria Town, guiding buyers, sellers, and investors through every step of the process.",
    alt: "Entrance gate of Mehria Town, Attock",
  },
  {
    name: "Mehria Enclave",
    image: "/images/locations/mehria-enclave.jpg",
    eyebrow: "Serving clients in Mehria Enclave",
    description:
      "From first inquiry to closing, Nadeem Real Estate provides hands-on guidance for buying, selling, and investing in Mehria Enclave.",
    alt: "Entrance monument and commercial plaza at Mehria Enclave, Attock",
  },
  {
    name: "Mehria Paradise",
    image: "/images/locations/mehria-paradise.jpg",
    eyebrow: "Property opportunities in Mehria Paradise",
    description:
      "Nadeem Real Estate supports clients across Mehria Paradise with clear, experienced advice on property buying, selling, and long-term investment.",
    alt: "Entrance gate and boulevard at Mehria Paradise, Attock",
  },
];

export function LocationsSection() {
  return (
    <section
      id="locations"
      className="scroll-mt-24 bg-bg-alt px-6 py-24"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-14 max-w-[640px] text-center">
          <p className="mb-3 inline-block text-[0.8rem] font-bold tracking-[0.14em] text-accent-text uppercase">
            Where We Work
          </p>
          <h2 className="text-[clamp(1.7rem,2.5vw+1rem,2.4rem)] text-balance">
            Our Projects &amp; Areas We Serve
          </h2>
          <p className="mt-3 text-[1.05rem] text-text-muted">
            Nadeem Real Estate helps clients discover, buy, sell, and invest
            in properties across Attock&apos;s leading residential
            communities.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => (
            <article
              key={location.name}
              className="group flex flex-col overflow-hidden rounded-md border border-border bg-surface shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={location.image}
                  alt={location.alt}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="mb-1.5 text-lg">{location.name}</h3>
                <p className="mb-3 text-[0.8rem] font-semibold tracking-[0.02em] text-accent-text">
                  {location.eyebrow}
                </p>
                <p className="flex-1 text-[0.92rem] text-text-muted">
                  {location.description}
                </p>
                <Link
                  href="/properties"
                  className="mt-4 inline-flex w-full items-center justify-center rounded-sm border-[1.5px] border-accent bg-accent px-6 py-3 text-sm font-semibold text-primary-dark transition-all hover:-translate-y-0.5 hover:border-accent-dark hover:bg-accent-dark hover:text-white hover:shadow-sm"
                >
                  Explore Properties
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
