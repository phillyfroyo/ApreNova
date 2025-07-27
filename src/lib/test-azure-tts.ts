// src/lib/test-azure-tts.ts
import { getTTSService } from './tts-service';
import type { TTSRequest } from '@/types/azure-tts';

/**
 * Test the Azure TTS system end-to-end
 */
export async function testAzureTTS(): Promise<{
  success: boolean;
  results: Array<{
    test: string;
    success: boolean;
    error?: string;
    duration?: number;
    cached?: boolean;
  }>;
}> {
  const ttsService = getTTSService();
  const results = [];

  // Test 1: Basic Spanish TTS
  try {
    const start = Date.now();
    const spanishRequest: TTSRequest = {
      text: 'Hola, este es una prueba del sistema de texto a voz.',
      language: 'es-ES',
      speed: 'normal'
    };
    
    const spanishResult = await ttsService.generateTTS(spanishRequest);
    const duration = Date.now() - start;
    
    results.push({
      test: 'Spanish Normal Speed TTS',
      success: !!spanishResult.audioUrl,
      duration,
      cached: spanishResult.cached
    });
  } catch (error) {
    results.push({
      test: 'Spanish Normal Speed TTS',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 2: Basic English TTS
  try {
    const start = Date.now();
    const englishRequest: TTSRequest = {
      text: 'Hello, this is a test of the text-to-speech system.',
      language: 'en-US',
      speed: 'normal'
    };
    
    const englishResult = await ttsService.generateTTS(englishRequest);
    const duration = Date.now() - start;
    
    results.push({
      test: 'English Normal Speed TTS',
      success: !!englishResult.audioUrl,
      duration,
      cached: englishResult.cached
    });
  } catch (error) {
    results.push({
      test: 'English Normal Speed TTS',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 3: Slow speed TTS
  try {
    const start = Date.now();
    const slowRequest: TTSRequest = {
      text: 'This is a slow speed test.',
      language: 'en-US',
      speed: 'slow'
    };
    
    const slowResult = await ttsService.generateTTS(slowRequest);
    const duration = Date.now() - start;
    
    results.push({
      test: 'English Slow Speed TTS',
      success: !!slowResult.audioUrl,
      duration,
      cached: slowResult.cached
    });
  } catch (error) {
    results.push({
      test: 'English Slow Speed TTS',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 4: Cache functionality (repeat first test)
  try {
    const start = Date.now();
    const cacheRequest: TTSRequest = {
      text: 'Hola, este es una prueba del sistema de texto a voz.',
      language: 'es-ES',
      speed: 'normal'
    };
    
    const cacheResult = await ttsService.generateTTS(cacheRequest);
    const duration = Date.now() - start;
    
    results.push({
      test: 'Cache Hit Test',
      success: !!cacheResult.audioUrl && cacheResult.cached,
      duration,
      cached: cacheResult.cached
    });
  } catch (error) {
    results.push({
      test: 'Cache Hit Test',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 5: Batch processing
  try {
    const start = Date.now();
    const batchRequests: TTSRequest[] = [
      { text: 'Primera oración.', language: 'es-ES', speed: 'normal' },
      { text: 'Segunda oración.', language: 'es-ES', speed: 'normal' },
      { text: 'Tercera oración.', language: 'es-ES', speed: 'normal' }
    ];
    
    const batchResult = await ttsService.generateBatchTTS({
      items: batchRequests,
      storySlug: 'test-story',
      chapterPage: 'test-chapter-1'
    });
    const duration = Date.now() - start;
    
    const successCount = batchResult.results.filter(r => !!r.audioUrl).length;
    
    results.push({
      test: `Batch Processing (${successCount}/${batchRequests.length})`,
      success: successCount === batchRequests.length,
      duration
    });
  } catch (error) {
    results.push({
      test: 'Batch Processing',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 6: Service health check
  try {
    const healthCheck = await ttsService.testService();
    
    results.push({
      test: 'Service Health Check',
      success: healthCheck.speechService && healthCheck.cacheService && healthCheck.endToEnd,
      error: !healthCheck.speechService ? 'Speech service failed' : 
             !healthCheck.cacheService ? 'Cache service failed' :
             !healthCheck.endToEnd ? 'End-to-end test failed' : undefined
    });
  } catch (error) {
    results.push({
      test: 'Service Health Check',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  const successCount = results.filter(r => r.success).length;
  const totalTests = results.length;

  return {
    success: successCount === totalTests,
    results
  };
}

/**
 * Test Azure TTS API endpoints
 */
export async function testTTSAPI(baseUrl: string = 'http://localhost:3000'): Promise<{
  success: boolean;
  results: Array<{
    endpoint: string;
    success: boolean;
    status?: number;
    error?: string;
    responseTime?: number;
  }>;
}> {
  const results = [];

  // Test 1: Generate endpoint
  try {
    const start = Date.now();
    const response = await fetch(`${baseUrl}/api/azure-tts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'API test message',
        language: 'en-US',
        speed: 'normal'
      })
    });
    
    const responseTime = Date.now() - start;
    const success = response.ok;
    
    results.push({
      endpoint: 'POST /api/azure-tts/generate',
      success,
      status: response.status,
      responseTime
    });
  } catch (error) {
    results.push({
      endpoint: 'POST /api/azure-tts/generate',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 2: Generate endpoint info
  try {
    const start = Date.now();
    const response = await fetch(`${baseUrl}/api/azure-tts/generate`);
    const responseTime = Date.now() - start;
    
    results.push({
      endpoint: 'GET /api/azure-tts/generate',
      success: response.ok,
      status: response.status,
      responseTime
    });
  } catch (error) {
    results.push({
      endpoint: 'GET /api/azure-tts/generate',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 3: Batch endpoint info
  try {
    const start = Date.now();
    const response = await fetch(`${baseUrl}/api/azure-tts/batch`);
    const responseTime = Date.now() - start;
    
    results.push({
      endpoint: 'GET /api/azure-tts/batch',
      success: response.ok,
      status: response.status,
      responseTime
    });
  } catch (error) {
    results.push({
      endpoint: 'GET /api/azure-tts/batch',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 4: Admin endpoint
  try {
    const start = Date.now();
    const response = await fetch(`${baseUrl}/api/azure-tts/admin`);
    const responseTime = Date.now() - start;
    
    results.push({
      endpoint: 'GET /api/azure-tts/admin',
      success: response.status === 200, // Should work without auth for GET
      status: response.status,
      responseTime
    });
  } catch (error) {
    results.push({
      endpoint: 'GET /api/azure-tts/admin',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  const successCount = results.filter(r => r.success).length;
  const totalTests = results.length;

  return {
    success: successCount === totalTests,
    results
  };
}