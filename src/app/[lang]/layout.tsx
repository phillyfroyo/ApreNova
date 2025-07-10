// src/app/[lang]/layout.tsx
import { ReactNode } from "react";
import { useParams } from "next/navigation";

export default function LangLayout({ children }: { children: ReactNode }) {
  const { lang } = useParams();
  const typedLang = lang === "en" || lang === "es" ? lang : "es";

  return (
    <html lang={typedLang}>
      <body>
        {/* Put shared header/navigation here */}
        {/* Possibly a language switcher */}
        {children}
        {/* Put shared footer here */}
      </body>
    </html>
  );
}
