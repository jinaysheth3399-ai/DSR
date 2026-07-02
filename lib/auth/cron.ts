import "server-only"

import { createHash, timingSafeEqual } from "node:crypto"

// ---------------------------------------------------------------------------
// Auth for internal scheduled endpoints (e.g. the weekly visits report).
// Vercel Cron automatically sends `Authorization: Bearer $CRON_SECRET` when
// the CRON_SECRET env var is set on the project, so a route protected here
// works both for Vercel's own trigger and for manual/test invocations that
// present the same secret.
// ---------------------------------------------------------------------------

export type CronAuthResult =
  | { ok: true }
  | { ok: false; status: number; code: string; message: string }

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest()
}

export function authenticateCronRequest(request: Request): CronAuthResult {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return {
      ok: false,
      status: 503,
      code: "cron_not_configured",
      message: "Set CRON_SECRET in the server environment to enable this endpoint.",
    }
  }

  const authHeader = request.headers.get("authorization")
  const match = authHeader ? /^Bearer\s+(.+)$/i.exec(authHeader.trim()) : null
  const presented = match ? match[1].trim() : null

  if (!presented || presented.length === 0) {
    return {
      ok: false,
      status: 401,
      code: "missing_credentials",
      message: "Provide the cron secret via the 'Authorization: Bearer <secret>' header.",
    }
  }

  if (!timingSafeEqual(sha256(presented), sha256(secret))) {
    return {
      ok: false,
      status: 401,
      code: "invalid_credentials",
      message: "The provided cron secret is not valid.",
    }
  }

  return { ok: true }
}
