/**
 * Direct SMTP mailer using nodemailer.
 * Configure via environment variables:
 *   SMTP_HOST   e.g. smtp.gmail.com or mail.duupflow.com
 *   SMTP_PORT   e.g. 465 (SSL) or 587 (TLS) — defaults to 587
 *   SMTP_USER   e.g. hello@duupflow.com
 *   SMTP_PASS   app password or SMTP password
 *   SMTP_FROM   optional, defaults to SMTP_USER
 */
import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

interface MailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendMail({ to, subject, html, replyTo }: MailOptions) {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  const transport = createTransport();
  await transport.sendMail({ from, to, subject, html, replyTo });
}
