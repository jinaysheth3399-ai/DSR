import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth/dal"
import { LoginForm } from "@/components/auth/LoginForm"

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) {
    redirect(user.role === "admin" ? "/admin" : "/dsr/new")
  }

  return (
    <div className="bg-editorial-aura flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10 space-y-3 text-center">
          <p className="font-display text-xs uppercase tracking-[0.32em] text-muted-foreground">
            Etrav · DSR
          </p>
          <h1 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">
            Welcome <span className="italic">back</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to record today&rsquo;s visits.
          </p>
        </div>
        <LoginForm />
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Trouble signing in? Ask an admin to confirm your number is on the
          whitelist.
        </p>
      </div>
    </div>
  )
}
