# VisionFit Pro

AI 服装模特图生成系统 - 一站式生成专业模特效果图

## 产品介绍

VisionFit Pro 是一款面向外贸服装老板的 AI 工具，帮助用户：
- 上传服装产品图片（多角度）
- AI 自动分析产品特征
- 选择场景和参数设置
- 生成穿有该服装的模特效果图
- 审核、选择、发布到社媒平台

## 技术架构

### 前端
- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **状态管理**: localStorage (MVP阶段)

### 后端 API
- **图像分析**: Qwen VL (千问) - `qwen-vl-plus`
- **图像生成**: FLUX-2 (kie.ai) - `flux-2/flex-text-to-image`

### API 配置
```
# 千问 - 图像分析
QWEN_API_KEY=sk-759966a829c146efaf22b4084ca3bc70
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# kie.ai FLUX-2 - 图像生成
FLUX_API_KEY=6fc37e08157ebef17ed92fbd34e13112
FLUX_BASE_URL=https://api.kie.ai
```

## 工作流程

```
1. 上传图片 (最多20张，同一产品不同角度)
      ↓
2. 产品分析
   - 综合分析: AI 汇总所有图片，输出完整产品描述
   - 单独分析: 针对单张图片分析
      ↓
3. 场景设计
   - 选择预设场景(咖啡厅/街道/办公室等)
   - 设置季节、主体、环境、周围元素
      ↓
4. 生成图片
   - 按场景配置生成多张模特图
   - 异步任务，轮询状态
      ↓
5. 审核发布
   - 选择要保留的图片
   - 设置封面
   - 下载或发布到社媒
```

## 页面结构

| 页面 | 路径 | 功能 |
|------|------|------|
| 首页 | `/` | 整体流程介绍 |
| 上传 | `/upload` | 上传产品图片(最多20张) |
| 分析 | `/analysis` | AI 分析，可综合分析所有图片 |
| 场景 | `/scene` | 设计场景和参数 |
| 生成 | `/generate` | 生成模特效果图 |
| 审核 | `/review` | 选择图片，设置封面 |
| 输出 | `/output` | 下载/发布 |

## 核心功能

### 1. 上传图片
- 支持最多 20 张图片
- 同一产品多角度展示
- 可替换/删除已上传图片

### 2. 产品分析
- **综合分析**: 将所有图片一起发送给 Qwen VL，输出完整产品描述
- **单独分析**: 针对单张图片单独分析
- 可手动编辑分析结果
- 分析字段:
  - 产品类型 (product_type)
  - 颜色 (color)
  - 材质 (material)
  - 风格 (style)
  - 产品描述 (description)

### 3. 场景设计
- **预设场景**: 咖啡厅、城市街道、公园、办公室、海滩、运动场、家居生活、摄影棚
- **参数设置**:
  - 生成数量 (每场景1-5张)
  - 季节 (春夏秋冬)
  - 主体 (人/女人/男人/猫/仓鼠等)
  - 环境 (室内/户外/半室内/夜景)
  - 周围元素 (天空/大海/沙滩/草坪/高楼等，可多选)
  - 自定义场景描述

### 4. 图片生成
- 基于产品分析和场景配置生成提示词
- 调用 FLUX-2 API
- 异步任务，轮询状态
- 显示生成进度

### 5. 审核发布
- 按场景分组展示生成结果
- 选择/取消选择图片
- 设置封面图
- 删除不需要的图片
- 保存选择结果

### 6. 输出
- 封面预览
- 文案编辑
- 发布平台选择 (Facebook/Instagram/下载)
- 下载功能 (生成包含链接的文本文件)

## Supabase 集成

### 1. 获取 Supabase API 密钥

1. 登录 [Supabase](https://supabase.com/dashboard)
2. 进入你的项目 → **Settings** → **API**
3. 复制 **anon public** key 到 `.env.local` 的 `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. 运行数据库迁移

在 Supabase Dashboard → **SQL Editor** 中运行以下步骤：

1. 创建新查询，粘贴 `supabase/migrations/001_initial_schema.sql` 的内容
2. 点击 **Run** 执行

这将创建所有必要的表：
- `projects` - 项目
- `clothing_items` - 上传的图片
- `product_analysis` - 产品分析结果
- `scene_configs` - 场景配置
- `generated_images` - 生成的图片
- `selected_images` - 选择的图片

### 3. 启用 API

确保 Table Policies 允许匿名访问（迁移脚本已配置）。

## 待完成功能

- [x] Supabase 集成 (数据库 schema 已创建，等待配置 anon key)
- [ ] 将页面接入 Supabase (替换 localStorage 调用)
- [ ] Facebook/Instagram API 集成
- [ ] 文案自动生成
- [ ] 封面图单独生成
- [ ] 历史记录管理
- [ ] 用户账号体系

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
│   │       ├── analyze-batch/    # 批量综合分析 API
│   │       └── generate/         # 图像生成 API
│   ├── components/
│   │   ├── StepNav.tsx           # 步骤导航组件
│   │   └── WizardLayout.tsx      # 布局组件
│   └── lib/
│       ├── storage.ts            # localStorage 封装 (MVP)
│       ├── supabase.ts           # Supabase 客户端
│       ├── db.ts                 # Supabase 数据库操作
│       └── database.types.ts     # 数据库类型定义
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql # 数据库迁移脚本
├── .env.local                    # 环境变量
└── package.json
```

## 版本记录

### v0.2.0 (2026-06-21)
- 添加 Supabase 数据库 schema
- 创建 Supabase 客户端和数据库操作模块
- 准备 Supabase 集成（等待配置 anon key）

### v0.1.0 (2026-06-21)
- 完成基础框架搭建
- 完成上传、分析、场景、生成、审核、输出全流程
- 集成 Qwen VL 图像分析
- 集成 FLUX-2 图像生成
- localStorage 数据持久化

---

*最后更新: 2026-06-21*
