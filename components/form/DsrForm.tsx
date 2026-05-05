"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form } from "@/components/ui/form"

import { Stepper } from "./Stepper"
import { HeaderStep } from "./steps/HeaderStep"
import { FlightStep } from "./steps/FlightStep"
import { HotelStep } from "./steps/HotelStep"
import { DmcStep } from "./steps/DmcStep"
import { VisitCloseStep } from "./steps/VisitCloseStep"
import {
  STEPS,
  STEP_FIELDS,
  STEP_TITLES,
  dsrFormDefaults,
  dsrFormSchema,
  type DsrFormValues,
  type StepKey,
} from "@/lib/schemas/dsr"
import { discardDraft, saveDraft, submitDsr } from "@/app/_actions/dsr"

type Props = {
  optionsByField: Record<string, string[]>
  initialDraft: {
    payload: Partial<DsrFormValues>
    currentStep: StepKey
    updatedAt: string
  } | null
}

const STEP_DESCRIPTIONS: Record<StepKey, string> = {
  header: "Who did you meet?",
  flight: "Their flight booking footprint.",
  hotel: "Hotel volumes and preferences.",
  dmc: "Destination management & competitor share.",
  close: "How did the visit land?",
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 30_000) return "just now"
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`
  return `${Math.round(ms / 86_400_000)}d ago`
}

export function DsrForm({ optionsByField, initialDraft }: Props) {
  const [step, setStep] = useState<StepKey>(initialDraft?.currentStep ?? "header")
  const [draftDecided, setDraftDecided] = useState(!initialDraft)
  const [showBanner, setShowBanner] = useState(Boolean(initialDraft))
  const [savedAt, setSavedAt] = useState<string | null>(initialDraft?.updatedAt ?? null)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [submitPending, startSubmit] = useTransition()

  const form = useForm<DsrFormValues>({
    resolver: zodResolver(dsrFormSchema),
    defaultValues: initialDraft
      ? { ...dsrFormDefaults, ...(initialDraft.payload as Partial<DsrFormValues>) }
      : dsrFormDefaults,
    mode: "onTouched",
  })

  const stepRef = useRef(step)
  useEffect(() => {
    stepRef.current = step
  }, [step])

  const submittingRef = useRef(false)

  // Auto-save (debounced) — gated until user resolved the draft banner.
  useEffect(() => {
    if (!draftDecided) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const sub = form.watch((data) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(async () => {
        if (submittingRef.current) return
        const r = await saveDraft(data, stepRef.current)
        if (r.ok) setSavedAt(r.updatedAt)
      }, 800)
    })
    return () => {
      sub.unsubscribe()
      if (timer) clearTimeout(timer)
    }
  }, [form, draftDecided])

  // Save current_step when the user navigates between steps.
  useEffect(() => {
    if (!draftDecided) return
    if (submittingRef.current) return
    void saveDraft(form.getValues(), step).then((r) => {
      if (r.ok) setSavedAt(r.updatedAt)
    })
  }, [step, draftDecided, form])

  function handleResume() {
    setShowBanner(false)
    setDraftDecided(true)
  }

  async function handleDiscard() {
    await discardDraft()
    form.reset(dsrFormDefaults)
    setStep("header")
    setShowBanner(false)
    setDraftDecided(true)
    setSavedAt(null)
  }

  async function handleNext() {
    const fields = [...STEP_FIELDS[step]] as Array<keyof DsrFormValues>
    const ok = await form.trigger(fields)
    if (!ok) return
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) {
      setDirection(1)
      setStep(STEPS[idx + 1])
    }
  }

  function handleBack() {
    const idx = STEPS.indexOf(step)
    if (idx > 0) {
      setDirection(-1)
      setStep(STEPS[idx - 1])
    }
  }

  function jumpToFirstError() {
    const errors = form.formState.errors
    const firstStep = STEPS.find((s) =>
      STEP_FIELDS[s].some(
        (f) => (errors as Record<string, unknown>)[f as string] !== undefined
      )
    )
    if (firstStep) {
      setDirection(STEPS.indexOf(firstStep) > STEPS.indexOf(step) ? 1 : -1)
      setStep(firstStep)
    }
  }

  function handleSubmit() {
    startSubmit(async () => {
      const valid = await form.trigger()
      if (!valid) {
        jumpToFirstError()
        toast.error("Some fields need attention.")
        return
      }
      submittingRef.current = true
      const result = await submitDsr(form.getValues())
      submittingRef.current = false
      if (result && !result.ok) {
        if (result.error === "validation_failed") {
          jumpToFirstError()
          toast.error("Validation failed. Please check the highlighted fields.")
        } else {
          toast.error("Couldn't save. Please try again.")
        }
      }
    })
  }

  const stepIndex = STEPS.indexOf(step)
  const isLastStep = stepIndex === STEPS.length - 1
  const isFirstStep = stepIndex === 0

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:py-12">
      <AnimatePresence>
        {showBanner && initialDraft && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-300/60 bg-amber-50/70 p-4 text-sm shadow-sm backdrop-blur-sm dark:border-amber-700/40 dark:bg-amber-950/25 sm:flex-row sm:items-center sm:justify-between"
          >
            <p>
              Resume your visit from{" "}
              <span className="font-medium">{timeAgo(initialDraft.updatedAt)}</span>?
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDiscard}>
                Discard
              </Button>
              <Button size="sm" onClick={handleResume}>
                Resume
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Stepper currentStep={step} />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
      >
        <Card className="mt-8 border-border/70 shadow-[0_1px_2px_oklch(0_0_0/0.04),0_8px_24px_-12px_oklch(0_0_0/0.08)]">
          <CardHeader className="space-y-1.5 pb-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Step {stepIndex + 1} · {String(stepIndex + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
            </p>
            <CardTitle className="font-display text-3xl leading-tight">
              {STEP_TITLES[step]}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {STEP_DESCRIPTIONS[step]}
            </p>
          </CardHeader>
          <div className="divider-hairline" />
          <CardContent className="pt-6">
            <Form {...form}>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (isLastStep) handleSubmit()
                  else void handleNext()
                }}
              >
                <div className="relative overflow-hidden">
                  <AnimatePresence mode="wait" initial={false} custom={direction}>
                    <motion.div
                      key={step}
                      custom={direction}
                      variants={{
                        enter: (d: number) => ({ opacity: 0, x: 24 * d }),
                        center: { opacity: 1, x: 0 },
                        exit: (d: number) => ({ opacity: 0, x: -24 * d }),
                      }}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                    >
                      {step === "header" && <HeaderStep />}
                      {step === "flight" && (
                        <FlightStep optionsByField={optionsByField} />
                      )}
                      {step === "hotel" && (
                        <HotelStep optionsByField={optionsByField} />
                      )}
                      {step === "dmc" && (
                        <DmcStep optionsByField={optionsByField} />
                      )}
                      {step === "close" && (
                        <VisitCloseStep optionsByField={optionsByField} />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="mt-10 flex items-center justify-between gap-3 border-t border-border/60 pt-5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={isFirstStep || submitPending}
                  >
                    <ArrowLeft className="size-4" />
                    Back
                  </Button>

                  <SaveIndicator savedAt={savedAt} />

                  <Button
                    type="submit"
                    disabled={submitPending}
                    className="min-w-[7.5rem]"
                  >
                    {submitPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : !isLastStep ? (
                      <ArrowRight className="size-4" />
                    ) : null}
                    {isLastStep ? "Submit" : "Next"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

function SaveIndicator({ savedAt }: { savedAt: string | null }) {
  const [now, setNow] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setNow((n) => n + 1), 15_000)
    return () => clearInterval(t)
  }, [])
  // `now` only matters as a tick to refresh timeAgo display
  void now
  if (!savedAt) return <span className="text-xs text-muted-foreground" />
  return (
    <motion.span
      initial={false}
      animate={{ opacity: 1 }}
      className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex"
    >
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-50" />
        <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
      </span>
      Saved {timeAgo(savedAt)}
    </motion.span>
  )
}
