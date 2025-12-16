// src/lib/admin/api-service.ts
// Centralized service layer for all admin API calls

import type {
  ApiResult,
  AuthRequest,
  AuthResponse,
  DetectLevelRequest,
  DetectLevelResponse,
  RewriteLevelRequest,
  RewriteLevelResponse,
  TranslateRequest,
  TranslateResponse,
  GenerateMetadataRequest,
  GenerateMetadataResponse,
  GenerateTextMetadataResponse,
  GenerateImageMetadataResponse,
  TranslateToSpanishResponse,
  ParseAttributionRequest,
  ParseAttributionResponse,
  ProxyImageRequest,
  ProxyImageResponse,
  SaveStoryRequest,
  SaveStoryResponse,
  MetadataType,
} from "./api-types";

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Wrapper for fetch that handles common error patterns
 */
async function fetchApi<T>(
  url: string,
  options: RequestInit
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Request failed with status ${response.status}`,
        details: data.details,
      };
    }

    return { success: true, data: data as T };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// ============================================================================
// Admin API Service
// ============================================================================

export const adminApi = {
  // --------------------------------------------------------------------------
  // Authentication
  // --------------------------------------------------------------------------

  /**
   * Validate admin secret
   */
  async authenticate(secret: string): Promise<ApiResult<AuthResponse>> {
    const request: AuthRequest = { secret };
    return fetchApi<AuthResponse>("/api/admin/auth", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  // --------------------------------------------------------------------------
  // Level Detection
  // --------------------------------------------------------------------------

  /**
   * Detect CEFR level of text
   */
  async detectLevel(
    text: string,
    language: "en" | "es" = "en"
  ): Promise<ApiResult<DetectLevelResponse>> {
    const request: DetectLevelRequest = { text, language };
    return fetchApi<DetectLevelResponse>("/api/admin/detect-level", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  // --------------------------------------------------------------------------
  // Level Rewriting
  // --------------------------------------------------------------------------

  /**
   * Rewrite text to a specific CEFR level
   */
  async rewriteLevel(
    text: string,
    targetLevel: number,
    options: {
      sourceLanguage?: "en" | "es";
      sourceLevel?: number;
      isPoetry?: boolean;
    } = {}
  ): Promise<ApiResult<RewriteLevelResponse>> {
    const request: RewriteLevelRequest = {
      text,
      targetLevel,
      sourceLanguage: options.sourceLanguage || "en",
      sourceLevel: options.sourceLevel,
      isPoetry: options.isPoetry,
    };
    return fetchApi<RewriteLevelResponse>("/api/admin/rewrite-level", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  // --------------------------------------------------------------------------
  // Translation
  // --------------------------------------------------------------------------

  /**
   * Translate text between English and Spanish
   */
  async translate(
    text: string,
    fromLanguage: "en" | "es",
    level: number
  ): Promise<ApiResult<TranslateResponse>> {
    const request: TranslateRequest = { text, fromLanguage, level };
    return fetchApi<TranslateResponse>("/api/admin/translate", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  // --------------------------------------------------------------------------
  // Metadata Generation
  // --------------------------------------------------------------------------

  /**
   * Generate title options for a story
   */
  async generateTitles(
    storyText: string,
    sourceLanguage: "en" | "es",
    customPrompt?: string
  ): Promise<ApiResult<GenerateTextMetadataResponse>> {
    const request: GenerateMetadataRequest = {
      storyText,
      sourceLanguage,
      type: "title",
      customPrompt,
    };
    return fetchApi<GenerateTextMetadataResponse>("/api/admin/generate-metadata", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  /**
   * Generate description/hook options for a story
   */
  async generateDescriptions(
    storyText: string,
    sourceLanguage: "en" | "es",
    customPrompt?: string
  ): Promise<ApiResult<GenerateTextMetadataResponse>> {
    const request: GenerateMetadataRequest = {
      storyText,
      sourceLanguage,
      type: "description",
      customPrompt,
    };
    return fetchApi<GenerateTextMetadataResponse>("/api/admin/generate-metadata", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  /**
   * Generate thumbnail image options
   */
  async generateThumbnail(
    storyText: string,
    sourceLanguage: "en" | "es",
    customPrompt?: string
  ): Promise<ApiResult<GenerateImageMetadataResponse>> {
    const request: GenerateMetadataRequest = {
      storyText,
      sourceLanguage,
      type: "image",
      customPrompt,
    };
    return fetchApi<GenerateImageMetadataResponse>("/api/admin/generate-metadata", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  /**
   * Generate background image options
   */
  async generateBackground(
    storyText: string,
    sourceLanguage: "en" | "es",
    customPrompt?: string
  ): Promise<ApiResult<GenerateImageMetadataResponse>> {
    const request: GenerateMetadataRequest = {
      storyText,
      sourceLanguage,
      type: "background",
      customPrompt,
    };
    return fetchApi<GenerateImageMetadataResponse>("/api/admin/generate-metadata", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  /**
   * Translate text to Spanish (for metadata)
   */
  async translateToSpanish(
    texts: string[]
  ): Promise<ApiResult<TranslateToSpanishResponse>> {
    const request: GenerateMetadataRequest = {
      storyText: texts.join("\n\n---SEPARATOR---\n\n"),
      sourceLanguage: "en",
      type: "translate-to-spanish",
    };
    return fetchApi<TranslateToSpanishResponse>("/api/admin/generate-metadata", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  /**
   * Generic metadata generation (for backward compatibility)
   */
  async generateMetadata(
    storyText: string,
    sourceLanguage: "en" | "es",
    type: MetadataType,
    customPrompt?: string
  ): Promise<ApiResult<GenerateMetadataResponse>> {
    const request: GenerateMetadataRequest = {
      storyText,
      sourceLanguage,
      type,
      customPrompt,
    };
    return fetchApi<GenerateMetadataResponse>("/api/admin/generate-metadata", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  // --------------------------------------------------------------------------
  // Attribution Parsing
  // --------------------------------------------------------------------------

  /**
   * Parse front matter text to extract attribution metadata
   */
  async parseAttribution(
    frontMatterText: string
  ): Promise<ApiResult<ParseAttributionResponse>> {
    const request: ParseAttributionRequest = { frontMatterText };
    return fetchApi<ParseAttributionResponse>("/api/admin/parse-attribution", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  // --------------------------------------------------------------------------
  // Image Proxy
  // --------------------------------------------------------------------------

  /**
   * Proxy an image URL to bypass CORS (for DALL-E images)
   */
  async proxyImage(imageUrl: string): Promise<ApiResult<ProxyImageResponse>> {
    const request: ProxyImageRequest = { imageUrl };
    return fetchApi<ProxyImageResponse>("/api/admin/proxy-image", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  /**
   * Fetch a DALL-E image and convert to a File object
   */
  async fetchImageAsFile(
    imageUrl: string,
    filename: string
  ): Promise<ApiResult<{ file: File; dataUrl: string }>> {
    const proxyResult = await this.proxyImage(imageUrl);

    if (!proxyResult.success) {
      return proxyResult;
    }

    try {
      const response = await fetch(proxyResult.data.dataUrl);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: "image/png" });

      return {
        success: true,
        data: {
          file,
          dataUrl: proxyResult.data.dataUrl,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to convert image",
      };
    }
  },

  // --------------------------------------------------------------------------
  // Save Story
  // --------------------------------------------------------------------------

  /**
   * Save story to the codebase
   */
  async saveStory(
    storyData: SaveStoryRequest
  ): Promise<ApiResult<SaveStoryResponse>> {
    return fetchApi<SaveStoryResponse>("/api/admin/save-story", {
      method: "POST",
      body: JSON.stringify(storyData),
    });
  },
};

// Export types for consumers
export type { ApiResult };
