// src/lib/validation.ts
import type { TTSRequest, TTSBatchRequest } from '@/types/azure-tts';

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate a single TTS request
 */
export function validateTTSRequest(data: any): TTSRequest {
  const errors: string[] = [];

  // Validate text
  if (typeof data.text !== 'string') {
    errors.push('text must be a string');
  } else if (data.text.trim().length === 0) {
    errors.push('text cannot be empty');
  } else if (data.text.length > 3000) {
    errors.push('text exceeds maximum length of 3000 characters');
  }

  // Validate language
  if (typeof data.language !== 'string') {
    errors.push('language must be a string');
  } else if (!['es-ES', 'en-US'].includes(data.language)) {
    errors.push('language must be either "es-ES" or "en-US"');
  }

  // Validate speed
  if (typeof data.speed !== 'string') {
    errors.push('speed must be a string');
  } else if (!['normal', 'slow'].includes(data.speed)) {
    errors.push('speed must be either "normal" or "slow"');
  }

  // Validate optional fields
  if (data.storySlug !== undefined) {
    if (typeof data.storySlug !== 'string') {
      errors.push('storySlug must be a string');
    } else if (data.storySlug.length > 100) {
      errors.push('storySlug exceeds maximum length of 100 characters');
    }
  }

  if (data.chapterPage !== undefined) {
    if (typeof data.chapterPage !== 'string') {
      errors.push('chapterPage must be a string');
    } else if (data.chapterPage.length > 50) {
      errors.push('chapterPage exceeds maximum length of 50 characters');
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(`Validation failed: ${errors.join(', ')}`);
  }

  return {
    text: data.text.trim(),
    language: data.language,
    speed: data.speed,
    storySlug: data.storySlug,
    chapterPage: data.chapterPage
  };
}

/**
 * Validate a batch TTS request
 */
export function validateTTSBatchRequest(data: any): TTSBatchRequest {
  const errors: string[] = [];

  // Validate items array
  if (!Array.isArray(data.items)) {
    errors.push('items must be an array');
  } else {
    if (data.items.length === 0) {
      errors.push('items array cannot be empty');
    } else if (data.items.length > 50) {
      errors.push('items array exceeds maximum length of 50');
    } else {
      // Validate each item
      data.items.forEach((item: any, index: number) => {
        try {
          validateTTSRequest(item);
        } catch (error) {
          if (error instanceof ValidationError) {
            errors.push(`Item ${index}: ${error.message}`);
          }
        }
      });
    }
  }

  // Validate storySlug
  if (typeof data.storySlug !== 'string') {
    errors.push('storySlug must be a string');
  } else if (data.storySlug.length > 100) {
    errors.push('storySlug exceeds maximum length of 100 characters');
  }

  // Validate chapterPage
  if (typeof data.chapterPage !== 'string') {
    errors.push('chapterPage must be a string');
  } else if (data.chapterPage.length > 50) {
    errors.push('chapterPage exceeds maximum length of 50 characters');
  }

  if (errors.length > 0) {
    throw new ValidationError(`Validation failed: ${errors.join(', ')}`);
  }

  return {
    items: data.items.map((item: any) => validateTTSRequest(item)),
    storySlug: data.storySlug,
    chapterPage: data.chapterPage
  };
}

/**
 * Validate audio ID parameter
 */
export function validateAudioId(audioId: string): string {
  if (typeof audioId !== 'string') {
    throw new ValidationError('audioId must be a string');
  }

  if (audioId.length !== 64) {
    throw new ValidationError('audioId must be 64 characters long');
  }

  if (!/^[a-f0-9]+$/i.test(audioId)) {
    throw new ValidationError('audioId must be a valid hexadecimal string');
  }

  return audioId;
}

/**
 * Sanitize text for TTS processing
 */
export function sanitizeText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    .trim()
    // Remove potentially harmful characters for SSML
    .replace(/[<>&"']/g, (match) => {
      switch (match) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '"': return '&quot;';
        case "'": return '&apos;';
        default: return match;
      }
    })
    // Ensure it doesn't start/end with punctuation that might cause issues
    .replace(/^[.,;:!?]+|[.,;:!?]+$/g, '');
}

/**
 * Validate content type for file upload
 */
export function validateContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType === 'application/json';
}

/**
 * Validate request size
 */
export function validateRequestSize(contentLength: string | null, maxSize: number = 1024 * 1024): boolean {
  if (!contentLength) return false;
  
  const size = parseInt(contentLength, 10);
  return !isNaN(size) && size <= maxSize;
}

/**
 * Create error response for validation failures
 */
export function createValidationErrorResponse(error: ValidationError): Response {
  return new Response(
    JSON.stringify({
      error: 'Validation Error',
      message: error.message,
      field: error.field,
      timestamp: new Date().toISOString()
    }),
    {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Create error response for general errors
 */
export function createErrorResponse(
  message: string, 
  status: number = 500, 
  code?: string
): Response {
  return new Response(
    JSON.stringify({
      error: code || 'Internal Server Error',
      message,
      timestamp: new Date().toISOString()
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Create success response
 */
export function createSuccessResponse(data: any, status: number = 200): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}