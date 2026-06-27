# VisionFit Pro — 功能需求文档

> 最后更新：2026-06-27
> 状态：规划中

---

## 一、项目背景与目标

VisionFit Pro 定位为**外贸B端商户的AI图片生成 + 社媒发布工具**，帮助用户：
1. 上传产品图，AI生成穿在模特身上的效果图
2. 一键发布到海外社媒平台（Facebook 等）
3. 通过品牌信息嵌入和询盘入口，获取B端客户线索

**核心闭环：图片生成 → 品牌信息嵌入 → 平台发布 → 询盘转化**

---

## 二、功能规划

### 2.1 品牌资料库（Brand Profiles & Assets）

**目的：** 所有品牌相关资产集中管理，支持生成时复用。

**实现方式：**
- `brand_profiles` 表：存储品牌基本信息（公司名、联系方式、二维码、logo、水印样式）
- `brand_assets` 表：存储上传的资质文件（认证PDF、工厂照、发货照等）
- 品牌设置页：管理品牌信息 + 上传资质材料
- 生成图片时，勾选"嵌入品牌信息" → 自动叠加水印/LOGO/联系方式

**数据模型：**

```sql
-- 品牌配置
create table brand_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  name text not null,
  contact_email text,
  contact_phone text,
  contact_whatsapp text,
  website_url text,
  logo_url text,
  watermark_style text default 'corner',  -- corner/center/disabled
  watermark_position text default 'bottom-right',  -- top-left/bottom-right/center
  qr_code_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 品牌资产（资质文件、工厂照等）
create table brand_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brand_profiles(id) on delete cascade,
  asset_type text not null,  -- certification/factory/shipping/logo/other
  file_name text,
  file_url text not null,
  file_size int,
  mime_type text,
  description text,
  usage_count int default 0,  -- 被引用次数
  created_at timestamptz default now()
);
```

**页面：**
- `/brand` — 品牌设置页（信息编辑 + 资产上传）
- `/brand/assets` — 品牌资料库（查看/删除已上传资产）

---

### 2.2 平台配置层（Platform Config）

**目的：** 支持多平台发布，生成时自动适配尺寸和格式。

**实现方式：**
- `platform_configs` 表：维护平台配置（尺寸规则、内容格式）
- 前端选择目标平台 + 内容格式 → 生成时读配置表适配尺寸
- 当前覆盖 Facebook（Reel/Story/Post/Carousel），后续可扩展 Instagram/TikTok

**数据模型：**

```sql
create table platform_configs (
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
```

**Facebook 配置预置数据：**

| content_format | aspect_ratio | width | height |
|----------------|-------------|-------|--------|
| reel | 9:16 | 1080 | 1920 |
| story | 9:16 | 1080 | 1920 |
| post | 1:1 | 1080 | 1080 |
| post | 4:5 | 1080 | 1350 |
| carousel | 1:1 | 1080 | 1080 |

---

### 2.3 品牌信息嵌入（Brand Watermark in Generation）

**目的：** 生成图片时自动嵌入品牌 LOGO、联系方式、二维码，提升信任度。

**实现方式：**
- 生成流程中增加"品牌信息"步骤
- 勾选后，图片角落叠加：LOGO + 联系方式 + 二维码（根据 watermark_style 配置）
- 使用 sharp（Node.js 图片处理）在生成后叠加水印

**嵌入规则：**
- 位置：`bottom-right` 角落，padding 20px
- LOGO：最多占图片宽度 15%
- 联系方式：字体 Arial，字号按图片比例自适应
- 二维码：固定 80x80px

---

### 2.4 社媒发布（Social Media Publishing）

**目的：** 一键将生成好的图片发布到 Facebook 主页。

**实现方式：**
- Facebook Graph API 通过页面访问令牌（Page Access Token）发布
- 支持发图片帖子（Photo Post），后续扩展 Reel/Story
- 先发到用户绑定的 Facebook Page，用户需 OAuth 授权

**发布流程：**
```
用户授权 Facebook Page
  ↓
选择平台（Facebook）+ 内容格式
  ↓
填写标题/正文（可选AI生成）
  ↓
调用 Facebook Graph API 发布
  ↓
返回帖子链接
```

**API 参考：**
```
POST https://graph.facebook.com/v{version}/{page-id}/photos
  url: {image-url}
  caption: {post-text}
  access_token: {page-access-token}
```

---

### 2.5 线索管理（Lead Tracking）

**目的：** 追踪发布效果，知道哪篇帖子带来了询盘。

**实现方式（轻量方案）：**
- 生成专属短链接（含 UTM 参数），指向落地页
- 落地页集成第三方询盘表单（Tally/Typeform）
- 数据在第三方平台管理，不自建 CRM
- 功能占位，后期按需演进

**落地页字段：**
- 产品名称、图片、规格
- 品牌联系方式
- 询盘表单（姓名/公司/邮箱/留言）

---

## 三、实现计划

### Phase 1：品牌资料库（本次 MVP）
- [ ] `brand_profiles` 表
- [ ] `brand_assets` 表
- [ ] 品牌设置页 `/brand`
- [ ] 资产上传功能
- [ ] 资产库查看/删除

### Phase 2：平台配置 + 尺寸适配
- [ ] `platform_configs` 表 + 预置数据
- [ ] 平台选择 UI（生成页）
- [ ] 尺寸自适应逻辑

### Phase 3：品牌信息嵌入
- [ ] 水印叠加逻辑（sharp）
- [ ] 生成流程集成品牌信息勾选
- [ ] 二维码/联系方式渲染

### Phase 4：Facebook 发布
- [ ] Facebook OAuth 授权
- [ ] 绑定 Facebook Page
- [ ] 图片帖子发布 API
- [ ] 发布结果展示（帖子链接）

### Phase 5：线索追踪
- [ ] 短链接生成（UTM）
- [ ] 落地页模板
- [ ] 第三方表单集成

---

## 四、依赖关系

```
Phase 1（品牌资料库）
    ↓
Phase 2（平台配置）← 依赖 Phase 1 的品牌表
    ↓
Phase 3（品牌嵌入）← 依赖 Phase 1 的品牌配置
    ↓
Phase 4（社媒发布）← 依赖 Phase 1 + 2
    ↓
Phase 5（线索追踪）← 依赖 Phase 4
```

---

## 五、待确认事项

1. **Facebook 审核政策**：App 需通过 Facebook 审核才能有权限发帖子，当前先用测试 Token 跑通流程
2. **图片叠加方式**：sharp 叠加水印稳定性需验证，可能改用外部图片编辑服务
3. **多语言支持**：产品描述是否需要 AI 生成多语言版本（英文/阿拉伯语）