import { redirect } from "next/navigation"

import { requireUser } from "@/lib/auth/dal"
import { AgentMeetingForm } from "@/components/form/AgentMeetingForm"
import { AGENT_MEETING_EMPLOYEE_CODE } from "@/app/_actions/agent-meeting"

export default async function KaranMeetingPage() {
  const user = await requireUser()
  if (user.employee_code !== AGENT_MEETING_EMPLOYEE_CODE) {
    redirect("/dsr/new")
  }
  return <AgentMeetingForm />
}
