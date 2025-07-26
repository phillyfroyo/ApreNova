// src/app/sandbox/[...page]/page.tsx

import React from "react";
import { notFound } from "next/navigation";
import SandboxMain from "../page";

export default async function SandboxPage({ params }: { params: Promise<{ page: string[] }> }) {
  const { page } = await params;
  
  // Handle dynamic sandbox routes like /sandbox/page-2, /sandbox/experimental/page-3, etc.
  if (page && page.length > 0) {
    // Check for experimental mode: /sandbox/experimental/page-X
    if (page[0] === "experimental" && page.length > 1) {
      const pageParam = page[1];
      if (!pageParam.match(/^page-[1-4]$/)) {
        return notFound();
      }
    }
    // Check for normal mode: /sandbox/page-X
    else if (page.length === 1) {
      const pageParam = page[0];
      if (!pageParam.match(/^page-[1-4]$/)) {
        return notFound();
      }
    }
    // Invalid URL structure
    else {
      return notFound();
    }
  }

  return <SandboxMain />;
}