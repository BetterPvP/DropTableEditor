import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  code: z.string().min(4),
  email: z.string().email(),
});

const ALLOWED_CODES = new Set(['ADMIN-1234', 'DEV-SPACE']);

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (!ALLOWED_CODES.has(parsed.data.code.toUpperCase())) {
    return NextResponse.json({ error: 'Invite code not recognised' }, { status: 403 });
  }

  return NextResponse.json({ ok: true, role: 'admin' });
}
