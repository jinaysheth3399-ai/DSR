import { Target, TrendingUp, Users } from "lucide-react"

import { Card } from "@/components/ui/card"
import type { DashboardStats } from "@/app/_actions/submissions"

const items: Array<{
  key: keyof DashboardStats
  label: string
  hint: string
  Icon: typeof TrendingUp
}> = [
  { key: "visits_today", label: "Visits today", hint: "Asia / Kolkata", Icon: Users },
  { key: "visits_week", label: "Visits · 7d", hint: "Trailing seven days", Icon: TrendingUp },
  { key: "leads_week", label: "Leads · 7d", hint: "DMC interest expressed", Icon: Target },
]

export function StatCards({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map(({ key, label, hint, Icon }) => (
        <Card
          key={key}
          className="relative overflow-hidden border-border/70 p-5 shadow-[0_1px_2px_oklch(0_0_0/0.03)] transition-shadow hover:shadow-[0_4px_18px_-8px_oklch(0_0_0/0.08)]"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-4 left-0 w-px bg-foreground/80"
          />
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </p>
            <Icon className="size-4 text-muted-foreground/60" />
          </div>
          <p className="mt-4 font-display text-5xl leading-none tabular-nums">
            {stats[key]}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
        </Card>
      ))}
    </div>
  )
}
