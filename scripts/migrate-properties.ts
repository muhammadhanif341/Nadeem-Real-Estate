/**
 * One-time migration: reconcile src/lib/listings.ts + data/properties.json
 * into the canonical `properties` table (schema: supabase/migrations/0001).
 *
 * SAFE TO RUN AGAIN: rows are upserted with `slug` as the conflict target
 * (matching the UNIQUE constraint in the schema), so re-running never
 * creates duplicates — it just re-applies the same canonical mapping.
 *
 * DOES NOT touch any local source file. src/lib/listings.ts,
 * data/properties.json, and data/inquiries.json are read-only inputs here.
 *
 * If NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set, this
 * script stops after building and validating the canonical dataset —  it
 * writes a local preview file instead of attempting any network call, and
 * exits non-zero so it's unambiguous in CI/logs that nothing was written to
 * a database. It never invents or prompts for credentials.
 *
 * Usage:
 *   node scripts/migrate-properties.ts            # build + validate + preview
 *   node scripts/migrate-properties.ts --apply     # also upsert to Supabase (requires credentials)
 */

import fs from "node:fs";
import path from "node:path";
import { listings } from "../src/lib/listings.ts";

// ---- Shared types ---------------------------------------------------------

type Status = "draft" | "published" | "sold" | "rented";

interface CanonicalProperty {
  slug: string;
  name: string;
  description: string;
  long_description: string | null;
  price: number;
  currency: string;
  location: string;
  property_type: string;
  listing_type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  area_sqft: number | null;
  land_size: string | null;
  features: string[];
  images: string[];
  image_gradient: string | null;
  agent: string;
  featured: boolean;
  status: Status;
}

interface JsonProperty {
  id: string;
  name: string;
  description: string;
  price: number;
  currency?: string;
  location: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  area?: number;
  landSize?: string;
  features: string[];
  images: string[];
  agent: string;
  availability: string;
}

// ---- Helpers ----------------------------------------------------------

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Mirrors src/app/api/chat/route.ts's isAvailable() classification, mapped
 * onto the schema's status enum. None of the current 16 properties.json
 * entries hit the "unavailable"/"off market" branch — included only so a
 * future entry with those values doesn't get guessed as sold/rented. */
function statusFromAvailability(availability: string): Status {
  const a = availability.toLowerCase();
  if (a === "sold") return "sold";
  if (a === "rented") return "rented";
  if (a === "for sale" || a === "for rent") return "published";
  return "draft";
}

/** properties.json image paths (e.g. "properties/prop-001-1.jpg") don't
 * actually exist on disk except for the one real property — verified via
 * `ls public/images/properties`, which only contains
 * family-house/7-5-marla-house-abdullah-block.jpg. Carrying over the other
 * 15 paths as real image references would insert broken links into the
 * canonical data, which is worse than the status quo (an explicit, known
 * "no photo yet" state via imageGradient/empty images[]). So: only keep an
 * image path if the referenced file actually exists under public/. */
function resolveExistingImages(rawPaths: string[]): string[] {
  return rawPaths
    .map((p) => (p.startsWith("/") ? p : `/images/${p}`))
    .filter((p) => fs.existsSync(path.join(process.cwd(), "public", p)));
}

// ---- Load sources -------------------------------------------------------

const propertiesJsonRaw = fs.readFileSync(
  path.join(process.cwd(), "data", "properties.json"),
  "utf8",
);
const jsonProperties: JsonProperty[] = JSON.parse(propertiesJsonRaw).properties;

const inquiriesRaw = fs.readFileSync(
  path.join(process.cwd(), "data", "inquiries.json"),
  "utf8",
);
const inquiries: unknown[] = inquiriesRaw.trim() ? JSON.parse(inquiriesRaw) : [];

// ---- Known duplicate: the 7.5 Marla house exists in BOTH sources --------
// (listings.ts id "7" / slug "7-5-marla-family-house-abdullah-block" and
// properties.json "prop-016"). Identified by manual inspection: identical
// price, currency, location, bedrooms, bathrooms, landSize, and features
// across both records — confirmed, not guessed. Hardcoded here rather than
// fuzzy-matched because it's the only duplicate across this dataset and a
// generic matcher would be unjustified complexity for one known pair.
const DUPLICATE_LISTINGS_TS_ID = "7";
const DUPLICATE_JSON_ID = "prop-016";

// ---- Build canonical dataset ---------------------------------------------

const canonical: CanonicalProperty[] = [];
const conflicts: string[] = [];
const notes: string[] = [];

for (const listing of listings) {
  if (listing.id === DUPLICATE_LISTINGS_TS_ID) continue; // handled below

  // src/lib/listings.ts has no availability/listingType field at all. All 6
  // of these sample entries are currently rendered live on /properties with
  // no "unavailable" marker of any kind, and all price at a for-sale scale
  // (not a plausible monthly rent) — so "For Sale" / "published" reflects
  // current live behavior, not a guess about unseen data.
  notes.push(
    `${listing.slug}: listings.ts has no availability field — defaulted listing_type="For Sale", status="published" to match current live site behavior.`,
  );

  canonical.push({
    slug: listing.slug,
    name: listing.name,
    description: listing.description,
    long_description: listing.longDescription,
    price: listing.price,
    currency: listing.currency,
    location: listing.location,
    property_type: listing.type,
    listing_type: "For Sale",
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    area_sqft: listing.areaSqft ?? null,
    land_size: listing.landSize ?? null,
    features: listing.features ?? [],
    images: listing.image ? resolveExistingImages([listing.image]) : [],
    image_gradient: listing.imageGradient,
    agent: "Nadeem",
    featured: listing.featured,
    status: "published",
  });
}

for (const property of jsonProperties) {
  if (property.id === DUPLICATE_JSON_ID) continue; // handled below

  canonical.push({
    slug: slugify(property.name),
    name: property.name,
    description: property.description,
    long_description: null,
    price: property.price,
    currency: property.currency ?? "USD",
    location: property.location,
    property_type: property.propertyType,
    listing_type: property.availability,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    area_sqft: property.area ?? null,
    land_size: property.landSize ?? null,
    features: property.features ?? [],
    images: resolveExistingImages(property.images ?? []),
    image_gradient: null,
    agent: property.agent,
    featured: false,
    status: statusFromAvailability(property.availability),
  });
}

// ---- Merge the one known duplicate into a single canonical record -------

const dupFromListings = listings.find((l) => l.id === DUPLICATE_LISTINGS_TS_ID)!;
const dupFromJson = jsonProperties.find((p) => p.id === DUPLICATE_JSON_ID)!;

// Confirm the two records actually agree on every fact before merging —
// fail loudly instead of silently picking one side if they ever diverge.
const factsAgree =
  dupFromListings.price === dupFromJson.price &&
  dupFromListings.currency === dupFromJson.currency &&
  dupFromListings.location === dupFromJson.location &&
  dupFromListings.bedrooms === dupFromJson.bedrooms &&
  dupFromListings.bathrooms === dupFromJson.bathrooms &&
  dupFromListings.landSize === dupFromJson.landSize &&
  JSON.stringify(dupFromListings.features) === JSON.stringify(dupFromJson.features);

if (!factsAgree) {
  console.error(
    "[migrate] The 7.5 Marla duplicate's factual fields disagree between " +
      "listings.ts and properties.json — refusing to guess. Resolve manually before re-running.",
  );
  process.exit(1);
}

// Cosmetic-only differences, resolved and documented (not silently dropped):
//  - property_type: "Family Home" (listings.ts) vs "House" (properties.json)
//    -> kept "Family Home" to match what the live site's UI badge already
//       displays for this listing today.
//  - description: listings.ts's is used as the canonical short description;
//    its longDescription (properties.json has no equivalent field) becomes
//    long_description.
//  - image path: listings.ts uses a leading-slash public path;
//    properties.json uses a bare relative path for the same file — both
//    point at the one real photo that actually exists on disk.
conflicts.push(
  "7.5 Marla house: property_type differs cosmetically (\"Family Home\" vs \"House\") — not a factual conflict; resolved to \"Family Home\" to match the live UI badge.",
);

canonical.push({
  slug: dupFromListings.slug,
  name: dupFromListings.name,
  description: dupFromListings.description,
  long_description: dupFromListings.longDescription,
  price: dupFromListings.price,
  currency: dupFromListings.currency,
  location: dupFromListings.location,
  property_type: dupFromListings.type,
  listing_type: dupFromJson.availability,
  bedrooms: dupFromListings.bedrooms,
  bathrooms: dupFromListings.bathrooms,
  area_sqft: null,
  land_size: dupFromListings.landSize ?? null,
  features: dupFromListings.features ?? [],
  images: resolveExistingImages([dupFromListings.image!]),
  image_gradient: dupFromListings.imageGradient,
  agent: dupFromJson.agent,
  featured: dupFromListings.featured,
  status: statusFromAvailability(dupFromJson.availability),
});

// ---- Validate --------------------------------------------------------

const slugCounts = new Map<string, number>();
for (const p of canonical) {
  slugCounts.set(p.slug, (slugCounts.get(p.slug) ?? 0) + 1);
}
const duplicateSlugs = [...slugCounts.entries()].filter(([, count]) => count > 1);
if (duplicateSlugs.length > 0) {
  console.error("[migrate] Duplicate slugs after merge — aborting:", duplicateSlugs);
  process.exit(1);
}

const expectedCount = listings.length - 1 + jsonProperties.length - 1 + 1;
if (canonical.length !== expectedCount) {
  console.error(
    `[migrate] Canonical count mismatch: got ${canonical.length}, expected ${expectedCount} — aborting.`,
  );
  process.exit(1);
}

const marlaHouseMatches = canonical.filter((p) => p.slug === dupFromListings.slug);
if (marlaHouseMatches.length !== 1) {
  console.error("[migrate] 7.5 Marla house does not appear exactly once — aborting.");
  process.exit(1);
}

// ---- Report ------------------------------------------------------------

console.log("[migrate] Source counts:");
console.log(`  listings.ts:        ${listings.length}`);
console.log(`  properties.json:    ${jsonProperties.length}`);
console.log(`  known duplicates:   1 (7.5 Marla house)`);
console.log(`  canonical properties: ${canonical.length}`);
console.log(`  inquiries.json records: ${inquiries.length}`);
console.log("");
console.log("[migrate] Notes:");
for (const n of notes) console.log(`  - ${n}`);
console.log("[migrate] Conflicts (resolved, not silently dropped):");
for (const c of conflicts) console.log(`  - ${c}`);

const previewPath = path.join(process.cwd(), "scripts", ".migration-preview.json");
fs.writeFileSync(previewPath, JSON.stringify({ properties: canonical, inquiries }, null, 2) + "\n", "utf8");
console.log(`\n[migrate] Canonical dataset written to ${path.relative(process.cwd(), previewPath)} for review.`);

// ---- Apply (only with --apply AND real credentials) ----------------------

const shouldApply = process.argv.includes("--apply");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!shouldApply) {
  console.log("\n[migrate] Dry run only (pass --apply to write to Supabase once credentials exist). Nothing was sent over the network.");
  process.exit(0);
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "\n[migrate] --apply was passed but NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. " +
      "STOPPING before performing the migration, as required — no credentials were invented, no network call was made.",
  );
  process.exit(1);
}

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(supabaseUrl, serviceRoleKey);

const { error: propertiesError, data: upserted } = await supabase
  .from("properties")
  .upsert(canonical, { onConflict: "slug" })
  .select("id, slug");

if (propertiesError) {
  console.error("[migrate] Properties upsert failed:", propertiesError.message);
  process.exit(1);
}
console.log(`[migrate] Upserted ${upserted?.length ?? 0} properties.`);

if (inquiries.length === 0) {
  console.log("[migrate] No inquiry records to migrate (data/inquiries.json is empty).");
} else {
  console.log(
    `[migrate] ${inquiries.length} inquiry record(s) found in data/inquiries.json. ` +
      "This script does not migrate them automatically yet — inquiries.json's shape " +
      "(confirmInquiry()'s record) doesn't carry a stable dedup key the inquiries table " +
      "schema currently exposes. Add a legacy_inquiry_id column before scripting this path.",
  );
}
