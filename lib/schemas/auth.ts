import { z } from "zod"

export const phoneSchema = z
  .string()
  .regex(/^\+91[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")

export const otpSchema = z
  .string()
  .regex(/^\d{6}$/, "Enter the 6-digit code")

export const requestOtpSchema = z.object({ phone: phoneSchema })

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  otp: otpSchema,
})

export type RequestOtpInput = z.infer<typeof requestOtpSchema>
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>
