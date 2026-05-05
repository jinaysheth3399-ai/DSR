import Link from "next/link"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { SubmissionListRow } from "@/app/_actions/submissions"
import { cn } from "@/lib/utils"

const outcomeStyles: Record<SubmissionListRow["visit_outcome"], string> = {
  Positive:
    "border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:border-emerald-700/40 dark:bg-emerald-950/40 dark:text-emerald-300",
  Neutral:
    "border-zinc-300/60 bg-zinc-50 text-zinc-800 dark:border-zinc-700/40 dark:bg-zinc-900/60 dark:text-zinc-300",
  Negative:
    "border-rose-300/60 bg-rose-50 text-rose-800 dark:border-rose-700/40 dark:bg-rose-950/40 dark:text-rose-300",
}

function fmtDate(s: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(s + "T00:00:00Z"))
}

export function SubmissionsTable({ rows }: { rows: SubmissionListRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-16 text-center">
        <p className="font-display text-2xl italic text-muted-foreground">
          Nothing here yet.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          No submissions match these filters.
        </p>
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-border/70 hover:bg-transparent">
            <TableHead className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Date
            </TableHead>
            <TableHead className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              FS rep
            </TableHead>
            <TableHead className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Agent
            </TableHead>
            <TableHead className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Outcome
            </TableHead>
            <TableHead className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Lead
            </TableHead>
            <TableHead className="w-[1%]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const agentLabel =
              r.agent_type === "registered"
                ? r.agency_code ?? "—"
                : r.agency_name ?? "—"
            return (
              <TableRow
                key={r.id}
                className="border-border/60 align-middle transition-colors hover:bg-muted/40"
              >
                <TableCell className="whitespace-nowrap text-sm tabular-nums">
                  {fmtDate(r.visit_date)}
                </TableCell>
                <TableCell className="text-sm">
                  <div className="font-medium">{r.submitter_name}</div>
                  <div className="text-xs text-muted-foreground tabular">
                    {r.submitter_code}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  <div className="font-medium">{agentLabel}</div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {r.agent_type}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "border font-normal",
                      outcomeStyles[r.visit_outcome]
                    )}
                  >
                    {r.visit_outcome}
                  </Badge>
                </TableCell>
                <TableCell>
                  {r.dmc_lead_interest ? (
                    <Badge
                      variant="secondary"
                      className="border border-brand/30 bg-brand/10 font-normal text-brand dark:bg-brand/20"
                    >
                      Lead
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-sm">
                  <Link
                    href={`/admin/submissions/${r.id}`}
                    className="text-foreground underline-offset-4 hover:underline"
                  >
                    View →
                  </Link>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
