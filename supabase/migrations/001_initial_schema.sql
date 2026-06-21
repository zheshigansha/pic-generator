-- VisionFit Pro - Initial Database Schema
-- Run this in Supabase SQL Editor to set up the database

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================================
-- PROJECTS TABLE
-- Represents one clothing product going through the full workflow
-- ============================================================================
create table if not exists public.projects (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    status text not null default 'uploaded' check (status in ('uploaded', 'analyzed', 'scene_set', 'generated', 'reviewed', 'published')),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- ============================================================================
-- CLOTHING ITEMS TABLE
-- Individual product images uploaded for a project
-- ============================================================================
create table if not exists public.clothing_items (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid not null references public.projects(id) on delete cascade,
    name text not null,
    image_data text not null, -- Base64 data URL
    uploaded_at date not null default current_date,
    created_at timestamp with time zone default now()
);

create index if not exists idx_clothing_items_project_id on public.clothing_items(project_id);

-- ============================================================================
-- PRODUCT ANALYSIS TABLE
-- Batch analysis result for a project (one analysis per project = all images combined)
-- ============================================================================
create table if not exists public.product_analysis (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid not null unique references public.projects(id) on delete cascade,
    product_type text,
    color text,
    material text,
    style text,
    description text,
    raw_response text, -- Full AI response for debugging
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- ============================================================================
-- SCENE CONFIGS TABLE
-- Scene configurations for a project
-- ============================================================================
create table if not exists public.scene_configs (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid not null references public.projects(id) on delete cascade,
    name text not null default '',
    sort_order integer not null default 0,
    images_count integer not null default 1 check (images_count between 1 and 5),
    season text not null default 'Spring',
    subject text not null default '人',
    environment text not null default '户外',
    surroundings text[] not null default '{}',
    custom_prompt text not null default '',
    preset_id text, -- Reference to preset scene type (coffee_shop, urban_street, etc.)
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create index if not exists idx_scene_configs_project_id on public.scene_configs(project_id);

-- ============================================================================
-- GENERATED IMAGES TABLE
-- AI-generated images for a project
-- ============================================================================
create table if not exists public.generated_images (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid not null references public.projects(id) on delete cascade,
    scene_config_id uuid references public.scene_configs(id) on delete set null,
    url text not null,
    revised_prompt text,
    scene_name text not null default '',
    created_at timestamp with time zone default now()
);

create index if not exists idx_generated_images_project_id on public.generated_images(project_id);
create index if not exists idx_generated_images_scene_config_id on public.generated_images(scene_config_id);

-- ============================================================================
-- SELECTED IMAGES TABLE
-- User's selections and cover choice for a project
-- ============================================================================
create table if not exists public.selected_images (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid not null unique references public.projects(id) on delete cascade,
    selected_image_ids uuid[] not null default '{}', -- Array of selected generated_images IDs
    cover_image_id uuid references public.generated_images(id) on delete set null,
    caption text not null default '',
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- ============================================================================
-- FUNCTION: Auto-update updated_at timestamp
-- ============================================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Apply updated_at triggers
drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
    before update on public.projects
    for each row execute function public.handle_updated_at();

drop trigger if exists set_product_analysis_updated_at on public.product_analysis;
create trigger set_product_analysis_updated_at
    before update on public.product_analysis
    for each row execute function public.handle_updated_at();

drop trigger if exists set_scene_configs_updated_at on public.scene_configs;
create trigger set_scene_configs_updated_at
    before update on public.scene_configs
    for each row execute function public.handle_updated_at();

drop trigger if exists set_selected_images_updated_at on public.selected_images;
create trigger set_selected_images_updated_at
    before update on public.selected_images
    for each row execute function public.handle_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- For MVP, allow all operations. Later you can add auth-based RLS.
-- ============================================================================
alter table public.projects enable row level security;
alter table public.clothing_items enable row level security;
alter table public.product_analysis enable row level security;
alter table public.scene_configs enable row level security;
alter table public.generated_images enable row level security;
alter table public.selected_images enable row level security;

-- Allow all operations for MVP (anonymous access)
-- In production, replace with proper auth policies
create policy "Allow all for anonymous" on public.projects for all using (true) with check (true);
create policy "Allow all for anonymous" on public.clothing_items for all using (true) with check (true);
create policy "Allow all for anonymous" on public.product_analysis for all using (true) with check (true);
create policy "Allow all for anonymous" on public.scene_configs for all using (true) with check (true);
create policy "Allow all for anonymous" on public.generated_images for all using (true) with check (true);
create policy "Allow all for anonymous" on public.selected_images for all using (true) with check (true);