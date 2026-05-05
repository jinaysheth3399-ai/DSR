import "server-only"

import { logger } from "@/lib/logger"

export class SmsSendError extends Error {
  constructor(public readonly reason: string) {
    super(`SMS send failed: ${reason}`)
    this.name = "SmsSendError"
  }
}

// DLT-approved template — wording is locked. Only the OTP value is substituted.
function buildOtpMessage(otp: string): string {
  return `Dear customer, Your One Time Password is ${otp} to log in to your account. Rajyabharat`
}

export async function sendOtpSms(phone: string, otp: string): Promise<void> {
  const apiUrl = process.env.SMS_API_URL
  const apiUser = process.env.SMS_API_USER
  const apiKey = process.env.SMS_API_KEY
  const senderId = process.env.SMS_SENDER_ID

  if (!apiUrl || !apiUser || !apiKey || !senderId) {
    if (process.env.NODE_ENV === "production") {
      throw new SmsSendError("provider_not_configured")
    }
    if (process.env.DEV_BYPASS_OTP === "true") {
      // Only place the raw OTP is ever printed. Gated on env flag.
      console.warn(`[dev-sms] OTP for ${phone}: ${otp}`)
    } else {
      logger.warn(
        "[sms] OTP requested but provider not configured (set DEV_BYPASS_OTP=true to print OTPs in dev)"
      )
    }
    return
  }

  // Mobicomm/Dove-SMS expects digits without the leading "+".
  const apiPhone = phone.startsWith("+") ? phone.slice(1) : phone

  const params = new URLSearchParams({
    user: apiUser,
    key: apiKey,
    mobile: apiPhone,
    message: buildOtpMessage(otp),
    senderid: senderId,
    accusage: "1",
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)

  try {
    const res = await fetch(`${apiUrl}?${params.toString()}`, {
      method: "GET",
      signal: controller.signal,
    })

    const body = (await res.text()).trim()

    // Provider returns plain text. Success looks like "sent,success,<msgid>...".
    if (!res.ok || !body.toLowerCase().startsWith("sent,success")) {
      // Truncate body so we don't spill anything weird into logs.
      throw new SmsSendError(`provider_response: ${body.slice(0, 120)}`)
    }
  } catch (err) {
    if (err instanceof SmsSendError) throw err
    if (err instanceof Error && err.name === "AbortError") {
      throw new SmsSendError("timeout")
    }
    throw new SmsSendError("network_error")
  } finally {
    clearTimeout(timer)
  }
}
