"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AdminLogin from "./AdminLogin";
import StoryUploadForm from "./StoryUploadForm";
import StoryManager from "./StoryManager";
import CostsManager from "./CostsManager";
import UsersManager from "./UsersManager";
import { SUTPAlgorithms } from "./components/dev-tools";
import StoryTester from "./StoryTester";

const ADMIN_SESSION_KEY = "admin_authenticated";

type AdminTab = "upload" | "manage" | "costs" | "users" | "premium" | "dev" | "test";

// Warm up serverless functions in the background
function warmupServerless() {
  fetch("/api/admin/warmup").catch(() => {
    // Silently ignore errors - this is just a best-effort warm-up
  });
}

export default function UploadStoryPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>("users");

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
        <div className="max-w-6xl mx-auto px-4 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            <button
              onClick={() => setActiveTab("users")}
              className={`px-4 sm:px-6 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === "users"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab("upload")}
              className={`px-4 sm:px-6 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === "upload"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Upload
            </button>
            <button
              onClick={() => setActiveTab("manage")}
              className={`px-4 sm:px-6 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === "manage"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Manage
            </button>
            <button
              onClick={() => setActiveTab("costs")}
              className={`px-4 sm:px-6 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === "costs"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Costs
            </button>
            <button
              onClick={() => setActiveTab("premium")}
              className={`px-4 sm:px-6 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === "premium"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Premium
            </button>
            <button
              onClick={() => setActiveTab("dev")}
              className={`px-4 sm:px-6 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === "dev"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Dev
            </button>
            <button
              onClick={() => setActiveTab("test")}
              className={`px-4 sm:px-6 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === "test"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Test
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
      {activeTab === "premium" && <PremiumManager />}
      {activeTab === "dev" && <DevTools />}
      {activeTab === "test" && <StoryTester />}
    </div>
  );
}

// Premium Manager Component (moved from Dev Tools)
function PremiumManager() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [toggling, setToggling] = useState(false);

  const handleTogglePremium = async () => {
    setToggling(true);
    try {
      await fetch("/api/dev-toggle-premium", { method: "POST" });
      await update();
      router.refresh();
    } catch (err) {
      console.error("Failed to toggle premium:", err);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="max-w-2xl">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Premium Status Manager</h2>
          <p className="text-sm text-gray-500 mb-6">
            Toggle premium status for testing purposes.
          </p>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Current Status</h3>
              <p className="text-sm text-gray-500">
                {session?.user?.isPremium ? (
                  <span className="text-green-600 font-medium">Premium</span>
                ) : (
                  <span className="text-gray-600">Free</span>
                )}
              </p>
            </div>
            <button
              onClick={handleTogglePremium}
              disabled={toggling}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
            >
              {toggling ? "Toggling..." : "Toggle Premium"}
            </button>
          </div>
          <p className="text-xs text-amber-600 mt-4">
            Note: This sets isPremium without Stripe. Use actual checkout to test billing portal.
          </p>
        </div>
      </div>
    </div>
  );
}

// Dev Tools Component
function DevTools() {
  const [devSubTab, setDevSubTab] = useState<"tools" | "su-tp-algorithms">("su-tp-algorithms");

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setDevSubTab("tools")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            devSubTab === "tools"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          General Tools
        </button>
        <button
          onClick={() => setDevSubTab("su-tp-algorithms")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            devSubTab === "su-tp-algorithms"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          SU TP Algorithms
        </button>
      </div>

      {devSubTab === "tools" && (
        <div className="max-w-2xl">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Developer Tools</h2>
            <p className="text-sm text-gray-500 mb-6">
              These tools are for development and testing purposes only.
            </p>
            <p className="text-sm text-gray-400">
              Premium toggle has been moved to its own tab.
            </p>
          </div>
        </div>
      )}

      {devSubTab === "su-tp-algorithms" && <SUTPAlgorithms />}
    </div>
  );
}

