"use client"

import { useState } from "react"
import { Check, ChevronDown, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Props = {
  options: ReadonlyArray<string>
  value: ReadonlyArray<string>
  onChange: (next: string[]) => void
  placeholder?: string
  ariaLabel?: string
  disabled?: boolean
  // When true, picking this option clears all others (and vice versa).
  exclusiveOption?: string
}

export function MultiSelectDropdown({
  options,
  value,
  onChange,
  placeholder = "Select…",
  ariaLabel,
  disabled,
  exclusiveOption,
}: Props) {
  const [open, setOpen] = useState(false)

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
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              aria-label={ariaLabel}
              disabled={disabled}
              className="w-full justify-between font-normal"
            />
          }
        >
          <span className={cn(value.length === 0 && "text-muted-foreground")}>
            {value.length === 0
              ? placeholder
              : value.length === 1
                ? value[0]
                : `${value.length} selected`}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--anchor-width,320px)] min-w-72 p-0"
        >
          <ScrollArea className="max-h-72">
            <div className="flex flex-col p-1">
              {options.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  No options.
                </p>
              )}
              {options.map((opt) => {
                const selected = value.includes(opt)
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggle(opt)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                      selected && "bg-primary/5"
                    )}
                  >
                    <span>{opt}</span>
                    {selected && (
                      <Check className="size-4 shrink-0 text-primary" />
                    )}
                  </button>
                )
              })}
            </div>
          </ScrollArea>
          {value.length > 0 && (
            <div className="border-t p-1">
              <button
                type="button"
                onClick={() => onChange([])}
                className="flex w-full items-center gap-1 rounded-sm px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
              >
                <X className="size-3" /> Clear all
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <Badge
              key={v}
              variant="secondary"
              className="font-normal"
            >
              {v}
              <button
                type="button"
                onClick={() => toggle(v)}
                aria-label={`Remove ${v}`}
                className="ml-1 -mr-0.5 rounded-sm hover:bg-foreground/10"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
