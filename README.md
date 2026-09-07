# Nadeem Real Estate Consultant

A Next.js (App Router) + TypeScript + Tailwind CSS web app for Nadeem Real
Estate Consultant to list, browse, and manage property listings, and connect
prospective clients with the consultancy.

This replaces a previous static HTML/CSS/JS scaffold (see git history) with
a real framework, following the recommendations in
[`docs/platform-blueprint.md`](./docs/platform-blueprint.md).

## Structure

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture overview and
project conventions. In short:

- `src/app/` — pages and API routes (App Router)
- `src/components/` — UI components
- `src/lib/` — data access and business logic (listings, mortgage math,
  contact form validation, WhatsApp links)
- `docs/` — the platform recommendation report this migration follows

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the keys you have; leave the rest blank
npm run dev
```

Open <http://localhost:3000>.

## What's real vs. placeholder right now

- Listings are a typed sample dataset in `src/lib/listings.ts` — no
  database is connected yet.
- Property photos are brand-toned gradient placeholders — no real
  photography or image host is connected yet.
- The map on each listing page is a static placeholder — connect
  `NEXT_PUBLIC_MAPBOX_TOKEN` to enable a real Mapbox map.
- The contact form validates and logs inquiries server-side, but doesn't
  send email or persist to a database yet.
- The chat widget is still the original mock; it isn't wired to the
  Anthropic API yet.
- Customer inquiries and property viewing requests are stored locally in
  `data/inquiries.json` for development/testing only. This must be replaced
  with a proper production database before production deployment.

`.env.example` lists every integration key referenced in the codebase, with
notes on which tier (Must Have / Highly Recommended / Optional) each one is
from the blueprint.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (also generates `sitemap.xml` / `robots.txt`) |
| `npm start` | Run the production build |
| `npm run lint` | ESLint (includes accessibility rules via `eslint-config-next`) |
| `npm test` | Run the Vitest unit tests |

## Deployment

This project deploys cleanly to Vercel (`vercel deploy` or via the Vercel
dashboard/GitHub integration) — no special configuration needed beyond the
environment variables in `.env.example`.
