import { createNotifyHandler } from '@/lib/notify/handler';
import { createRateLimiter } from '@/lib/notify/rate-limit';
import { sendNotification } from '@/lib/notify/send-notification';

// Admin email notifications for child apps. Only POST is exported, so other methods get a 405.
// Runs on the Node.js runtime, the default. (A `runtime` export isn't allowed with cacheComponents.)

export const POST = createNotifyHandler({
  send: sendNotification,
  allow: createRateLimiter({ limit: 30, windowMs: 60_000 }),
});
