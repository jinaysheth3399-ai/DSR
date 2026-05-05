"use client"

import { useFormContext } from "react-hook-form"

import { RadioCardsField, TextField } from "../fields"
import type { DsrFormValues } from "@/lib/schemas/dsr"

export function HeaderStep() {
  const form = useFormContext<DsrFormValues>()
  const type = form.watch("agent_type")

  return (
    <div className="space-y-6">
      <RadioCardsField
        name="agent_type"
        label="Agent type"
        cols={2}
        options={[
          { value: "registered", label: "Registered" },
          { value: "new", label: "New" },
        ]}
      />

      {type === "registered" ? (
        <TextField
          key="agency_code"
          name="agency_code"
          label="Agency code"
          placeholder="e.g. ETAG-1234"
          maxLength={30}
        />
      ) : (
        <TextField
          key="agency_name"
          name="agency_name"
          label="Agency name"
          placeholder="Agency or company name"
          maxLength={100}
        />
      )}
    </div>
  )
}
