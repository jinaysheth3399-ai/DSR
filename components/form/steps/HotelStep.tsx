"use client"

import { useFormContext } from "react-hook-form"

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { NumberField, TextField, YesNoField } from "../fields"
import { MultiSelectChips } from "../MultiSelectChips"
import { MultiSelectDropdown } from "../MultiSelectDropdown"
import { HOTEL_CATEGORIES, type DsrFormValues } from "@/lib/schemas/dsr"

export function HotelStep({
  optionsByField,
}: {
  optionsByField: Record<string, string[]>
}) {
  const form = useFormContext<DsrFormValues>()
  const hasRef = form.watch("hotel_escalation_has_ref")

  return (
    <div className="space-y-6">
      <YesNoField
        name="hotel_escalation_has_ref"
        label="Reference number on a specific Hotel escalation?"
      />
      {hasRef && (
        <TextField
          name="hotel_escalation_booking_id"
          label="Booking ID"
          placeholder="e.g. HTL12345"
          maxLength={100}
        />
      )}

      <NumberField
        name="hotel_monthly_room_nights_other"
        label="Agent's current monthly room nights on other platforms"
        suffix="nights"
        step={1}
        placeholder="0"
      />

      <NumberField
        name="hotel_current_room_nights_etrav"
        label="Agent's current room nights on Etrav"
        description="Enter 0 if dormant."
        suffix="nights"
        step={1}
        placeholder="0"
      />

      <FormField
        control={form.control}
        name="hotel_primary_platform"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Primary hotel-booking platforms</FormLabel>
            <FormControl>
              <MultiSelectChips
                options={optionsByField.hotel_primary_platform ?? []}
                value={field.value ?? []}
                onChange={field.onChange}
                ariaLabel="Hotel platforms"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <NumberField
        name="hotel_committed_room_nights"
        label="Monthly room nights committed to Etrav going forward"
        suffix="nights"
        step={1}
        placeholder="0"
      />

      <FormField
        control={form.control}
        name="hotel_category_preference"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Hotel category preference</FormLabel>
            <FormControl>
              <MultiSelectChips
                options={HOTEL_CATEGORIES as unknown as string[]}
                value={field.value ?? []}
                onChange={(v) =>
                  field.onChange(
                    v.filter((x) =>
                      (HOTEL_CATEGORIES as ReadonlyArray<string>).includes(x)
                    )
                  )
                }
                ariaLabel="Hotel category preference"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="hotel_issue_complaint"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Any issue or complaint raised?</FormLabel>
            <p className="text-xs text-muted-foreground">
              Free text. Leave blank if none.
            </p>
            <FormControl>
              <Textarea
                {...field}
                value={(field.value as string | undefined) ?? ""}
                rows={3}
                maxLength={500}
                placeholder="Words only…"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
