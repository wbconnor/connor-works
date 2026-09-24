// Railway health check ({{HEALTH_PATH}}). Add a database ping here once the app has one.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ ok: true });
}
