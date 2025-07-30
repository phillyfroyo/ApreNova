// src/app/api/azure-tts/generate/route.ts
import { NextRequest } from 'next/server';
import { getAzureSpeechService } from '@/lib/azure-speech';
import { getTTSCacheService } from '@/lib/tts-cache';
import { getRateLimiter, getClientIdentifier, createRateLimitHeaders } from '@/lib/rate-limiter';
import { 
  validateTTSRequest, 
  validateContentType, 
  validateRequestSize,
  createValidationErrorResponse,
  createErrorResponse,
  createSuccessResponse,
  ValidationError
} from '@/lib/validation';
import type { TTSRequest, TTSResponse } from '@/types/azure-tts';

/**
 * POST /api/azure-tts/generate
 * Generate TTS audio with word-level timing data
 */
export async function POST(request: NextRequest) {
  try {
    // Validate request headers
    const contentType = request.headers.get('content-type');
    if (!validateContentType(contentType)) {
      return createErrorResponse('Content-Type must be application/json', 400);
    }

    const contentLength = request.headers.get('content-length');
    if (!validateRequestSize(contentLength)) {
      return createErrorResponse('Request payload too large', 413);
    }

    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimiter = getRateLimiter('generate');
    const { allowed, info } = rateLimiter.isAllowed(clientId);

    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate Limit Exceeded',
          message: 'Too many requests. Please try again later.',
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
    let requestData: TTSRequest;
    try {
      const body = await request.json();
      requestData = validateTTSRequest(body);
    } catch (error) {
      if (error instanceof ValidationError) {
        return createValidationErrorResponse(error);
      }
      return createErrorResponse('Invalid JSON payload', 400);
    }

    // Initialize services
    const speechService = getAzureSpeechService();
    const cacheService = getTTSCacheService();

    // Check cache first (skip caching on Vercel)
    const isVercel = process.env.VERCEL === '1';
    let cached = null;
    if (!isVercel) {
      cached = await cacheService.getCached(requestData);
      if (cached) {
        return new Response(
          JSON.stringify(cached),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=2592000', // 30 days
              ...createRateLimitHeaders(info)
            }
          }
        );
      }
    }

    // Validate the request with speech service
    speechService.validateRequest(requestData);

    // Generate new TTS audio
    const result = await speechService.generateSpeechBuffer(requestData);
    
    // Save to cache (skip on Vercel)
    let audioUrl = '';
    if (!isVercel) {
      audioUrl = await cacheService.saveToCache(
        requestData,
        result.buffer,
        result.wordTimings,
        result.duration
      );
    } else {
      // On Vercel, return base64 data URL for immediate use
      const base64Audio = Buffer.from(result.buffer).toString('base64');
      audioUrl = `data:audio/mp3;base64,${base64Audio}`;
    }

    const response: TTSResponse = {
      audioUrl,
      wordTimings: result.wordTimings,
      duration: result.duration,
      cached: false
    };

    return new Response(
      JSON.stringify(response),
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
    console.error('TTS generation error:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Azure Speech')) {
        return createErrorResponse('Speech synthesis service unavailable', 503);
      }
      if (error.message.includes('rate limit') || error.message.includes('quota')) {
        return createErrorResponse('Service quota exceeded. Please try again later.', 429);
      }
    }

    return createErrorResponse('Internal server error occurred during TTS generation', 500);
  }
}

/**
 * GET /api/azure-tts/generate
 * Get endpoint information and rate limit status
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    const rateLimiter = getRateLimiter('generate');
    const info = rateLimiter.getInfo(clientId);

    return createSuccessResponse({
      endpoint: 'TTS Generation',
      description: 'Generate text-to-speech audio with word-level timing data',
      rateLimit: info,
      supportedLanguages: ['es-ES', 'en-US'],
      supportedSpeeds: ['normal', 'slow'],
      maxTextLength: 3000,
      format: 'MP3',
      features: [
        'Word-level timing data',
        'High-quality neural voices',
        'Intelligent caching',
        'Rate limiting protection'
      ]
    });
  } catch (error) {
    return createErrorResponse('Unable to retrieve endpoint information', 500);
  }
}

/**
 * OPTIONS /api/azure-tts/generate
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