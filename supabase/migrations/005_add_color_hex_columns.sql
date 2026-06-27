-- Add hex color columns for precise color control in AI generation
alter table public.product_analysis add column color_main_hex text;
alter table public.product_analysis add column color_accents_hex text;