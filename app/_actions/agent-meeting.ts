"use server"

import { redirect } from "next/navigation"

import { requireUser } from "@/lib/auth/dal"
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

  // Server-side navigation — throws NEXT_REDIRECT, never returns.
  redirect("/dsr/karan/success")
}
