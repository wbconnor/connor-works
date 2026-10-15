import { connection } from 'next/server';

// Railway health check. connection() keeps it from being prerendered at build time,
// so a 200 means the server is actually answering.
export async function GET() {
  await connection();
  return Response.json({ ok: true });
}
