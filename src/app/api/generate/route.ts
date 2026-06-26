import { NextRequest, NextResponse } from 'next/server'
import { getClientKey, rateLimit } from '@/lib/rate-limit'

const DEFAULT_API_BASE = 'https://api.kie.ai'
const MAX_PROMPT_LENGTH = 5000
const ALLOWED_ASPECT_RATIOS = new Set(['1:1', '3:4', '4:3', '9:16', '16:9'])
const ALLOWED_RESOLUTIONS = new Set(['1K', '2K'])

interface GenerateRequest {
  prompt: string
  imageUrl?: string  // Reference image URL for img2img
  aspectRatio?: string
  resolution?: string
  strength?: number   // img2img strength 0-1, higher = more faithful to reference image
}

function getApiBase() {
  return process.env.FLUX_BASE_URL || DEFAULT_API_BASE
}

function isAllowedReferenceUrl(imageUrl: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return false

  try {
    const candidate = new URL(imageUrl)
    const allowed = new URL(supabaseUrl)
    return candidate.protocol === 'https:' && candidate.hostname === allowed.hostname
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.FLUX_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'FLUX API key is not configured' }, { status: 503 })
  }

  const limited = rateLimit(getClientKey(request, 'generate'), 10, 60_000)
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Too many generation requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(limited.retryAfter) },
      }
    )
  }

  try {
    const { prompt, imageUrl, aspectRatio = '3:4', resolution = '1K', strength = 0.8 } = await request.json() as GenerateRequest

    if (!prompt || typeof prompt !== 'string' || prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json({ error: 'Invalid prompt' }, { status: 400 })
    }

    if (imageUrl && !isAllowedReferenceUrl(imageUrl)) {
      return NextResponse.json({ error: 'Invalid reference image URL' }, { status: 400 })
    }

    if (strength !== undefined && (typeof strength !== 'number' || strength < 0 || strength > 1)) {
      return NextResponse.json({ error: 'Invalid strength value, must be 0-1' }, { status: 400 })
    }

    if (!ALLOWED_ASPECT_RATIOS.has(aspectRatio) || !ALLOWED_RESOLUTIONS.has(resolution)) {
      return NextResponse.json({ error: 'Invalid generation settings' }, { status: 400 })
    }

    // Determine which model to use
    const useImg2Img = !!imageUrl
    const model = useImg2Img ? 'flux-2/flex-image-to-image' : 'flux-2/flex-text-to-image'

    // Build input based on model type
    const input: Record<string, string | boolean | string[] | number> = {
      prompt,
      aspect_ratio: aspectRatio,
      resolution,
      nsfw_checker: false,
    }

    if (useImg2Img) {
      // img2img requires input_urls (array of image URLs)
      input.input_urls = [imageUrl]
      // strength: higher = more faithful to reference, lower = more creative freedom
      input.strength = strength
    }

    // Step 1: Create task
    const createResponse = await fetch(`${getApiBase()}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input,
      }),
    })

    const createData = await createResponse.json()

    if (createData.code !== 200) {
      return NextResponse.json({ error: createData.msg || 'Failed to create task' }, { status: createData.code })
    }

    const taskId = createData.data.taskId

    return NextResponse.json({
      created: Date.now(),
      taskId,
    })
  } catch (error) {
    console.error('Generate API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
