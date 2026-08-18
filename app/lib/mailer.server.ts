import nodemailer from "nodemailer";

import { env } from "./env.server";

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface SendEmailResult {
  delivered: boolean;
}

const DEFAULT_SMTP_PORT = 587;

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const host = env.SMTP_HOST;
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.info("[mailer] Email not sent (SMTP is unset).", {
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    return { delivered: true };
  }

  const from = env.EMAIL_FROM ?? user;
  const port = env.SMTP_PORT ?? DEFAULT_SMTP_PORT;

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });

    await transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    return { delivered: true };
  } catch (error) {
    console.error("[mailer] SMTP send failed.", error);
    return { delivered: false };
  }
}
