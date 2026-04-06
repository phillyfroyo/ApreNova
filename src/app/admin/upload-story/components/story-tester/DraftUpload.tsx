"use client";
import { useState } from "react";

interface DraftUploadProps {
  onSaved: () => void;
}

export default function DraftUpload({ onSaved }: DraftUploadProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/draft-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content }),
      });
      if (res.ok) {
        setTitle("");
        setContent("");
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <input
        type="text"
        placeholder="Story title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <textarea
        placeholder="Paste story content here..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={24}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
      />
      <button
        onClick={handleSave}
        disabled={saving || !title.trim() || !content.trim()}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "Saving..." : "Save Draft"}
      </button>
    </div>
  );
}
