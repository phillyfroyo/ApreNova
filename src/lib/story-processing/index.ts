// src/lib/story-processing/index.ts
// Main entry point for story processing library
//
// ⚠️  WARNING: This module includes server-only exports (AI SDK functions).
//     Importing this in client components will cause a build-time error.
//
// For client components, use: import { ... } from "@/lib/story-processing/client"
// For API routes/server, use: import { ... } from "@/lib/story-processing" (this file)
//                         or: import { ... } from "@/lib/story-processing/server"

import "server-only";

// Re-export everything from the server module
// This maintains backward compatibility - existing server-side imports will work
export * from "./server";
