import { NextRequest, NextResponse } from 'next/server'
import { getClientKey, rateLimit } from '@/lib/rate-limit'

const MAX_DATA_URL_LENGTH = 14 * 1024 * 1024

function getApiUrl() {
  return `${process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'}/chat/completions`
}

interface AnalyzeRequest {
  imageData: string
}

function isValidImageData(imageData: string) {
  return /^data:image\/(png|jpe?g|webp);base64,/i.test(imageData) && imageData.length <= MAX_DATA_URL_LENGTH
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.QWEN_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Qwen API key is not configured' }, { status: 503 })
  }

  const limited = rateLimit(getClientKey(request, 'analyze'), 30, 60_000)
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
    const { imageData } = await request.json() as AnalyzeRequest

    if (!imageData || !isValidImageData(imageData)) {
      return NextResponse.json(
        { error: 'Invalid image data format' },
        { status: 400 }
      )
    }

    const prompt = `You are a professional product analyst for e-commerce photography. Look at this image and analyze the product in detail for AI image generation purposes.

Provide a structured analysis in JSON format with these exact fields:

{
  "product_type": "Product type - be specific like 'ski jacket', 'down puffer coat', 'running shoes', 'leather crossbody bag'",
  "color_main": "Primary/main color of the product, e.g. 'deep black', 'pure white', 'navy blue'",
  "color_accents": "Secondary colors, accent colors, or color blocking details, e.g. 'white piping on sleeves', 'red logo on left chest', 'black trim at cuffs and hem'",
  "material_texture": "Material and surface texture, e.g. 'matte nylon fabric with horizontal quilted baffles', 'smooth genuine leather', 'textured knit wool with cable pattern'",
  "logo_position": "Logo placement on the garment/accessory, e.g. 'left chest area', 'right sleeve near cuff', 'center back upper', 'front pocket flap'",
  "logo_style": "Logo appearance - size, color, and technique, e.g. '3cm×3cm white embroidered logo', 'black reflective printed wordmark', 'small gold metal badge'",
  "special_features": ["Feature 1 - be specific like 'waterproof taped seams', 'detachable faux fur hood', 'adjustable velcro cuffs', 'thumb holes in sleeves', 'inner fleece lining'"],
  "silhouette": "Overall shape and fit, e.g. 'relaxed oversized fit, hip-length', 'slim tapered leg', 'structured boxy frame'",
  "description": "A concise 1-2 sentence product description for marketing purposes - focus on key selling points and visual character"
}

CRITICAL REQUIREMENTS:
- Extract ALL visible details accurately - logo position, texture patterns, color blocking, seam styles
- If logo text is visible, include it in logo_style
- List every notable feature you can identify in special_features array
- Be as specific as possible with measurements and locations
- If you cannot determine a field, use "not visible" or "cannot determine" instead of guessing

Analyze the image carefully and provide accurate information.`

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
            content: [
              {
                type: 'image_url',
                image_url: { url: imageData },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Qwen API error:', response.status, error)
      return NextResponse.json(
        { error: `Qwen API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return NextResponse.json(
        { error: 'No analysis result from Qwen', raw: JSON.stringify(data) },
        { status: 500 }
      )
    }

    // Parse the response text
    let analysis = null
    try {
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) ||
                       content.match(/```\n([\s\S]*?)\n```/) ||
                       content.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[jsonMatch[0].startsWith('{') ? 0 : 1])
      } else {
        // Try to extract JSON from the text
        const startIdx = content.indexOf('{')
        const endIdx = content.lastIndexOf('}')
        if (startIdx !== -1 && endIdx !== -1) {
          analysis = JSON.parse(content.substring(startIdx, endIdx + 1))
        }
      }
    } catch (parseError) {
      console.error('Failed to parse analysis JSON:', parseError, 'Content:', content)
      return NextResponse.json(
        { error: 'Failed to parse analysis result', raw: content },
        { status: 500 }
      )
    }

    if (!analysis) {
      return NextResponse.json(
        { error: 'Failed to extract analysis JSON', raw: content },
        { status: 500 }
      )
    }

    return NextResponse.json({
      analysis,
      rawResponse: content,
    })
  } catch (error) {
    console.error('Analyze API error:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    )
  }
}
