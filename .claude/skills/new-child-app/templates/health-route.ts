// Railway health check ({{HEALTH_PATH}}). Add a database ping here once the app has one.
import { connection } from 'next/server';

// connection() keeps the response from being prerendered at build time. (`dynamic = 'force-dynamic'`
// is a build error when cacheComponents is on, which create-next-app enables by default.)
export async function GET() {
  await connection();
  return Response.json({ ok: true });
}
