'use client';

import nextDynamic from 'next/dynamic';

const DesignGuideClient = nextDynamic(() => import('@/components/DesignGuideClient'), {
  ssr: false,
});

export default function Page() {
  return <DesignGuideClient />;
}
