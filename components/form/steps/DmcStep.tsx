"use client"

import { useFormContext } from "react-hook-form"

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { NumberField, TextField, YesNoField } from "../fields"
import { MultiSelectChips } from "../MultiSelectChips"
import type { DsrFormValues } from "@/lib/schemas/dsr"

export function DmcStep({
  optionsByField,
}: {
  optionsByField: Record<string, string[]>
}) {
  const form = useFormContext<DsrFormValues>()
  const hasRef = form.watch("dmc_escalation_has_ref")

  return (
    <div className="space-y-6">
      <YesNoField
        name="dmc_escalation_has_ref"
        label="Reference number on a specific DMC escalation?"
      />
      {hasRef && (
        <TextField
          name="dmc_escalation_booking_id"
          label="Booking ID"
          placeholder="e.g. DMC12345"
          maxLength={100}
        />
      )}

      <FormField
        control={form.control}
        name="dmc_destination_discussed"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Destinations discussed</FormLabel>
            <FormControl>
              <MultiSelectChips
                options={optionsByField.dmc_destination_discussed ?? []}
                value={field.value ?? []}
                onChange={field.onChange}
                ariaLabel="DMC destinations"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <YesNoField
        name="dmc_agent_active"
        label="Is the agent currently active in this destination?"
      />

      <TextField
        name="dmc_current_vendor"
        label="Current DMC vendor (competitor name)"
        placeholder="e.g. Rayna Tours"
        maxLength={100}
      />

      <NumberField
        name="dmc_current_vendor_pax"
        label="Monthly pax volume with current vendor"
        suffix="pax"
        step={1}
        placeholder="0"
      />

      <YesNoField
        name="dmc_lead_interest"
        label="Did the agent show interest / request a quote?"
      />

      <NumberField
        name="dmc_committed_pax"
        label="Monthly pax committed to Etrav DMC"
        suffix="pax"
        step={1}
        placeholder="0"
      />

      <FormField
        control={form.control}
        name="dmc_objection"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Objections raised</FormLabel>
            <p className="text-xs text-muted-foreground">
              Pick all that apply, or leave empty if none.
            </p>
            <FormControl>
              <MultiSelectChips
                options={optionsByField.dmc_objection ?? []}
                value={field.value ?? []}
                onChange={field.onChange}
                ariaLabel="DMC objections"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
