import { useParams } from "next/navigation";
import type { Language } from "@/types/i18n";

export function useTypedLang(): Language {
  const { lang } = useParams();
  return lang as Language;
}
