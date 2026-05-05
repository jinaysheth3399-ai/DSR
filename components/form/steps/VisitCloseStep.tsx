"use client"

import { RadioCardsField, SelectField } from "../fields"
import { VISIT_OUTCOMES } from "@/lib/schemas/dsr"

export function VisitCloseStep({
  optionsByField,
}: {
  optionsByField: Record<string, string[]>
}) {
  return (
    <div className="space-y-6">
      <RadioCardsField
        name="visit_outcome"
        label="Overall visit outcome"
        options={VISIT_OUTCOMES as unknown as string[]}
        cols={3}
      />

      <SelectField
        name="visit_commitment"
        label="What did you promise the agent?"
        placeholder="Pick a commitment"
        options={optionsByField.visit_commitment ?? []}
      />
    </div>
  )
}
