import "server-only"

import { randomInt } from "node:crypto"
import bcrypt from "bcryptjs"

export const OTP_TTL_MS = 5 * 60 * 1000
export const OTP_MAX_ATTEMPTS = 5
export const OTP_LENGTH = 6

export function generateOtp(): string {
  return String(randomInt(100000, 1000000))
}

export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10)
}

export async function verifyOtpHash(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash)
}

export function otpExpiry(fromMs: number = Date.now()): Date {
  return new Date(fromMs + OTP_TTL_MS)
}
