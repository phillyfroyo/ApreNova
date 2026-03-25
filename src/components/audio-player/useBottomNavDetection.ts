// src/components/audio-player/useBottomNavDetection.ts
"use client";

import { useState, useEffect } from "react";

export function useBottomNavDetection() {
  const [hasBottomNav, setHasBottomNav] = useState(false);

  useEffect(() => {
    const check = () => {
      const bottomNav = document.querySelector('nav.fixed.bottom-0');
      setHasBottomNav(!!bottomNav);
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return hasBottomNav;
}
