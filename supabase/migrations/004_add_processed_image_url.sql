-- Add processed_image_url column to clothing_items for transparent background images
alter table public.clothing_items
add column if not exists processed_image_url text;

-- Also add image_url if it doesn't exist (from migration 002 may have added it)
-- This ensures the column exists even if migration 002 didn't run properly
