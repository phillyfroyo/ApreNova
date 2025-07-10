// src/app/[lng]/layout.tsx
import type { ReactNode } from "react";

export default function LngLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
