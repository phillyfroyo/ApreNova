// src/app/api/azure-tts/[audioId]/route.ts
import { NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getTTSCacheService } from '@/lib/tts-cache';
import { getRateLimiter, getClientIdentifier, createRateLimitHeaders } from '@/lib/rate-limiter';
import { 
  validateAudioId,
  createValidationErrorResponse,
  createErrorResponse,
  createSuccessResponse,
  ValidationError
} from '@/lib/validation';

/**
 * GET /api/azure-tts/[audioId]
 * Retrieve cached TTS audio file and metadata
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ audioId: string }> }
) {
  try {
    // Await params in Next.js 15
    const { audioId: rawAudioId } = await params;

    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimiter = getRateLimiter('retrieve');
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

    // Validate audioId parameter
    let audioId: string;
    try {
      audioId = validateAudioId(rawAudioId);
    } catch (error) {
      if (error instanceof ValidationError) {
        return createValidationErrorResponse(error);
      }
      return createErrorResponse('Invalid audio ID format', 400);
    }

    // Check if requesting metadata or audio file
    const format = new URL(request.url).searchParams.get('format');
    const includeMetadata = new URL(request.url).searchParams.get('metadata') === 'true';

    const cacheService = getTTSCacheService();
    const audioPath = path.join(process.cwd(), 'public', 'cache', 'tts-audio', `${audioId}.mp3`);
    const metadataPath = path.join(process.cwd(), 'cache', 'tts-metadata', `${audioId}.json`);

    // Check if files exist
    const [audioExists, metadataExists] = await Promise.all([
      fs.access(audioPath).then(() => true).catch(() => false),
      fs.access(metadataPath).then(() => true).catch(() => false)
    ]);

    if (!audioExists || !metadataExists) {
      return createErrorResponse('Audio file not found', 404, 'AUDIO_NOT_FOUND');
    }

    // If requesting only metadata
    if (includeMetadata && format !== 'audio') {
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);
        
        // Update access time
        metadata.accessedAt = Date.now();
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

        return new Response(
          JSON.stringify({
            audioId,
            audioUrl: `/cache/tts-audio/${audioId}.mp3`,
            wordTimings: metadata.wordTimings,
            duration: metadata.duration,
            language: metadata.language,
            speed: metadata.speed,
            createdAt: metadata.createdAt,
            accessedAt: metadata.accessedAt,
            cached: true
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
        return createErrorResponse('Failed to read metadata', 500);
      }
    }

    // Return audio file
    try {
      const audioBuffer = await fs.readFile(audioPath);
      const stats = await fs.stat(audioPath);

      // Update metadata access time
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);
        metadata.accessedAt = Date.now();
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      } catch (error) {
        // Don't fail the request if metadata update fails
        console.warn('Failed to update metadata access time:', error);
      }

      return new Response(new Uint8Array(audioBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': stats.size.toString(),
          'Cache-Control': 'public, max-age=2592000', // 30 days
          'Accept-Ranges': 'bytes',
          'Content-Disposition': `inline; filename="${audioId}.mp3"`,
          ...createRateLimitHeaders(info)
        }
      });
    } catch (error) {
      return createErrorResponse('Failed to read audio file', 500);
    }

  } catch (error) {
    console.error('Audio retrieval error:', error);
    return createErrorResponse('Internal server error occurred during audio retrieval', 500);
  }
}

/**
 * HEAD /api/azure-tts/[audioId]
 * Check if audio file exists without downloading it
 */
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ audioId: string }> }
) {
  try {
    // Await params in Next.js 15
    const { audioId: rawAudioId } = await params;

    // Validate audioId parameter
    let audioId: string;
    try {
      audioId = validateAudioId(rawAudioId);
    } catch (error) {
      return new Response(null, { status: 400 });
    }

    const audioPath = path.join(process.cwd(), 'public', 'cache', 'tts-audio', `${audioId}.mp3`);
    
    try {
      const stats = await fs.stat(audioPath);
      
      return new Response(null, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': stats.size.toString(),
          'Cache-Control': 'public, max-age=2592000',
          'Last-Modified': stats.mtime.toUTCString(),
        }
      });
    } catch (error) {
      return new Response(null, { status: 404 });
    }

  } catch (error) {
    return new Response(null, { status: 500 });
  }
}

/**
 * DELETE /api/azure-tts/[audioId]
 * Delete cached audio file (admin only - would need authentication)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ audioId: string }> }
) {
  try {
    // Await params in Next.js 15
    const { audioId: rawAudioId } = await params;

    // TODO: Add authentication/authorization check here
    // For now, return 403 as this should be admin-only
    return createErrorResponse('Forbidden: Admin access required', 403);

    /*
    // Future implementation:
    let audioId: string;
    try {
      audioId = validateAudioId(rawAudioId);
    } catch (error) {
      if (error instanceof ValidationError) {
        return createValidationErrorResponse(error);
      }
      return createErrorResponse('Invalid audio ID format', 400);
    }

    const audioPath = path.join(process.cwd(), 'public', 'cache', 'tts-audio', `${audioId}.mp3`);
    const metadataPath = path.join(process.cwd(), 'cache', 'tts-metadata', `${audioId}.json`);

    await Promise.all([
      fs.unlink(audioPath).catch(() => {}),
      fs.unlink(metadataPath).catch(() => {})
    ]);

    return createSuccessResponse({ deleted: true, audioId });
    */

  } catch (error) {
    return createErrorResponse('Internal server error occurred during deletion', 500);
  }
}

/**
 * OPTIONS /api/azure-tts/[audioId]
 * Handle preflight requests for CORS
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}