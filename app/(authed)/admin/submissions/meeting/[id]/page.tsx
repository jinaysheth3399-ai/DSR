import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { getAgentMeetingReport } from "@/app/_actions/agent-meeting"
import { AgentMeetingDetailView } from "@/components/admin/AgentMeetingDetailView"

export default async function AgentMeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const report = await getAgentMeetingReport(id)
  if (!report) notFound()

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
      <Link
        href="/admin/submissions"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Back to submissions
      </Link>
      <AgentMeetingDetailView report={report} />
    </div>
  )
}
