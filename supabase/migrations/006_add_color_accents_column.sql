-- Add color_accents text column (migration 005 only added hex columns, missing the text column)
alter table public.product_analysis add column color_accents text;
