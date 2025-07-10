// src/app/[lang]/layout.tsx
import type { ReactNode } from "react";
import type { Language } from "@/types/i18n";

type LayoutProps = {
  children: ReactNode;
  params: {
    lang: string;
  };
};

export default function LangLayout({ children, params }: LayoutProps) {
  const lang = ["en", "es"].includes(params.lang) ? params.lang : "es";

  return (
    <html lang={lang} translate="no">
      <body>{children}</body>
    </html>
  );
}
