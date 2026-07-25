import { z } from "zod"

// ---------------------------------------------------------------------------
// Agent meeting report — standalone form, currently restricted to a single
// employee (Karan Makdani, employee_code EC052; see app/_actions/agent-meeting.ts).
// ---------------------------------------------------------------------------

export const DESTINATION_OPTIONS = [
  "Dubai",
  "Bali",
  "Vietnam",
  "Thailand",
  "Maldives",
  "Others",
] as const

export const agentMeetingFormSchema = z.object({
  travel_agent_name: z.string().trim().min(1, "Required").max(200),
  agent_code: z.string().trim().min(1, "Required").max(50),
  city: z.string().trim().min(1, "Required").max(100),
  business_aspect: z.string().trim().min(1, "Required").max(500),
  current_challenges: z.string().trim().min(1, "Required").max(2000),
  meeting_summary: z.string().trim().min(1, "Required").max(2000),
  potential_queries: z.string().trim().min(1, "Required").max(2000),
  destinations_interested: z
    .array(z.enum(DESTINATION_OPTIONS))
    .min(1, "Pick at least one"),
})

export type AgentMeetingFormValues = z.infer<typeof agentMeetingFormSchema>

export const agentMeetingFormDefaults: AgentMeetingFormValues = {
  travel_agent_name: "",
  agent_code: "",
  city: "",
  business_aspect: "",
  current_challenges: "",
  meeting_summary: "",
  potential_queries: "",
  destinations_interested: [],
}
