import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { getSubmission } from "@/app/_actions/submissions"
import { SubmissionDetailView } from "@/components/admin/SubmissionDetailView"

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const submission = await getSubmission(id)
  if (!submission) notFound()

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
      <Link
        href="/admin/submissions"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Back to submissions
      </Link>
      <SubmissionDetailView submission={submission} />
    </div>
  )
}
