// src/app/api/azure-tts/[audioId]/route.ts
import { NextRequest } from 'next/server';
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getRateLimiter, getClientIdentifier, createRateLimitHeaders } from '@/lib/rate-limiter';
import {
  validateAudioId,
  createValidationErrorResponse,
  createErrorResponse,
  createSuccessResponse,
  ValidationError
} from '@/lib/validation';

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';
const BUCKET = process.env.R2_BUCKET_NAME || '';

function getR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
  });
}

/**
 * GET /api/azure-tts/[audioId]
 * Retrieve cached TTS audio (redirect) or metadata from R2
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ audioId: string }> }
) {
  try {
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

    const includeMetadata = new URL(request.url).searchParams.get('metadata') === 'true';
    const format = new URL(request.url).searchParams.get('format');

    // If requesting metadata, fetch from R2
    if (includeMetadata && format !== 'audio') {
      try {
        const client = getR2Client();
        const metaResponse = await client.send(
          new GetObjectCommand({ Bucket: BUCKET, Key: `tts/${audioId}.meta.json` })
        );
        const metaBody = await metaResponse.Body?.transformToString();
        if (!metaBody) {
          return createErrorResponse('Audio file not found', 404, 'AUDIO_NOT_FOUND');
        }

        const metadata = JSON.parse(metaBody);
        return new Response(
          JSON.stringify({
            audioId,
            audioUrl: `${R2_PUBLIC_URL}/tts/${audioId}.mp3`,
            wordTimings: metadata.wordTimings,
            duration: metadata.duration,
            language: metadata.language,
            speed: metadata.speed,
            createdAt: metadata.createdAt,
            cached: true
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=2592000',
              ...createRateLimitHeaders(info)
            }
          }
        );
      } catch {
        return createErrorResponse('Audio file not found', 404, 'AUDIO_NOT_FOUND');
      }
    }

    // For audio requests, redirect to R2 public URL
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${R2_PUBLIC_URL}/tts/${audioId}.mp3`,
        'Cache-Control': 'public, max-age=2592000',
        ...createRateLimitHeaders(info)
      }
    });

  } catch (error) {
    console.error('Audio retrieval error:', error);
    return createErrorResponse('Internal server error occurred during audio retrieval', 500);
  }
}

/**
 * HEAD /api/azure-tts/[audioId]
 * Check if audio file exists in R2 without downloading it
 */
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ audioId: string }> }
) {
  try {
    const { audioId: rawAudioId } = await params;

    let audioId: string;
    try {
      audioId = validateAudioId(rawAudioId);
    } catch {
      return new Response(null, { status: 400 });
    }

    try {
      const client = getR2Client();
      const headResponse = await client.send(
        new HeadObjectCommand({ Bucket: BUCKET, Key: `tts/${audioId}.mp3` })
      );

      return new Response(null, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': (headResponse.ContentLength || 0).toString(),
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Last-Modified': headResponse.LastModified?.toUTCString() || '',
        }
      });
    } catch {
      return new Response(null, { status: 404 });
    }

  } catch {
    return new Response(null, { status: 500 });
  }
}

/**
 * DELETE /api/azure-tts/[audioId]
 * Delete cached audio file (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ audioId: string }> }
) {
  try {
    const { audioId: rawAudioId } = await params;
    return createErrorResponse('Forbidden: Admin access required', 403);
  } catch {
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
