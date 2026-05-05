import { NextResponse, type NextRequest } from "next/server"

import { SESSION_COOKIE_NAME } from "@/lib/auth/session"

const PROTECTED_PREFIXES = ["/dsr", "/admin"]
const PUBLIC_PREFIXES = ["/login"]

function startsWithAny(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = startsWithAny(pathname, PROTECTED_PREFIXES)
  const isPublic = startsWithAny(pathname, PUBLIC_PREFIXES)

  // Optimistic check: cookie presence only. Full DB-backed validation
  // happens in the Data Access Layer (lib/auth/dal.ts) on each render
  // and inside every Server Action.
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value)

  if (isProtected && !hasSession) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (isPublic && hasSession) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
}
