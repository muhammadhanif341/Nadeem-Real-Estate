# Platform blueprint

Full interactive version with per-tool setup notes and current pricing:
https://claude.ai/code/artifact/2cb5fb86-7bad-4cbf-bed4-e3a5a6c2f5c1

This document is the condensed reference this repo's migration follows.
Update it (and the artifact above) if a decision below changes.

## Where this came from

A review of the pre-migration static site (`index.html` / `styles.css` /
`app.js`, no framework, no backend) against what a production real estate
platform needs: search/filters, property detail pages, favorites/comparison,
agent accounts, maps, a mortgage calculator, structured data — none of
which a plain static site can support without a real application layer.

## Recommended stack (implemented in this migration)

```
Framework   Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
Data        Supabase (Postgres + Auth + Storage)        — not yet connected
Search      Algolia or Meilisearch                      — not yet connected
Maps        Mapbox GL JS                                — not yet connected
Media       Cloudinary, or Supabase Storage + next/image — not yet connected
Email       Resend                                       — not yet connected
Monitoring  Sentry                                       — not yet connected
Hosting     Vercel
```

Everything not yet connected has a placeholder in the code (see "Known
placeholders" in `CLAUDE.md`) and a commented-out env var in `.env.example`
— wiring one up means filling in that key and swapping the placeholder
component/function, not restructuring the app.

## Priority matrix

**Must have** (implemented in this migration): Next.js + TypeScript +
Tailwind, shadcn/ui-ready component structure, Embla Carousel gallery,
`next/image`, typed listings data layer, React Hook Form + Zod contact form,
WhatsApp `wa.me` deep links, mortgage calculator, per-page metadata, JSON-LD
structured data, `next-sitemap`, ESLint, Vercel-ready build.

**Must have** (not yet connected — needs real accounts/keys): Mapbox GL JS,
Supabase.

**Highly recommended**: Framer Motion, Algolia/Meilisearch, Resend,
Cloudinary, Sanity (or a Supabase-backed admin UI), Vercel Analytics,
Lighthouse CI, Vitest/Playwright (Vitest is in; Playwright isn't yet),
Sentry, Cloudflare Turnstile.

**Optional**: Lucide icons (already in use), Figma/v0 connectors for design
iteration, Clerk (once there's more than one agent), Twilio WhatsApp
Business API (automation), Semrush.

**Avoid / not needed**: MLS/IDX integration (no formal MLS in most Pakistani
markets), WordPress real-estate themes, a paid "mortgage calculator" SaaS,
jQuery-era carousels/parallax libraries, running two vendors for one
capability (e.g. Cloudinary + a second CDN, or Clerk + Supabase Auth).

## Next steps, roughly in order

1. Create a Supabase project; move `src/lib/listings.ts` from the hardcoded
   array to real queries.
2. Get real property photography; replace `imageGradient` placeholders with
   `next/image` (via Cloudinary or Supabase Storage).
3. Get a Mapbox token; replace `MapPlaceholder` with a real map.
4. Get a Resend API key; send real email from `/api/contact`.
5. Add Sentry once the site has real traffic to monitor.
6. Add Algolia/Meilisearch once the listing catalog outgrows client-side
   filtering in `PropertiesBrowser`.
