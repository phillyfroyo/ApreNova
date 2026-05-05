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

// Fires Pixel + CAPI with a shared event_id so Meta dedupes them.
// `name` must be a standard event in the ALLOWED_EVENTS list of /api/meta/track.
export function trackEventDeduped(
  name: string,
  params?: Record<string, unknown>,
): void {
  const eventId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  trackEvent(name, params, eventId);

  // Mirror to CAPI server-side. Fire-and-forget — don't block the UI.
  // Use keepalive so the request survives navigation away from the page.
  fetch('/api/meta/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_name: name,
      event_id: eventId,
      custom_data: params,
      event_source_url: typeof window !== 'undefined' ? window.location.href : undefined,
    }),
    keepalive: true,
  }).catch(() => {});
}
