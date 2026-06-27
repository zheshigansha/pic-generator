-- Brand assets: 品牌资产（资质文件、工厂照、发货照等）
create table if not exists brand_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brand_profiles(id) on delete cascade,
  asset_type text not null,
  file_name text,
  file_url text not null,
  file_size int,
  mime_type text,
  description text,
  usage_count int default 0,
  created_at timestamptz default now()
);

-- RLS
alter table brand_assets enable row level security;

create policy "Users can manage own brand assets"
  on brand_assets for all
  using (
    exists (
      select 1 from brand_profiles
      where brand_profiles.id = brand_assets.brand_id
        and brand_profiles.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from brand_profiles
      where brand_profiles.id = brand_assets.brand_id
        and brand_profiles.user_id = auth.uid()
    )
  );

-- Usage count increment function
create or replace function increment_asset_usage(asset_id uuid)
returns void as $$
  update brand_assets set usage_count = usage_count + 1 where id = asset_id;
$$ language sql security definer;