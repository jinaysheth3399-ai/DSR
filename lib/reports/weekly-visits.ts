import "server-only"

import { formatInTimeZone, toZonedTime } from "date-fns-tz"
import { addDays, startOfWeek } from "date-fns"

import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { logger } from "@/lib/logger"

// ---------------------------------------------------------------------------
// Weekly visits report: one row per visit for a given date range, shaped for
// the "employee number / name / date / agent" report requested by ops.
// All week-boundary math is done in IST (visit_date is already an IST
// calendar date, see docs/visits-api.md).
// ---------------------------------------------------------------------------

const REPORT_TZ = "Asia/Kolkata"

export type ReportRow = {
  employee_code: string
  employee_name: string
  visit_date: string
  agent: string
}

// Monday through Saturday of the week containing `now` (IST).
export function currentReportWeekRange(now: Date = new Date()): {
  dateFrom: string
  dateTo: string
} {
  const zoned = toZonedTime(now, REPORT_TZ)
  const monday = startOfWeek(zoned, { weekStartsOn: 1 })
  const saturday = addDays(monday, 5)
  return {
    dateFrom: formatInTimeZone(monday, REPORT_TZ, "yyyy-MM-dd"),
    dateTo: formatInTimeZone(saturday, REPORT_TZ, "yyyy-MM-dd"),
  }
}

export type ListReportRowsResult =
  | { ok: true; rows: ReportRow[] }
  | { ok: false; error: string }

export async function listReportRows(
  dateFrom: string,
  dateTo: string
): Promise<ListReportRowsResult> {
  const sb = getSupabaseAdmin()

  const { data, error } = await sb
    .from("dsr_submissions")
    .select("submitted_by, visit_date, agency_code, agency_name")
    .gte("visit_date", dateFrom)
    .lte("visit_date", dateTo)
    .order("visit_date", { ascending: true })

  if (error) {
    logger.error("[reports] listReportRows failed", { code: error.code, msg: error.message })
    return { ok: false, error: "db_error" }
  }

  const rows = (data ?? []) as Array<{
    submitted_by: string
    visit_date: string
    agency_code: string | null
    agency_name: string | null
  }>

  const employeeIds = [...new Set(rows.map((r) => r.submitted_by))]
  const employees = new Map<string, { name: string; code: string }>()
  if (employeeIds.length > 0) {
    const { data: emps, error: empError } = await sb
      .from("employees")
      .select("id, full_name, employee_code")
      .in("id", employeeIds)
    if (empError) {
      logger.error("[reports] employee lookup failed", {
        code: empError.code,
        msg: empError.message,
      })
      return { ok: false, error: "db_error" }
    }
    for (const e of emps ?? []) {
      employees.set(e.id as string, {
        name: e.full_name as string,
        code: e.employee_code as string,
      })
    }
  }

  const result: ReportRow[] = rows.map((r) => {
    const emp = employees.get(r.submitted_by)
    return {
      employee_code: emp?.code ?? "(unknown)",
      employee_name: emp?.name ?? "(unknown)",
      visit_date: r.visit_date,
      agent: r.agency_code ?? r.agency_name ?? "(unknown)",
    }
  })

  // Group by date, then by employee within each date, so one person's visits
  // for a day are contiguous rather than interleaved with other employees'.
  result.sort((a, b) => {
    if (a.visit_date !== b.visit_date) return a.visit_date < b.visit_date ? -1 : 1
    if (a.employee_name !== b.employee_name) return a.employee_name.localeCompare(b.employee_name)
    return a.employee_code.localeCompare(b.employee_code)
  })

  return { ok: true, rows: result }
}
