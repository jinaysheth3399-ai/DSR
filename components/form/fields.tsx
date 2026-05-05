"use client"

import { useFormContext, type FieldPath } from "react-hook-form"

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { DsrFormValues } from "@/lib/schemas/dsr"

type Option = { value: string; label: string }

function normalizeOptions(opts: ReadonlyArray<string | Option>): Option[] {
  return opts.map((o) => (typeof o === "string" ? { value: o, label: o } : o))
}

const colsClass: Record<2 | 3 | 4, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
}

type RadioCardsProps = {
  name: FieldPath<DsrFormValues>
  label: string
  options: ReadonlyArray<string | Option>
  cols?: 2 | 3 | 4
  description?: string
}

export function RadioCardsField({
  name,
  label,
  options,
  cols = 3,
  description,
}: RadioCardsProps) {
  const form = useFormContext<DsrFormValues>()
  const opts = normalizeOptions(options)
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          <FormControl>
            <RadioGroup
              value={(field.value as string | undefined) ?? ""}
              onValueChange={field.onChange}
              className={cn("grid gap-2", colsClass[cols])}
            >
              {opts.map((o) => {
                const active = field.value === o.value
                return (
                  <label
                    key={o.value}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                      active
                        ? "border-primary bg-primary/5"
                        : "border-input hover:bg-muted/50"
                    )}
                  >
                    <RadioGroupItem value={o.value} />
                    <span>{o.label}</span>
                  </label>
                )
              })}
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

type YesNoProps = { name: FieldPath<DsrFormValues>; label: string }

export function YesNoField({ name, label }: YesNoProps) {
  const form = useFormContext<DsrFormValues>()
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => {
        const v = field.value as boolean | undefined
        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <RadioGroup
                value={v === true ? "yes" : v === false ? "no" : undefined}
                onValueChange={(s) => field.onChange(s === "yes")}
                className="flex gap-2"
              >
                {(
                  [
                    { v: "yes", label: "Yes" },
                    { v: "no", label: "No" },
                  ] as const
                ).map((opt) => {
                  const isActive = (opt.v === "yes") === Boolean(v)
                  return (
                    <label
                      key={opt.v}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm transition-colors",
                        isActive
                          ? "border-primary bg-primary/5"
                          : "border-input hover:bg-muted/50"
                      )}
                    >
                      <RadioGroupItem value={opt.v} />
                      <span>{opt.label}</span>
                    </label>
                  )
                })}
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

type NumberFieldProps = {
  name: FieldPath<DsrFormValues>
  label: string
  suffix?: string
  step?: number | "any"
  placeholder?: string
  description?: string
}

export function NumberField({
  name,
  label,
  suffix,
  step = "any",
  placeholder,
  description,
}: NumberFieldProps) {
  const form = useFormContext<DsrFormValues>()
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          <div className="relative">
            <FormControl>
              <Input
                ref={field.ref}
                name={field.name}
                type="number"
                inputMode={step === "any" ? "decimal" : "numeric"}
                step={step}
                min={0}
                placeholder={placeholder}
                value={
                  field.value === undefined || field.value === null
                    ? ""
                    : Number.isNaN(field.value as number)
                      ? ""
                      : (field.value as number)
                }
                onBlur={field.onBlur}
                onChange={(e) => {
                  const raw = e.target.value
                  field.onChange(raw === "" ? 0 : Number(raw))
                }}
                className={cn(suffix && "pr-14")}
              />
            </FormControl>
            {suffix && (
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-muted-foreground">
                {suffix}
              </span>
            )}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

type TextFieldProps = {
  name: FieldPath<DsrFormValues>
  label: string
  placeholder?: string
  maxLength?: number
}

export function TextField({
  name,
  label,
  placeholder,
  maxLength,
}: TextFieldProps) {
  const form = useFormContext<DsrFormValues>()
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              value={(field.value as string | undefined) ?? ""}
              placeholder={placeholder}
              maxLength={maxLength}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

type SelectFieldProps = {
  name: FieldPath<DsrFormValues>
  label: string
  placeholder?: string
  options: ReadonlyArray<string>
}

export function SelectField({
  name,
  label,
  placeholder,
  options,
}: SelectFieldProps) {
  const form = useFormContext<DsrFormValues>()
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select
            value={(field.value as string | undefined) ?? ""}
            onValueChange={field.onChange}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={placeholder ?? "Choose…"} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
