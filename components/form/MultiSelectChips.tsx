"use client"

import { cn } from "@/lib/utils"

type Props = {
  options: ReadonlyArray<string>
  value: ReadonlyArray<string>
  onChange: (next: string[]) => void
  // When set, picking this option clears all others; picking any other option
  // also clears this one. Used for "None"-style mutually-exclusive entries.
  exclusiveOption?: string
  className?: string
  ariaLabel?: string
  disabled?: boolean
}

export function MultiSelectChips({
  options,
  value,
  onChange,
  exclusiveOption,
  className,
  ariaLabel,
  disabled,
}: Props) {
  function toggle(opt: string) {
    if (disabled) return
    const has = value.includes(opt)
    if (exclusiveOption) {
      if (opt === exclusiveOption) {
        onChange(has ? [] : [opt])
        return
      }
      const without = value.filter((v) => v !== exclusiveOption)
      onChange(
        has ? without.filter((v) => v !== opt) : [...without, opt]
      )
      return
    }
    onChange(has ? value.filter((v) => v !== opt) : [...value, opt])
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {options.map((opt) => {
        const active = value.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            aria-pressed={active}
            disabled={disabled}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-input bg-background text-muted-foreground hover:border-foreground/40 hover:bg-muted/50"
            )}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}
