import { describe, expect, test, vi } from 'vitest';
import { MAX_TEXT_BYTES, createNotifyHandler } from '@/lib/notify/handler';
import { createRateLimiter } from '@/lib/notify/rate-limit';

const env = {
  RESEND_API_KEY: 're_test',
  NOTIFY_EMAIL_FROM: 'notify@connor.works',
  NOTIFY_EMAIL_TO: 'admin@example.com',
  NOTIFY_API_KEY: 'secret-key',
};
const validBody = { app: 'meridian-underground', subject: 'New RSVP', text: 'Someone RSVPed.' };

function setup(overrides: { env?: Record<string, string | undefined>; allow?: () => boolean } = {}) {
  const send = vi.fn().mockResolvedValue(undefined);
  const logger = { warn: vi.fn(), error: vi.fn() };
  const POST = createNotifyHandler({ send, allow: overrides.allow ?? (() => true), env: overrides.env ?? env, logger });
  return { POST, send, logger };
}

function request(body: unknown = validBody, key: string | null = env.NOTIFY_API_KEY) {
  return new Request('http://localhost/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key === null ? {} : { Authorization: `Bearer ${key}` }) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/notify', () => {
  test('202: sends the email with the [app] subject prefix', async () => {
    const { POST, send } = setup();
    const response = await POST(request());
    expect(response.status).toBe(202);
    expect(send).toHaveBeenCalledWith({ subject: '[meridian-underground] New RSVP', text: 'Someone RSVPed.' });
  });

  test.each([
    ['missing', null],
    ['wrong', 'not-the-key'],
    ['empty', ''],
  ])('401 on a %s key, without reading the body', async (_, key) => {
    const { POST, send } = setup();
    const req = request(validBody, key);
    const response = await POST(req);
    expect(response.status).toBe(401);
    expect(req.bodyUsed).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  test('401 on a non-Bearer authorization header', async () => {
    const { POST } = setup();
    const req = new Request('http://localhost/api/notify', {
      method: 'POST',
      headers: { Authorization: env.NOTIFY_API_KEY },
      body: JSON.stringify(validBody),
    });
    expect((await POST(req)).status).toBe(401);
  });

  test.each([
    ['invalid JSON', '{not json'],
    ['a non-object', '"hello"'],
    ['a missing app', { subject: 'Hi', text: 'Body' }],
    ['an unknown app', { ...validBody, app: 'no-such-app' }],
    ['a missing subject', { app: validBody.app, text: 'Body' }],
    ['a blank subject', { ...validBody, subject: '  ' }],
    ['a multi-line subject', { ...validBody, subject: 'Hi\r\nBcc: x@example.com' }],
    ['an oversized subject', { ...validBody, subject: 'x'.repeat(201) }],
    ['a missing text', { app: validBody.app, subject: 'Hi' }],
    ['a non-string text', { ...validBody, text: 42 }],
    ['an oversized text', { ...validBody, text: 'x'.repeat(MAX_TEXT_BYTES + 1) }],
    ['text over 4 KB in bytes but not characters', { ...validBody, text: 'é'.repeat(MAX_TEXT_BYTES / 2 + 1) }],
  ])('400 on %s', async (_, body) => {
    const { POST, send } = setup();
    expect((await POST(request(body))).status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  test('accepts text of exactly 4 KB', async () => {
    const { POST } = setup();
    expect((await POST(request({ ...validBody, text: 'x'.repeat(MAX_TEXT_BYTES) }))).status).toBe(202);
  });

  test('429 when rate-limited, before checking the key', async () => {
    const { POST, send } = setup({ allow: () => false });
    expect((await POST(request())).status).toBe(429);
    expect((await POST(request(validBody, 'wrong'))).status).toBe(429);
    expect(send).not.toHaveBeenCalled();
  });

  test.each(['RESEND_API_KEY', 'NOTIFY_EMAIL_FROM', 'NOTIFY_EMAIL_TO', 'NOTIFY_API_KEY'])(
    '503 when %s is not set, warning once',
    async (name) => {
      const { POST, send, logger } = setup({ env: { ...env, [name]: undefined } });
      expect((await POST(request())).status).toBe(503);
      expect((await POST(request())).status).toBe(503);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn.mock.calls[0][0]).toContain(name);
      expect(send).not.toHaveBeenCalled();
    },
  );

  test('502 and logs when sending fails', async () => {
    const { POST, send, logger } = setup();
    send.mockRejectedValueOnce(new Error('provider down'));
    expect((await POST(request())).status).toBe(502);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});

describe('createRateLimiter', () => {
  test('allows `limit` requests per window, then recovers as old requests age out', () => {
    let time = 0;
    const allow = createRateLimiter({ limit: 30, windowMs: 60_000, now: () => time });
    for (let i = 0; i < 30; i++) expect(allow()).toBe(true);
    expect(allow()).toBe(false);
    time = 59_999;
    expect(allow()).toBe(false);
    time = 60_000;
    expect(allow()).toBe(true);
  });
});
