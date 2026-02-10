// src/app/[lng]/tutor/page.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { Language } from "@/types/i18n";
import { t } from "@/lib/t";
import { AppLayout } from '@/components/layout';

type Message = {
  role: "user" | "assistant";
  content: string;
};

// Simple markdown renderer for bold and italic
function renderMarkdown(text: string): React.ReactElement {
  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  let keyCounter = 0;

  // Match **bold** or *italic* (handle bold first to avoid conflicts)
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // Add formatted text
    if (match[2]) {
      // Bold (**text**)
      parts.push(<strong key={keyCounter++}>{match[2]}</strong>);
    } else if (match[3]) {
      // Italic (*text*)
      parts.push(<em key={keyCounter++}>{match[3]}</em>);
    }

    lastIndex = pattern.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return <>{parts}</>;
}

export default function TutorPage() {
  const { lng } = useParams();
  const typedLang = (lng as Language) || 'es';
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isInitialScrollRef = useRef(false);
  const hasLoadedHistoryRef = useRef(false);

  const scrollToBottom = (instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? "instant" : "smooth" });
  };

  // Load conversation history on mount (or show auth message for unauthenticated users)
  useEffect(() => {
    // Prevent double-loading on React strict mode double-render
    if (hasLoadedHistoryRef.current) return;

    // If not authenticated, show auth message as first assistant response
    if (!session?.user) {
      hasLoadedHistoryRef.current = true;
      setMessages([{ role: "assistant", content: "__AUTH_REQUIRED__" }]);
      return;
    }

    const loadHistory = async () => {
      try {
        const response = await fetch("/api/tutor");
        if (response.ok) {
          const data = await response.json();
          hasLoadedHistoryRef.current = true;
          setMessages(data.messages || []);
        }
      } catch (error) {
        console.error("Failed to load conversation history:", error);
      }
    };

    loadHistory();
  }, [session]);

  useEffect(() => {
    // Scroll to bottom when messages change
    // Use instant scroll on first render, smooth thereafter
    if (messages.length > 0) {
      if (!isInitialScrollRef.current) {
        // First time we have messages - instant scroll
        setTimeout(() => scrollToBottom(true), 0);
        isInitialScrollRef.current = true;
      } else {
        // Subsequent updates - smooth scroll
        scrollToBottom();
      }
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setInput("");
    setIsLoading(true);

    // If not authenticated, show auth message
    if (!session?.user) {
      await new Promise(resolve => setTimeout(resolve, 500));
      setMessages(prev => [...prev, { role: "assistant", content: "__AUTH_REQUIRED__" }]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: currentMessages }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: "assistant",
        content: data.message,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: t(typedLang, "aiTutor", "errorMessage"),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <AppLayout lang={typedLang} requireAuth={false} hideBottomNav>
    {/* Full-screen background that extends under sidebar */}
    <div
      className="fixed inset-0 bg-cover bg-center -z-10"
      style={{ backgroundImage: "url('/images/background6.png')" }}
    />
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">
          {t(typedLang, "stories", "aiTutor")}
        </h1>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto flex flex-col min-h-full justify-end">
          {messages.length === 0 && !isLoading && (
            <div className="text-center text-gray-500 mt-20">
              <p className="text-lg mb-2">
                {t(typedLang, "aiTutor", "startConversation")}
              </p>
              <p className="text-sm">
                {t(typedLang, "aiTutor", "practiceSkills")}
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end mt-20 mb-4" : "justify-start"
              }`}
            >
              {message.role === "user" ? (
                <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-blue-600 text-white">
                  <p className="whitespace-pre-wrap">{renderMarkdown(message.content)}</p>
                </div>
              ) : message.content === "__AUTH_REQUIRED__" ? (
                <div className="max-w-[80%] bg-white/90 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-md">
                  <p className="text-gray-800">
                    {t(typedLang, "aiTutor", "signInToUse")}{" "}
                    <Link href={`/${typedLang}/auth/login`} className="text-indigo-600 hover:underline font-medium">
                      {t(typedLang, "aiTutor", "signIn")}
                    </Link>
                    {" "}{t(typedLang, "aiTutor", "or")}{" "}
                    <Link href={`/${typedLang}/auth/signup`} className="text-indigo-600 hover:underline font-medium">
                      {t(typedLang, "aiTutor", "createAccount")}
                    </Link>
                  </p>
                </div>
              ) : (
                <div className="max-w-[80%]">
                  <p className="whitespace-pre-wrap text-gray-800">{renderMarkdown(message.content)}</p>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-white text-gray-800 border border-gray-200">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Container */}
      <div className="py-4 pl-2 pr-4 sm:pl-4 md:pl-8 lg:pl-16 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="relative flex items-end" style={{ maxWidth: "calc(100% - 60px)" }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t(typedLang, "aiTutor", "placeholder")}
              className="flex-1 pl-4 pr-[72px] py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-y-auto shadow-md text-base"
              style={{ minHeight: "52px", maxHeight: "200px" }}
              rows={1}
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="absolute right-2 bottom-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {t(typedLang, "aiTutor", "send")}
            </button>
          </div>
        </form>
      </div>
    </div>
    </AppLayout>
  );
}
