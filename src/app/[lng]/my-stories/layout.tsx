// src/app/[lng]/my-stories/layout.tsx
// All routes under /[lng]/my-stories are auth-gated personal content.
// Belt-and-suspenders noindex: even if the auth gate is ever removed,
// this metadata tells Google to skip these pages entirely.

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function MyStoriesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
