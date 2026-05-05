"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth/dal"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { logger } from "@/lib/logger"

export type OptionRow = {
  id: string
  field_key: string
  label: string
  sort_order: number
  is_active: boolean
}

export async function listAllOptions(): Promise<OptionRow[]> {
  await requireAdmin()
  const sb = getSupabaseAdmin()
  const { data } = await sb
    .from("placeholder_options")
    .select("id, field_key, label, sort_order, is_active")
    .order("field_key", { ascending: true })
    .order("sort_order", { ascending: true })
  return (data ?? []).map((r) => ({
    id: r.id as string,
    field_key: r.field_key as string,
    label: r.label as string,
    sort_order: r.sort_order as number,
    is_active: r.is_active as boolean,
  }))
}

const createSchema = z.object({
  field_key: z.string().min(1).max(80),
  label: z.string().trim().min(1).max(120),
})

export async function createOption(input: unknown) {
  await requireAdmin()
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: "validation_failed" as const }
  }
  const sb = getSupabaseAdmin()
  // Compute next sort_order
  const { data: existing } = await sb
    .from("placeholder_options")
    .select("sort_order")
    .eq("field_key", parsed.data.field_key)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = ((existing?.sort_order as number | undefined) ?? 0) + 10
  const { error } = await sb.from("placeholder_options").insert({
    field_key: parsed.data.field_key,
    label: parsed.data.label,
    sort_order: nextOrder,
    is_active: true,
  })
  if (error) {
    if (error.code === "23505") return { ok: false as const, error: "duplicate" as const }
    logger.error("[admin] createOption failed", { code: error.code })
    return { ok: false as const, error: "db_error" as const }
  }
  revalidatePath("/admin/options")
  return { ok: true as const }
}

const updateSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(120).optional(),
  is_active: z.boolean().optional(),
})

export async function updateOption(input: unknown) {
  await requireAdmin()
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: "validation_failed" as const }
  }
  const { id, ...patch } = parsed.data
  if (Object.keys(patch).length === 0) return { ok: true as const }
  const sb = getSupabaseAdmin()
  const { error } = await sb
    .from("placeholder_options")
    .update(patch)
    .eq("id", id)
  if (error) {
    if (error.code === "23505") return { ok: false as const, error: "duplicate" as const }
    logger.error("[admin] updateOption failed", { code: error.code })
    return { ok: false as const, error: "db_error" as const }
  }
  revalidatePath("/admin/options")
  return { ok: true as const }
}

export async function deleteOption(id: string) {
  await requireAdmin()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false as const, error: "invalid_id" as const }
  }
  const sb = getSupabaseAdmin()
  const { error } = await sb.from("placeholder_options").delete().eq("id", id)
  if (error) {
    logger.error("[admin] deleteOption failed", { code: error.code })
    return { ok: false as const, error: "db_error" as const }
  }
  revalidatePath("/admin/options")
  return { ok: true as const }
}

// Move an option up (smaller sort_order) or down (larger) by swapping with neighbour.
export async function moveOption(id: string, direction: "up" | "down") {
  await requireAdmin()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false as const, error: "invalid_id" as const }
  }
  const sb = getSupabaseAdmin()

  const { data: row } = await sb
    .from("placeholder_options")
    .select("id, field_key, sort_order")
    .eq("id", id)
    .maybeSingle()
  if (!row) return { ok: false as const, error: "not_found" as const }

  const fieldKey = row.field_key as string
  const myOrder = row.sort_order as number

  // Find neighbour: smallest order above (up) or largest below (down)
  const neighbourQ = sb
    .from("placeholder_options")
    .select("id, sort_order")
    .eq("field_key", fieldKey)
    .neq("id", id)
    .limit(1)

  const { data: neighbours } =
    direction === "up"
      ? await neighbourQ.lt("sort_order", myOrder).order("sort_order", { ascending: false })
      : await neighbourQ.gt("sort_order", myOrder).order("sort_order", { ascending: true })

  const n = neighbours?.[0]
  if (!n) return { ok: true as const } // already at boundary
  const neighbourId = n.id as string
  const neighbourOrder = n.sort_order as number

  // Swap sort_orders
  const tempOrder = -Math.abs(myOrder + neighbourOrder) - 1
  await sb.from("placeholder_options").update({ sort_order: tempOrder }).eq("id", id)
  await sb.from("placeholder_options").update({ sort_order: myOrder }).eq("id", neighbourId)
  await sb.from("placeholder_options").update({ sort_order: neighbourOrder }).eq("id", id)

  revalidatePath("/admin/options")
  return { ok: true as const }
}
