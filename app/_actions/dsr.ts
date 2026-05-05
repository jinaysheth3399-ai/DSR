"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireUser } from "@/lib/auth/dal"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import {
  STEPS,
  dsrFormSchema,
  type DsrFormValues,
  type StepKey,
} from "@/lib/schemas/dsr"
import { logger } from "@/lib/logger"

function todayInIst(): string {
  // Returns YYYY-MM-DD in Asia/Kolkata regardless of server timezone.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

export type LoadedDraft = {
  payload: Record<string, unknown>
  currentStep: StepKey
  updatedAt: string
}

export async function loadDraft(): Promise<LoadedDraft | null> {
  const user = await requireUser()
  const sb = getSupabaseAdmin()
  const { data } = await sb
    .from("dsr_drafts")
    .select("payload, current_step, updated_at")
    .eq("employee_id", user.employee_id)
    .maybeSingle()
  if (!data) return null
  return {
    payload: (data.payload as Record<string, unknown>) ?? {},
    currentStep: data.current_step as StepKey,
    updatedAt: data.updated_at as string,
  }
}

export async function saveDraft(
  payload: unknown,
  currentStep: StepKey
): Promise<{ ok: true; updatedAt: string } | { ok: false; error: string }> {
  const user = await requireUser()
  if (!STEPS.includes(currentStep)) {
    return { ok: false, error: "invalid_step" }
  }
  const sb = getSupabaseAdmin()
  const updatedAt = new Date().toISOString()
  const { error } = await sb
    .from("dsr_drafts")
    .upsert(
      {
        employee_id: user.employee_id,
        payload: (payload as object) ?? {},
        current_step: currentStep,
        updated_at: updatedAt,
      },
      { onConflict: "employee_id" }
    )
  if (error) {
    logger.error("[dsr] saveDraft failed", { code: error.code, msg: error.message })
    return { ok: false, error: "db_error" }
  }
  return { ok: true, updatedAt }
}

export async function discardDraft(): Promise<{ ok: true }> {
  const user = await requireUser()
  const sb = getSupabaseAdmin()
  await sb.from("dsr_drafts").delete().eq("employee_id", user.employee_id)
  return { ok: true }
}

// On success, the action calls redirect() and never returns. The Promise
// resolves only on failure, with one of these error shapes.
export type SubmitDsrResult = {
  ok: false
  error: "validation_failed" | "db_error"
  issues?: Array<{ path: string; message: string }>
}

export async function submitDsr(
  rawPayload: unknown
): Promise<SubmitDsrResult | undefined> {
  const user = await requireUser()

  const parsed = dsrFormSchema.safeParse(rawPayload)
  if (!parsed.success) {
    return {
      ok: false,
      error: "validation_failed",
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    }
  }

  const data: DsrFormValues = parsed.data
  const sb = getSupabaseAdmin()

  // Apply XOR cleanup: only the field appropriate to the variant is sent;
  // the other is set null. This satisfies the agency_xor / *_credit_xor /
  // *_escalation_xor check constraints.
  const row = {
    submitted_by: user.employee_id,
    visit_date: todayInIst(),

    agent_type: data.agent_type,
    agency_code: data.agent_type === "registered" ? data.agency_code : null,
    agency_name: data.agent_type === "new" ? data.agency_name : null,

    flight_escalation_has_ref: data.flight_escalation_has_ref,
    flight_escalation_booking_id: data.flight_escalation_has_ref
      ? data.flight_escalation_booking_id
      : null,
    flight_monthly_txn_lakhs: data.flight_monthly_txn_lakhs,
    flight_domestic_portals: data.flight_domestic_portals,
    flight_international_portals: data.flight_international_portals,
    flight_issue_complaint: data.flight_issue_complaint,
    flight_agent_mode: data.flight_agent_mode,
    flight_dealing_type: data.flight_dealing_type,
    flight_client_type: data.flight_client_type,
    flight_payment_mode: data.flight_payment_mode,
    flight_credit_type:
      data.flight_payment_mode === "Credit" ? data.flight_credit_type : null,

    hotel_escalation_has_ref: data.hotel_escalation_has_ref,
    hotel_escalation_booking_id: data.hotel_escalation_has_ref
      ? data.hotel_escalation_booking_id
      : null,
    hotel_monthly_room_nights_other: data.hotel_monthly_room_nights_other,
    hotel_current_room_nights_etrav: data.hotel_current_room_nights_etrav,
    hotel_primary_platform: data.hotel_primary_platform,
    hotel_committed_room_nights: data.hotel_committed_room_nights,
    hotel_category_preference: data.hotel_category_preference,
    hotel_issue_complaint: data.hotel_issue_complaint || null,

    dmc_escalation_has_ref: data.dmc_escalation_has_ref,
    dmc_escalation_booking_id: data.dmc_escalation_has_ref
      ? data.dmc_escalation_booking_id
      : null,
    dmc_destination_discussed: data.dmc_destination_discussed,
    dmc_agent_active: data.dmc_agent_active,
    dmc_current_vendor: data.dmc_current_vendor,
    dmc_current_vendor_pax: data.dmc_current_vendor_pax,
    dmc_lead_interest: data.dmc_lead_interest,
    dmc_committed_pax: data.dmc_committed_pax,
    dmc_objection: data.dmc_objection,

    visit_outcome: data.visit_outcome,
    visit_commitment: data.visit_commitment,
  }

  const { data: inserted, error } = await sb
    .from("dsr_submissions")
    .insert(row)
    .select("id")
    .single()

  if (error || !inserted) {
    logger.error("[dsr] submission insert failed", {
      code: error?.code,
      msg: error?.message,
    })
    return { ok: false, error: "db_error" }
  }

  await sb.from("dsr_drafts").delete().eq("employee_id", user.employee_id)

  // Invalidate admin caches so the new row shows up on next visit.
  revalidatePath("/admin/submissions")
  revalidatePath("/admin")

  // Server-side navigation — throws NEXT_REDIRECT, never returns.
  redirect("/dsr/success")
}
