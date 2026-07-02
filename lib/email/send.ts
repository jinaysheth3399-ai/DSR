import "server-only"

import { Resend } from "resend"

import { logger } from "@/lib/logger"

export class EmailSendError extends Error {
  constructor(public readonly reason: string) {
    super(`Email send failed: ${reason}`)
    this.name = "EmailSendError"
  }
}

export type EmailAttachment = {
  filename: string
  content: Buffer
  contentType?: string
}

export async function sendEmail(opts: {
  to: string[]
  subject: string
  html: string
  attachments?: EmailAttachment[]
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new EmailSendError("provider_not_configured")
  }
  const from = process.env.REPORT_EMAIL_FROM ?? "onboarding@resend.dev"

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  })

  if (error) {
    logger.error("[email] send failed", { name: error.name, message: error.message })
    throw new EmailSendError(error.message)
  }
}
