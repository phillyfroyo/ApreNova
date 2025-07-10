// src/app/[lang]/layout.tsx
import { ReactNode } from "react";

export default function LangLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Shared header/navigation here */}
      {/* Possibly a language switcher */}
      {children}
      {/* Shared footer here */}
    </>
  );
}
