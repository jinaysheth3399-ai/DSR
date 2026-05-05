import {
  getDashboardStats,
  listEmployeesForFilter,
  listSubmissions,
  type SubmissionFilters,
} from "@/app/_actions/submissions"
import { StatCards } from "@/components/admin/StatCards"
import { FilterBar } from "@/components/admin/FilterBar"
import { SubmissionsTable } from "@/components/admin/SubmissionsTable"
import { Pagination } from "@/components/admin/Pagination"
import { ExportCsvButton } from "@/components/admin/ExportCsvButton"

type SP = Record<string, string | string[] | undefined>

function pickString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0]
  return v
}

function rawFiltersFromParams(sp: SP): Partial<SubmissionFilters> {
  return {
    date_from: pickString(sp.date_from),
    date_to: pickString(sp.date_to),
    submitted_by: pickString(sp.submitted_by),
    outcome: pickString(sp.outcome) as SubmissionFilters["outcome"],
    has_lead: pickString(sp.has_lead) as SubmissionFilters["has_lead"],
    agency: pickString(sp.agency),
    page: pickString(sp.page) ? Number(pickString(sp.page)) : undefined,
  }
}

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<SP>
}) {
  const sp = await searchParams
  const filters = rawFiltersFromParams(sp)

  const [stats, page, employees] = await Promise.all([
    getDashboardStats(),
    listSubmissions(filters),
    listEmployeesForFilter(),
  ])

  const linkParams: Record<string, string | undefined> = {
    date_from: filters.date_from,
    date_to: filters.date_to,
    submitted_by: filters.submitted_by,
    outcome: filters.outcome,
    has_lead: filters.has_lead,
    agency: filters.agency,
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Admin
          </p>
          <h1 className="font-display text-4xl leading-tight tracking-tight">
            Submissions
          </h1>
          <p className="text-sm text-muted-foreground">
            Filtered visits across the team. Click a row for the full record.
          </p>
        </div>
        <ExportCsvButton filters={linkParams} />
      </header>

      <StatCards stats={stats} />

      <FilterBar employees={employees} />

      <SubmissionsTable rows={page.rows} />

      <Pagination
        page={page.page}
        totalPages={page.totalPages}
        total={page.total}
        pageSize={page.pageSize}
        searchParams={linkParams}
      />
    </div>
  )
}
