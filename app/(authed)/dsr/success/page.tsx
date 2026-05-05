import Link from "next/link"

import { requireUser } from "@/lib/auth/dal"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SuccessAnimation } from "@/components/form/SuccessAnimation"

export default async function SubmissionSuccessPage() {
  await requireUser()
  return (
    <div className="bg-editorial-aura flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <SuccessAnimation />
        <p className="mt-8 font-display text-xs uppercase tracking-[0.32em] text-muted-foreground">
          Visit · Recorded
        </p>
        <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">
          All <span className="italic">set.</span>
        </h1>
        <p className="mt-3 max-w-xs text-sm text-muted-foreground">
          Your DSR entry is saved and visible to admins.
        </p>
        <Link
          href="/dsr/new"
          className={cn(
            buttonVariants({ size: "lg" }),
            "mt-8 h-11 px-6"
          )}
        >
          Record another visit
        </Link>
      </div>
    </div>
  )
}
