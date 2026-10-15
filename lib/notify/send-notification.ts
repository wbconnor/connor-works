import { Resend } from 'resend';

export type Notification = { subject: string; text: string };

/**
 * Emails the admin inbox(es) in NOTIFY_EMAIL_TO. The only file that knows about the email
 * provider (ARCHITECTURE.md §12.1), so switching providers only changes this file.
 */
export async function sendNotification({ subject, text }: Notification): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const to = (process.env.NOTIFY_EMAIL_TO ?? '')
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean);

  const { error } = await resend.emails.send({ from: process.env.NOTIFY_EMAIL_FROM ?? '', to, subject, text });
  if (error) throw new Error(`Resend rejected the email: ${error.name}: ${error.message}`);
}
