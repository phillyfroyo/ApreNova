// Meta Pixel client-side helpers.
// `fbq` is injected by the Pixel base script loaded in <MetaPixel>.

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export function pixelEnabled(): boolean {
  return typeof window !== 'undefined' && !!window.fbq && !!META_PIXEL_ID;
}

export function trackPageView(): void {
  if (!pixelEnabled()) return;
  window.fbq!('track', 'PageView');
}

// Standard events: 'ViewContent', 'CompleteRegistration', 'Lead', etc.
// Custom events use trackCustom().
// `eventID` enables deduplication when the same event is also sent via CAPI.
export function trackEvent(
  name: string,
  params?: Record<string, unknown>,
  eventID?: string,
): void {
  if (!pixelEnabled()) return;
  const options = eventID ? { eventID } : undefined;
  window.fbq!('track', name, params ?? {}, options);
}

export function trackCustomEvent(
  name: string,
  params?: Record<string, unknown>,
  eventID?: string,
): void {
  if (!pixelEnabled()) return;
  const options = eventID ? { eventID } : undefined;
  window.fbq!('trackCustom', name, params ?? {}, options);
}

function generateEventId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function mirrorToCapi(
  name: string,
  eventId: string,
  params: Record<string, unknown> | undefined,
  isCustom: boolean,
): void {
  fetch('/api/meta/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_name: name,
      event_id: eventId,
      custom_data: params,
      event_source_url: typeof window !== 'undefined' ? window.location.href : undefined,
      is_custom: isCustom,
    }),
    keepalive: true,
  }).catch(() => {});
}

// Fires Pixel + CAPI with a shared event_id so Meta dedupes them.
// `name` must be a standard event in the ALLOWED_EVENTS list of /api/meta/track.
export function trackEventDeduped(
  name: string,
  params?: Record<string, unknown>,
): void {
  const eventId = generateEventId();
  trackEvent(name, params, eventId);
  mirrorToCapi(name, eventId, params, false);
}

// Same as trackEventDeduped but for custom (non-standard) events.
// `name` must be in CUSTOM_EVENTS in /api/meta/track.
export function trackCustomEventDeduped(
  name: string,
  params?: Record<string, unknown>,
): void {
  const eventId = generateEventId();
  trackCustomEvent(name, params, eventId);
  mirrorToCapi(name, eventId, params, true);
}
