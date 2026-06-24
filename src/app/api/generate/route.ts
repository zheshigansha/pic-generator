import { NextRequest, NextResponse } from 'next/server'

const API_BASE = 'https://api.kie.ai'
const API_KEY = process.env.FLUX_API_KEY!

interface GenerateRequest {
  prompt: string
  imageUrl?: string  // Reference image URL for img2img
  aspectRatio?: string
  resolution?: string
}

async function pollTaskStatus(taskId: string, maxAttempts = 60): Promise<{ url: string; revisedPrompt: string }[]> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${API_BASE}/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    })

    const data = await response.json()

    if (data.code !== 200) {
      throw new Error(data.msg || 'Query failed')
    }

    const { state, resultJson } = data.data

    if (state === 'success') {
      const result = JSON.parse(resultJson)
      return result.resultUrls.map((url: string) => ({ url, revisedPrompt: '' }))
    }

    if (state === 'fail') {
      throw new Error(data.data.failMsg || 'Generation failed')
    }

    // Wait 3 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 3000))
  }

  throw new Error('Generation timeout')
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, imageUrl, aspectRatio = '3:4', resolution = '1K' } = await request.json() as GenerateRequest

    // Determine which model to use
    const useImg2Img = !!imageUrl
    const model = useImg2Img ? 'flux-2/flex-image-to-image' : 'flux-2/flex-text-to-image'

    // Build input based on model type
    const input: Record<string, any> = {
      prompt,
      aspect_ratio: aspectRatio,
      resolution,
      nsfw_checker: false,
    }

    if (useImg2Img) {
      // img2img requires input_urls (array of image URLs)
      input.input_urls = [imageUrl]
    }

    // Step 1: Create task
    const createResponse = await fetch(`${API_BASE}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
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

    // Step 2: Poll for results
    const images = await pollTaskStatus(taskId)

    return NextResponse.json({
      created: Date.now(),
      images,
    })
  } catch (error) {
    console.error('Generate API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}