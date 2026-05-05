// Internal endpoint the client calls to mirror its Pixel events to CAPI.
// Keeps the access token server-side only.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';
import { sendCapiEvent, extractCapiUserContext } from '@/lib/meta-capi';

const ALLOWED_EVENTS = new Set([
  'PageView',
  'ViewContent',
  'CompleteRegistration',
  'Lead',
]);

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { event_name, event_id, custom_data, event_source_url } = body ?? {};

  if (typeof event_name !== 'string' || !ALLOWED_EVENTS.has(event_name)) {
    return NextResponse.json({ error: 'Invalid event_name' }, { status: 400 });
  }
  if (typeof event_id !== 'string' || !event_id) {
    return NextResponse.json({ error: 'Missing event_id' }, { status: 400 });
  }

  const session = await getServerSession(authOptions);

  let email: string | null = null;
  let externalId: string | null = null;
  let phone: string | null = null;

  if (session?.user?.id) {
    externalId = session.user.id;
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, phone: true },
    });
    email = user?.email ?? null;
    phone = user?.phone ?? null;
  }

  const ctx = extractCapiUserContext(req);

  await sendCapiEvent({
    eventName: event_name,
    eventId: event_id,
    eventSourceUrl: typeof event_source_url === 'string' ? event_source_url : null,
    customData: typeof custom_data === 'object' && custom_data ? custom_data : undefined,
    userData: {
      email,
      phone,
      externalId,
      ...ctx,
    },
  });

  return NextResponse.json({ ok: true });
}
