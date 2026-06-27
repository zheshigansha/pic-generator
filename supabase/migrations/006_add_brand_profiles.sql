-- Brand profiles: 品牌配置（公司信息、联系方式、水印样式）
create table if not exists brand_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  contact_email text,
  contact_phone text,
  contact_whatsapp text,
  website_url text,
  logo_url text,
  watermark_style text default 'corner',
  watermark_position text default 'bottom-right',
  qr_code_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table brand_profiles enable row level security;

create policy "Users can manage own brand profile"
  on brand_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger brand_profiles_updated_at
  before update on brand_profiles
  for each row execute function update_updated_at();