import "server-only"

import * as XLSX from "xlsx"

import type { ReportRow } from "@/lib/reports/weekly-visits"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function renderReportHtml(
  rows: ReportRow[],
  dateFrom: string,
  dateTo: string
): string {
  const from = escapeHtml(dateFrom)
  const to = escapeHtml(dateTo)
  const message =
    rows.length === 0
      ? `No visits were logged for this week (${from} to ${to}).`
      : `This is the visits report for this week: ${from} to ${to}. See the attached Excel file for details.`

  return `<!DOCTYPE html>
<html>
  <body style="font-family:Arial,Helvetica,sans-serif;color:#222;">
    <p>${message}</p>
  </body>
</html>`
}

export function renderReportXlsx(rows: ReportRow[]): Buffer {
  const sheetRows = rows.map((r) => ({
    "Employee Number": r.employee_code,
    Name: r.employee_name,
    Date: r.visit_date,
    Agent: r.agent,
  }))
  const sheet = XLSX.utils.json_to_sheet(sheetRows)
  sheet["!cols"] = [{ wch: 16 }, { wch: 24 }, { wch: 12 }, { wch: 20 }]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, "Visits")
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer
}
