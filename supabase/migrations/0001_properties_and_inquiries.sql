-- Phase 1 foundation schema for the Nadeem Real Estate admin portal.
--
-- NOT APPLIED YET. This file is prepared for review only — it has not been
-- run against any Supabase project. No credentials exist in this
-- environment to run it, and Phase 1 explicitly excludes any data cutover.
-- Apply it later (via `supabase db push` or the SQL editor) when Phase 2
-- begins.
--
-- Design notes:
--  - `properties` is the future single source of truth that will eventually
--    replace both src/lib/listings.ts (hardcoded array) and
--    data/properties.json (used only by the AI agent) — see
--    docs/platform-blueprint.md. Columns are a superset of both existing
--    shapes (Listing + the chat route's Property interface) so no field
--    used by either consumer today is lost.
--  - `inquiries` is the future replacement for data/inquiries.json,
--    covering both confirmInquiry() records from src/app/api/chat/route.ts
--    ("chat" source) and the /api/contact form ("contact" source).
--  - Nothing here is wired into the app yet.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  long_description text,
  price numeric not null,
  currency text not null default 'USD',
  location text not null,
  property_type text not null,
  listing_type text not null default 'For Sale',
  bedrooms integer,
  bathrooms integer,
  area_sqft numeric,
  land_size text,
  features text[] not null default '{}',
  images text[] not null default '{}',
  image_gradient text,
  agent text not null default 'Nadeem',
  featured boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'sold', 'rented')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.properties is
  'Future single source of truth for property listings, replacing src/lib/listings.ts and data/properties.json. Not yet connected to the app (Phase 1: schema only).';

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at
  before update on public.properties
  for each row
  execute function public.set_updated_at();

alter table public.properties enable row level security;

-- Public (anon + authenticated): read published properties only.
drop policy if exists "public read published properties" on public.properties;
create policy "public read published properties"
  on public.properties
  for select
  to anon, authenticated
  using (status = 'published');

-- Admin (any authenticated user — this project has a single admin account):
-- full read/write, including drafts. There is intentionally no separate
-- "admin" role/table yet since there is only one admin user; if a second
-- admin role is ever needed, tighten this to check a dedicated admins table
-- instead of "any authenticated user".
drop policy if exists "authenticated manage properties" on public.properties;
create policy "authenticated manage properties"
  on public.properties
  for all
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- inquiries
-- ---------------------------------------------------------------------------

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('chat', 'contact')),
  status text not null default 'NEW',
  property_id uuid references public.properties (id) on delete set null,
  inquiry_type text,
  customer_name text,
  customer_email text,
  customer_phone text,
  customer_address text,
  customer_unit text,
  preferred_date text,
  preferred_time text,
  message text,
  promotion_id text,
  fee jsonb,
  confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.inquiries is
  'Future replacement for data/inquiries.json. Covers both the AI chat agent''s confirmInquiry() records (source=chat) and the /api/contact form (source=contact). Not yet connected to the app (Phase 1: schema only).';

alter table public.inquiries enable row level security;

-- No anon policy: public visitors submit inquiries through the server-side
-- API routes (/api/chat, /api/contact) using the service-role key, which
-- bypasses RLS entirely — the anon/public key is never used to write here.
-- Only the admin can read submitted inquiries.
drop policy if exists "authenticated read inquiries" on public.inquiries;
create policy "authenticated read inquiries"
  on public.inquiries
  for select
  to authenticated
  using (true);
