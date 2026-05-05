import { NextResponse, type NextRequest } from "next/server"

import { requestOtpSchema } from "@/lib/schemas/auth"
import { requestOtp } from "@/lib/auth/flows"

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

  const parsed = requestOtpSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_phone" },
      { status: 400 }
    )
  }

  // TODO(open-item): per plan §1, this endpoint must be rate-limited per-IP and
  // per-phone before going to production. Held until Jinay confirms the policy.

  const result = await requestOtp(parsed.data.phone, {
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
  })

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 502 }
    )
  }
  return NextResponse.json({ ok: true })
}
