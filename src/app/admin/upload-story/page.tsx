"use client";

import { useState, useEffect } from "react";
import AdminLogin from "./AdminLogin";
import StoryUploadForm from "./StoryUploadForm";
import StoryManager from "./StoryManager";
import CostsManager from "./CostsManager";
import UsersManager from "./UsersManager";

const ADMIN_SESSION_KEY = "admin_authenticated";

type AdminTab = "upload" | "manage" | "costs" | "users";

// Warm up serverless functions in the background
function warmupServerless() {
  fetch("/api/admin/warmup").catch(() => {
    // Silently ignore errors - this is just a best-effort warm-up
  });
}

export default function UploadStoryPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>("upload");

  useEffect(() => {
    // Check if already authenticated in this session
    const sessionAuth = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (sessionAuth === "true") {
      setIsAuthenticated(true);
    }
    setIsLoading(false);

    // Warm up serverless functions immediately on page load
    // This runs in parallel with auth check so functions are ready when user proceeds
    warmupServerless();
  }, []);

  const handleLogin = () => {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin onSuccess={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Story Admin</h1>
            <p className="text-sm text-gray-500">Upload and manage stories</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab("upload")}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === "upload"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Upload New Story
            </button>
            <button
              onClick={() => setActiveTab("manage")}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === "manage"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Manage Stories
            </button>
            <button
              onClick={() => setActiveTab("costs")}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === "costs"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              API Costs
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === "users"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Users
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {activeTab === "upload" && (
        <StoryUploadForm onLogout={handleLogout} hideHeader />
      )}
      {activeTab === "manage" && <StoryManager />}
      {activeTab === "costs" && <CostsManager />}
      {activeTab === "users" && <UsersManager />}
    </div>
  );
}
