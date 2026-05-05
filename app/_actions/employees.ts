"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth/dal"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import {
  employeeBaseSchema,
  employeeRoleSchema,
  normalizeIndianPhone,
} from "@/lib/schemas/employee"
import { logger } from "@/lib/logger"

export type EmployeeRow = {
  id: string
  full_name: string
  phone: string
  employee_code: string
  role: "field_sales" | "admin"
  is_active: boolean
  created_at: string
}

export async function listEmployees(): Promise<EmployeeRow[]> {
  await requireAdmin()
  const sb = getSupabaseAdmin()
  const { data } = await sb
    .from("employees")
    .select("id, full_name, phone, employee_code, role, is_active, created_at")
    .order("created_at", { ascending: false })
  return (data ?? []).map((e) => ({
    id: e.id as string,
    full_name: e.full_name as string,
    phone: e.phone as string,
    employee_code: e.employee_code as string,
    role: e.role as "field_sales" | "admin",
    is_active: e.is_active as boolean,
    created_at: e.created_at as string,
  }))
}

export async function createEmployee(input: unknown) {
  await requireAdmin()
  const parsed = employeeBaseSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "validation_failed" as const,
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    }
  }
  const sb = getSupabaseAdmin()
  const { error } = await sb.from("employees").insert(parsed.data)
  if (error) {
    if (error.code === "23505") {
      return { ok: false as const, error: "duplicate" as const }
    }
    logger.error("[admin] createEmployee failed", { code: error.code })
    return { ok: false as const, error: "db_error" as const }
  }
  revalidatePath("/admin/employees")
  return { ok: true as const }
}

const updateSchema = employeeBaseSchema.extend({
  id: z.string().uuid(),
  is_active: z.boolean().optional(),
})

export async function updateEmployee(input: unknown) {
  await requireAdmin()
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "validation_failed" as const,
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    }
  }
  const { id, ...update } = parsed.data
  const sb = getSupabaseAdmin()
  const { error } = await sb.from("employees").update(update).eq("id", id)
  if (error) {
    if (error.code === "23505") {
      return { ok: false as const, error: "duplicate" as const }
    }
    logger.error("[admin] updateEmployee failed", { code: error.code })
    return { ok: false as const, error: "db_error" as const }
  }
  revalidatePath("/admin/employees")
  return { ok: true as const }
}

export async function deleteEmployee(id: string) {
  const me = await requireAdmin()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false as const, error: "invalid_id" as const }
  }
  if (id === me.employee_id) {
    return { ok: false as const, error: "cannot_delete_self" as const }
  }
  const sb = getSupabaseAdmin()
  const { error } = await sb.from("employees").delete().eq("id", id)
  if (error) {
    // 23503 = foreign_key_violation (employee has submissions and FK is RESTRICT)
    if (error.code === "23503") {
      return { ok: false as const, error: "has_submissions" as const }
    }
    logger.error("[admin] deleteEmployee failed", { code: error.code })
    return { ok: false as const, error: "db_error" as const }
  }
  revalidatePath("/admin/employees")
  return { ok: true as const }
}

// ---------------------------------------------------------------------------
// Bulk upload — two-stage: preview validates, commit inserts.
// ---------------------------------------------------------------------------

const rawRowSchema = z.object({
  full_name: z.string(),
  phone: z.string(),
  employee_code: z.string(),
  role: z.string().optional(),
})

export type BulkPreviewRow = {
  index: number
  raw: { full_name: string; phone: string; employee_code: string; role?: string }
  ok: boolean
  normalized?: {
    full_name: string
    phone: string
    employee_code: string
    role: "field_sales" | "admin"
  }
  errors: string[]
}

export async function bulkPreviewEmployees(rawRows: unknown[]) {
  await requireAdmin()
  const sb = getSupabaseAdmin()

  // Snapshot of existing phones + codes to flag dupes against DB.
  const { data: existing } = await sb
    .from("employees")
    .select("phone, employee_code")
  const existingPhones = new Set(
    (existing ?? []).map((r) => r.phone as string)
  )
  const existingCodes = new Set(
    (existing ?? []).map((r) => r.employee_code as string)
  )

  const seenPhones = new Set<string>()
  const seenCodes = new Set<string>()
  const out: BulkPreviewRow[] = []

  rawRows.forEach((raw, index) => {
    const errors: string[] = []
    const parsed = rawRowSchema.safeParse(raw)
    if (!parsed.success) {
      out.push({
        index,
        raw: (raw as BulkPreviewRow["raw"]) ?? {
          full_name: "",
          phone: "",
          employee_code: "",
        },
        ok: false,
        errors: ["Missing or malformed columns"],
      })
      return
    }
    const r = parsed.data
    const fullName = r.full_name.trim()
    const code = r.employee_code.trim()
    const phone = normalizeIndianPhone(r.phone)
    const role: "field_sales" | "admin" =
      r.role && r.role.toLowerCase() === "admin" ? "admin" : "field_sales"

    if (!fullName) errors.push("Missing full name")
    if (!code) errors.push("Missing employee code")
    if (!phone) errors.push("Invalid phone")
    if (phone && existingPhones.has(phone)) errors.push("Phone already in DB")
    if (code && existingCodes.has(code)) errors.push("Employee code already in DB")
    if (phone && seenPhones.has(phone)) errors.push("Duplicate phone in upload")
    if (code && seenCodes.has(code)) errors.push("Duplicate employee code in upload")
    if (employeeRoleSchema.safeParse(role).success === false) errors.push("Invalid role")

    const ok = errors.length === 0
    if (ok && phone) {
      seenPhones.add(phone)
      seenCodes.add(code)
    }

    out.push({
      index,
      raw: { full_name: r.full_name, phone: r.phone, employee_code: r.employee_code, role: r.role },
      ok,
      normalized: ok && phone
        ? { full_name: fullName, phone, employee_code: code, role }
        : undefined,
      errors,
    })
  })

  const validCount = out.filter((r) => r.ok).length
  return { rows: out, validCount, invalidCount: out.length - validCount }
}

export async function bulkCommitEmployees(rawRows: unknown[]) {
  await requireAdmin()
  const preview = await bulkPreviewEmployees(rawRows)
  const valid = preview.rows.filter((r) => r.ok && r.normalized)
  if (valid.length === 0) {
    return { ok: false as const, error: "nothing_to_insert" as const }
  }
  // Re-check no new collisions snuck in between preview and commit.
  if (preview.invalidCount > 0) {
    return {
      ok: false as const,
      error: "preview_has_errors" as const,
      preview,
    }
  }

  const sb = getSupabaseAdmin()
  const { error } = await sb
    .from("employees")
    .insert(valid.map((v) => v.normalized!))
  if (error) {
    logger.error("[admin] bulkCommit failed", { code: error.code, msg: error.message })
    return { ok: false as const, error: "db_error" as const }
  }
  revalidatePath("/admin/employees")
  return { ok: true as const, inserted: valid.length }
}
