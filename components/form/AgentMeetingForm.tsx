"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import { MultiSelectChips } from "@/components/form/MultiSelectChips"
import { submitAgentMeeting } from "@/app/_actions/agent-meeting"
import {
  DESTINATION_OPTIONS,
  agentMeetingFormDefaults,
  agentMeetingFormSchema,
  type AgentMeetingFormValues,
} from "@/lib/schemas/agent-meeting"

export function AgentMeetingForm() {
  const [pending, startSubmit] = useTransition()

  const form = useForm<AgentMeetingFormValues>({
    resolver: zodResolver(agentMeetingFormSchema),
    defaultValues: agentMeetingFormDefaults,
    mode: "onTouched",
  })

  function handleSubmit(values: AgentMeetingFormValues) {
    startSubmit(async () => {
      const result = await submitAgentMeeting(values)
      if (result && !result.ok) {
        if (result.error === "validation_failed") {
          toast.error("Validation failed. Please check the highlighted fields.")
        } else if (result.error === "forbidden") {
          toast.error("You don't have access to this form.")
        } else {
          toast.error("Couldn't save. Please try again.")
        }
      }
    })
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:py-12">
      <Card className="border-border/70 shadow-[0_1px_2px_oklch(0_0_0/0.04),0_8px_24px_-12px_oklch(0_0_0/0.08)]">
        <CardHeader className="space-y-1.5 pb-4">
          <CardTitle className="font-display text-3xl leading-tight">
            Agent Meeting Report
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Date of visit is recorded automatically as today.
          </p>
        </CardHeader>
        <div className="divider-hairline" />
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="travel_agent_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Travel Agent Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Agent or agency name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="agent_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agent code</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. ETAG-1234" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="City" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="business_aspect"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Aspect</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Business aspect discussed" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="current_challenges"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Challenges or Feedback</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Challenges or feedback raised" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="meeting_summary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meeting Summary</FormLabel>
                    <FormControl>
                      <Textarea rows={4} placeholder="Summary of the meeting" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="potential_queries"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Potential Queries</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Potential queries raised" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="destinations_interested"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destinations interested</FormLabel>
                    <FormControl>
                      <MultiSelectChips
                        options={DESTINATION_OPTIONS}
                        value={field.value}
                        onChange={field.onChange}
                        ariaLabel="Destinations interested"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end border-t border-border/60 pt-5">
                <Button type="submit" disabled={pending} className="min-w-[7.5rem]">
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Submit
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
