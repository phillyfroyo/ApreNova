'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { trackEvent } from '@/lib/meta-pixel';

// Reads `?newUser=1` from the URL after Google OAuth post-login redirect,
// fires CompleteRegistration once, then strips the param so refreshes don't re-fire.
// Uses the event_id from `?newUserEid=` so it dedupes against the CAPI event
// fired server-side in /api/post-login.
export default function NewUserPixelEvent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (searchParams.get('newUser') !== '1') return;
    fired.current = true;

    const eventId = searchParams.get('newUserEid') ?? undefined;
    trackEvent('CompleteRegistration', { method: 'google' }, eventId);

    const params = new URLSearchParams(searchParams.toString());
    params.delete('newUser');
    params.delete('newUserEid');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, searchParams, router]);

  return null;
}
