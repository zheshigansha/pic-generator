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

    const prompt = `You are a professional product analyst. Look at this image and analyze the product. Provide a detailed description in JSON format:

{
  "product_type": "The type of product - be specific like 'running shoes', 'leather handbag', 'cotton t-shirt', 'wool sweater'",
  "color": "The main colors present - be specific like 'pure white', 'navy blue with white accents', 'black and red'",
  "material": "The main material(s) - like 'genuine leather', 'canvas', 'cotton blend', 'synthetic fabric'",
  "style": "The overall style - like 'casual sporty', 'business formal', 'streetwear', 'vintage retro', 'minimalist'",
  "description": "A detailed 2-3 sentence description of this product including its key features, design elements, and visual characteristics."
}

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
