"use client"

import { useFormContext } from "react-hook-form"

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  NumberField,
  RadioCardsField,
  TextField,
  YesNoField,
} from "../fields"
import { MultiSelectChips } from "../MultiSelectChips"
import { MultiSelectDropdown } from "../MultiSelectDropdown"
import {
  FLIGHT_AGENT_MODES,
  FLIGHT_CLIENT_TYPES,
  FLIGHT_CREDIT_TYPES,
  FLIGHT_DEALING_TYPES,
  FLIGHT_PAYMENT_MODES,
  type DsrFormValues,
} from "@/lib/schemas/dsr"

export function FlightStep({
  optionsByField,
}: {
  optionsByField: Record<string, string[]>
}) {
  const form = useFormContext<DsrFormValues>()
  const hasRef = form.watch("flight_escalation_has_ref")
  const paymentMode = form.watch("flight_payment_mode")

  const issueOptions = optionsByField.flight_issue_complaint ?? []

  return (
    <div className="space-y-6">
      <YesNoField
        name="flight_escalation_has_ref"
        label="Reference number on a specific Flight escalation?"
      />
      {hasRef && (
        <TextField
          name="flight_escalation_booking_id"
          label="Booking ID"
          placeholder="e.g. ABC123XYZ"
          maxLength={100}
        />
      )}

      <NumberField
        name="flight_monthly_txn_lakhs"
        label="Agent's current monthly flight transactions on other portals"
        suffix="lakhs"
        step="any"
        placeholder="0.00"
      />

      <FormField
        control={form.control}
        name="flight_domestic_portals"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Primary domestic-booking portals</FormLabel>
            <FormControl>
              <MultiSelectDropdown
                options={optionsByField.flight_domestic_portals ?? []}
                value={field.value ?? []}
                onChange={field.onChange}
                placeholder="Pick one or more portals"
                ariaLabel="Domestic flight portals"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="flight_international_portals"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Primary international-booking portals</FormLabel>
            <FormControl>
              <MultiSelectDropdown
                options={optionsByField.flight_international_portals ?? []}
                value={field.value ?? []}
                onChange={field.onChange}
                placeholder="Pick one or more portals"
                ariaLabel="International flight portals"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="flight_issue_complaint"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Issues or complaints raised</FormLabel>
            <p className="text-xs text-muted-foreground">
              Picking &ldquo;None&rdquo; clears the others.
            </p>
            <FormControl>
              <MultiSelectChips
                options={issueOptions}
                value={field.value ?? []}
                onChange={field.onChange}
                exclusiveOption={
                  issueOptions.includes("None") ? "None" : undefined
                }
                ariaLabel="Flight issues or complaints"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <RadioCardsField
        name="flight_agent_mode"
        label="Offline / Online / Both?"
        options={FLIGHT_AGENT_MODES as unknown as string[]}
        cols={3}
      />
      <RadioCardsField
        name="flight_dealing_type"
        label="Direct dealing or via distributor?"
        options={FLIGHT_DEALING_TYPES as unknown as string[]}
        cols={2}
      />
      <RadioCardsField
        name="flight_client_type"
        label="Client type"
        options={FLIGHT_CLIENT_TYPES as unknown as string[]}
        cols={2}
      />
      <RadioCardsField
        name="flight_payment_mode"
        label="Mode of payment to supplier"
        options={FLIGHT_PAYMENT_MODES as unknown as string[]}
        cols={3}
      />
      {paymentMode === "Credit" && (
        <RadioCardsField
          name="flight_credit_type"
          label="Credit type"
          options={FLIGHT_CREDIT_TYPES as unknown as string[]}
          cols={3}
        />
      )}
    </div>
  )
}
