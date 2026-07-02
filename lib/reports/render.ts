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
  const body =
    rows.length === 0
      ? `<tr><td colspan="4" style="padding:12px;text-align:center;color:#666;">No visits logged for this period.</td></tr>`
      : rows
          .map(
            (r) => `<tr>
              <td style="padding:8px 12px;border:1px solid #ddd;">${escapeHtml(r.employee_code)}</td>
              <td style="padding:8px 12px;border:1px solid #ddd;">${escapeHtml(r.employee_name)}</td>
              <td style="padding:8px 12px;border:1px solid #ddd;">${escapeHtml(r.visit_date)}</td>
              <td style="padding:8px 12px;border:1px solid #ddd;">${escapeHtml(r.agent)}</td>
            </tr>`
          )
          .join("")

  return `<!DOCTYPE html>
<html>
  <body style="font-family:Arial,Helvetica,sans-serif;color:#222;">
    <h2 style="margin-bottom:4px;">Weekly Visits Report</h2>
    <p style="margin-top:0;color:#555;">${escapeHtml(dateFrom)} to ${escapeHtml(dateTo)} &middot; ${rows.length} visit${rows.length === 1 ? "" : "s"}</p>
    <table style="border-collapse:collapse;width:100%;max-width:720px;">
      <thead>
        <tr style="background:#f2f2f2;">
          <th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">Employee Number</th>
          <th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">Name</th>
          <th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">Date</th>
          <th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">Agent</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
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
