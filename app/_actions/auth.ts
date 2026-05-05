"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { getSupabaseAdmin } from "@/lib/supabase/admin"
import {
  SESSION_COOKIE_NAME,
  hashSessionToken,
} from "@/lib/auth/session"

export async function logout() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (token) {
    const sb = getSupabaseAdmin()
    await sb
      .from("sessions")
      .delete()
      .eq("token_hash", hashSessionToken(token))
  }

  cookieStore.delete(SESSION_COOKIE_NAME)
  redirect("/login")
}
