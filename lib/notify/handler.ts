import { createHash, timingSafeEqual } from 'node:crypto';
import { zones } from '@connor-works/config';
import type { Notification } from './send-notification';

// POST /api/notify (ARCHITECTURE.md §12.2, DESIGN.md §8)

export const REQUIRED_ENV = ['RESEND_API_KEY', 'NOTIFY_EMAIL_FROM', 'NOTIFY_EMAIL_TO', 'NOTIFY_API_KEY'] as const;
export const MAX_TEXT_BYTES = 4096;
export const MAX_SUBJECT_LENGTH = 200;
// Generous ceiling for the whole JSON body, checked before it's read
const MAX_BODY_BYTES = 16 * 1024;

type Dependencies = {
  send: (notification: Notification) => Promise<void>;
  /** Rate limiter: returns false when the request should get a 429 */
  allow: () => boolean;
  env?: Record<string, string | undefined>;
  logger?: Pick<Console, 'warn' | 'error'>;
};

const json = (body: unknown, status: number) => Response.json(body, { status });

/** Compares SHA-256 digests so the buffers are equal length and the comparison is constant-time */
function keyMatches(given: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

function parseBody(raw: string): { app: string; subject: string; text: string } | string {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return 'Body must be JSON';
  }
  if (typeof body !== 'object' || body === null) return 'Body must be a JSON object';
  const { app, subject, text } = body as Record<string, unknown>;

  if (typeof app !== 'string' || !Object.hasOwn(zones, app)) return '"app" must be an app in the zone registry';
  if (typeof subject !== 'string' || subject.trim() === '') return '"subject" is required';
  if (subject.length > MAX_SUBJECT_LENGTH) return `"subject" must be at most ${MAX_SUBJECT_LENGTH} characters`;
  if (/[\r\n]/.test(subject)) return '"subject" must be a single line';
  if (typeof text !== 'string' || text.trim() === '') return '"text" is required';
  if (Buffer.byteLength(text) > MAX_TEXT_BYTES) return `"text" must be at most ${MAX_TEXT_BYTES} bytes`;
  return { app, subject, text };
}

export function createNotifyHandler({ send, allow, env = process.env, logger = console }: Dependencies) {
  let warnedUnconfigured = false;

  return async function POST(request: Request): Promise<Response> {
    if (!allow()) return json({ error: 'Too many requests' }, 429);

    const missing = REQUIRED_ENV.filter((name) => !env[name]);
    if (missing.length > 0) {
      if (!warnedUnconfigured) {
        logger.warn(`/api/notify is disabled: ${missing.join(', ')} not set`);
        warnedUnconfigured = true;
      }
      return json({ error: 'Notifications are not configured' }, 503);
    }

    // Check the key before reading the body
    const header = request.headers.get('authorization') ?? '';
    const key = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    if (!key || !keyMatches(key, env.NOTIFY_API_KEY!)) return json({ error: 'Unauthorized' }, 401);

    if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
      return json({ error: 'Body too large' }, 400);
    }
    const body = parseBody(await request.text());
    if (typeof body === 'string') return json({ error: body }, 400);

    try {
      await send({ subject: `[${body.app}] ${body.subject}`, text: body.text });
    } catch (error) {
      // No retries: this is a low-volume, non-critical path (ARCHITECTURE.md §12.2)
      logger.error('/api/notify: sending failed', error);
      return json({ error: 'Sending failed' }, 502);
    }
    return json({ ok: true }, 202);
  };
}
