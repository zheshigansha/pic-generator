import { NextRequest, NextResponse } from 'next/server'
import { getClientKey, rateLimit } from '@/lib/rate-limit'

const MAX_IMAGE_COUNT = 20
const MAX_DATA_URL_LENGTH = 14 * 1024 * 1024

function getApiUrl() {
  return `${process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'}/chat/completions`
}

interface AnalyzeBatchRequest {
  imageDataList: string[]
}

function isValidImageData(imageData: string) {
  return /^data:image\/(png|jpe?g|webp);base64,/i.test(imageData) && imageData.length <= MAX_DATA_URL_LENGTH
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.QWEN_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Qwen API key is not configured' }, { status: 503 })
  }

  const limited = rateLimit(getClientKey(request, 'analyze-batch'), 12, 60_000)
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Too many analysis requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(limited.retryAfter) },
      }
    )
  }

  try {
    const { imageDataList } = await request.json() as AnalyzeBatchRequest

    if (!imageDataList || !Array.isArray(imageDataList) || imageDataList.length === 0 || imageDataList.length > MAX_IMAGE_COUNT) {
      return NextResponse.json(
        { error: 'Invalid image data list' },
        { status: 400 }
      )
    }

    if (!imageDataList.every(isValidImageData)) {
      return NextResponse.json(
        { error: 'Invalid image data format' },
        { status: 400 }
      )
    }

    const prompt = `You are a professional product analyst for e-commerce photography. I will provide multiple images of the SAME product from different angles. Analyze ALL images together and provide ONE comprehensive structured analysis.

Provide your analysis in the following JSON format with these exact fields:

{
  "product_type": "Product type - be very specific, e.g., 'ski jacket', 'down puffer coat', 'running shoes', 'crossbody bag'",
  "color_main": "Primary/main color, e.g. 'deep black', 'pure white', 'navy blue'",
  "color_accents": "Secondary colors, accent colors, or color blocking details from all angles, e.g. 'white piping on sleeves and hem', 'red logo on left chest visible in front view'",
  "material_texture": "Material and surface texture from multiple angles, e.g. 'matte nylon fabric with horizontal quilted baffles visible on front and back', 'smooth leather with visible grain texture'",
  "logo_position": "Logo placement on the garment/accessory - note positions visible across different angles, e.g. 'left chest area (front view), right sleeve near cuff (side view)'",
  "logo_style": "Logo appearance - size, color, and technique, e.g. '3cm×3cm white embroidered logo on left chest', 'black reflective printed wordmark'",
  "special_features": ["Feature 1 - from multiple angles note details like 'waterproof taped seams visible on sleeve edges', 'detachable faux fur hood visible in front view'", "Feature 2 from multiple angles"],
  "silhouette": "Overall shape and fit based on all angles, e.g. 'relaxed oversized fit hip-length visible from front, back view shows full coverage'",
  "description": "A concise 1-2 sentence product description for marketing purposes - focus on key selling points visible across all angles"
}

CRITICAL REQUIREMENTS:
- Analyze ALL images carefully - they show different views of the SAME product
- Combine observations from all angles into one coherent analysis
- Extract ALL visible details accurately - logo position, texture patterns, color blocking, seam styles
- If logo text is visible, include it in logo_style
- List every notable feature visible across all images in special_features
- Be as specific as possible with measurements and locations
- If you cannot determine a field, use "not visible" or "cannot determine" instead of guessing`

    // Build content array with all images and text
    const content: Array<{type: string, image_url?: {url: string}, text?: string}> = []

    // Add all images first
    for (const imageData of imageDataList) {
      content.push({
        type: 'image_url',
        image_url: { url: imageData },
      })
    }

    // Add the prompt text
    content.push({
      type: 'text',
      text: prompt,
    })

    const response = await fetch(getApiUrl(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-vl-plus',
        messages: [
          {
            role: 'user',
            content: content,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('Qwen API error:', response.status, errorBody)
      return NextResponse.json(
        { error: `Qwen API error: ${response.status}`, detail: errorBody },
        { status: response.status }
      )
    }

    const data = await response.json()

    const content_text = data.choices?.[0]?.message?.content

    if (!content_text) {
      return NextResponse.json(
        { error: 'No analysis result from Qwen', raw: JSON.stringify(data) },
        { status: 500 }
      )
    }

    // Parse the response text
    let analysis = null
    try {
      const jsonMatch = content_text.match(/```json\n([\s\S]*?)\n```/) ||
                       content_text.match(/```\n([\s\S]*?)\n```/) ||
                       content_text.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[jsonMatch[0].startsWith('{') ? 0 : 1])
      } else {
        // Try to extract JSON from the text
        const startIdx = content_text.indexOf('{')
        const endIdx = content_text.lastIndexOf('}')
        if (startIdx !== -1 && endIdx !== -1) {
          analysis = JSON.parse(content_text.substring(startIdx, endIdx + 1))
        }
      }
    } catch (parseError) {
      console.error('Failed to parse analysis JSON:', parseError, 'Content:', content_text)
      return NextResponse.json(
        { error: 'Failed to parse analysis result', raw: content_text },
        { status: 500 }
      )
    }

    if (!analysis) {
      return NextResponse.json(
        { error: 'Failed to extract analysis JSON', raw: content_text },
        { status: 500 }
      )
    }

    return NextResponse.json({
      analysis,
      rawResponse: content_text,
    })
  } catch (error) {
    console.error('Analyze Batch API error:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    )
  }
}
