import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
export function middleware(req: NextRequest) {
  const url = req.nextUrl
  if (url.pathname === '/sdk') {
    url.pathname = '/sdkupload'
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}
export const config = { matcher: ['/sdk'] }
