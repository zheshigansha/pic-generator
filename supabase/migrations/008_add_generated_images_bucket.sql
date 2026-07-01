-- Storage bucket for watermarked/generated images
-- Run this if the 'generated-images' bucket doesn't exist in your Supabase dashboard

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-images',
  'generated-images',
  true,
  50 * 1024 * 1024,  -- 50MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 50 * 1024 * 1024;