import { NextRequest, NextResponse } from 'next/server'
import { getClientKey, rateLimit } from '@/lib/rate-limit'

const DEFAULT_API_BASE = 'https://api.kie.ai'

function getApiBase() {
  return process.env.FLUX_BASE_URL || DEFAULT_API_BASE
}

function parseResultUrls(resultJson: string) {
  const parsed = JSON.parse(resultJson) as { resultUrls?: unknown }
  if (!Array.isArray(parsed.resultUrls)) {
    throw new Error('Invalid generation result')
  }

  return parsed.resultUrls
    .filter((url): url is string => typeof url === 'string' && /^https?:\/\//i.test(url))
    .map(url => ({ url, revisedPrompt: '' }))
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.FLUX_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'FLUX API key is not configured' }, { status: 503 })
  }

  const limited = rateLimit(getClientKey(request, 'generate-status'), 120, 60_000)
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Too many status requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(limited.retryAfter) },
      }
    )
  }

  const taskId = request.nextUrl.searchParams.get('taskId')
  if (!taskId || !/^[a-zA-Z0-9_-]{8,128}$/.test(taskId)) {
    return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
  }

  const response = await fetch(`${getApiBase()}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })

  if (!response.ok) {
    return NextResponse.json({ error: `FLUX status error: ${response.status}` }, { status: response.status })
  }

  const data = await response.json()
  if (data.code !== 200) {
    return NextResponse.json({ error: data.msg || 'Query failed' }, { status: 502 })
  }

  const state = data.data?.state
  if (state === 'success') {
    return NextResponse.json({ state, images: parseResultUrls(data.data.resultJson) })
  }

  if (state === 'fail') {
    return NextResponse.json({ state, error: data.data?.failMsg || 'Generation failed' }, { status: 502 })
  }

  return NextResponse.json({ state: state || 'running' })
}
