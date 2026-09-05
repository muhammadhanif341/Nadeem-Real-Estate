# Nadeem Real Estate Consultant

## Purpose

A web application for Nadeem Real Estate Consultant to list, browse, and manage
property listings (buy/sell/rent) and connect prospective clients with the
consultancy.

## Architecture Overview

Migrated from a static HTML/CSS/JS scaffold to Next.js (App Router) +
TypeScript + Tailwind CSS, per the recommendations in
`docs/platform-blueprint.md`. The frontend/backend split described in the
previous version of this file is now expressed within one Next.js app
instead of as separate top-level folders — Next.js's own conventions
(`app/`, API routes, server components) already enforce that separation, so
introducing parallel `frontend/`/`backend/` folders on top of it would just
be duplicate structure. If a real reason to split them out again ever
justifies it — a heavier standalone backend the current API routes can't
express, a Node service, a Python worker — that structure is what
`backend/` on its own should hold, not a re-implementation of what
Next.js's `src/app/api` already provides.

- `src/app/` — routes (App Router). `page.tsx` files are pages,
  `app/api/*/route.ts` files are the backend API. `layout.tsx` is the shared
  shell (header, footer, chat widget, site-wide JSON-LD).
- `src/components/` — reusable UI. Renders listings and forms; talks to the
  backend only through `fetch()` calls to `app/api/*` routes, never by
  importing server-only modules directly.
- `src/lib/` — business logic and data access, framework-agnostic where
  possible: `listings.ts` (data layer — swap for a real DB query here, see
  below), `mortgage.ts` (pure calculator math, unit tested), `contact-schema.ts`
  (shared client/server validation), `whatsapp.ts`, `site.ts`, `format.ts`.
- `docs/platform-blueprint.md` — the full tool/plugin/integration
  recommendation report this migration was based on.

**Data layer status:** `src/lib/listings.ts` currently returns a typed,
hardcoded sample array — there is no database yet. It exists so every
consumer (`PropertyCard`, `PropertiesBrowser`, the detail page) already
imports from one place; swapping in Supabase (or any other DB) means
changing `getAllListings` / `getListingBySlug` in that one file, not any
component. Do not scatter new hardcoded listing data elsewhere.

**Known placeholders — do not treat as bugs, treat as the next task:**
- No real property photography yet — `Listing.imageGradient` renders a
  brand-toned gradient in place of a photo. `PropertyGallery` and
  `PropertyCard` are already wired for real `<Image>` elements once photos
  exist.
- `MapPlaceholder` is a static stand-in for Mapbox GL JS — swap it once
  `NEXT_PUBLIC_MAPBOX_TOKEN` is set (see `.env.example`).
- `/api/contact` validates and logs an inquiry but doesn't send email or
  persist it yet — wire up Resend and/or Supabase there once those API keys
  exist.
- `ChatWidget` is still the original mock ("My AI brain isn't connected
  yet") — this repo's `ANTHROPIC_API_KEY` is for a future `/api/chat` route
  that calls the Anthropic API **server-side only**; never call it from the
  client.

## Coding Rules

- Keep changes minimal and scoped to the current task — no speculative
  features, no premature abstractions.
- Match existing file/folder conventions above; don't introduce new
  top-level folders without a clear reason.
- No dead code, no commented-out blocks, no placeholder TODOs left behind
  — exception: the specific, named placeholders listed above, which are
  intentional and documented, not left behind by accident.
- Comments only when the *why* isn't obvious from the code itself.
- Keep UI and API-route logic separated; don't embed data-fetching/validation
  logic that belongs in `src/lib/` directly inside a component.

## Security Rules

- Never commit secrets, API keys, tokens, or credentials to any file in this
  repo. `.env.example` lists every variable name with an empty value — real
  values go in `.env.local` (gitignored), never in `.env.example` itself.
- Validate and sanitize all user input on the server (API routes); never
  trust client-side validation alone. `contact-schema.ts` is shared by both
  layers specifically so they can't drift apart.
- Never expose internal error details, stack traces, or database details to
  the frontend.
- Any contact/lead-capture forms must guard against injection (SQL/XSS/etc.)
  per OWASP top 10 practices, and against spam (see Cloudflare Turnstile in
  the blueprint) once real traffic arrives.

## Token-Saving Rules

- Read only the files relevant to the current task; don't re-read files
  already open in context.
- Prefer targeted edits over rewriting whole files.
- Avoid generating explanatory summaries or documentation unless asked.
- Don't re-derive project structure or conventions already documented here —
  refer to this file instead.

## Scope Rule

- Only modify the files strictly required for the current task. Do not
  touch unrelated files, folders, or configuration as a side effect.
