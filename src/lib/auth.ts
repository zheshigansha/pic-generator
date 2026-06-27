import { NextRequest } from 'next/server'

const SESSION_COOKIE = 'visionfit_session'

export function verifySession(request: NextRequest): boolean {
  const sessionSecret = process.env.APP_SESSION_SECRET
  if (!sessionSecret) return false

  const cookieHeader = request.headers.get('cookie') || ''
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [key, ...val] = c.trim().split('=')
      return [key, val.join('=')]
    })
  )

  return cookies[SESSION_COOKIE] === sessionSecret
}