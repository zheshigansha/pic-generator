# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VisionFit Pro is an AI-powered clothing model image generation tool for social media marketing. It helps foreign trade clothing businesses generate professional model效果图 without photoshoots.

**Tech Stack**: Next.js 16 (App Router) + TypeScript + Tailwind CSS + Supabase

## Common Commands

```bash
npm install        # Install dependencies
npm run dev        # Start development server (default port 3000)
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run ESLint
```

## Architecture

### Data Flow

```
Upload → Analysis (Qwen VL) → Scene Config → Generation (FLUX-2) → Review → Output
```

### State Management

- **Project ID**: Stored in `localStorage` via `ProjectContext` (key: `visionfit_project_id`)
- **All business data** (clothing items, analysis, scenes, generated images): Stored in **Supabase**

This means pages don't use localStorage directly for data persistence—only the project ID is kept in localStorage, while everything else flows through Supabase via `src/lib/db.ts`.

### API Routes (src/app/api/)

| Route | Purpose | External API |
|--------|---------|-------------|
| `/api/analyze` | Single image analysis | Qwen VL (阿里千问) |
| `/api/analyze-batch` | Batch analysis (all images) | Qwen VL |
| `/api/generate` | Generate model images | FLUX-2 (kie.ai) |

### Database (Supabase)

Schema is in `supabase/migrations/001_initial_schema.sql`. Tables:
- `projects` - clothing products going through the workflow
- `clothing_items` - uploaded product images (base64 in `image_data`)
- `product_analysis` - AI analysis results (one per project)
- `scene_configs` - scene settings for generation
- `generated_images` - AI-generated model images
- `selected_images` - user selections and cover choice

### Key Files

- `src/lib/db.ts` - All Supabase database operations (not localStorage despite the README saying so)
- `src/lib/supabase.ts` - Supabase client initialization
- `src/lib/database.types.ts` - TypeScript types matching Supabase schema
- `src/lib/storage.ts` - Legacy localStorage helper (being replaced by Supabase)
- `src/components/ProjectContext.tsx` - Project state management (creates/loads project ID from localStorage)

### Page Flow (src/app/)

```
/ → Introduction page
/upload → Upload product images (max 20)
/analysis → AI analysis (comprehensive + single image)
/scene → Scene configuration (preset scenes, season, subject, environment)
/generate → Generate model images (async, polls FLUX-2)
/review → Review and select images
/output → Download or publish to social media
```

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `QWEN_API_KEY` - Alibaba Qwen VL API key
- `QWEN_BASE_URL` - Qwen API endpoint
- `FLUX_API_KEY` - kie.ai FLUX-2 API key
- `FLUX_BASE_URL` - FLUX API endpoint

## Known Issues

- **Hydration mismatch**: Browser extensions that inject attributes into `<html>` (e.g., `data-site-language`, `data-theme`) cause React hydration warnings. This can break functionality in regular mode—use incognito mode for testing.
- **Supabase migration**: Run `supabase/migrations/001_initial_schema.sql` in Supabase SQL Editor before using the app.

## Development Notes

- All database operations go through `db.ts` which wraps Supabase—do not use `storage.ts` for new features
- Images are stored as base64 data URLs in Supabase `clothing_items.image_data` column
- Generation is async: create task → poll status every 3s → return results (max 60 polls)
- The `WizardLayout` wraps pages with `ProjectProvider` which auto-creates a project if none exists
