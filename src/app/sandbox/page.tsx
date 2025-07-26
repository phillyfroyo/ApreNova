"use client";

import { usePathname } from "next/navigation";
import StoryLayoutSandbox from "@/components/StoryLayoutSandbox";
import StoryLayoutExperimental from "@/components/StoryLayoutExperimental";

// Mock story data sets for different testing scenarios - now mapped to pages
const mockDataSets = {
  1: [
    { en: "Hello world.", es: "Hola mundo." },
    { en: "This is a test.", es: "Esta es una prueba." },
    { en: "Testing UI elements.", es: "Probando elementos de la interfaz." }
  ],
  2: [
    { en: "Maya's name was third on the list.", es: "El nombre de Maya estaba en tercer lugar en la lista." },
    { en: "She looked at it, written on the white board at the front of the classroom:", es: "Lo miró, escrito en la pizarra blanca al frente del salón:" },
    { en: "Daniel, Jo, Maya.", es: "Daniel, Jo, Maya." },
    { en: "Her note cards shook in her hands.", es: "Sus tarjetas temblaban en sus manos." },
    { en: "She had practiced the history presentation ten times the night before.", es: "Había practicado la presentación de historia diez veces la noche anterior." }
  ],
  3: [
    { en: "Maya's name was third on the list.", es: "El nombre de Maya estaba en tercer lugar en la lista." },
    { en: "She looked at it, written on the white board at the front of the classroom:", es: "Lo miró, escrito en la pizarra blanca al frente del salón:" },
    { en: "Daniel, Jo, Maya.", es: "Daniel, Jo, Maya." },
    { en: "Her note cards shook in her hands.", es: "Sus tarjetas temblaban en sus manos." },
    { en: "She had practiced the history presentation ten times the night before.", es: "Había practicado la presentación de historia diez veces la noche anterior." },
    { en: "She practiced in her bedroom, into the mirror, she even read it to her dog.", es: "Practicó en su habitación, frente al espejo, incluso se la leyó a su perro." },
    { en: "It sounded okay then. Maybe even pretty good.", es: "En ese momento sonaba bien. Tal vez incluso bastante bien." },
    { en: "\"Daniel, you're up,\" said Mr. Flores happily.", es: "\"Daniel, te toca,\" dijo el Sr. Flores con alegría." },
    { en: "Maya tried to take deep breaths, counting backwards like the app on her phone said to do.", es: "Maya trató de respirar profundo, contando hacia atrás como decía la app en su teléfono." }
  ],
  4: [
    { en: "This has <em>italic text</em> in it.", es: "Esto tiene <em>texto en cursiva</em> en él." },
    { en: "And this has <strong>bold text</strong> too.", es: "Y esto también tiene <strong>texto en negrita</strong>." },
    { en: "Some text with <em>multiple</em> <strong>formatting</strong> elements.", es: "Algo de texto con <em>múltiples</em> elementos de <strong>formato</strong>." }
  ]
};

// Mock story map with 4 pages
const mockStoryMap = {
  hasChapters: false,
  chapters: [
    {
      chapter: 1,
      pages: [1, 2, 3, 4]
    }
  ]
};

export default function SandboxPage() {
  const pathname = usePathname();
  
  // Extract page number from URL or default to page 1
  // Expecting URLs like /sandbox, /sandbox/page-1, /sandbox/page-2, etc.
  const pathParts = pathname.split('/');
  const pageParam = pathParts[pathParts.length - 1];
  const currentPage = pageParam.startsWith('page-') ? parseInt(pageParam.replace('page-', '')) : 1;
  
  // Get the appropriate dataset for current page, fallback to page 1
  const sentences = mockDataSets[currentPage as keyof typeof mockDataSets] || mockDataSets[1];
  
  // For the experimental toggle, we'll use a simple URL parameter approach
  const isExperimental = pathname.includes('/experimental');

  const StoryComponent = isExperimental ? StoryLayoutExperimental : StoryLayoutSandbox;

  return (
    <StoryComponent
      title="UI Testing Sandbox"
      storySlug="sandbox-story"
      sentences={sentences}
      initialLevel="l3"
      storyMap={mockStoryMap}
    />
  );
}