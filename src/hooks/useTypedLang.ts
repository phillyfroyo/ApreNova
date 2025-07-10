import { useParams } from "next/navigation";
import type { Language } from "@/types/i18n";

export function useTypedLang(): Language {
  const { lng } = useParams();
  return lng as Language;
}
