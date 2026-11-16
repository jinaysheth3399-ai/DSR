import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let _client: SupabaseClient | null = null

// Hard ceiling on any single request to Supabase. Without it, a database that
// stops answering leaves every request hanging until the platform kills it
// (observed: 90s for a page load, indefinitely for OTP sends), and users keep
// retrying, which piles more work onto a database that is already stuck. A
// timed-out request surfaces as an ordinary `error` on the supabase-js result,
// which every caller already handles.
//
// This must be supabase-js's own `db.timeout`, not a timeout signal added in a
// custom fetch. postgrest-js retries GET/HEAD up to 3 more times on network
// errors, and AbortSignal.timeout() fails with a TimeoutError, which counts as
// one; only an AbortError is treated as deliberate. With the custom-fetch
// version a stuck read took ~67s (4 x 15s plus backoff) and hit the struggling
// database 4 times. db.timeout aborts with an AbortError, so it is final.
const REQUEST_TIMEOUT_MS = 15_000

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
    db: { schema: "public", timeout: REQUEST_TIMEOUT_MS },
  })

  return _client
}
