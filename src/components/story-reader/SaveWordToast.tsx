// src/components/story-reader/SaveWordToast.tsx
"use client";

import { Check, BookmarkPlus, AlertCircle } from "lucide-react";

interface SaveWordToastProps {
  toast: { message: string; type: "success" | "error" | "exists" } | null;
}

export default function SaveWordToast({ toast }: SaveWordToastProps) {
  if (!toast) return null;

  return (
    <div
      className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[200] px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transition-all duration-300 ${
        toast.type === "success"
          ? "bg-green-500 text-white"
          : toast.type === "exists"
            ? "bg-amber-500 text-white"
            : "bg-red-500 text-white"
      }`}
    >
      {toast.type === "success" && <Check className="w-4 h-4" />}
      {toast.type === "exists" && <BookmarkPlus className="w-4 h-4" />}
      {toast.type === "error" && <AlertCircle className="w-4 h-4" />}
      <span className="text-sm font-medium">{toast.message}</span>
    </div>
  );
}
