import { requireUser } from "@/lib/auth/dal"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { DsrForm } from "@/components/form/DsrForm"
import type { DsrFormValues, StepKey } from "@/lib/schemas/dsr"

type OptionRow = {
  field_key: string
  label: string
  sort_order: number
}

export default async function NewVisitPage() {
  const user = await requireUser()
  const sb = getSupabaseAdmin()

  const [{ data: opts }, { data: draft }] = await Promise.all([
    sb
      .from("placeholder_options")
      .select("field_key, label, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    sb
      .from("dsr_drafts")
      .select("payload, current_step, updated_at")
      .eq("employee_id", user.employee_id)
      .maybeSingle(),
  ])

  const optionsByField = ((opts as OptionRow[] | null) ?? []).reduce<
    Record<string, string[]>
  >((acc, row) => {
    ;(acc[row.field_key] ??= []).push(row.label)
    return acc
  }, {})

  const initialDraft = draft
    ? {
        payload: (draft.payload as Partial<DsrFormValues>) ?? {},
        currentStep: draft.current_step as StepKey,
        updatedAt: draft.updated_at as string,
      }
    : null

  return (
    <DsrForm optionsByField={optionsByField} initialDraft={initialDraft} />
  )
}
