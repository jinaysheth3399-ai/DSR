import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { getAgentHistory } from "@/app/_actions/submissions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function fmtDate(s: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(s + "T00:00:00Z"))
}

const outcomeStyle: Record<string, string> = {
  Positive: "bg-green-100 text-green-800 border-green-300/50",
  Neutral: "bg-zinc-100 text-zinc-800 border-zinc-300/50",
  Negative: "bg-red-100 text-red-800 border-red-300/50",
}

export default async function AgentHistoryPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const decoded = decodeURIComponent(code)
  const { rows, employeeMap } = await getAgentHistory(decoded)

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:py-10">
      <Link
        href="/admin/submissions"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Back to submissions
      </Link>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Agency history — {decoded}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length} visit{rows.length === 1 ? "" : "s"} on record
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 p-12 text-center text-sm text-muted-foreground">
          No visits recorded for this agency code yet.
        </div>
      ) : (
        <ol className="space-y-4">
          {rows.map((r) => {
            const submitter = employeeMap.get(r.submitted_by as string)
            return (
              <li key={r.id as string}>
                <Card>
                  <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                    <div>
                      <CardTitle className="text-base">
                        {fmtDate(r.visit_date as string)}
                      </CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {submitter?.full_name ?? "(deleted)"} · {submitter?.employee_code ?? "—"}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`border ${outcomeStyle[r.visit_outcome as string] ?? ""}`}
                    >
                      {r.visit_outcome as string}
                    </Badge>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p>
                      <span className="text-muted-foreground">Commitment:</span>{" "}
                      {(r.visit_commitment as string) || "—"}
                    </p>
                    <Link
                      href={`/admin/submissions/${r.id as string}`}
                      className="mt-2 inline-block text-primary underline-offset-2 hover:underline"
                    >
                      View full submission →
                    </Link>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
