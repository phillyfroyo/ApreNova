// src/app/api/azure-tts/batch/route.ts
import { NextRequest } from 'next/server';
import { getAzureSpeechService } from '@/lib/azure-speech';
import { getTTSCacheService } from '@/lib/tts-cache';
import { getRateLimiter, getClientIdentifier, createRateLimitHeaders } from '@/lib/rate-limiter';
import {
  validateTTSBatchRequest,
  validateContentType,
  validateRequestSize,
  createValidationErrorResponse,
  createErrorResponse,
  createSuccessResponse,
  ValidationError
} from '@/lib/validation';
import type { TTSBatchRequest, TTSBatchResponse, TTSResponse } from '@/types/azure-tts';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

/**
 * POST /api/azure-tts/batch
 * Generate multiple TTS audio files in batch
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication for AI API calls
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return createErrorResponse("Authentication required", 401);
    }

    // Validate request headers
    const contentType = request.headers.get('content-type');
    if (!validateContentType(contentType)) {
      return createErrorResponse('Content-Type must be application/json', 400);
    }

    const contentLength = request.headers.get('content-length');
    if (!validateRequestSize(contentLength, 5 * 1024 * 1024)) { // 5MB for batch requests
      return createErrorResponse('Request payload too large', 413);
    }

    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimiter = getRateLimiter('batch');
    const { allowed, info } = rateLimiter.isAllowed(clientId);

    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate Limit Exceeded',
          message: 'Too many batch requests. Please try again later.',
          retryAfter: Math.ceil((info.resetTime - Date.now()) / 1000)
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...createRateLimitHeaders(info)
          }
        }
      );
    }

    // Parse and validate request body
    let requestData: TTSBatchRequest;
    try {
      const body = await request.json();
      requestData = validateTTSBatchRequest(body);
    } catch (error) {
      if (error instanceof ValidationError) {
        return createValidationErrorResponse(error);
      }
      return createErrorResponse('Invalid JSON payload', 400);
    }

    // Initialize services
    const speechService = getAzureSpeechService();
    const cacheService = getTTSCacheService();

    const results: TTSResponse[] = [];
    const totalStartTime = Date.now();
    let totalDuration = 0;
    let cacheHits = 0;
    let newGenerations = 0;

    // Process each item in the batch
    for (let i = 0; i < requestData.items.length; i++) {
      const item = requestData.items[i];
      
      try {
        // Check cache first
        const cached = await cacheService.getCached(item);
        if (cached) {
          results.push(cached);
          totalDuration += cached.duration;
          cacheHits++;
          continue;
        }

        // Validate the request with speech service
        speechService.validateRequest(item);

        // Generate new TTS audio
        const result = await speechService.generateSpeechBuffer(item);
        
        // Save to cache
        const audioUrl = await cacheService.saveToCache(
          item,
          result.buffer,
          result.wordTimings,
          result.duration
        );

        const response: TTSResponse = {
          audioUrl,
          wordTimings: result.wordTimings,
          duration: result.duration,
          cached: false
        };

        results.push(response);
        totalDuration += result.duration;
        newGenerations++;

      } catch (error) {
        console.error(`Error processing batch item ${i}:`, error);
        
        // Add error result but continue processing other items
        results.push({
          audioUrl: '',
          wordTimings: [],
          duration: 0,
          cached: false
        });
      }
    }

    const cacheHitRate = requestData.items.length > 0 ? cacheHits / requestData.items.length : 0;

    const batchResponse: TTSBatchResponse = {
      results,
      totalDuration,
      cacheHitRate
    };

    const processingTime = Date.now() - totalStartTime;

    return new Response(
      JSON.stringify({
        ...batchResponse,
        metadata: {
          itemsProcessed: requestData.items.length,
          cacheHits,
          newGenerations,
          processingTimeMs: processingTime,
          averageProcessingTime: processingTime / requestData.items.length
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=2592000', // 30 days
          ...createRateLimitHeaders(info)
        }
      }
    );

  } catch (error) {
    console.error('Batch TTS generation error:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Azure Speech')) {
        return createErrorResponse('Speech synthesis service unavailable', 503);
      }
      if (error.message.includes('rate limit') || error.message.includes('quota')) {
        return createErrorResponse('Service quota exceeded. Please try again later.', 429);
      }
    }

    return createErrorResponse('Internal server error occurred during batch TTS generation', 500);
  }
}

/**
 * GET /api/azure-tts/batch
 * Get batch endpoint information
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    const rateLimiter = getRateLimiter('batch');
    const info = rateLimiter.getInfo(clientId);

    return createSuccessResponse({
      endpoint: 'Batch TTS Generation',
      description: 'Generate multiple TTS audio files in a single request',
      rateLimit: info,
      maxBatchSize: 50,
      maxPayloadSize: '5MB',
      supportedLanguages: ['es-ES', 'en-US'],
      supportedSpeeds: ['normal', 'slow'],
      maxTextLength: 3000,
      format: 'MP3',
      features: [
        'Batch processing of multiple texts',
        'Word-level timing data for each item',
        'High-quality neural voices',
        'Intelligent caching with hit rate reporting',
        'Partial success handling',
        'Processing time metrics'
      ],
      usage: {
        'Content-Type': 'application/json',
        'Body': {
          items: 'Array of TTS requests',
          storySlug: 'Story identifier for organization',
          chapterPage: 'Chapter and page identifier'
        }
      }
    });
  } catch (error) {
    return createErrorResponse('Unable to retrieve batch endpoint information', 500);
  }
}

/**
 * OPTIONS /api/azure-tts/batch
 * Handle preflight requests for CORS
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}