// Meta Conversions API (CAPI) — server-side event sender.
// Mirrors browser Pixel events for stronger matching + survives ad blockers.
// Docs: https://developers.facebook.com/docs/marketing-api/conversions-api

import crypto from 'node:crypto';

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE;
const GRAPH_VERSION = 'v22.0';

export type CapiUserData = {
  email?: string | null;
  phone?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  fbp?: string | null; // _fbp cookie value
  fbc?: string | null; // _fbc cookie value (click ID)
  externalId?: string | null; // typically your DB user id
};

export type CapiEvent = {
  eventName: string;
  eventId?: string; // for client+server dedup
  eventSourceUrl?: string | null;
  customData?: Record<string, unknown>;
  userData: CapiUserData;
};

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeAndHash(value: string | null | undefined, lowercase = true): string | undefined {
  if (!value) return undefined;
  const normalized = lowercase ? value.trim().toLowerCase() : value.trim();
  if (!normalized) return undefined;
  return sha256(normalized);
}

function buildUserData(user: CapiUserData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const em = normalizeAndHash(user.email);
  if (em) out.em = [em];
  const ph = normalizeAndHash(user.phone?.replace(/\D/g, ''), false);
  if (ph) out.ph = [ph];
  if (user.externalId) out.external_id = [sha256(user.externalId)];
  if (user.ipAddress) out.client_ip_address = user.ipAddress;
  if (user.userAgent) out.client_user_agent = user.userAgent;
  if (user.fbp) out.fbp = user.fbp;
  if (user.fbc) out.fbc = user.fbc;
  return out;
}

export function capiConfigured(): boolean {
  return !!PIXEL_ID && !!ACCESS_TOKEN;
}

// Sends a single event to Meta. Never throws — logs on failure so it can't
// break the calling request. Caller decides whether to await or fire-and-forget.
export async function sendCapiEvent(event: CapiEvent): Promise<void> {
  if (!capiConfigured()) return;

  const payload = {
    data: [
      {
        event_name: event.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        event_source_url: event.eventSourceUrl ?? undefined,
        action_source: 'website',
        user_data: buildUserData(event.userData),
        custom_data: event.customData ?? {},
      },
    ],
    ...(TEST_EVENT_CODE ? { test_event_code: TEST_EVENT_CODE } : {}),
  };

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn(`[CAPI] ${event.eventName} failed: ${res.status} ${body}`);
    }
  } catch (err) {
    console.warn(`[CAPI] ${event.eventName} error:`, err);
  }
}

// Pulls IP, UA, and Meta cookies off an incoming Next.js request.
// Pass to sendCapiEvent() so Meta can match the server event back to the user's browser.
export function extractCapiUserContext(req: Request): {
  ipAddress: string | null;
  userAgent: string | null;
  fbp: string | null;
  fbc: string | null;
} {
  const headers = req.headers;
  const forwardedFor = headers.get('x-forwarded-for');
  const ipAddress = forwardedFor ? forwardedFor.split(',')[0]!.trim() : headers.get('x-real-ip');
  const userAgent = headers.get('user-agent');

  const cookieHeader = headers.get('cookie') ?? '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    }),
  );

  return {
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    fbp: cookies['_fbp'] ?? null,
    fbc: cookies['_fbc'] ?? null,
  };
}
