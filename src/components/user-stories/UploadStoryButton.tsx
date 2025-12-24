"use client";

import { useStoryUpload } from "@/contexts/StoryUploadContext";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";

export default function UploadStoryButton() {
  const { setShowUploadModal, isUploading } = useStoryUpload();
  const { data: session } = useSession();
  const { lng } = useParams();
  const router = useRouter();

  const handleClick = () => {
    // If not logged in, redirect to login
    if (!session?.user) {
      router.push(`/${lng}/auth/login`);
      return;
    }

    // Open the upload modal
    setShowUploadModal(true);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isUploading}
      className="group relative flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      title={lng === "es" ? "Subir historia" : "Upload story"}
    >
      {isUploading ? (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      )}

      {/* Tooltip */}
      <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        {lng === "es" ? "Subir historia" : "Upload story"}
      </span>
    </button>
  );
}
