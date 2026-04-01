// src/app/api/azure-tts/admin/route.ts
import { NextRequest } from 'next/server';
import { getTTSCacheService } from '@/lib/tts-cache';
import { getAzureSpeechService } from '@/lib/azure-speech';
import { createErrorResponse, createSuccessResponse } from '@/lib/validation';
import { requireAdminAuth, createAuthResponse, AuthError } from '@/lib/auth-helpers';

/**
 * GET /api/azure-tts/admin
 * Get TTS service statistics and health status
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    await requireAdminAuth();

    const cacheService = getTTSCacheService();
    const speechService = getAzureSpeechService();

    // Get cache statistics
    const cacheStats = await cacheService.getCacheStats();

    // Test service connectivity
    const serviceHealth = {
      speechService: false,
      cacheService: true
    };

    try {
      serviceHealth.speechService = await speechService.testConnection();
    } catch (error) {
      console.error('Speech service health check failed:', error);
    }

    return createSuccessResponse({
      status: 'operational',
      services: serviceHealth,
      cache: {
        totalFiles: cacheStats.totalFiles,
        totalSizeMB: Math.round(cacheStats.totalSize / (1024 * 1024) * 100) / 100,
        hitRate: Math.round(cacheStats.hitRate * 100 * 100) / 100, // Percentage with 2 decimal places
        oldestFile: cacheStats.oldestFile ? new Date(cacheStats.oldestFile).toISOString() : null,
        newestFile: cacheStats.newestFile ? new Date(cacheStats.newestFile).toISOString() : null
      },
      features: {
        supportedLanguages: ['es-ES', 'en-US'],
        supportedSpeeds: ['normal', 'slow'],
        maxTextLength: 3000,
        audioFormat: 'MP3',
        wordTimingSupport: true,
        cacheEnabled: true
      },
      limits: {
        generatePerMinute: 30,
        batchPerMinute: 5,
        retrievePerMinute: 200,
        maxBatchSize: 50,
        maxPayloadSize: '5MB'
      }
    });

  } catch (error) {
    if (error instanceof AuthError) {
      return createAuthResponse(error);
    }
    console.error('Admin endpoint error:', error);
    return createErrorResponse('Unable to retrieve service statistics', 500);
  }
}

/**
 * POST /api/azure-tts/admin
 * Administrative actions (cache cleanup, health checks, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    await requireAdminAuth();

    const { action, ...params } = await request.json();
    const cacheService = getTTSCacheService();

    switch (action) {
      case 'clear-cache':
        await cacheService.clearAll();
        return createSuccessResponse({ action, result: 'R2 cache cleared' });

      case 'health-check':
        const speechService = getAzureSpeechService();
        const isHealthy = await speechService.testConnection();
        return createSuccessResponse({ action, healthy: isHealthy });

      case 'cache-stats':
        const stats = await cacheService.getCacheStats();
        return createSuccessResponse({ action, stats });

      default:
        return createErrorResponse('Unknown admin action', 400);
    }

  } catch (error) {
    if (error instanceof AuthError) {
      return createAuthResponse(error);
    }
    console.error('Admin action error:', error);
    return createErrorResponse('Admin action failed', 500);
  }
}

/**
 * OPTIONS /api/azure-tts/admin
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