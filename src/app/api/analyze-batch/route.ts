import { NextRequest, NextResponse } from 'next/server'

const API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

interface AnalyzeBatchRequest {
  imageDataList: string[]
}

export async function POST(request: NextRequest) {
  try {
    const { imageDataList } = await request.json() as AnalyzeBatchRequest

    if (!imageDataList || !Array.isArray(imageDataList) || imageDataList.length === 0) {
      return NextResponse.json(
        { error: 'Invalid image data list' },
        { status: 400 }
      )
    }

    // Check first image format
    if (!imageDataList[0] || !imageDataList[0].startsWith('data:image')) {
      return NextResponse.json(
        { error: 'Invalid image data format' },
        { status: 400 }
      )
    }

    const prompt = `You are a professional product analyst. I will provide multiple images of the SAME product from different angles. Please analyze ALL images together and provide ONE comprehensive product description.

Look carefully at ALL images - they show different views (front, back, side, detail, etc.) of the SAME product. Combine your observations from all angles to create a complete and accurate analysis.

Provide your analysis in the following JSON format:
{
  "product_type": "The complete product type - be very specific, e.g., 'low-top basketball sneakers', 'crossbody leather messenger bag', 'slim-fit denim jeans'",
  "color": "All colors present - be specific about color placement, e.g., 'predominantly black with white midsole and red accent stitching', 'solid heather gray with navy blue trim'",
  "material": "Main materials used - e.g., 'genuine cowhide leather with fabric lining', '98% cotton 2% elastane denim, rubber outsole'",
  "style": "Overall style and aesthetic - e.g., 'urban streetwear with retro basketball influences', 'minimalist Scandinavian design', 'classic Americana workwear'",
  "description": "A comprehensive 3-4 sentence description covering: the overall silhouette and shape, key design features visible from different angles, distinctive details or branding elements, and the intended use or occasion for this product."
}

IMPORTANT: Analyze ALL images carefully. They are different views of the SAME product. Your description should reflect observations from all angles combined into one coherent analysis.`

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

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.QWEN_API_KEY}`,
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
      const error = await response.text()
      return NextResponse.json(
        { error: `Qwen API error: ${response.status} - ${error}` },
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