import Link from "next/link"

import { logout } from "@/app/_actions/auth"
import type { CurrentUser } from "@/lib/auth/dal"

export function Header({ user }: { user: CurrentUser }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/55">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="font-display text-2xl italic leading-none tracking-tight"
        >
          DSR
        </Link>

        <div className="flex items-center gap-5 text-sm">
          {user.role === "admin" && (
            <nav className="hidden items-center gap-5 md:flex">
              <Link
                href="/admin/submissions"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Submissions
              </Link>
              <Link
                href="/admin/employees"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Employees
              </Link>
              <Link
                href="/admin/options"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Options
              </Link>
            </nav>
          )}

          <span className="hidden text-muted-foreground sm:inline">
            <span className="text-foreground">{user.full_name}</span>
            <span className="opacity-50"> · {user.employee_code}</span>
          </span>

          <form action={logout}>
            <button
              type="submit"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
