import { requireAdmin } from "@/lib/auth/dal"
import { listEmployees } from "@/app/_actions/employees"
import { EmployeesPanel } from "@/components/admin/EmployeesPanel"
import { BulkUpload } from "@/components/admin/BulkUpload"

export default async function EmployeesPage() {
  const me = await requireAdmin()
  const employees = await listEmployees()

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 md:py-12">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Admin
        </p>
        <h1 className="font-display text-4xl leading-tight tracking-tight">
          Employees
        </h1>
        <p className="text-sm text-muted-foreground">
          The whitelist. Anyone here can request an OTP and sign in.
        </p>
      </header>

      <BulkUpload />

      <EmployeesPanel
        initialEmployees={employees}
        currentEmployeeId={me.employee_id}
      />
    </div>
  )
}
