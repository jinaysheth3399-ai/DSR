"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { VISIT_OUTCOMES } from "@/lib/schemas/dsr"

const ALL = "__all__"

type Employee = {
  id: string
  full_name: string
  employee_code: string
  is_active: boolean
}

export function FilterBar({ employees }: { employees: Employee[] }) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()

  function update(patch: Record<string, string | undefined | null>) {
    const next = new URLSearchParams(sp?.toString() ?? "")
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "" || v === ALL) next.delete(k)
      else next.set(k, v)
    }
    next.delete("page")
    startTransition(() => {
      router.push(`?${next.toString()}`, { scroll: false })
    })
  }

  function clearAll() {
    startTransition(() => {
      router.push("?", { scroll: false })
    })
  }

  const dateFrom = sp?.get("date_from") ?? ""
  const dateTo = sp?.get("date_to") ?? ""
  const submittedBy = sp?.get("submitted_by") ?? ALL
  const outcome = sp?.get("outcome") ?? ALL
  const hasLead = sp?.get("has_lead") ?? ALL
  const agency = sp?.get("agency") ?? ""

  const anyFilter =
    dateFrom ||
    dateTo ||
    submittedBy !== ALL ||
    outcome !== ALL ||
    hasLead !== ALL ||
    agency

  return (
    <div className="rounded-xl border border-border/70 bg-card/40 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between pb-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Filters
        </p>
        {anyFilter ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            disabled={pending}
            className="h-7 text-xs text-muted-foreground"
          >
            <X className="size-3.5" /> Clear
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="date_from" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id="date_from"
            type="date"
            value={dateFrom}
            onChange={(e) => update({ date_from: e.target.value })}
            className="h-9"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="date_to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="date_to"
            type="date"
            value={dateTo}
            onChange={(e) => update({ date_to: e.target.value })}
            className="h-9"
          />
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">FS rep</Label>
          <Select
            value={submittedBy}
            onValueChange={(v) => update({ submitted_by: v })}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All reps</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.full_name}{" "}
                  <span className="opacity-60">· {e.employee_code}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Outcome</Label>
          <Select
            value={outcome}
            onValueChange={(v) => update({ outcome: v })}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any</SelectItem>
              {VISIT_OUTCOMES.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Lead?</Label>
          <Select
            value={hasLead}
            onValueChange={(v) => update({ has_lead: v })}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any</SelectItem>
              <SelectItem value="true">Lead generated</SelectItem>
              <SelectItem value="false">No lead</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="agency" className="text-xs text-muted-foreground">
            Agency search
          </Label>
          <Input
            id="agency"
            placeholder="Code or name"
            defaultValue={agency}
            onBlur={(e) =>
              update({ agency: e.target.value.trim() || undefined })
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                update({
                  agency:
                    (e.target as HTMLInputElement).value.trim() || undefined,
                })
              }
            }}
            className="h-9"
          />
        </div>
      </div>
    </div>
  )
}
