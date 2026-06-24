-- Add image_url column to clothing_items for img2img generation
-- This stores the public URL of images uploaded to Supabase Storage

alter table public.clothing_items
add column if not exists image_url text;

-- Create index for faster lookups
create index if not exists idx_clothing_items_image_url on public.clothing_items(image_url);
