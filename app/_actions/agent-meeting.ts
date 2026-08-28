"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { requireAdmin, requireUser } from "@/lib/auth/dal"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import {
  AGENT_MEETING_EMPLOYEE_CODE,
  agentMeetingFormSchema,
  type AgentMeetingFormValues,
} from "@/lib/schemas/agent-meeting"
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

// On success, the action calls redirect() and never returns. The Promise
// resolves only on failure, with one of these error shapes.
export type SubmitAgentMeetingResult = {
  ok: false
  error: "forbidden" | "validation_failed" | "db_error"
  issues?: Array<{ path: string; message: string }>
}

export async function submitAgentMeeting(
  rawPayload: unknown
): Promise<SubmitAgentMeetingResult | undefined> {
  const user = await requireUser()
  if (user.employee_code !== AGENT_MEETING_EMPLOYEE_CODE) {
    return { ok: false, error: "forbidden" }
  }

  const parsed = agentMeetingFormSchema.safeParse(rawPayload)
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

  const data: AgentMeetingFormValues = parsed.data
  const sb = getSupabaseAdmin()

  const { data: inserted, error } = await sb
    .from("agent_meeting_reports")
    .insert({
      submitted_by: user.employee_id,
      visit_date: todayInIst(),
      travel_agent_name: data.travel_agent_name,
      agent_code: data.agent_code,
      city: data.city,
      business_aspect: data.business_aspect,
      current_challenges: data.current_challenges,
      meeting_summary: data.meeting_summary,
      potential_queries: data.potential_queries,
      destinations_interested: data.destinations_interested,
    })
    .select("id")
    .single()

  if (error || !inserted) {
    logger.error("[agent-meeting] insert failed", {
      code: error?.code,
      msg: error?.message,
    })
    return { ok: false, error: "db_error" }
  }

  // Server-side navigation: throws NEXT_REDIRECT, never returns.
  redirect("/dsr/karan/success")
}

// ---------------------------------------------------------------------------
// Admin read: a single meeting report by id (for app/(authed)/admin/submissions/meeting/[id])
// ---------------------------------------------------------------------------

export type AgentMeetingDetail = {
  id: string
  visit_date: string
  travel_agent_name: string
  agent_code: string
  city: string
  business_aspect: string
  current_challenges: string
  meeting_summary: string
  potential_queries: string
  destinations_interested: string[]
  created_at: string
  submitter_name: string
  submitter_code: string
}

export async function getAgentMeetingReport(id: string): Promise<AgentMeetingDetail | null> {
  await requireAdmin()
  if (!z.string().uuid().safeParse(id).success) return null

  const sb = getSupabaseAdmin()
  const { data: row } = await sb
    .from("agent_meeting_reports")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (!row) return null

  const { data: emp } = await sb
    .from("employees")
    .select("full_name, employee_code")
    .eq("id", row.submitted_by as string)
    .maybeSingle()

  return {
    id: row.id as string,
    visit_date: row.visit_date as string,
    travel_agent_name: row.travel_agent_name as string,
    agent_code: row.agent_code as string,
    city: row.city as string,
    business_aspect: row.business_aspect as string,
    current_challenges: row.current_challenges as string,
    meeting_summary: row.meeting_summary as string,
    potential_queries: row.potential_queries as string,
    destinations_interested: (row.destinations_interested as string[] | null) ?? [],
    created_at: row.created_at as string,
    submitter_name: emp?.full_name ?? "(deleted)",
    submitter_code: emp?.employee_code ?? "—",
  }
}
