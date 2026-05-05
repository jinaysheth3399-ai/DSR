import { NextResponse, type NextRequest } from "next/server"
import { cookies } from "next/headers"

import { verifyOtpSchema } from "@/lib/schemas/auth"
import { verifyOtp } from "@/lib/auth/flows"
import { SESSION_COOKIE_NAME, SESSION_TTL_SEC } from "@/lib/auth/session"

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 }
    )
  }

  const parsed = verifyOtpSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_input" },
      { status: 400 }
    )
  }

  // TODO(open-item): per plan §1, rate-limit per-IP and per-phone here.

  const result = await verifyOtp(parsed.data.phone, parsed.data.otp, {
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
  })

  if (!result.ok) {
    const status = result.error === "too_many_attempts" ? 429 : 401
    return NextResponse.json(
      { ok: false, error: result.error },
      { status }
    )
  }

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, result.sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SEC,
    expires: result.expiresAt,
  })

  return NextResponse.json({ ok: true, role: result.role })
}
