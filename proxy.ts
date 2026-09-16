import { NextResponse, type NextRequest } from "next/server"

import { SESSION_COOKIE_NAME, SESSION_TTL_SEC } from "@/lib/auth/session"

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
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value

  if (isProtected && !sessionToken) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (isPublic && sessionToken) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  const response = NextResponse.next()

  // Slide the cookie's expiry forward on every navigation.
  //
  // The DAL already extends sessions.expires_at in the database as the user
  // browses, but the cookie itself was only ever written once, at login, with
  // a fixed SESSION_TTL_SEC lifetime. So the cookie hard-expired 7 days after
  // login no matter how active the user was, logging the whole team out
  // weekly. A cookie's expiry is not readable server-side, so there is
  // nothing to compare against and no way to refresh it selectively: re-issue
  // it on each pass-through. Attributes must stay identical to the ones set
  // in app/api/auth/verify-otp/route.ts or the browser stores a second,
  // conflicting cookie.
  //
  // This only extends the cookie. sessions.expires_at in the database stays
  // the authority on whether a session is still valid, so a revoked or
  // genuinely expired session is still rejected by the DAL.
  if (sessionToken) {
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SEC,
    })
  }

  return response
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
}
