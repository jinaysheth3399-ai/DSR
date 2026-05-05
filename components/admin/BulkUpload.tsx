"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  bulkCommitEmployees,
  bulkPreviewEmployees,
  type BulkPreviewRow,
} from "@/app/_actions/employees"

const MAX_FILE_BYTES = 2 * 1024 * 1024 // 2 MB

type ParsedRow = {
  full_name: string
  phone: string
  employee_code: string
  role?: string
}

function pick(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k]
    if (v != null && String(v).trim() !== "") return String(v).trim()
  }
  return ""
}

async function parseFile(file: File): Promise<ParsedRow[]> {
  const XLSX = await import("xlsx")
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: "array" })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
    raw: false,
  })
  return json.map((row) => {
    const norm: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      norm[k.trim().toLowerCase().replace(/\s+/g, "_")] = v
    }
    return {
      full_name: pick(norm, "full_name", "name", "fullname"),
      phone: pick(norm, "phone_number", "phone", "mobile", "contact", "mobile_number"),
      employee_code: pick(
        norm,
        "employee_code",
        "code",
        "empcode",
        "employee_id"
      ),
      role: pick(norm, "role"),
    }
  })
}

export function BulkUpload() {
  const router = useRouter()
  const [previewRows, setPreviewRows] = useState<BulkPreviewRow[] | null>(null)
  const [stats, setStats] = useState<{ valid: number; invalid: number } | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null)
  const [pending, startTransition] = useTransition()

  function reset() {
    setPreviewRows(null)
    setStats(null)
    setParsedRows(null)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // allow re-selecting same file
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      toast.error("File too large (max 2 MB).")
      return
    }
    startTransition(async () => {
      try {
        const rows = await parseFile(file)
        if (rows.length === 0) {
          toast.error("No rows found.")
          return
        }
        setParsedRows(rows)
        const result = await bulkPreviewEmployees(rows)
        setPreviewRows(result.rows)
        setStats({ valid: result.validCount, invalid: result.invalidCount })
      } catch {
        toast.error("Couldn't parse the file.")
      }
    })
  }

  function handleCommit() {
    if (!parsedRows) return
    startTransition(async () => {
      const result = await bulkCommitEmployees(parsedRows)
      if (!result.ok) {
        const msg =
          result.error === "preview_has_errors"
            ? "Fix errors and re-upload before committing."
            : result.error === "nothing_to_insert"
              ? "Nothing to insert."
              : "Commit failed."
        toast.error(msg)
        return
      }
      toast.success(`Inserted ${result.inserted} employees.`)
      reset()
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bulk upload</CardTitle>
        <p className="text-sm text-muted-foreground">
          Required columns (case-insensitive): <strong>Full name</strong>,{" "}
          <strong>Phone number</strong>, <strong>Employee Code</strong>. Role
          column is optional and defaults to <code>field_sales</code>. Max 2 MB,
          .csv or .xlsx.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!previewRows && (
          <label className="flex cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed border-input bg-muted/20 px-6 py-10 text-sm text-muted-foreground hover:bg-muted/40">
            {pending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Upload className="size-5" />
            )}
            {pending ? "Parsing…" : "Choose a .csv or .xlsx file"}
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={handleFile}
              disabled={pending}
            />
          </label>
        )}

        {previewRows && stats && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="size-4" />
                <span>
                  <strong className="text-foreground">{stats.valid}</strong> valid,{" "}
                  <strong className="text-foreground">{stats.invalid}</strong> with errors
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={reset} disabled={pending}>
                  <X className="size-4" /> Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCommit}
                  disabled={pending || stats.invalid > 0 || stats.valid === 0}
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  Commit {stats.valid} rows
                </Button>
              </div>
            </div>

            <div className="max-h-96 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((r) => (
                    <TableRow
                      key={r.index}
                      className={r.ok ? "" : "bg-destructive/5"}
                    >
                      <TableCell className="text-xs text-muted-foreground">
                        {r.index + 1}
                      </TableCell>
                      <TableCell>{r.raw.full_name || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.raw.phone || "—"}
                      </TableCell>
                      <TableCell>{r.raw.employee_code || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {r.raw.role || "field_sales"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.ok ? (
                          <span className="text-green-700">OK</span>
                        ) : (
                          <span className="text-destructive">
                            {r.errors.join("; ")}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
