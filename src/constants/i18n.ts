// src/constants/i18n.ts
import type { Language } from "@/types/i18n";

export const translations: Record<Language, Record<string, string>> = {
  en: {
    complete: "Mark as Complete",
    next: "Next",
    welcome: "Welcome to AprendO",
  },
  es: {
    complete: "Marcar como completado",
    next: "Siguiente",
    welcome: "Bienvenido a AprendO",
  },
};
