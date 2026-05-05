// Generates UUIDs for Pixel + CAPI event deduplication.
// When the same event is fired both client-side (Pixel) and server-side (CAPI)
// with the same event_id, Meta dedupes them automatically.

export function newEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older environments — extremely unlikely path in Next 16.
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
