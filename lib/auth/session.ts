import "server-only"

import { randomBytes, createHash } from "node:crypto"

export const SESSION_COOKIE_NAME = "dsr_session"
export const SESSION_TTL_SEC = 60 * 60 * 24 * 7
export const SLIDING_REFRESH_THRESHOLD_SEC = 5 * 60

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex")
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function sessionExpiry(fromMs: number = Date.now()): Date {
  return new Date(fromMs + SESSION_TTL_SEC * 1000)
}
