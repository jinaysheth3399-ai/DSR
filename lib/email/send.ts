import "server-only"

import nodemailer from "nodemailer"

import { logger } from "@/lib/logger"

// ---------------------------------------------------------------------------
// SMTP email sender (default: Gmail). Gmail requires an app password (needs
// 2FA enabled on the sending account) rather than the normal account
// password: https://myaccount.google.com/apppasswords
// ---------------------------------------------------------------------------

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
  const host = process.env.SMTP_HOST ?? "smtp.gmail.com"
  const port = Number(process.env.SMTP_PORT ?? 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!user || !pass) {
    throw new EmailSendError("provider_not_configured")
  }

  const from = process.env.REPORT_EMAIL_FROM ?? user

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  try {
    await transporter.sendMail({
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown"
    logger.error("[email] send failed", { msg })
    throw new EmailSendError(msg)
  }
}
