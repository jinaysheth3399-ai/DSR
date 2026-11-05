"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Step = "phone" | "otp"

const RESEND_COOLDOWN_SEC = 30

// Upper bound on a login request from the browser. The server already caps
// each database call at 15s, so this only fires if the request itself is
// stuck in transit; without it a stalled request leaves the button spinning
// forever.
const REQUEST_TIMEOUT_MS = 30_000

const UNREACHABLE_MSG = "Couldn't reach the server. Check your connection and try again."

// `res` is null when the request never completed (offline, timed out).
async function postJson(
  url: string,
  body: unknown
): Promise<{ res: Response | null; json: Record<string, unknown> }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
    return { res, json }
  } catch {
    return { res: null, json: {} }
  }
}

export function LoginForm() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("phone")
  const [phoneDigits, setPhoneDigits] = useState("")
  const [otp, setOtp] = useState("")
  const [cooldown, setCooldown] = useState(0)
  const [isPending, startTransition] = useTransition()

  const fullPhone = `+91${phoneDigits}`
  const phoneValid = /^[6-9]\d{9}$/.test(phoneDigits)
  const otpValid = /^\d{6}$/.test(otp)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function sendOtp(): Promise<boolean> {
    const { res, json } = await postJson("/api/auth/send-otp", { phone: fullPhone })
    if (!res) {
      toast.error(UNREACHABLE_MSG)
      return false
    }
    if (!res.ok || !json.ok) {
      toast.error("Couldn't send code. Try again in a moment.")
      return false
    }
    return true
  }

  function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!phoneValid) return
    startTransition(async () => {
      if (await sendOtp()) {
        setStep("otp")
        setCooldown(RESEND_COOLDOWN_SEC)
      }
    })
  }

  function handleResend() {
    if (cooldown > 0 || isPending) return
    startTransition(async () => {
      if (await sendOtp()) {
        toast.success("Code sent again.")
        setCooldown(RESEND_COOLDOWN_SEC)
      }
    })
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!otpValid) return
    startTransition(async () => {
      const { res, json } = await postJson("/api/auth/verify-otp", { phone: fullPhone, otp })
      if (!res) {
        toast.error(UNREACHABLE_MSG)
        return
      }

      if (!res.ok || !json.ok) {
        const msg =
          json.error === "expired_or_invalid"
            ? "Code has expired. Request a new one."
            : json.error === "too_many_attempts"
              ? "Too many attempts. Request a new code."
              : json.error === "unavailable"
                ? "The server is busy right now. Please try again in a minute."
                : "Wrong code."
        toast.error(msg)
        if (
          json.error === "expired_or_invalid" ||
          json.error === "too_many_attempts"
        ) {
          setOtp("")
          setStep("phone")
        }
        return
      }

      router.replace(json.role === "admin" ? "/admin" : "/dsr/new")
      router.refresh()
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
    >
      <Card className="w-full border-border/70 shadow-[0_1px_2px_oklch(0_0_0/0.04),0_8px_24px_-12px_oklch(0_0_0/0.08)]">
        <CardHeader>
          <CardTitle className="font-display text-2xl">
            {step === "phone" ? "Sign in" : "Enter code"}
          </CardTitle>
          <CardDescription>
            {step === "phone"
              ? "We'll text a one-time code to your registered number."
              : (
                <>
                  Sent to{" "}
                  <span className="font-medium text-foreground tabular">
                    {fullPhone}
                  </span>
                </>
              )}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {step === "phone" ? (
            <form onSubmit={handlePhoneSubmit} className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="phone">Mobile number</Label>
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-lg border border-r-0 border-input bg-muted/60 px-3 text-sm text-muted-foreground select-none">
                    +91
                  </span>
                  <Input
                    id="phone"
                    inputMode="numeric"
                    pattern="\d{10}"
                    maxLength={10}
                    className="h-10 rounded-l-none tabular"
                    placeholder="9876543210"
                    value={phoneDigits}
                    onChange={(e) =>
                      setPhoneDigits(
                        e.target.value.replace(/\D/g, "").slice(0, 10)
                      )
                    }
                    autoFocus
                    autoComplete="tel-national"
                  />
                </div>
              </div>
              <Button
                type="submit"
                size="lg"
                className="h-10"
                disabled={!phoneValid || isPending}
              >
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Send code
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="otp">One-time code</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="••••••"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  autoFocus
                  autoComplete="one-time-code"
                  className="h-12 text-center font-mono text-xl tracking-[0.5em] tabular"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="h-10"
                disabled={!otpValid || isPending}
              >
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Verify and continue
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setStep("phone")
                    setOtp("")
                  }}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  ← Change number
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || isPending}
                  className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50 disabled:hover:text-muted-foreground"
                >
                  {cooldown > 0
                    ? `Resend in ${cooldown}s`
                    : "Resend code"}
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
