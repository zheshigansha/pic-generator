-- Platform configs: 平台尺寸配置
create table if not exists platform_configs (
  id uuid primary key default gen_random_uuid(),
  platform text not null,           -- facebook/instagram/tiktok
  content_format text not null,     -- reel/story/post/carousel
  aspect_ratio text not null,       -- 9:16 / 1:1 / 4:5
  width int not null,
  height int not null,
  max_file_size_mb int default 100,
  description text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- RLS disabled for single-user app
alter table platform_configs disable row level security;

-- Facebook preset data
insert into platform_configs (platform, content_format, aspect_ratio, width, height, description) values
  ('facebook', 'reel',    '9:16', 1080, 1920, 'Facebook Reel 短视频'),
  ('facebook', 'story',   '9:16', 1080, 1920, 'Facebook Story 快拍'),
  ('facebook', 'post',    '1:1',  1080, 1080, 'Facebook Post 方图'),
  ('facebook', 'post',    '4:5',  1080, 1350, 'Facebook Post 竖图'),
  ('facebook', 'carousel','1:1',  1080, 1080, 'Facebook Carousel 方图轮播');