-- Phase 1 foundation: Supabase Storage bucket for property photos.
--
-- NOT APPLIED YET — same status as 0001_properties_and_inquiries.sql.
-- No images are uploaded or migrated in Phase 1; the future admin portal's
-- image-upload workflow will use this bucket once it's built.

insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', true)
on conflict (id) do nothing;

-- Public: read-only access to files in this bucket (so next/image can load
-- them directly from the Supabase Storage CDN URL on the public site).
drop policy if exists "public read property images" on storage.objects;
create policy "public read property images"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'property-images');

-- Admin (any authenticated user — see note in 0001 about the single-admin
-- model): upload, replace, and delete property photos.
drop policy if exists "authenticated manage property images" on storage.objects;
create policy "authenticated manage property images"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'property-images')
  with check (bucket_id = 'property-images');
