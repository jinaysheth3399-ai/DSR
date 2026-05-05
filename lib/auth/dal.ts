import "server-only"

import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { getSupabaseAdmin } from "@/lib/supabase/admin"
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SEC,
  SLIDING_REFRESH_THRESHOLD_SEC,
  hashSessionToken,
} from "./session"

export type EmployeeRole = "field_sales" | "admin"

export type CurrentUser = {
  employee_id: string
  role: EmployeeRole
  full_name: string
  phone: string
  employee_code: string
  session_id: string
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const tokenHash = hashSessionToken(token)
  const sb = getSupabaseAdmin()

  const { data: session, error: sessionErr } = await sb
    .from("sessions")
    .select("id, employee_id, expires_at, last_seen_at")
    .eq("token_hash", tokenHash)
    .maybeSingle()

  if (sessionErr || !session) return null
  if (new Date(session.expires_at).getTime() <= Date.now()) return null

  const { data: employee, error: empErr } = await sb
    .from("employees")
    .select("id, full_name, phone, employee_code, role, is_active")
    .eq("id", session.employee_id)
    .maybeSingle()

  if (empErr || !employee || !employee.is_active) return null

  const lastSeenMs = new Date(session.last_seen_at).getTime()
  if (Date.now() - lastSeenMs > SLIDING_REFRESH_THRESHOLD_SEC * 1000) {
    const nowIso = new Date().toISOString()
    const newExpiresIso = new Date(Date.now() + SESSION_TTL_SEC * 1000).toISOString()
    void sb
      .from("sessions")
      .update({ last_seen_at: nowIso, expires_at: newExpiresIso })
      .eq("id", session.id)
      .then(() => undefined)
  }

  return {
    employee_id: employee.id,
    role: employee.role as EmployeeRole,
    full_name: employee.full_name,
    phone: employee.phone,
    employee_code: employee.employee_code,
    session_id: session.id,
  }
})

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  return user
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser()
  if (user.role !== "admin") redirect("/")
  return user
}
