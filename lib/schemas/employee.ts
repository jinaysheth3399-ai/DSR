import { z } from "zod"

import { phoneSchema } from "./auth"

export const employeeRoleSchema = z.enum(["field_sales", "admin"])

export const employeeBaseSchema = z.object({
  full_name: z.string().trim().min(1, "Required").max(100),
  phone: phoneSchema,
  employee_code: z.string().trim().min(1, "Required").max(30),
  role: employeeRoleSchema.default("field_sales"),
})

export type EmployeeInput = z.infer<typeof employeeBaseSchema>

export function normalizeIndianPhone(raw: string): string | null {
  const trimmed = raw.trim().replace(/[\s\-()]/g, "")
  if (/^\+91[6-9]\d{9}$/.test(trimmed)) return trimmed
  if (/^91[6-9]\d{9}$/.test(trimmed)) return `+${trimmed}`
  if (/^[6-9]\d{9}$/.test(trimmed)) return `+91${trimmed}`
  return null
}
