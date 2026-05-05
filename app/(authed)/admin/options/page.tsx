import { listAllOptions } from "@/app/_actions/options"
import { OptionsPanel } from "@/components/admin/OptionsPanel"

export default async function OptionsPage() {
  const options = await listAllOptions()

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 md:py-12">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Admin
        </p>
        <h1 className="font-display text-4xl leading-tight tracking-tight">
          Dropdown options
        </h1>
        <p className="text-sm text-muted-foreground">
          Edit what reps see in each multiselect or dropdown. Marking inactive
          hides an option from new entries while preserving past submissions
          that referenced it.
        </p>
      </header>

      <OptionsPanel options={options} />
    </div>
  )
}
