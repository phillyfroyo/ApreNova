"use client";
import { useState, useEffect } from "react";

interface Draft {
  id: string;
  title: string;
  audioUrl: string | null;
  createdAt: string;
}

interface DraftListProps {
  onRead: (id: string) => void;
  refreshKey: number;
}

export default function DraftList({ onRead, refreshKey }: DraftListProps) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/admin/draft-stories")
      .then((r) => r.json())
      .then(setDrafts)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    await fetch(`/api/admin/draft-stories/${id}`, { method: "DELETE" });
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (drafts.length === 0) return <p className="text-gray-500">No drafts yet. Upload one to get started.</p>;

  return (
    <div className="max-w-3xl mx-auto divide-y divide-gray-100">
      {drafts.map((draft) => (
        <div key={draft.id} className="flex items-center justify-between py-3 px-2">
          <div>
            <span className="font-medium text-gray-900">{draft.title}</span>
            <span className="ml-3 text-xs text-gray-400">
              {new Date(draft.createdAt).toLocaleDateString()}
            </span>
            {draft.audioUrl && (
              <span className="ml-2 text-xs text-green-600">audio ready</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onRead(draft.id)}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Read
            </button>
            <button
              onClick={() => handleDelete(draft.id, draft.title)}
              className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
