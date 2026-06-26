-- Security hardening
-- Business tables are now accessed through Next.js API routes with
-- SUPABASE_SERVICE_ROLE_KEY. The browser must not have direct table access.

drop policy if exists "Allow all for anonymous" on public.projects;
drop policy if exists "Allow all for anonymous" on public.clothing_items;
drop policy if exists "Allow all for anonymous" on public.product_analysis;
drop policy if exists "Allow all for anonymous" on public.scene_configs;
drop policy if exists "Allow all for anonymous" on public.generated_images;
drop policy if exists "Allow all for anonymous" on public.selected_images;

alter table public.projects enable row level security;
alter table public.clothing_items enable row level security;
alter table public.product_analysis enable row level security;
alter table public.scene_configs enable row level security;
alter table public.generated_images enable row level security;
alter table public.selected_images enable row level security;

revoke all on public.projects from anon, authenticated;
revoke all on public.clothing_items from anon, authenticated;
revoke all on public.product_analysis from anon, authenticated;
revoke all on public.scene_configs from anon, authenticated;
revoke all on public.generated_images from anon, authenticated;
revoke all on public.selected_images from anon, authenticated;

-- No replacement anon/authenticated policies are added here intentionally.
-- The service_role key bypasses RLS on the server. Keep that key out of
-- NEXT_PUBLIC_* variables and never expose it to the browser.
