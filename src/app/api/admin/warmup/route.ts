// src/app/api/admin/warmup/route.ts
// Lightweight endpoint to warm up Node.js serverless functions
// Called on page load to pre-warm the runtime before user needs it

import { NextResponse } from "next/server";

// Import heavy dependencies to ensure they're loaded in this bundle
// This warms up the modules that other admin routes will need
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// Touch the imports so they're not tree-shaken
const _dependencies = { OpenAI, Anthropic };

export async function GET() {
  return NextResponse.json({
    status: "warm",
    timestamp: Date.now(),
  });
}
