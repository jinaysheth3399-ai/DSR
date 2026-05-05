"use client"

import { motion } from "framer-motion"
import { Check } from "lucide-react"

import { STEPS, STEP_TITLES, type StepKey } from "@/lib/schemas/dsr"
import { cn } from "@/lib/utils"

export function Stepper({ currentStep }: { currentStep: StepKey }) {
  const currentIndex = STEPS.indexOf(currentStep)
  const progress = currentIndex / (STEPS.length - 1)

  return (
    <div className="w-full">
      {/* Hairline progress rail (desktop visual layer) */}
      <div className="relative hidden h-7 items-center md:flex">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
        <motion.div
          className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-foreground"
          initial={false}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        />
        <ol className="relative flex w-full justify-between">
          {STEPS.map((step, idx) => {
            const isDone = idx < currentIndex
            const isActive = idx === currentIndex
            return (
              <li key={step} className="flex items-center gap-2.5">
                <motion.span
                  layout
                  initial={false}
                  animate={{
                    scale: isActive ? 1.05 : 1,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 320,
                    damping: 22,
                  }}
                  className={cn(
                    "relative z-10 flex size-7 items-center justify-center rounded-full border text-[11px] font-medium tabular transition-colors",
                    isDone &&
                      "border-foreground bg-foreground text-background",
                    isActive &&
                      "border-foreground bg-background text-foreground shadow-[0_0_0_4px_var(--background)]",
                    !isDone &&
                      !isActive &&
                      "border-border bg-background text-muted-foreground shadow-[0_0_0_4px_var(--background)]"
                  )}
                >
                  {isDone ? <Check className="size-3.5" /> : idx + 1}
                </motion.span>
                <span
                  className={cn(
                    "text-sm transition-colors",
                    isActive
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {STEP_TITLES[step]}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      {/* Mobile compact view */}
      <div className="md:hidden">
        <div className="flex items-center justify-between text-xs">
          <span className="font-display text-base italic">
            {STEP_TITLES[currentStep]}
          </span>
          <span className="text-muted-foreground tabular">
            Step {currentIndex + 1} of {STEPS.length}
          </span>
        </div>
        <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-border">
          <motion.div
            className="h-full bg-foreground"
            initial={false}
            animate={{ width: `${((currentIndex + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          />
        </div>
      </div>
    </div>
  )
}
