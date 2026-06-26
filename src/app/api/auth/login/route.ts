import { NextRequest, NextResponse } from 'next/server'
import { getClientKey, rateLimit } from '@/lib/rate-limit'

const SESSION_COOKIE = 'visionfit_session'

export async function POST(request: NextRequest) {
  const accessPassword = process.env.APP_ACCESS_PASSWORD
  const sessionSecret = process.env.APP_SESSION_SECRET

  if (!accessPassword || !sessionSecret) {
    return NextResponse.json(
      { error: 'Application access control is not configured' },
      { status: 503 }
    )
  }

  const limited = rateLimit(getClientKey(request, 'login'), 10, 60_000)
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Too many login attempts' },
      {
        status: 429,
        headers: { 'Retry-After': String(limited.retryAfter) },
      }
    )
  }

  const body = await request.json().catch(() => ({})) as { password?: string }
  if (body.password !== accessPassword) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE, sessionSecret, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  })
  return response
}
