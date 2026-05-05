"use client"

import { useTransition } from "react"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { exportSubmissionsCsv } from "@/app/_actions/submissions"

export function ExportCsvButton({
  filters,
}: {
  filters: Record<string, string | undefined>
}) {
  const [pending, startTransition] = useTransition()

  function handleExport() {
    startTransition(async () => {
      const cleaned = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== undefined && v !== "")
      )
      const result = await exportSubmissionsCsv(cleaned)
      if (!result.ok) {
        toast.error("Export failed.")
        return
      }
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const stamp = new Date().toISOString().slice(0, 10)
      a.download = `dsr-submissions-${stamp}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Exported ${result.rowCount} rows.`)
    })
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      Export CSV
    </Button>
  )
}
