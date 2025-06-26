"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const switchLanguage = (lang) => {
    let newPath;

    if (lang === "en") {
      newPath = "/en";
    } else {
      newPath = "/";
    }

    router.push(newPath);
    setOpen(false);
  };

  return (
    <div className="absolute top-4 right-4 text-[15px] font-[Alice] text-black z-50">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 focus:outline-none"
        type="button"
      >
        <span>Site Language</span>
        <span>🌐</span>
        <span className="text-xs">▼</span>
      </button>
      {open && (
        <div
          className="mt-2 bg-white shadow-md rounded-md p-2 absolute right-0"
          onMouseLeave={() => setOpen(false)}
        >
          <button
            className="block px-4 py-2 text-left hover:bg-gray-100 w-full"
            onClick={() => switchLanguage("es")}
          >
            🇪🇸 Español
          </button>
          <button
            className="block px-4 py-2 text-left hover:bg-gray-100 w-full"
            onClick={() => switchLanguage("en")}
          >
            🇺🇸 English
          </button>
        </div>
      )}
    </div>
  );
}
