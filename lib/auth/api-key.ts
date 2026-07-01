import "server-only"

import { createHash, timingSafeEqual } from "node:crypto"

// ---------------------------------------------------------------------------
// Outward data-API authentication.
//
// This is deliberately separate from the cookie/OTP session used by the web
// app (see lib/auth/dal.ts). Third parties consuming the visits API present a
// static bearer key instead of logging in. Configure one or more allowed keys
// via the DSR_API_KEY environment variable (comma-separated for rotation or
// per-consumer keys).
// ---------------------------------------------------------------------------

export type ApiAuthResult =
  | { ok: true }
  | { ok: false; status: number; code: string; message: string }

function loadAllowedKeys(): string[] {
  const raw = process.env.DSR_API_KEY
  if (!raw) return []
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
}

function extractPresentedKey(request: Request): string | null {
  const authHeader = request.headers.get("authorization")
  if (authHeader) {
    const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim())
    if (match) return match[1].trim()
  }
  const apiKeyHeader = request.headers.get("x-api-key")
  if (apiKeyHeader && apiKeyHeader.trim().length > 0) {
    return apiKeyHeader.trim()
  }
  return null
}

// Hash both sides to a fixed 32-byte digest before comparing. This keeps
// timingSafeEqual from ever seeing a length mismatch (which would throw and
// also leak the secret's length), while preserving constant-time comparison.
function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest()
}

function keyMatchesAny(presented: string, allowed: string[]): boolean {
  const presentedHash = sha256(presented)
  let matched = false
  for (const candidate of allowed) {
    if (timingSafeEqual(presentedHash, sha256(candidate))) {
      matched = true
      // No early break: keep total work independent of which key matched.
    }
  }
  return matched
}

export function authenticateApiRequest(request: Request): ApiAuthResult {
  const allowed = loadAllowedKeys()
  if (allowed.length === 0) {
    return {
      ok: false,
      status: 503,
      code: "api_not_configured",
      message:
        "The data API is not enabled on this server. Set DSR_API_KEY to enable it.",
    }
  }

  const presented = extractPresentedKey(request)
  if (!presented) {
    return {
      ok: false,
      status: 401,
      code: "missing_credentials",
      message:
        "Provide an API key via the 'Authorization: Bearer <key>' header or the 'x-api-key' header.",
    }
  }

  if (!keyMatchesAny(presented, allowed)) {
    return {
      ok: false,
      status: 401,
      code: "invalid_credentials",
      message: "The provided API key is not valid.",
    }
  }

  return { ok: true }
}
