// src/components/StoryTutorChat.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { X, Loader2 } from "lucide-react";
import type { Language } from "@/types/i18n";
import { t } from "@/lib/t";

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

interface StoryTutorChatProps {
  storySlug: string;
  currentPageText: string[];
  onClose: () => void;
  isOpen: boolean;
  initialContext?: {
    lineIndex: number;
    fullLine: string;
    selectedText?: string;
  } | null;
  preloadedMessages?: any[] | null;
  onMessagesUpdate?: (messages: any[]) => void;
  backgroundImage?: string;
}

export default function StoryTutorChat({
  storySlug,
  currentPageText,
  onClose,
  isOpen,
  initialContext,
  preloadedMessages,
  onMessagesUpdate,
  backgroundImage,
}: StoryTutorChatProps) {
  const { lng } = useParams();
  const typedLang = (lng as Language) ?? "es";
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasAutoSentRef = useRef(false);
  const isInitialScrollRef = useRef(false);
  const lastProcessedContextRef = useRef<string>("");
  const isProcessingRef = useRef(false);
  const hasLoadedHistoryRef = useRef(false);

  const scrollToBottom = (instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? "instant" : "smooth" });
  };

  // Load conversation history for this story and auto-send initial message if needed
  useEffect(() => {
    // Reset when chat closes
    if (!isOpen) {
      hasAutoSentRef.current = false;
      isInitialScrollRef.current = false;
      lastProcessedContextRef.current = "";
      isProcessingRef.current = false;
      hasLoadedHistoryRef.current = false;
      return;
    }

    // Create unique ID for this context
    const contextId = initialContext
      ? JSON.stringify({ line: initialContext.lineIndex, text: initialContext.selectedText || initialContext.fullLine })
      : "";

    // If already processing this exact context, skip
    if (isProcessingRef.current && contextId === lastProcessedContextRef.current) {
      return;
    }

    const loadHistory = async () => {
      try {
        // Step 1: Use preloaded messages if available, otherwise fetch (only for authenticated users)
        let loadedMessages: Message[] = [];

        // Only load history for authenticated users
        if (session?.user) {
          if (preloadedMessages && preloadedMessages.length > 0) {
            console.log(`✨ Using ${preloadedMessages.length} pre-loaded messages - instant load!`);
            loadedMessages = preloadedMessages;
          } else {
            const response = await fetch(`/api/story-tutor?storySlug=${encodeURIComponent(storySlug)}`);
            if (!response.ok) throw new Error("Failed to load history");

            const data = await response.json();
            loadedMessages = data.messages || [];
          }
        }

        // Step 2: Check if this is a new context (different from last processed)
        const isNewContext = contextId && contextId !== lastProcessedContextRef.current;

        // If reopening chat without new context, only load history if we haven't already
        if (!isNewContext) {
          // Only load history if this is the first time (prevents overwriting "You selected" message)
          if (!hasLoadedHistoryRef.current) {
            hasLoadedHistoryRef.current = true;
            setMessages(loadedMessages);
          }
          return;
        }

        // Step 3: New context - mark it as being processed and show history
        isProcessingRef.current = true;
        lastProcessedContextRef.current = contextId;
        hasLoadedHistoryRef.current = true;
        setMessages(loadedMessages);

        // Step 4: If there's initial context, send "You selected" as a real message
        if (initialContext) {
          const selectedText = initialContext.selectedText || initialContext.fullLine;
          const youSelectedMessage: Message = {
            role: "user",
            content: t(typedLang, "storyTutor", "youSelected").replace("{text}", selectedText)
          };

          // Add "You selected" message to UI immediately
          setMessages(prev => [...prev, youSelectedMessage]);

          // Check if we should send to GPT (only if not recently addressed)
          const textToCheck = initialContext.selectedText || initialContext.fullLine;
          const shouldSendToGPT = loadedMessages.length === 0 ||
            !loadedMessages.slice(-3).some((m: Message) => m.content.includes(textToCheck));

          // Send the "You selected" message to backend and get GPT response
          setTimeout(async () => {
            setIsLoading(true);

            // If user is not authenticated, show auth message instead of calling API
            if (!session?.user) {
              // Brief delay to show loading state
              await new Promise(resolve => setTimeout(resolve, 500));
              setMessages(prev => [...prev, { role: "assistant", content: "__AUTH_REQUIRED__" }]);
              setIsLoading(false);
              isProcessingRef.current = false;
              return;
            }

            try {
              // Use proactive endpoint if sending to GPT, otherwise just save the message
              const endpoint = shouldSendToGPT ? "/api/story-tutor-proactive" : "/api/story-tutor";

              const apiResponse = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  messages: [...loadedMessages, youSelectedMessage],
                  storySlug,
                  currentPageText,
                  context: initialContext,
                  routeLanguage: typedLang,
                }),
              });

              if (apiResponse.ok) {
                const apiData = await apiResponse.json();
                const assistantMessage: Message = {
                  role: "assistant",
                  content: apiData.message,
                };
                // Append GPT response
                setMessages(prev => [...prev, assistantMessage]);
              } else {
                throw new Error("Failed to get response");
              }
            } catch (error) {
              console.error("Error auto-sending message:", error);
              const errorMessage: Message = {
                role: "assistant",
                content: t(typedLang, "storyTutor", "errorMessage"),
              };
              setMessages(prev => [...prev, errorMessage]);
            } finally {
              setIsLoading(false);
              isProcessingRef.current = false;
            }
          }, 0);
        } else {
          // No initial context, just clear processing flag
          isProcessingRef.current = false;
        }
      } catch (error) {
        console.error("Failed to load story conversation history:", error);
        isProcessingRef.current = false;
      }
    };

    loadHistory();
  }, [session, storySlug, isOpen, initialContext]);

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

    // Sync messages back to parent to keep preloaded cache fresh
    if (onMessagesUpdate && messages.length > 0) {
      onMessagesUpdate(messages);
    }
  }, [messages, onMessagesUpdate]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setInput("");

    // If user is not authenticated, show auth message
    if (!session?.user) {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      setMessages(prev => [...prev, { role: "assistant", content: "__AUTH_REQUIRED__" }]);
      setIsLoading(false);
      return;
    }

    // Create a separate loading state for this specific request
    const requestId = Date.now();
    setIsLoading(true);

    try {
      const response = await fetch("/api/story-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: currentMessages,
          storySlug,
          currentPageText,
          context: initialContext,
          routeLanguage: typedLang,
        }),
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
        content: t(typedLang, "storyTutor", "errorMessage"),
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
    <div
      className="flex flex-col h-full bg-cover bg-center bg-fixed"
      style={{ backgroundImage: backgroundImage ? `url('${backgroundImage}')` : undefined }}
    >
      {/* Header */}
      <div className="bg-purple-600/95 backdrop-blur-sm text-white px-4 py-3 flex items-center justify-between border-b border-purple-700">
        <h2 className="text-lg font-semibold">❓ {t(typedLang, "storyTutor", "title")}</h2>
        <button
          onClick={onClose}
          className="text-white hover:bg-purple-700 rounded-full p-1 transition"
        >
          <X size={20} />
        </button>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-white/40 backdrop-blur-md max-h-[calc(100vh-200px)]">
        <div>
          {messages.length === 0 && !isLoading && (
            <div className="text-center text-gray-700 mt-10 bg-white/80 backdrop-blur-sm rounded-xl p-6 mx-auto max-w-md">
              <p className="text-base mb-2 font-semibold">👋 {t(typedLang, "storyTutor", "askAnything")}</p>
              <p className="text-sm">{t(typedLang, "storyTutor", "helpWith")}</p>
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
                <div className="max-w-[85%] rounded-2xl px-4 py-2 bg-purple-600/95 backdrop-blur-sm text-white shadow-lg">
                  <p className="whitespace-pre-wrap text-sm">{renderMarkdown(message.content)}</p>
                </div>
              ) : message.content === "__AUTH_REQUIRED__" ? (
                <div className="max-w-[85%] bg-white/90 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-md">
                  <p className="text-sm text-gray-800">
                    {t(typedLang, "storyTutor", "signInToUse")}{" "}
                    <Link href={`/${typedLang}/auth/login`} className="text-indigo-600 hover:underline font-medium">
                      {t(typedLang, "storyTutor", "signIn")}
                    </Link>
                    {" "}{t(typedLang, "storyTutor", "or")}{" "}
                    <Link href={`/${typedLang}/auth/signup`} className="text-indigo-600 hover:underline font-medium">
                      {t(typedLang, "storyTutor", "createAccount")}
                    </Link>
                  </p>
                </div>
              ) : (
                <div className="max-w-[85%] bg-white/90 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-md">
                  <p className="whitespace-pre-wrap text-sm text-gray-800">{renderMarkdown(message.content)}</p>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl px-4 py-2 bg-white/90 backdrop-blur-sm text-gray-800 shadow-md">
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
      <div className="border-t border-purple-300/50 bg-white/80 backdrop-blur-md px-4 py-3">
        <form onSubmit={handleSubmit}>
          <div className="relative flex items-end" style={{ maxWidth: "calc(100% - 60px)" }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t(typedLang, "storyTutor", "placeholder")}
              className="flex-1 px-3 py-2 pr-[72px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none overflow-y-auto text-sm"
              style={{ minHeight: "44px", maxHeight: "150px" }}
              rows={1}
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {t(typedLang, "storyTutor", "send")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
