import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Submission = Record<string, unknown> & {
  id: string
  submitter_name: string
  submitter_code: string
}

function fmtDate(s: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(s + (s.length === 10 ? "T00:00:00Z" : "")))
}

function fmtTimestamp(s: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(s))
}

function val(v: unknown): React.ReactNode {
  if (v === null || v === undefined || v === "") return <span className="text-muted-foreground">—</span>
  if (typeof v === "boolean") return v ? "Yes" : "No"
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-muted-foreground">— (none)</span>
    return (
      <div className="flex flex-wrap gap-1">
        {v.map((s, i) => (
          <Badge key={i} variant="secondary" className="font-normal">
            {String(s)}
          </Badge>
        ))}
      </div>
    )
  }
  return String(v)
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("grid gap-1", className)}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

export function SubmissionDetailView({ submission }: { submission: Submission }) {
  const s = submission

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Visit · {fmtDate(s.visit_date as string)}
        </p>
        <h1 className="font-display text-4xl leading-tight tracking-tight">
          {s.agent_type === "registered"
            ? (s.agency_code as string) || "Agency visit"
            : (s.agency_name as string) || "Agency visit"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Submitted by{" "}
          <span className="font-medium text-foreground">
            {s.submitter_name}
          </span>{" "}
          ({s.submitter_code}){" · "}
          recorded {fmtTimestamp(s.created_at as string)}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle className="text-base">Header</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Agent type">{val(s.agent_type)}</Field>
            <Field label="Agency">
              {(s.agent_type === "registered" ? s.agency_code : s.agency_name) as React.ReactNode || val(null)}
            </Field>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Flight</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Reference on escalation">{val(s.flight_escalation_has_ref)}</Field>
            <Field label="Booking ID">{val(s.flight_escalation_booking_id)}</Field>
            <Field label="Monthly txn (lakhs)">{val(s.flight_monthly_txn_lakhs)}</Field>
            <Field label="Domestic portals" className="sm:col-span-2">{val(s.flight_domestic_portals)}</Field>
            <Field label="International portals" className="sm:col-span-2">{val(s.flight_international_portals)}</Field>
            <Field label="Issue / complaint" className="sm:col-span-2">{val(s.flight_issue_complaint)}</Field>
            <Field label="Agent mode">{val(s.flight_agent_mode)}</Field>
            <Field label="Dealing type">{val(s.flight_dealing_type)}</Field>
            <Field label="Client type">{val(s.flight_client_type)}</Field>
            <Field label="Payment mode">{val(s.flight_payment_mode)}</Field>
            <Field label="Credit type">{val(s.flight_credit_type)}</Field>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Hotel</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Reference on escalation">{val(s.hotel_escalation_has_ref)}</Field>
            <Field label="Booking ID">{val(s.hotel_escalation_booking_id)}</Field>
            <Field label="Monthly room nights on other platforms">{val(s.hotel_monthly_room_nights_other)}</Field>
            <Field label="Current room nights on Etrav">{val(s.hotel_current_room_nights_etrav)}</Field>
            <Field label="Primary platforms" className="sm:col-span-2">{val(s.hotel_primary_platform)}</Field>
            <Field label="Committed room nights (forward)">{val(s.hotel_committed_room_nights)}</Field>
            <Field label="Category preference" className="sm:col-span-2">{val(s.hotel_category_preference)}</Field>
            <Field label="Issue / complaint" className="sm:col-span-2">{val(s.hotel_issue_complaint)}</Field>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">DMC</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Reference on escalation">{val(s.dmc_escalation_has_ref)}</Field>
            <Field label="Booking ID">{val(s.dmc_escalation_booking_id)}</Field>
            <Field label="Destinations discussed" className="sm:col-span-2">{val(s.dmc_destination_discussed)}</Field>
            <Field label="Agent active in destination">{val(s.dmc_agent_active)}</Field>
            <Field label="Current vendor">{val(s.dmc_current_vendor)}</Field>
            <Field label="Current vendor pax">{val(s.dmc_current_vendor_pax)}</Field>
            <Field label="Lead generated?">{val(s.dmc_lead_interest)}</Field>
            <Field label="Committed pax to Etrav">{val(s.dmc_committed_pax)}</Field>
            <Field label="Objection" className="sm:col-span-2">{val(s.dmc_objection)}</Field>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Visit close</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Outcome">{val(s.visit_outcome)}</Field>
            <Field label="Commitment">{val(s.visit_commitment)}</Field>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
