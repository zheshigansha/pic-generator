import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'visionfit_session'

function isPublicPath(pathname: string) {
  return (
    pathname === '/login' ||
    pathname === '/api/auth/login' ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  )
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const accessPassword = process.env.APP_ACCESS_PASSWORD
  const sessionSecret = process.env.APP_SESSION_SECRET

  if (!accessPassword || !sessionSecret) {
    if (process.env.NODE_ENV === 'production') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Application access control is not configured' },
          { status: 503 }
        )
      }
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('setup', '1')
      return NextResponse.redirect(url)
    }

    return NextResponse.next()
  }

  const session = request.cookies.get(SESSION_COOKIE)?.value
  if (session === sessionSecret) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('next', `${pathname}${search}`)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
