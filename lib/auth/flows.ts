import "server-only"

import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { sendOtpSms, SmsSendError } from "@/lib/sms/send"
import { logger } from "@/lib/logger"
import {
  OTP_MAX_ATTEMPTS,
  generateOtp,
  hashOtp,
  otpExpiry,
  verifyOtpHash,
} from "./otp"
import {
  generateSessionToken,
  hashSessionToken,
  sessionExpiry,
} from "./session"
import type { EmployeeRole } from "./dal"

export type RequestOtpResult =
  | { ok: true }
  | { ok: false; error: "send_failed" }

export async function requestOtp(
  phone: string,
  ctx?: { ip?: string; userAgent?: string }
): Promise<RequestOtpResult> {
  const sb = getSupabaseAdmin()

  const { data: employee } = await sb
    .from("employees")
    .select("id, is_active")
    .eq("phone", phone)
    .maybeSingle()

  // Anti-enumeration: behave the same regardless of whether the phone is
  // whitelisted. Caller always sees ok; SMS is only actually sent for
  // active whitelisted phones.
  if (!employee || !employee.is_active) {
    logger.info("[otp] request for non-whitelisted phone (silently dropped)")
    return { ok: true }
  }

  // Invalidate any earlier un-consumed OTPs for this phone — one-OTP-at-a-time.
  await sb
    .from("otp_requests")
    .update({ consumed_at: new Date().toISOString() })
    .eq("phone", phone)
    .is("consumed_at", null)

  const otp = generateOtp()
  const otpHashValue = await hashOtp(otp)

  const { error: insertErr } = await sb.from("otp_requests").insert({
    phone,
    otp_hash: otpHashValue,
    expires_at: otpExpiry().toISOString(),
  })

  if (insertErr) {
    logger.error("[otp] insert failed", { code: insertErr.code, msg: insertErr.message })
    return { ok: false, error: "send_failed" }
  }

  try {
    await sendOtpSms(phone, otp)
  } catch (err) {
    if (err instanceof SmsSendError) {
      logger.error("[otp] sms send failed", { reason: err.reason })
    } else {
      logger.error("[otp] sms send failed", { unknown: true })
    }
    return { ok: false, error: "send_failed" }
  }

  // Best-effort metadata for the row (don't fail the flow on it).
  if (ctx?.ip || ctx?.userAgent) {
    void sb // no-op; otp_requests doesn't store ua/ip in schema. Reserved for future.
  }

  return { ok: true }
}

export type VerifyOtpResult =
  | { ok: true; role: EmployeeRole; sessionToken: string; expiresAt: Date }
  | {
      ok: false
      error: "expired_or_invalid" | "too_many_attempts" | "invalid"
    }

export async function verifyOtp(
  phone: string,
  otp: string,
  ctx?: { ip?: string; userAgent?: string }
): Promise<VerifyOtpResult> {
  const sb = getSupabaseAdmin()

  const { data: otpRow } = await sb
    .from("otp_requests")
    .select("id, otp_hash, attempt_count, expires_at, consumed_at")
    .eq("phone", phone)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!otpRow) return { ok: false, error: "expired_or_invalid" }

  if (otpRow.attempt_count >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "too_many_attempts" }
  }

  const matches = await verifyOtpHash(otp, otpRow.otp_hash)
  if (!matches) {
    // Note: read-modify-write is acceptable at our concurrency (≤30 users).
    // For higher concurrency, switch to an rpc that does
    // `update ... set attempt_count = attempt_count + 1`.
    await sb
      .from("otp_requests")
      .update({ attempt_count: otpRow.attempt_count + 1 })
      .eq("id", otpRow.id)
    return { ok: false, error: "invalid" }
  }

  await sb
    .from("otp_requests")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", otpRow.id)

  const { data: employee } = await sb
    .from("employees")
    .select("id, role, is_active")
    .eq("phone", phone)
    .maybeSingle()

  if (!employee || !employee.is_active) {
    return { ok: false, error: "invalid" }
  }

  const token = generateSessionToken()
  const tokenHash = hashSessionToken(token)
  const expiresAt = sessionExpiry()

  const { error: sessionErr } = await sb.from("sessions").insert({
    employee_id: employee.id,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
    user_agent: ctx?.userAgent ?? null,
    ip: ctx?.ip ?? null,
  })

  if (sessionErr) {
    logger.error("[session] create failed", { code: sessionErr.code, msg: sessionErr.message })
    return { ok: false, error: "invalid" }
  }

  return {
    ok: true,
    role: employee.role as EmployeeRole,
    sessionToken: token,
    expiresAt,
  }
}
