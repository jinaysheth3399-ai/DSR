"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  createOption,
  deleteOption,
  moveOption,
  updateOption,
  type OptionRow,
} from "@/app/_actions/options"
import { FIELD_KEY_TITLES, KNOWN_FIELD_KEYS } from "@/lib/admin/option-fields"

type Props = {
  options: OptionRow[]
}

export function OptionsPanel({ options }: Props) {
  const groups = new Map<string, OptionRow[]>()
  for (const fk of KNOWN_FIELD_KEYS) groups.set(fk, [])
  for (const o of options) {
    if (!groups.has(o.field_key)) groups.set(o.field_key, [])
    groups.get(o.field_key)!.push(o)
  }

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([fieldKey, rows]) => (
        <FieldKeySection
          key={fieldKey}
          fieldKey={fieldKey}
          rows={rows}
        />
      ))}
    </div>
  )
}

function FieldKeySection({
  fieldKey,
  rows,
}: {
  fieldKey: string
  rows: OptionRow[]
}) {
  const [newLabel, setNewLabel] = useState("")
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const title =
    FIELD_KEY_TITLES[fieldKey as keyof typeof FIELD_KEY_TITLES] ?? fieldKey

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const label = newLabel.trim()
    if (!label) return
    startTransition(async () => {
      const r = await createOption({ field_key: fieldKey, label })
      if (!r.ok) {
        toast.error(
          r.error === "duplicate"
            ? "That label already exists for this field."
            : "Add failed."
        )
        return
      }
      setNewLabel("")
      toast.success("Added.")
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">
          Field key: <code className="rounded bg-muted px-1">{fieldKey}</code>
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No options yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((o, idx) => (
              <OptionRowEditor
                key={o.id}
                row={o}
                isFirst={idx === 0}
                isLast={idx === rows.length - 1}
              />
            ))}
          </ul>
        )}

        <form onSubmit={handleAdd} className="flex gap-2 pt-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="New option label"
            maxLength={120}
          />
          <Button type="submit" size="sm" disabled={pending || !newLabel.trim()}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Add
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function OptionRowEditor({
  row,
  isFirst,
  isLast,
}: {
  row: OptionRow
  isFirst: boolean
  isLast: boolean
}) {
  const router = useRouter()
  const [label, setLabel] = useState(row.label)
  const [pending, startTransition] = useTransition()

  function commitLabel() {
    const next = label.trim()
    if (!next || next === row.label) return
    startTransition(async () => {
      const r = await updateOption({ id: row.id, label: next })
      if (!r.ok) {
        toast.error(
          r.error === "duplicate" ? "Label already exists." : "Save failed."
        )
        setLabel(row.label)
        return
      }
      router.refresh()
    })
  }

  function toggleActive(checked: boolean) {
    startTransition(async () => {
      const r = await updateOption({ id: row.id, is_active: checked })
      if (!r.ok) toast.error("Save failed.")
      else router.refresh()
    })
  }

  function move(direction: "up" | "down") {
    startTransition(async () => {
      const r = await moveOption(row.id, direction)
      if (!r.ok) toast.error("Reorder failed.")
      else router.refresh()
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const r = await deleteOption(row.id)
      if (!r.ok) toast.error("Delete failed.")
      else {
        toast.success("Removed.")
        router.refresh()
      }
    })
  }

  return (
    <li className="flex items-center gap-2">
      <div className="flex flex-col gap-0.5">
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Move up"
          onClick={() => move("up")}
          disabled={isFirst || pending}
        >
          <ArrowUp className="size-3" />
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Move down"
          onClick={() => move("down")}
          disabled={isLast || pending}
        >
          <ArrowDown className="size-3" />
        </Button>
      </div>
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commitLabel}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commitLabel()
          }
        }}
        className="flex-1"
        maxLength={120}
        disabled={pending}
      />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <Checkbox
          checked={row.is_active}
          onCheckedChange={(v) => toggleActive(Boolean(v))}
          disabled={pending}
        />
        Active
      </label>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Delete option"
        onClick={handleDelete}
        disabled={pending}
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  )
}
