import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { authenticateApiRequest } from "@/lib/auth/api-key"
import { apiError } from "@/lib/api/response"
import { getVisitById } from "@/lib/api/visits"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = authenticateApiRequest(request)
  if (!auth.ok) return apiError(auth.status, auth.code, auth.message)

  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) {
    return apiError(400, "invalid_id", "The visit id must be a valid UUID.")
  }

  try {
    const result = await getVisitById(id)
    if (!result.ok) {
      return apiError(500, "internal_error", "Could not load the visit. Please retry.")
    }
    if (!result.visit) {
      return apiError(404, "not_found", "No visit exists with that id.")
    }
    return NextResponse.json({ data: result.visit })
  } catch (err) {
    logger.error("[api] GET /visits/[id] crashed", {
      msg: err instanceof Error ? err.message : "unknown",
    })
    return apiError(500, "internal_error", "Could not load the visit. Please retry.")
  }
}
