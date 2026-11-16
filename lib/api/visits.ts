import "server-only"

import { gunzipSync, gzipSync } from "node:zlib"

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

// Meeting-report fields for type: "agent_meeting" visits (see
// agent_meeting_reports / app/_actions/agent-meeting.ts). This is a
// standalone form for a single employee, unrelated to the five dsr_submissions
// sections, so it gets its own section instead of being forced into them.
export type ApiAgentMeeting = {
  travel_agent_name: string
  agent_code: string
  city: string
  business_aspect: string
  current_challenges: string
  meeting_summary: string
  potential_queries: string
  destinations_interested: string[]
}

export type ApiVisit = {
  id: string
  // "dsr_visit" rows always have header/flight/hotel/dmc/close populated and
  // agent_meeting: null. "agent_meeting" rows are the reverse. Check `type`
  // before reading either.
  type: "dsr_visit" | "agent_meeting"
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
  } | null
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
  } | null
  hotel: {
    escalation: EscalationRef
    monthly_room_nights_other: number
    current_room_nights_etrav: number
    primary_platform: string[]
    committed_room_nights: number
    category_preference: string[]
    issue_complaint: string | null
  } | null
  dmc: {
    escalation: EscalationRef
    destination_discussed: string[]
    agent_active: boolean
    current_vendor: string
    current_vendor_pax: number
    lead_interest: boolean
    committed_pax: number
    objection: string[]
    // null on visits submitted before this question was added
    essential_info_given: boolean | null
  } | null
  close: {
    visit_outcome: "Positive" | "Neutral" | "Negative"
    visit_commitment: string
  } | null
  agent_meeting: ApiAgentMeeting | null
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
  dmc_lead_interest, dmc_committed_pax, dmc_objection, dmc_essential_info_given,
  visit_outcome, visit_commitment,
  created_at, updated_at
`

const AGENT_MEETING_COLUMNS = `
  id, submitted_by, visit_date,
  travel_agent_name, agent_code, city, business_aspect,
  current_challenges, meeting_summary, potential_queries, destinations_interested,
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
    type: "dsr_visit",
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
      essential_info_given:
        (row.dmc_essential_info_given as boolean | null) ?? null,
    },
    close: {
      visit_outcome: row.visit_outcome as "Positive" | "Neutral" | "Negative",
      visit_commitment: row.visit_commitment as string,
    },
    agent_meeting: null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export function serializeAgentMeeting(
  row: Record<string, unknown>,
  submitter: SubmitterInfo | undefined
): ApiVisit {
  const submittedBy = row.submitted_by as string
  return {
    id: row.id as string,
    type: "agent_meeting",
    visit_date: row.visit_date as string,
    submitter: submitter ?? {
      id: submittedBy,
      name: "(unknown)",
      employee_code: "",
    },
    header: null,
    flight: null,
    hotel: null,
    dmc: null,
    close: null,
    agent_meeting: {
      travel_agent_name: row.travel_agent_name as string,
      agent_code: row.agent_code as string,
      city: row.city as string,
      business_aspect: row.business_aspect as string,
      current_challenges: row.current_challenges as string,
      meeting_summary: row.meeting_summary as string,
      potential_queries: row.potential_queries as string,
      destinations_interested: strArray(row.destinations_interested),
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

// Paging runs against the api_visit_keys view (migration 0007), which unions
// dsr_submissions and agent_meeting_reports with just the columns the API
// sorts and filters on. Postgres merges the two tables' indexes and skips to
// the offset itself, so one request returns a page of (id, source) keys in
// final order plus the exact total, at any depth (about 6 ms for the deepest
// page). Full rows are then loaded for that page only.
//
// Until Nov 2026 the app instead fetched every key up to the requested depth
// from each table, 1000 at a time, and merged them in JavaScript. A client
// paging through everything (the API's main consumer does, several times an
// hour) made each page cost more than the last, so a full sync cost grew with
// the square of the row count, and a 20,000-rows-per-table ceiling meant an
// oldest-first sync would have silently stopped receiving new visits.
//
// Columns that exist on only one table are null in the other's rows, so the
// outcome and has_lead filters exclude agent meetings, which have no such
// concept. agency_a / agency_b are the two text columns `agency` matches on
// each table (agency code and name; travel agent name and agent code).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyKeyFilters(q: any, query: VisitsQuery): any {
  let out = q
  if (query.date_from) out = out.gte("visit_date", query.date_from)
  if (query.date_to) out = out.lte("visit_date", query.date_to)
  if (query.outcome) out = out.eq("visit_outcome", query.outcome)
  if (query.submitted_by) out = out.eq("submitted_by", query.submitted_by)
  if (query.has_lead === "true") out = out.eq("dmc_lead_interest", true)
  if (query.has_lead === "false") out = out.eq("dmc_lead_interest", false)
  if (query.updated_since) out = out.gte("updated_at", query.updated_since)
  if (query.agency) {
    // Strip PostgREST filter metacharacters so the term cannot alter the
    // or() grammar (`,` separates conditions, `()` groups them, `%_` are
    // ilike wildcards).
    const a = query.agency.replace(/[%_,()]/g, "")
    if (a.length > 0) out = out.or(`agency_a.ilike.%${a}%,agency_b.ilike.%${a}%`)
  }
  return out
}

const KEYS_VIEW = "api_visit_keys"
const ID_CHUNK = 100 // keep `id=in.(...)` URLs well under gateway length limits

// A database read failed (including the client-side timeout). Surfaced as a
// retryable 500 rather than silently serving a short or wrong page.
class DbReadError extends Error {}

type PageKey = { id: string; source: "dsr" | "agent_meeting" }

async function fetchPageKeys(
  query: VisitsQuery,
  offset: number,
  limit: number
): Promise<{ keys: PageKey[]; total: number }> {
  const sb = getSupabaseAdmin()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = sb.from(KEYS_VIEW).select("id, source", { count: "exact" })
  q = applyKeyFilters(q, query)
    .order(query.sort, { ascending: query.order === "asc" })
    .order("id", { ascending: true }) // stable tiebreaker
    .range(offset, offset + limit - 1)
  const { data, error, count } = await q
  if (error) {
    // PostgREST answers 416 / PGRST103 when the offset is past the last row
    // and an exact count was asked for. That is an empty page, not a failure.
    if (error.code === "PGRST103") return { keys: [], total: await countKeys(query) }
    logger.error("[api] fetchPageKeys failed", { code: error.code, msg: error.message })
    throw new DbReadError(KEYS_VIEW)
  }
  return { keys: (data ?? []) as PageKey[], total: count ?? 0 }
}

async function countKeys(query: VisitsQuery): Promise<number> {
  const sb = getSupabaseAdmin()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = sb.from(KEYS_VIEW).select("id", { count: "exact", head: true })
  q = applyKeyFilters(q, query)
  const { count, error } = await q
  if (error) {
    logger.error("[api] countKeys failed", { code: error.code, msg: error.message })
    throw new DbReadError(KEYS_VIEW)
  }
  return count ?? 0
}

async function fetchRowsByIds(
  table: string,
  columns: string,
  ids: string[]
): Promise<Array<Record<string, unknown>>> {
  const sb = getSupabaseAdmin()
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += ID_CHUNK) chunks.push(ids.slice(i, i + ID_CHUNK))
  // Primary-key lookups of at most ID_CHUNK rows each: cheap enough to run
  // concurrently, which matters because every round trip crosses regions.
  const results = await Promise.all(
    chunks.map((chunk) => sb.from(table).select(columns).in("id", chunk))
  )
  const rows: Array<Record<string, unknown>> = []
  for (const { data, error } of results) {
    if (error) {
      logger.error(`[api] fetchRowsByIds(${table}) failed`, { code: error.code, msg: error.message })
      throw new DbReadError(table)
    }
    rows.push(...((data ?? []) as unknown as Array<Record<string, unknown>>))
  }
  return rows
}

export async function listVisits(query: VisitsQuery): Promise<ListVisitsResult> {
  const { page, page_size: pageSize } = query

  try {
    const { keys: pageKeys, total } = await fetchPageKeys(query, (page - 1) * pageSize, pageSize)

    const [dsrRows, meetingRows] = await Promise.all([
      fetchRowsByIds(
        "dsr_submissions",
        VISIT_COLUMNS,
        pageKeys.filter((k) => k.source === "dsr").map((k) => k.id)
      ),
      fetchRowsByIds(
        "agent_meeting_reports",
        AGENT_MEETING_COLUMNS,
        pageKeys.filter((k) => k.source === "agent_meeting").map((k) => k.id)
      ),
    ])

    const submitters = await fetchSubmitters(
      [...dsrRows, ...meetingRows].map((r) => r.submitted_by as string)
    )
    const dsrById = new Map(dsrRows.map((r) => [r.id as string, r]))
    const meetingById = new Map(meetingRows.map((r) => [r.id as string, r]))

    const data: ApiVisit[] = []
    for (const k of pageKeys) {
      const row = k.source === "dsr" ? dsrById.get(k.id) : meetingById.get(k.id)
      if (!row) continue // deleted between the key and row reads
      const submitter = submitters.get(row.submitted_by as string)
      data.push(
        k.source === "dsr" ? serializeVisit(row, submitter) : serializeAgentMeeting(row, submitter)
      )
    }

    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize)

    return {
      ok: true,
      data,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    }
  } catch (err) {
    if (err instanceof DbReadError) return { ok: false, error: "db_error" }
    throw err
  }
}

// ---------------------------------------------------------------------------
// Response reuse.
//
// The main consumer re-downloads every page several times an hour, mostly
// while nothing has changed (overnight especially). Each finished response
// body is kept, gzipped, in this server instance's memory, keyed by the exact
// query, and reused while api_visits_version() (migration 0007) returns the
// same value. That function fingerprints every row a response is built from
// (visits, meetings, employee names); any insert, edit or delete changes it
// and drops every saved response, so a reused body is identical to what a
// fresh build would return. A reuse costs one small query instead of the
// key, row and employee reads.
//
// Per-instance memory rather than Next's shared data cache: it has no
// platform usage limits, and correctness does not depend on how often it
// hits. Entries are small (a 500-visit page is ~700 KB of JSON, ~60 KB
// gzipped) and capped.
// ---------------------------------------------------------------------------

const RESPONSE_CACHE_MAX_ENTRIES = 300
let responseCacheVersion = ""
const responseCache = new Map<string, Buffer>()

async function fetchDataVersion(): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin().rpc("api_visits_version")
  if (error || typeof data !== "string") {
    logger.error("[api] api_visits_version failed", { code: error?.code, msg: error?.message })
    return null
  }
  return data
}

// Same filters, sort and page in any parameter order map to the same entry.
function responseCacheKey(query: VisitsQuery): string {
  return JSON.stringify(
    Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
  )
}

export type ListVisitsJsonResult =
  | { ok: true; body: string; cache: "hit" | "miss" }
  | { ok: false; error: string }

// The list endpoint's response body ({ data, pagination } as JSON), reused
// when the data has not changed since it was built.
export async function listVisitsJson(query: VisitsQuery): Promise<ListVisitsJsonResult> {
  // If the fingerprint cannot be read, serve a fresh build and save nothing.
  const version = await fetchDataVersion()
  const key = responseCacheKey(query)

  if (version !== null) {
    if (version !== responseCacheVersion) {
      responseCache.clear()
      responseCacheVersion = version
    }
    const saved = responseCache.get(key)
    if (saved) return { ok: true, body: gunzipSync(saved).toString("utf8"), cache: "hit" }
  }

  const result = await listVisits(query)
  if (!result.ok) return result
  const body = JSON.stringify({ data: result.data, pagination: result.pagination })

  // Saved under the fingerprint read before the build. If the data changed
  // meanwhile, the next call reads a new fingerprint, discards this entry and
  // rebuilds, so a saved body is never served after a change.
  if (version !== null && version === responseCacheVersion) {
    if (responseCache.size >= RESPONSE_CACHE_MAX_ENTRIES) {
      const oldest = responseCache.keys().next().value
      if (oldest !== undefined) responseCache.delete(oldest)
    }
    responseCache.set(key, gzipSync(body))
  }
  return { ok: true, body, cache: "miss" }
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
  if (row) {
    const typedRow = row as Record<string, unknown>
    const submitters = await fetchSubmitters([typedRow.submitted_by as string])
    return {
      ok: true,
      visit: serializeVisit(typedRow, submitters.get(typedRow.submitted_by as string)),
    }
  }

  // Not a dsr_submissions row. The same id could belong to a standalone
  // agent meeting report (uuid namespaces are independent per table).
  const { data: meetingRow, error: meetingError } = await sb
    .from("agent_meeting_reports")
    .select(AGENT_MEETING_COLUMNS)
    .eq("id", id)
    .maybeSingle()

  if (meetingError) {
    logger.error("[api] getVisitById meeting lookup failed", {
      code: meetingError.code,
      msg: meetingError.message,
    })
    return { ok: false, error: "db_error" }
  }
  if (!meetingRow) return { ok: true, visit: null }

  const typedMeetingRow = meetingRow as Record<string, unknown>
  const submitters = await fetchSubmitters([typedMeetingRow.submitted_by as string])
  return {
    ok: true,
    visit: serializeAgentMeeting(
      typedMeetingRow,
      submitters.get(typedMeetingRow.submitted_by as string)
    ),
  }
}
