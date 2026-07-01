import "server-only"

import { NextResponse } from "next/server"

// Consistent error envelope for every route under /api/v1.
// Success responses are shaped per-endpoint (see the route handlers).

export type ApiErrorBody = {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = { error: { code, message } }
  if (details !== undefined) body.error.details = details
  return NextResponse.json(body, { status })
}
