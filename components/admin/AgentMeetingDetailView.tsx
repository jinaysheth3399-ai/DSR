import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AgentMeetingDetail } from "@/app/_actions/agent-meeting"

function fmtDate(s: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(s + "T00:00:00Z"))
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

export function AgentMeetingDetailView({ report }: { report: AgentMeetingDetail }) {
  const r = report

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Meeting · {fmtDate(r.visit_date)}
        </p>
        <h1 className="font-display text-4xl leading-tight tracking-tight">
          {r.travel_agent_name || "Agent meeting"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Submitted by{" "}
          <span className="font-medium text-foreground">{r.submitter_name}</span>{" "}
          ({r.submitter_code}){" · "}
          recorded {fmtTimestamp(r.created_at)}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meeting details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Agent code">{r.agent_code || "—"}</Field>
            <Field label="City">{r.city || "—"}</Field>
            <Field label="Business aspect" className="sm:col-span-2">
              {r.business_aspect || "—"}
            </Field>
            <Field label="Current challenges / feedback" className="sm:col-span-2">
              {r.current_challenges || "—"}
            </Field>
            <Field label="Meeting summary" className="sm:col-span-2">
              {r.meeting_summary || "—"}
            </Field>
            <Field label="Potential queries" className="sm:col-span-2">
              {r.potential_queries || "—"}
            </Field>
            <Field label="Destinations interested" className="sm:col-span-2">
              {r.destinations_interested.length === 0 ? (
                "—"
              ) : (
                <div className="flex flex-wrap gap-1">
                  {r.destinations_interested.map((d) => (
                    <Badge key={d} variant="secondary" className="font-normal">
                      {d}
                    </Badge>
                  ))}
                </div>
              )}
            </Field>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
