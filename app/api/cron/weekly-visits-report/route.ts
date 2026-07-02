import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { authenticateCronRequest } from "@/lib/auth/cron"
import { apiError } from "@/lib/api/response"
import { currentReportWeekRange, listReportRows } from "@/lib/reports/weekly-visits"
import { renderReportHtml, renderReportXlsx } from "@/lib/reports/render"
import { sendEmail } from "@/lib/email/send"
import { logger } from "@/lib/logger"

// Scheduled endpoint: always evaluated per-request, never statically cached.
export const dynamic = "force-dynamic"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const querySchema = z.object({
  date_from: z.string().regex(DATE_RE, "Expected YYYY-MM-DD").optional(),
  date_to: z.string().regex(DATE_RE, "Expected YYYY-MM-DD").optional(),
  // Comma-separated recipient override, for ad hoc/test sends.
  to: z.string().optional(),
})

function loadRecipients(): string[] {
  const raw = process.env.WEEKLY_REPORT_RECIPIENTS
  if (!raw) return []
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export async function GET(request: NextRequest) {
  const auth = authenticateCronRequest(request)
  if (!auth.ok) return apiError(auth.status, auth.code, auth.message)

  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = querySchema.safeParse(params)
  if (!parsed.success) {
    return apiError(
      400,
      "invalid_query",
      "date_from/date_to must be YYYY-MM-DD.",
      parsed.error.issues.map((i) => ({
        field: i.path.join(".") || "(root)",
        message: i.message,
      }))
    )
  }

  const hasExplicitRange = Boolean(parsed.data.date_from && parsed.data.date_to)
  const { dateFrom, dateTo } = hasExplicitRange
    ? { dateFrom: parsed.data.date_from!, dateTo: parsed.data.date_to! }
    : currentReportWeekRange()

  const recipients = parsed.data.to
    ? parsed.data.to
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : loadRecipients()

  if (recipients.length === 0) {
    return apiError(
      503,
      "report_not_configured",
      "Set WEEKLY_REPORT_RECIPIENTS (or pass ?to=) to enable the weekly report."
    )
  }

  try {
    const result = await listReportRows(dateFrom, dateTo)
    if (!result.ok) {
      return apiError(500, "internal_error", "Could not load visits for the report.")
    }

    const html = renderReportHtml(result.rows, dateFrom, dateTo)
    const xlsx = renderReportXlsx(result.rows)

    await sendEmail({
      to: recipients,
      subject: `Weekly Visits Report: ${dateFrom} to ${dateTo}`,
      html,
      attachments: [
        {
          filename: `visits-${dateFrom}-to-${dateTo}.xlsx`,
          content: xlsx,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
    })

    return NextResponse.json({
      ok: true,
      date_from: dateFrom,
      date_to: dateTo,
      visit_count: result.rows.length,
      sent_to: recipients,
    })
  } catch (err) {
    logger.error("[cron] weekly visits report failed", {
      msg: err instanceof Error ? err.message : "unknown",
    })
    return apiError(500, "internal_error", "Could not send the weekly report.")
  }
}
