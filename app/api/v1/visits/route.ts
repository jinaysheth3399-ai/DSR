import { NextResponse, type NextRequest } from "next/server"

import { authenticateApiRequest } from "@/lib/auth/api-key"
import { apiError } from "@/lib/api/response"
import { listVisits, visitsQuerySchema } from "@/lib/api/visits"
import { logger } from "@/lib/logger"

// Data endpoint: always evaluated per-request, never statically cached.
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = authenticateApiRequest(request)
  if (!auth.ok) return apiError(auth.status, auth.code, auth.message)

  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = visitsQuerySchema.safeParse(params)
  if (!parsed.success) {
    return apiError(
      400,
      "invalid_query",
      "One or more query parameters are invalid.",
      parsed.error.issues.map((i) => ({
        field: i.path.join(".") || "(root)",
        message: i.message,
      }))
    )
  }

  try {
    const result = await listVisits(parsed.data)
    if (!result.ok) {
      return apiError(500, "internal_error", "Could not load visits. Please retry.")
    }
    return NextResponse.json({
      data: result.data,
      pagination: result.pagination,
    })
  } catch (err) {
    logger.error("[api] GET /visits crashed", {
      msg: err instanceof Error ? err.message : "unknown",
    })
    return apiError(500, "internal_error", "Could not load visits. Please retry.")
  }
}
