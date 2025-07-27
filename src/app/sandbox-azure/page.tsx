// src/app/sandbox-azure/page.tsx
"use client";

import { usePathname } from "next/navigation";
import StoryLayoutAzureSimple from "@/components/StoryLayoutAzureSimple";

// Same mock data as regular sandbox
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
  ]
};

const mockStoryMap = {
  hasChapters: false,
  chapters: [
    {
      chapter: 1,
      pages: [1, 2]
    }
  ]
};

export default function SandboxAzurePage() {
  const pathname = usePathname();
  
  // Extract page number from URL or default to page 1
  const pathParts = pathname.split('/');
  const pageParam = pathParts[pathParts.length - 1];
  const currentPage = pageParam.startsWith('page-') ? parseInt(pageParam.replace('page-', '')) : 1;
  
  // Get the appropriate dataset for current page, fallback to page 1
  const sentences = mockDataSets[currentPage as keyof typeof mockDataSets] || mockDataSets[1];

  return (
    <div>
      <div className="fixed top-4 right-4 z-50 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
        🔥 Azure TTS Testing
      </div>
      <StoryLayoutAzureSimple
        title="Azure TTS Sandbox"
        storySlug="sandbox-story"
        sentences={sentences}
        initialLevel="l3"
        storyMap={mockStoryMap}
      />
    </div>
  );
}