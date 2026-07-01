import "server-only"

import { z } from "zod"

import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { VISIT_OUTCOMES } from "@/lib/schemas/dsr"
import { logger } from "@/lib/logger"

// ---------------------------------------------------------------------------
// Query parameters for the list endpoint.
//
// Every value arrives as a string (URL query), so numbers are coerced and the
// rest are validated as strings/enums. Unknown params are ignored by zod.
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const SORT_FIELDS = ["visit_date", "created_at", "updated_at"] as const

export const visitsQuerySchema = z.object({
  date_from: z.string().regex(DATE_RE, "Expected YYYY-MM-DD").optional(),
  date_to: z.string().regex(DATE_RE, "Expected YYYY-MM-DD").optional(),
  outcome: z.enum(VISIT_OUTCOMES).optional(),
  agency: z.string().trim().min(1).max(100).optional(),
  submitted_by: z.string().uuid().optional(),
  has_lead: z.enum(["true", "false"]).optional(),
  updated_since: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Expected an ISO 8601 timestamp")
    .optional(),
  sort: z.enum(SORT_FIELDS).default("visit_date"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(500).default(50),
})

export type VisitsQuery = z.infer<typeof visitsQuerySchema>

// ---------------------------------------------------------------------------
// Response shapes. Fields are grouped by the five report sections so a
// consumer can map them without knowing the flat column layout.
// ---------------------------------------------------------------------------

export type EscalationRef = {
  has_ref: boolean
  booking_id: string | null
}

export type ApiVisit = {
  id: string
  visit_date: string
  submitter: {
    id: string
    name: string
    employee_code: string
  }
  header: {
    agent_type: "registered" | "new"
    agency_code: string | null
    agency_name: string | null
  }
  flight: {
    escalation: EscalationRef
    monthly_txn_lakhs: number
    domestic_portals: string[]
    international_portals: string[]
    issue_complaint: string[]
    agent_mode: string
    dealing_type: string
    client_type: string
    payment_mode: string
    credit_type: string | null
  }
  hotel: {
    escalation: EscalationRef
    monthly_room_nights_other: number
    current_room_nights_etrav: number
    primary_platform: string[]
    committed_room_nights: number
    category_preference: string[]
    issue_complaint: string | null
  }
  dmc: {
    escalation: EscalationRef
    destination_discussed: string[]
    agent_active: boolean
    current_vendor: string
    current_vendor_pax: number
    lead_interest: boolean
    committed_pax: number
    objection: string[]
  }
  close: {
    visit_outcome: "Positive" | "Neutral" | "Negative"
    visit_commitment: string
  }
  created_at: string
  updated_at: string
}

export type Pagination = {
  page: number
  page_size: number
  total: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

// ---------------------------------------------------------------------------
// Column list: every column on dsr_submissions, kept explicit so the API
// surface does not silently change if new columns are added to the table.
// ---------------------------------------------------------------------------

const VISIT_COLUMNS = `
  id, submitted_by, visit_date,
  agent_type, agency_code, agency_name,
  flight_escalation_has_ref, flight_escalation_booking_id,
  flight_monthly_txn_lakhs, flight_domestic_portals, flight_international_portals,
  flight_issue_complaint, flight_agent_mode, flight_dealing_type,
  flight_client_type, flight_payment_mode, flight_credit_type,
  hotel_escalation_has_ref, hotel_escalation_booking_id,
  hotel_monthly_room_nights_other, hotel_current_room_nights_etrav,
  hotel_primary_platform, hotel_committed_room_nights, hotel_category_preference,
  hotel_issue_complaint,
  dmc_escalation_has_ref, dmc_escalation_booking_id, dmc_destination_discussed,
  dmc_agent_active, dmc_current_vendor, dmc_current_vendor_pax,
  dmc_lead_interest, dmc_committed_pax, dmc_objection,
  visit_outcome, visit_commitment,
  created_at, updated_at
`

type SubmitterInfo = { id: string; name: string; employee_code: string }

// ---------------------------------------------------------------------------
// Value coercion helpers. Numeric columns can arrive as strings depending on
// the driver, so normalise to real JSON numbers; array columns to string[].
// ---------------------------------------------------------------------------

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : []
}

async function fetchSubmitters(
  ids: ReadonlyArray<string>
): Promise<Map<string, SubmitterInfo>> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return new Map()
  const sb = getSupabaseAdmin()
  const { data } = await sb
    .from("employees")
    .select("id, full_name, employee_code")
    .in("id", unique)
  return new Map(
    (data ?? []).map((e) => [
      e.id as string,
      {
        id: e.id as string,
        name: e.full_name as string,
        employee_code: e.employee_code as string,
      },
    ])
  )
}

export function serializeVisit(
  row: Record<string, unknown>,
  submitter: SubmitterInfo | undefined
): ApiVisit {
  const submittedBy = row.submitted_by as string
  return {
    id: row.id as string,
    visit_date: row.visit_date as string,
    submitter: submitter ?? {
      id: submittedBy,
      name: "(unknown)",
      employee_code: "",
    },
    header: {
      agent_type: row.agent_type as "registered" | "new",
      agency_code: (row.agency_code as string | null) ?? null,
      agency_name: (row.agency_name as string | null) ?? null,
    },
    flight: {
      escalation: {
        has_ref: Boolean(row.flight_escalation_has_ref),
        booking_id: (row.flight_escalation_booking_id as string | null) ?? null,
      },
      monthly_txn_lakhs: num(row.flight_monthly_txn_lakhs),
      domestic_portals: strArray(row.flight_domestic_portals),
      international_portals: strArray(row.flight_international_portals),
      issue_complaint: strArray(row.flight_issue_complaint),
      agent_mode: row.flight_agent_mode as string,
      dealing_type: row.flight_dealing_type as string,
      client_type: row.flight_client_type as string,
      payment_mode: row.flight_payment_mode as string,
      credit_type: (row.flight_credit_type as string | null) ?? null,
    },
    hotel: {
      escalation: {
        has_ref: Boolean(row.hotel_escalation_has_ref),
        booking_id: (row.hotel_escalation_booking_id as string | null) ?? null,
      },
      monthly_room_nights_other: num(row.hotel_monthly_room_nights_other),
      current_room_nights_etrav: num(row.hotel_current_room_nights_etrav),
      primary_platform: strArray(row.hotel_primary_platform),
      committed_room_nights: num(row.hotel_committed_room_nights),
      category_preference: strArray(row.hotel_category_preference),
      issue_complaint: (row.hotel_issue_complaint as string | null) ?? null,
    },
    dmc: {
      escalation: {
        has_ref: Boolean(row.dmc_escalation_has_ref),
        booking_id: (row.dmc_escalation_booking_id as string | null) ?? null,
      },
      destination_discussed: strArray(row.dmc_destination_discussed),
      agent_active: Boolean(row.dmc_agent_active),
      current_vendor: row.dmc_current_vendor as string,
      current_vendor_pax: num(row.dmc_current_vendor_pax),
      lead_interest: Boolean(row.dmc_lead_interest),
      committed_pax: num(row.dmc_committed_pax),
      objection: strArray(row.dmc_objection),
    },
    close: {
      visit_outcome: row.visit_outcome as "Positive" | "Neutral" | "Negative",
      visit_commitment: row.visit_commitment as string,
    },
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

// ---------------------------------------------------------------------------
// List: filtered, paginated set of visits.
// ---------------------------------------------------------------------------

export type ListVisitsResult =
  | { ok: true; data: ApiVisit[]; pagination: Pagination }
  | { ok: false; error: string }

export async function listVisits(query: VisitsQuery): Promise<ListVisitsResult> {
  const sb = getSupabaseAdmin()
  const { page, page_size: pageSize } = query
  const offset = (page - 1) * pageSize

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = sb.from("dsr_submissions").select(VISIT_COLUMNS, { count: "exact" })

  if (query.date_from) q = q.gte("visit_date", query.date_from)
  if (query.date_to) q = q.lte("visit_date", query.date_to)
  if (query.outcome) q = q.eq("visit_outcome", query.outcome)
  if (query.submitted_by) q = q.eq("submitted_by", query.submitted_by)
  if (query.has_lead === "true") q = q.eq("dmc_lead_interest", true)
  if (query.has_lead === "false") q = q.eq("dmc_lead_interest", false)
  if (query.updated_since) q = q.gte("updated_at", query.updated_since)
  if (query.agency) {
    // Strip PostgREST filter metacharacters so the term cannot alter the
    // or() grammar (`,` separates conditions, `()` groups them, `%_` are
    // ilike wildcards).
    const a = query.agency.replace(/[%_,()]/g, "")
    if (a.length > 0) {
      q = q.or(`agency_code.ilike.%${a}%,agency_name.ilike.%${a}%`)
    }
  }

  q = q
    .order(query.sort, { ascending: query.order === "asc" })
    .order("id", { ascending: true }) // stable tiebreaker for deterministic paging
    .range(offset, offset + pageSize - 1)

  const { data, count, error } = await q
  if (error) {
    logger.error("[api] listVisits failed", { code: error.code, msg: error.message })
    return { ok: false, error: "db_error" }
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>
  const submitters = await fetchSubmitters(rows.map((r) => r.submitted_by as string))
  const visits = rows.map((r) =>
    serializeVisit(r, submitters.get(r.submitted_by as string))
  )

  const total = count ?? 0
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize)
  return {
    ok: true,
    data: visits,
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    },
  }
}

// ---------------------------------------------------------------------------
// Single visit by id. `visit: null` means "valid request, no such row".
// ---------------------------------------------------------------------------

export type GetVisitResult =
  | { ok: true; visit: ApiVisit | null }
  | { ok: false; error: string }

export async function getVisitById(id: string): Promise<GetVisitResult> {
  const sb = getSupabaseAdmin()
  const { data: row, error } = await sb
    .from("dsr_submissions")
    .select(VISIT_COLUMNS)
    .eq("id", id)
    .maybeSingle()

  if (error) {
    logger.error("[api] getVisitById failed", { code: error.code, msg: error.message })
    return { ok: false, error: "db_error" }
  }
  if (!row) return { ok: true, visit: null }

  const typedRow = row as Record<string, unknown>
  const submitters = await fetchSubmitters([typedRow.submitted_by as string])
  return {
    ok: true,
    visit: serializeVisit(typedRow, submitters.get(typedRow.submitted_by as string)),
  }
}
