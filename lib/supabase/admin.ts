import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let _client: SupabaseClient | null = null

// Hard ceiling on any single request to Supabase. Without it, a database that
// stops answering leaves every request hanging until the platform kills it
// (observed: 90s for a page load, indefinitely for OTP sends), and users keep
// retrying, which piles more work onto a database that is already stuck. A
// timed-out request surfaces as an ordinary `error` on the supabase-js result,
// which every caller already handles.
const REQUEST_TIMEOUT_MS = 15_000

const fetchWithTimeout: typeof fetch = (input, init) => {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout
  return fetch(input, { ...init, signal })
}

export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the server environment"
    )
  }

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
    global: { fetch: fetchWithTimeout },
  })

  return _client
}
