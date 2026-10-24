"use server"

import { z } from "zod"

import { requireAdmin } from "@/lib/auth/dal"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { VISIT_OUTCOMES } from "@/lib/schemas/dsr"
import { logger } from "@/lib/logger"

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

const filterSchema = z
  .object({
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    submitted_by: z.string().uuid().optional(),
    outcome: z.enum(VISIT_OUTCOMES).optional(),
    has_lead: z.enum(["true", "false"]).optional(),
    agency: z.string().trim().min(1).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(10).max(200).default(50),
  })
  .partial({
    page: true,
    pageSize: true,
  })

export type SubmissionFilters = z.infer<typeof filterSchema>

export type SubmissionListRow = {
  id: string
  // "dsr" = a dsr_submissions row; "agent_meeting" = an agent_meeting_reports
  // row (see app/_actions/agent-meeting.ts). The two tables have unrelated
  // shapes, so list rows carry only the fields both can show; view the
  // record's own detail page for the rest.
  source: "dsr" | "agent_meeting"
  visit_date: string
  agent_label: string
  agent_sublabel: string
  visit_outcome: "Positive" | "Neutral" | "Negative" | null
  dmc_lead_interest: boolean | null
  created_at: string
  submitter_name: string
  submitter_code: string
}

export type SubmissionListPage = {
  rows: SubmissionListRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// The supabase-js builder generics are deeply parameterised; chaining filters
// across reassignments confuses TS. Using `any` here keeps the chain simple
// while preserving the typed select() shape on the consumer side.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(q: any, filters: SubmissionFilters): any {
  let out = q
  if (filters.date_from) out = out.gte("visit_date", filters.date_from)
  if (filters.date_to) out = out.lte("visit_date", filters.date_to)
  if (filters.submitted_by) out = out.eq("submitted_by", filters.submitted_by)
  if (filters.outcome) out = out.eq("visit_outcome", filters.outcome)
  if (filters.has_lead === "true") out = out.eq("dmc_lead_interest", true)
  if (filters.has_lead === "false") out = out.eq("dmc_lead_interest", false)
  if (filters.agency) {
    const a = filters.agency.replace(/[%_,]/g, "")
    out = out.or(`agency_code.ilike.%${a}%,agency_name.ilike.%${a}%`)
  }
  return out
}

// agent_meeting_reports has no outcome/lead concept, so a row can never match
// those filters, so callers should skip fetching this table entirely when
// either is set, rather than translating them here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyMeetingFilters(q: any, filters: SubmissionFilters): any {
  let out = q
  if (filters.date_from) out = out.gte("visit_date", filters.date_from)
  if (filters.date_to) out = out.lte("visit_date", filters.date_to)
  if (filters.submitted_by) out = out.eq("submitted_by", filters.submitted_by)
  if (filters.agency) {
    const a = filters.agency.replace(/[%_,]/g, "")
    out = out.or(`travel_agent_name.ilike.%${a}%,agent_code.ilike.%${a}%`)
  }
  return out
}

// PostgREST caps any single response at its configured max-rows (1000 on
// this project). Merging two tables into one paginated, sorted list only
// needs the top `limit` rows from EACH source, sorted the same way at the DB
// level: taking the top-`limit` of two sorted partitions and merging always
// yields the true top-`limit` of their union (a row past position `limit`
// within its own source's sort order can never rank inside the merged
// top-`limit`). This keeps page 1 fast regardless of table size instead of
// scanning the whole table (dsr_submissions has 8,000+ rows and is growing).
const FETCH_BATCH_SIZE = 1000
const LIMIT_CAP = 20_000 // defensive ceiling on how deep a single request may page

async function fetchTopDsrRows(
  filters: SubmissionFilters,
  limit: number
): Promise<SubmissionListRow[]> {
  const sb = getSupabaseAdmin()
  const rows: Array<Record<string, unknown>> = []
  let offset = 0
  while (rows.length < limit) {
    const batchSize = Math.min(FETCH_BATCH_SIZE, limit - offset)
    const baseQ = sb
      .from("dsr_submissions")
      .select(
        "id, visit_date, agent_type, agency_code, agency_name, visit_outcome, dmc_lead_interest, submitted_by, created_at"
      )
    const q = applyFilters(baseQ, filters)
      .order("visit_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + batchSize - 1)
    const { data, error } = await q
    if (error) {
      logger.error("[admin] listSubmissions dsr batch failed", { code: error.code, msg: error.message })
      break
    }
    const batch = (data ?? []) as Array<Record<string, unknown>>
    rows.push(...batch)
    if (batch.length < batchSize) break
    offset += batchSize
  }

  const employees = await attachSubmitterDetails(rows as Array<{ submitted_by: string }>)
  return rows.map((r) => {
    const e = employees.get(r.submitted_by as string)
    return {
      id: r.id as string,
      source: "dsr" as const,
      visit_date: r.visit_date as string,
      agent_label:
        ((r.agent_type === "registered" ? r.agency_code : r.agency_name) as string | null) ?? "—",
      agent_sublabel: r.agent_type as string,
      visit_outcome: r.visit_outcome as "Positive" | "Neutral" | "Negative",
      dmc_lead_interest: r.dmc_lead_interest as boolean,
      created_at: r.created_at as string,
      submitter_name: e?.full_name ?? "(deleted)",
      submitter_code: e?.employee_code ?? "—",
    }
  })
}

async function fetchTopMeetingRows(
  filters: SubmissionFilters,
  limit: number
): Promise<SubmissionListRow[]> {
  // A row here can never satisfy an outcome/lead filter, so skip the fetch.
  if (filters.outcome || filters.has_lead) return []

  const sb = getSupabaseAdmin()
  const rows: Array<Record<string, unknown>> = []
  let offset = 0
  while (rows.length < limit) {
    const batchSize = Math.min(FETCH_BATCH_SIZE, limit - offset)
    const baseQ = sb
      .from("agent_meeting_reports")
      .select("id, visit_date, travel_agent_name, submitted_by, created_at")
    const q = applyMeetingFilters(baseQ, filters)
      .order("visit_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + batchSize - 1)
    const { data, error } = await q
    if (error) {
      logger.error("[admin] listSubmissions meeting batch failed", { code: error.code, msg: error.message })
      break
    }
    const batch = (data ?? []) as Array<Record<string, unknown>>
    rows.push(...batch)
    if (batch.length < batchSize) break
    offset += batchSize
  }

  const employees = await attachSubmitterDetails(rows as Array<{ submitted_by: string }>)
  return rows.map((r) => {
    const e = employees.get(r.submitted_by as string)
    return {
      id: r.id as string,
      source: "agent_meeting" as const,
      visit_date: r.visit_date as string,
      agent_label: (r.travel_agent_name as string | null) ?? "—",
      agent_sublabel: "Meeting",
      visit_outcome: null,
      dmc_lead_interest: null,
      created_at: r.created_at as string,
      submitter_name: e?.full_name ?? "(deleted)",
      submitter_code: e?.employee_code ?? "—",
    }
  })
}

async function countDsrRows(filters: SubmissionFilters): Promise<number> {
  const sb = getSupabaseAdmin()
  const baseQ = sb.from("dsr_submissions").select("id", { count: "exact", head: true })
  const { count, error } = await applyFilters(baseQ, filters)
  if (error) {
    logger.error("[admin] countDsrRows failed", { code: error.code, msg: error.message })
    return 0
  }
  return count ?? 0
}

async function countMeetingRows(filters: SubmissionFilters): Promise<number> {
  if (filters.outcome || filters.has_lead) return 0
  const sb = getSupabaseAdmin()
  const baseQ = sb.from("agent_meeting_reports").select("id", { count: "exact", head: true })
  const { count, error } = await applyMeetingFilters(baseQ, filters)
  if (error) {
    logger.error("[admin] countMeetingRows failed", { code: error.code, msg: error.message })
    return 0
  }
  return count ?? 0
}

async function attachSubmitterDetails(
  rows: ReadonlyArray<{
    submitted_by: string
    [k: string]: unknown
  }>
) {
  if (rows.length === 0) return new Map<string, { full_name: string; employee_code: string }>()
  const ids = [...new Set(rows.map((r) => r.submitted_by))]
  const sb = getSupabaseAdmin()
  const { data } = await sb
    .from("employees")
    .select("id, full_name, employee_code")
    .in("id", ids)
  return new Map(
    (data ?? []).map((e) => [
      e.id as string,
      { full_name: e.full_name as string, employee_code: e.employee_code as string },
    ])
  )
}

export async function listSubmissions(
  rawFilters: Partial<SubmissionFilters>
): Promise<SubmissionListPage> {
  await requireAdmin()
  const filters = filterSchema.parse(rawFilters ?? {})
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const limit = Math.min(page * pageSize, LIMIT_CAP)

  const [dsrRows, meetingRows, dsrCount, meetingCount] = await Promise.all([
    fetchTopDsrRows(filters, limit),
    fetchTopMeetingRows(filters, limit),
    countDsrRows(filters),
    countMeetingRows(filters),
  ])

  const merged = [...dsrRows, ...meetingRows].sort((a, b) => {
    if (a.visit_date !== b.visit_date) return a.visit_date < b.visit_date ? 1 : -1
    return a.created_at < b.created_at ? 1 : -1
  })

  const total = dsrCount + meetingCount
  const offset = (page - 1) * pageSize
  const rows = merged.slice(offset, offset + pageSize)

  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

// ---------------------------------------------------------------------------
// Single submission detail
// ---------------------------------------------------------------------------

export type SubmissionDetail = Record<string, unknown> & {
  id: string
  submitter_name: string
  submitter_code: string
}

export async function getSubmission(id: string): Promise<SubmissionDetail | null> {
  await requireAdmin()
  if (!z.string().uuid().safeParse(id).success) return null

  const sb = getSupabaseAdmin()
  const { data: row } = await sb
    .from("dsr_submissions")
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
    ...(row as Record<string, unknown>),
    submitter_name: emp?.full_name ?? "(deleted)",
    submitter_code: emp?.employee_code ?? "—",
  } as SubmissionDetail
}

// ---------------------------------------------------------------------------
// CSV export — returns the full CSV string for the given filters.
// Caller (client) makes a Blob and triggers a download.
// ---------------------------------------------------------------------------

const CSV_COLUMNS = [
  "source",
  "visit_date",
  "submitter_name",
  "submitter_code",
  "agent_type",
  "agency_code",
  "agency_name",
  "visit_outcome",
  "visit_commitment",
  "flight_escalation_has_ref",
  "flight_escalation_booking_id",
  "flight_monthly_txn_lakhs",
  "flight_domestic_portals",
  "flight_international_portals",
  "flight_issue_complaint",
  "flight_agent_mode",
  "flight_dealing_type",
  "flight_client_type",
  "flight_payment_mode",
  "flight_credit_type",
  "hotel_escalation_has_ref",
  "hotel_escalation_booking_id",
  "hotel_monthly_room_nights_other",
  "hotel_current_room_nights_etrav",
  "hotel_primary_platform",
  "hotel_committed_room_nights",
  "hotel_category_preference",
  "hotel_issue_complaint",
  "dmc_escalation_has_ref",
  "dmc_escalation_booking_id",
  "dmc_destination_discussed",
  "dmc_agent_active",
  "dmc_current_vendor",
  "dmc_current_vendor_pax",
  "dmc_lead_interest",
  "dmc_committed_pax",
  "dmc_objection",
  "dmc_essential_info_given",
  // agent_meeting_reports-only fields (blank on "dsr" rows)
  "travel_agent_name",
  "agent_code",
  "city",
  "business_aspect",
  "current_challenges",
  "meeting_summary",
  "potential_queries",
  "destinations_interested",
  "created_at",
] as const

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ""
  let s: string
  if (Array.isArray(value)) s = value.join("; ")
  else if (typeof value === "boolean") s = value ? "Yes" : "No"
  else s = String(value)
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

// PostgREST caps any single response at its configured max-rows (1000 on
// this project) regardless of a larger client-side .limit(), so exports must
// page through with .range() to collect every matching row.
const EXPORT_BATCH_SIZE = 1000

async function fetchAllSubmissionsForExport(
  filters: SubmissionFilters
): Promise<{ ok: true; rows: Array<Record<string, unknown>> } | { ok: false; error: string }> {
  const sb = getSupabaseAdmin()
  const rows: Array<Record<string, unknown>> = []
  let offset = 0

  for (;;) {
    const baseQ = sb.from("dsr_submissions").select("*")
    const q = applyFilters(baseQ, filters)
      .order("visit_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + EXPORT_BATCH_SIZE - 1)

    const { data, error } = await q
    if (error) {
      logger.error("[admin] exportCsv batch failed", { code: error.code, msg: error.message })
      return { ok: false, error: "db_error" }
    }

    const batch = (data ?? []) as Array<Record<string, unknown>>
    rows.push(...batch)
    if (batch.length < EXPORT_BATCH_SIZE) break
    offset += EXPORT_BATCH_SIZE
  }

  return { ok: true, rows }
}

async function fetchAllMeetingsForExport(
  filters: SubmissionFilters
): Promise<{ ok: true; rows: Array<Record<string, unknown>> } | { ok: false; error: string }> {
  if (filters.outcome || filters.has_lead) return { ok: true, rows: [] }

  const sb = getSupabaseAdmin()
  const rows: Array<Record<string, unknown>> = []
  let offset = 0

  for (;;) {
    const baseQ = sb.from("agent_meeting_reports").select("*")
    const q = applyMeetingFilters(baseQ, filters)
      .order("visit_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + EXPORT_BATCH_SIZE - 1)

    const { data, error } = await q
    if (error) {
      logger.error("[admin] exportCsv meeting batch failed", { code: error.code, msg: error.message })
      return { ok: false, error: "db_error" }
    }

    const batch = (data ?? []) as Array<Record<string, unknown>>
    rows.push(...batch)
    if (batch.length < EXPORT_BATCH_SIZE) break
    offset += EXPORT_BATCH_SIZE
  }

  return { ok: true, rows }
}

export async function exportSubmissionsCsv(
  rawFilters: Partial<SubmissionFilters>
): Promise<{ ok: true; csv: string; rowCount: number } | { ok: false; error: string }> {
  await requireAdmin()
  const parsed = filterSchema.safeParse(rawFilters ?? {})
  if (!parsed.success) return { ok: false, error: "invalid_filters" }

  const dsrResult = await fetchAllSubmissionsForExport(parsed.data)
  if (!dsrResult.ok) return dsrResult
  const meetingResult = await fetchAllMeetingsForExport(parsed.data)
  if (!meetingResult.ok) return meetingResult

  const dsrRows: Array<Record<string, unknown>> = dsrResult.rows.map((r) => ({
    ...r,
    source: "dsr",
  }))
  const meetingRows: Array<Record<string, unknown>> = meetingResult.rows.map((r) => ({
    ...r,
    source: "agent_meeting",
  }))
  const rows = [...dsrRows, ...meetingRows].sort((a, b) => {
    const ad = a.visit_date as string
    const bd = b.visit_date as string
    if (ad !== bd) return ad < bd ? 1 : -1
    const ac = a.created_at as string
    const bc = b.created_at as string
    return ac < bc ? 1 : -1
  })

  const submitters = await attachSubmitterDetails(
    rows as Array<{ submitted_by: string }>
  )

  const header = CSV_COLUMNS.join(",")
  const body = rows
    .map((r) => {
      const e = submitters.get(r.submitted_by as string)
      const enriched: Record<string, unknown> = {
        ...r,
        submitter_name: e?.full_name ?? "(deleted)",
        submitter_code: e?.employee_code ?? "—",
      }
      return CSV_COLUMNS.map((c) => csvEscape(enriched[c])).join(",")
    })
    .join("\n")

  // UTF-8 BOM so Excel recognises encoding correctly.
  const csv = "﻿" + header + "\n" + body
  return { ok: true, csv, rowCount: rows.length }
}

// ---------------------------------------------------------------------------
// Dashboard stats — visits today / week, leads / open escalations (last 7 days)
// ---------------------------------------------------------------------------

function todayInIst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function daysAgoIst(days: number): string {
  const ms = Date.now() - days * 86_400_000
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms))
}

export type DashboardStats = {
  visits_today: number
  visits_week: number
  leads_week: number
}

export async function getDashboardStats(): Promise<DashboardStats> {
  await requireAdmin()
  const sb = getSupabaseAdmin()
  const today = todayInIst()
  const weekAgo = daysAgoIst(6) // inclusive 7-day window

  const [todayRes, weekRes, leadsRes] = await Promise.all([
    sb
      .from("dsr_submissions")
      .select("id", { count: "exact", head: true })
      .eq("visit_date", today),
    sb
      .from("dsr_submissions")
      .select("id", { count: "exact", head: true })
      .gte("visit_date", weekAgo),
    sb
      .from("dsr_submissions")
      .select("id", { count: "exact", head: true })
      .gte("visit_date", weekAgo)
      .eq("dmc_lead_interest", true),
  ])

  return {
    visits_today: todayRes.count ?? 0,
    visits_week: weekRes.count ?? 0,
    leads_week: leadsRes.count ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Agent history — all submissions for one agency_code (registered agents only).
// ---------------------------------------------------------------------------

export async function getAgentHistory(agencyCode: string) {
  await requireAdmin()
  const sb = getSupabaseAdmin()

  const { data, error } = await sb
    .from("dsr_submissions")
    .select("*")
    .eq("agency_code", agencyCode)
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    logger.error("[admin] getAgentHistory failed", { code: error.code })
    return { rows: [] as Array<Record<string, unknown>>, employeeMap: new Map<string, { full_name: string; employee_code: string }>() }
  }

  const employeeMap = await attachSubmitterDetails(
    (data ?? []) as Array<{ submitted_by: string }>
  )
  return {
    rows: (data ?? []) as Array<Record<string, unknown>>,
    employeeMap,
  }
}

// ---------------------------------------------------------------------------
// FS rep options — for filter bar dropdown
// ---------------------------------------------------------------------------

export async function listEmployeesForFilter() {
  await requireAdmin()
  const sb = getSupabaseAdmin()
  const { data } = await sb
    .from("employees")
    .select("id, full_name, employee_code, role, is_active")
    .order("full_name", { ascending: true })
  return (data ?? []).map((e) => ({
    id: e.id as string,
    full_name: e.full_name as string,
    employee_code: e.employee_code as string,
    role: e.role as "field_sales" | "admin",
    is_active: e.is_active as boolean,
  }))
}
