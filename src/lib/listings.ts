/**
 * Sample listing data.
 *
 * This is a typed stand-in for the real backend described in the project's
 * CLAUDE.md (a `backend/` API backed by `data/`). Swap `getAllListings` /
 * `getListingBySlug` for real Supabase (or other DB) queries once that
 * exists — every consumer in this app only imports from this file, so the
 * data source can change without touching components or pages.
 */

export type PropertyType =
  | "Apartment"
  | "Family Home"
  | "Luxury Villa"
  | "Townhouse"
  | "Condo"
  | "Commercial Land";

export interface Listing {
  id: string;
  slug: string;
  type: PropertyType;
  price: number;
  currency: "USD" | "PKR";
  name: string;
  location: string;
  description: string;
  longDescription: string;
  bedrooms: number | null;
  bathrooms: number | null;
  /** Omit when the verified size is only known in a non-sqft unit — see landSize. */
  areaSqft?: number;
  /** Verbatim size label (e.g. "7.5 Marla") for listings not measured in sqft. */
  landSize?: string;
  /** Short factual tags not covered by bedrooms/bathrooms/area, e.g. "2 TV Lounges". */
  features?: string[];
  /** Real photo path, once available; falls back to imageGradient when absent. */
  image?: string;
  /** Tailwind gradient classes used until real photography is available. */
  imageGradient: string;
  featured: boolean;
}

export const listings: Listing[] = [
  {
    id: "1",
    slug: "skyline-heights-apartment",
    type: "Apartment",
    price: 450000,
    currency: "USD",
    name: "Skyline Heights Apartment",
    location: "Downtown District",
    description:
      "Modern 2-bedroom apartment with panoramic skyline views, an open-plan living area, and access to a rooftop lounge.",
    longDescription:
      "Skyline Heights sits at the center of the Downtown District, offering a modern 2-bedroom layout with floor-to-ceiling windows and panoramic skyline views. The open-plan living area flows onto a private balcony, and residents share access to a rooftop lounge, gym, and concierge desk. A strong fit for professionals who want walkable access to the business district without giving up space or light.",
    bedrooms: 2,
    bathrooms: 2,
    areaSqft: 1150,
    imageGradient: "from-[#274462] to-[#12233b]",
    featured: true,
  },
  {
    id: "2",
    slug: "oakwood-residence",
    type: "Family Home",
    price: 780000,
    currency: "USD",
    name: "The Oakwood Residence",
    location: "Greenfield Suburbs",
    description:
      "Spacious 4-bedroom family home with a private garden, double garage, and a quiet street close to top-rated schools.",
    longDescription:
      "The Oakwood Residence is a spacious 4-bedroom family home on a quiet, tree-lined street in the Greenfield Suburbs. The layout centers on a large kitchen and family room opening onto a private garden, with a double garage and dedicated home-office nook. Zoned for several top-rated schools, it suits families looking to settle long-term.",
    bedrooms: 4,
    bathrooms: 3,
    areaSqft: 2600,
    imageGradient: "from-[#3a5a40] to-[#1f3320]",
    featured: true,
  },
  {
    id: "3",
    slug: "marina-bay-villa",
    type: "Luxury Villa",
    price: 1250000,
    currency: "USD",
    name: "Marina Bay Villa",
    location: "Marina District",
    description:
      "Waterfront luxury villa featuring a private dock, infinity pool, and uninterrupted views across the bay.",
    longDescription:
      "Marina Bay Villa is a waterfront estate in the Marina District, built around uninterrupted bay views. The property includes a private dock, an infinity pool cantilevered toward the water, and a primary suite with its own terrace. Finishes throughout are custom, and the villa is offered with an option to include existing furnishings.",
    bedrooms: 5,
    bathrooms: 5,
    areaSqft: 5200,
    imageGradient: "from-[#1c3559] to-[#0b1826]",
    featured: true,
  },
  {
    id: "4",
    slug: "cedar-park-townhouse",
    type: "Townhouse",
    price: 520000,
    currency: "USD",
    name: "Cedar Park Townhouse",
    location: "Cedar Park",
    description:
      "Contemporary 3-bedroom townhouse with a low-maintenance courtyard, minutes from schools and transit.",
    longDescription:
      "This contemporary 3-bedroom townhouse in Cedar Park pairs a low-maintenance courtyard with an efficient, light-filled layout across two levels. It's a short walk from the neighborhood's schools and transit line, making it a practical choice for buyers who want space without a large garden to maintain.",
    bedrooms: 3,
    bathrooms: 2,
    areaSqft: 1650,
    imageGradient: "from-[#6b4f2a] to-[#2e2011]",
    featured: false,
  },
  {
    id: "5",
    slug: "sunset-ridge-condo",
    type: "Condo",
    price: 340000,
    currency: "USD",
    name: "Sunset Ridge Condo",
    location: "Sunset Ridge",
    description:
      "Cozy 1-bedroom condo with modern finishes — an ideal entry point for first-time buyers or investors.",
    longDescription:
      "Sunset Ridge Condo is a cozy 1-bedroom unit with modern finishes throughout, priced as an accessible entry point for first-time buyers or investors. The building includes secure parking and an on-site laundry facility, and the unit has seen consistent rental demand for investors weighing a buy-to-let strategy.",
    bedrooms: 1,
    bathrooms: 1,
    areaSqft: 680,
    imageGradient: "from-[#52606d] to-[#1a1f27]",
    featured: false,
  },
  {
    id: "6",
    slug: "green-valley-commercial-plot",
    type: "Commercial Land",
    price: 2100000,
    currency: "USD",
    name: "Green Valley Commercial Plot",
    location: "Green Valley",
    description:
      "Prime commercial plot in a high-growth corridor, well-suited for retail or mixed-use development.",
    longDescription:
      "This commercial plot sits in the Green Valley growth corridor, an area zoned for retail and mixed-use development with strong projected foot traffic as surrounding residential projects complete. The site is fully serviced and road-fronted, ready for a developer to move directly into planning.",
    bedrooms: null,
    bathrooms: null,
    areaSqft: 43560,
    imageGradient: "from-[#96741f] to-[#4a3a12]",
    featured: false,
  },
  {
    id: "7",
    slug: "7-5-marla-family-house-abdullah-block",
    type: "Family Home",
    price: 285000,
    currency: "PKR",
    name: "7.5 Marla Family House for Sale",
    location: "Abdullah Block, Mehria Town, Attock",
    description:
      "4-bedroom, 5-bathroom family house on a 7.5 Marla plot in Abdullah Block, Mehria Town, with 2 TV lounges and a 1-car porch.",
    longDescription:
      "This 7.5 Marla family house in Abdullah Block, Mehria Town, Attock offers 4 bedrooms and 5 bathrooms across the property, with 2 separate TV lounges and a 1-car porch.",
    bedrooms: 4,
    bathrooms: 5,
    landSize: "7.5 Marla",
    features: ["2 TV Lounges", "1 Car Porch"],
    image: "/images/properties/family-house/7-5-marla-house-abdullah-block.jpg",
    imageGradient: "from-[#3a2a12] to-[#12233b]",
    featured: false,
  },
];

export function getAllListings(): Listing[] {
  return listings;
}

export function getFeaturedListings(): Listing[] {
  return listings.filter((l) => l.featured);
}

export function getListingBySlug(slug: string): Listing | undefined {
  return listings.find((l) => l.slug === slug);
}

export const propertyTypes: PropertyType[] = [
  "Apartment",
  "Family Home",
  "Luxury Villa",
  "Townhouse",
  "Condo",
  "Commercial Land",
];
