# VisionFit Pro

AI 服装模特图生成系统 — 上传衣服图，生成穿上这件衣服的模特效果图

## 产品介绍

VisionFit Pro 是一款面向外贸服装商的 AI 工具，帮助用户：
- 上传服装产品图片（多角度）
- AI 自动分析产品特征（颜色、材质、款式、描述）
- 选择/设计场景和参数
- 生成穿有该服装的模特效果图（img2img）
- 审核、选择、发布到社媒平台

## 技术架构

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 16 (App Router) + TypeScript + Tailwind CSS |
| 数据库 | Supabase (PostgreSQL + Storage) |
| 图像分析 | Qwen VL Plus (`qwen-vl-plus`) |
| 图像生成 | FLUX-2 (`flux-2/flex-image-to-image`) |

## 环境变量

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Qwen - 图像分析
QWEN_API_KEY=your-qwen-api-key
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# kie.ai FLUX-2 - 图像生成
FLUX_API_KEY=your-flux-api-key
FLUX_BASE_URL=https://api.kie.ai
```

## 工作流程

```
1. 上传图片（最多20张，同一产品不同角度）
   ↓
2. 产品分析
   - 综合分析：AI 汇总所有图片，输出完整产品描述
   - 单独分析：针对单张图片分析
   ↓
3. 场景设计
   - 选择预设场景（咖啡厅/街道/办公室等）
   - 设置季节、主体、环境、周围元素
   ↓
4. 生成图片
   - img2img：原始衣服图作为参考 + AI分析结果增强提示词
   - 按场景配置生成多张模特图
   ↓
5. 审核发布
   - 选择要保留的图片
   - 设置封面
   - 下载或发布到社媒
```

## 核心逻辑

### img2img 生成原理

```
原始衣服图 ──(img2img)──→ AI分析结果（文字增强）
                              ↓
                    穿上这件衣服的模特效果图

- 原始图作为参考（img2img），让衣服的版型/颜色/细节保持不变
- AI分析结果作为文字描述，补充产品细节
- 场景配置决定模特、环境、季节等外部元素
```

## 页面结构

| 页面 | 路径 | 功能 |
|------|------|------|
| 首页 | `/` | 整体流程介绍 |
| 上传 | `/upload` | 上传产品图片（存 Supabase Storage） |
| 分析 | `/analysis` | AI 分析，存 Supabase DB |
| 场景 | `/scene` | 设计场景，存 Supabase DB |
| 生成 | `/generate` | img2img 生成，结果存 Supabase DB |
| 审核 | `/review` | 选图，设封面 |
| 输出 | `/output` | 文案，发布/下载 |

## 数据库表结构

Supabase DB（详见 `supabase/migrations/`）：
- `projects` — 项目
- `clothing_items` — 上传的图片（含 image_url 指向 Storage）
- `product_analysis` — AI 分析结果
- `scene_configs` — 场景配置
- `generated_images` — 生成的图片
- `selected_images` — 用户选择和封面

## 待完成功能

- [ ] 背景去除（后台自动处理，提高还原度）
- [ ] 多图参考（所有角度图一起传给 img2img）
- [ ] Facebook/Instagram API 集成
- [ ] 文案自动生成
- [ ] 封面图单独生成
- [ ] 历史记录管理

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build
```

## 文件结构

```
vision-fit-pro/
├── src/
│   ├── app/
│   │   ├── page.tsx              # 首页
│   │   ├── upload/page.tsx       # 上传页
│   │   ├── analysis/page.tsx     # 分析页
│   │   ├── scene/page.tsx        # 场景页
│   │   ├── generate/page.tsx     # 生成页
│   │   ├── review/page.tsx       # 审核页
│   │   ├── output/page.tsx       # 输出页
│   │   └── api/
│   │       ├── analyze/          # 单图分析 API
│   │       ├── analyze-batch/     # 批量综合分析 API
│   │       └── generate/          # FLUX img2img 生成 API
│   ├── components/
│   │   ├── ProjectContext.tsx    # 项目 Context（自动创建 Project）
│   │   ├── StepNav.tsx           # 步骤导航
│   │   ├── WizardLayout.tsx      # 布局
│   │   └── types.ts              # 共享类型
│   └── lib/
│       ├── supabase.ts           # Supabase 客户端 + uploadToStorage
│       ├── db.ts                 # 数据库操作（CRUD）
│       ├── database.types.ts     # DB 类型定义
│       └── storage.ts            # localStorage 封装（历史遗留）
├── supabase/
│   └── migrations/               # 数据库迁移
├── .env.local                    # 环境变量
└── package.json
```

## 版本记录

### Phase 1 (2026-06-27)
- **品牌资料库**：brand_profiles + brand_assets 表，完整 CRUD
- **品牌设置页** `/brand`：信息编辑 + 资产上传
- **Storage bucket** `brand-assets`：需在 Supabase Dashboard 手动创建并设置 Public
- 侧边栏新增"品牌设置"入口
- 数据库类型定义更新

### 初版-MVP (2026-06-27)
- 基础数据流跑通（上传 → 分析 → 场景 → 生成 → 审核 → 输出）
- 所有数据切换到 Supabase DB 持久化
- 集成 Qwen VL Plus 图像分析
- 集成 FLUX-2 img2img 图像生成
- **颜色还原增强**：分析阶段提取 hex 色号，生成时加入 CRITICAL 颜色约束，显著提升服装颜色准确度
- **img2img 参考图优化**：优先使用去背透明背景图（processed_image_url）作为 FLUX 参考，解决原图背景干扰问题

### 初版 (2026-06-24)
- 基础框架搭建完成
- localStorage 阶段

---

*最后更新: 2026-06-27（Phase 1）*
