import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  searchParams,
}: {
  page: number
  totalPages: number
  total: number
  pageSize: number
  searchParams: Record<string, string | undefined>
}) {
  function buildHref(p: number): string {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(searchParams)) {
      if (v != null && v !== "") sp.set(k, v)
    }
    sp.set("page", String(p))
    return `?${sp.toString()}`
  }

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  const prevDisabled = page <= 1
  const nextDisabled = page >= totalPages

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <p>
        {total === 0
          ? "No results"
          : `Showing ${start}–${end} of ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={prevDisabled ? "#" : buildHref(page - 1)}
          aria-disabled={prevDisabled}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            prevDisabled && "pointer-events-none opacity-50"
          )}
          scroll={false}
        >
          <ChevronLeft className="size-4" /> Previous
        </Link>
        <span className="text-xs tabular-nums">
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <Link
          href={nextDisabled ? "#" : buildHref(page + 1)}
          aria-disabled={nextDisabled}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            nextDisabled && "pointer-events-none opacity-50"
          )}
          scroll={false}
        >
          Next <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  )
}
