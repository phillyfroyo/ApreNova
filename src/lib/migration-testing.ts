// src/lib/migration-testing.ts

import type { 
  MigrationTestResult, 
  AudioQualityMetrics, 
  ComparisonReport,
  MigrationConfig,
  PerformanceMetrics 
} from '@/types/migration';

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  tests: TestCase[];
  setupTeardown?: {
    setup?: () => Promise<void>;
    teardown?: () => Promise<void>;
  };
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  type: 'unit' | 'integration' | 'performance' | 'user_acceptance';
  timeout?: number; // ms
  retries?: number;
  execute: (context: TestContext) => Promise<TestResult>;
  validate?: (result: TestResult) => boolean;
}

export interface TestContext {
  storySlug: string;
  level: string;
  chapter: number;
  page: number;
  language: 'es-ES' | 'en-US';
  audioSystem: 'azure' | 'static' | 'hybrid';
  sentences: string[];
  config: MigrationConfig;
  metrics: PerformanceMetrics[];
}

export interface TestResult {
  testId: string;
  passed: boolean;
  score: number; // 0-100
  duration: number;
  errors: string[];
  warnings: string[];
  metrics: Record<string, any>;
  artifacts?: Record<string, any>; // Audio files, screenshots, etc.
}

/**
 * Main test runner for migration testing
 */
export class MigrationTestRunner {
  private results: Map<string, MigrationTestResult> = new Map();
  private isRunning = false;

  constructor(private config: MigrationConfig) {}

  /**
   * Run a complete test suite
   */
  async runTestSuite(suite: TestSuite, context: TestContext): Promise<MigrationTestResult[]> {
    if (this.isRunning) {
      throw new Error('Test runner is already running');
    }

    this.isRunning = true;
    const results: MigrationTestResult[] = [];

    try {
      // Setup
      if (suite.setupTeardown?.setup) {
        await suite.setupTeardown.setup();
      }

      // Run tests
      for (const test of suite.tests) {
        const result = await this.runSingleTest(test, context);
        results.push(result);
        this.results.set(result.testId, result);
      }

      // Teardown
      if (suite.setupTeardown?.teardown) {
        await suite.setupTeardown.teardown();
      }

    } finally {
      this.isRunning = false;
    }

    return results;
  }

  /**
   * Run a single test case
   */
  async runSingleTest(testCase: TestCase, context: TestContext): Promise<MigrationTestResult> {
    const startTime = Date.now();
    let attempt = 0;
    const maxAttempts = (testCase.retries || 0) + 1;

    while (attempt < maxAttempts) {
      try {
        const result = await this.executeWithTimeout(testCase, context);
        
        const migrationResult: MigrationTestResult = {
          testId: testCase.id,
          timestamp: Date.now(),
          type: testCase.type,
          passed: result.passed && (testCase.validate ? testCase.validate(result) : true),
          score: result.score,
          duration: Date.now() - startTime,
          errors: result.errors,
          metrics: result.metrics,
          context: {
            environment: process.env.NODE_ENV as any || 'development',
            audioSystem: context.audioSystem,
            testGroup: `${context.storySlug}-${context.level}`,
          },
        };

        return migrationResult;

      } catch (error) {
        attempt++;
        
        if (attempt >= maxAttempts) {
          return {
            testId: testCase.id,
            timestamp: Date.now(),
            type: testCase.type,
            passed: false,
            score: 0,
            duration: Date.now() - startTime,
            errors: [error instanceof Error ? error.message : String(error)],
            metrics: {},
            context: {
              environment: process.env.NODE_ENV as any || 'development',
              audioSystem: context.audioSystem,
              testGroup: `${context.storySlug}-${context.level}`,
            },
          };
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    throw new Error('Should not reach here');
  }

  /**
   * Execute test with timeout
   */
  private async executeWithTimeout(testCase: TestCase, context: TestContext): Promise<TestResult> {
    const timeout = testCase.timeout || 30000; // 30 seconds default

    return Promise.race([
      testCase.execute(context),
      new Promise<TestResult>((_, reject) => 
        setTimeout(() => reject(new Error(`Test timed out after ${timeout}ms`)), timeout)
      )
    ]);
  }

  /**
   * Get test results
   */
  getResults(): MigrationTestResult[] {
    return Array.from(this.results.values());
  }

  /**
   * Get test summary
   */
  getSummary(): {
    total: number;
    passed: number;
    failed: number;
    averageScore: number;
    totalDuration: number;
  } {
    const results = this.getResults();
    const passed = results.filter(r => r.passed).length;
    const averageScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    return {
      total: results.length,
      passed,
      failed: results.length - passed,
      averageScore: isNaN(averageScore) ? 0 : averageScore,
      totalDuration,
    };
  }
}

/**
 * Pre-defined test suites for different migration phases
 */
export const migrationTestSuites: Record<string, TestSuite> = {
  preDeployment: {
    id: 'pre-deployment',
    name: 'Pre-Deployment Validation',
    description: 'Validates system health before migration deployment',
    tests: [
      {
        id: 'azure-tts-connectivity',
        name: 'Azure TTS Service Connectivity',
        description: 'Verify Azure TTS service is accessible and responding',
        type: 'integration',
        timeout: 10000,
        async execute(context: TestContext): Promise<TestResult> {
          const startTime = Date.now();
          const errors: string[] = [];
          
          try {
            // Test Azure TTS API endpoint
            const response = await fetch('/api/azure-tts/generate', {
              method: 'GET',
            });
            
            if (!response.ok) {
              errors.push(`Azure TTS API returned ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.supportedLanguages?.includes('es-ES')) {
              errors.push('Spanish language not supported');
            }
            
            if (!data.supportedLanguages?.includes('en-US')) {
              errors.push('English language not supported');
            }

            return {
              testId: 'azure-tts-connectivity',
              passed: errors.length === 0,
              score: errors.length === 0 ? 100 : 0,
              duration: Date.now() - startTime,
              errors,
              warnings: [],
              metrics: {
                responseTime: Date.now() - startTime,
                supportedLanguages: data.supportedLanguages || [],
              },
            };
            
          } catch (error) {
            return {
              testId: 'azure-tts-connectivity',
              passed: false,
              score: 0,
              duration: Date.now() - startTime,
              errors: [error instanceof Error ? error.message : String(error)],
              warnings: [],
              metrics: {},
            };
          }
        },
      },
      
      {
        id: 'static-audio-availability',
        name: 'Static Audio Files Availability',
        description: 'Verify static audio files are accessible',
        type: 'integration',
        async execute(context: TestContext): Promise<TestResult> {
          const startTime = Date.now();
          const errors: string[] = [];
          const warnings: string[] = [];
          
          // Test a sample of audio files
          const samplePaths = [
            `/audio/es/${context.storySlug}/${context.level}/ch${context.chapter}/page-${context.page}/line1.mp3`,
            `/audio/es/${context.storySlug}/${context.level}/ch${context.chapter}/page-${context.page}-slow/line1.mp3`,
          ];
          
          let accessibleFiles = 0;
          
          for (const path of samplePaths) {
            try {
              const response = await fetch(path, { method: 'HEAD' });
              if (response.ok) {
                accessibleFiles++;
              } else {
                warnings.push(`Audio file not accessible: ${path}`);
              }
            } catch (error) {
              errors.push(`Failed to check audio file ${path}: ${error}`);
            }
          }
          
          const score = (accessibleFiles / samplePaths.length) * 100;
          
          return {
            testId: 'static-audio-availability',
            passed: errors.length === 0 && accessibleFiles > 0,
            score,
            duration: Date.now() - startTime,
            errors,
            warnings,
            metrics: {
              totalFiles: samplePaths.length,
              accessibleFiles,
              accessibilityRate: score / 100,
            },
          };
        },
      },

      {
        id: 'cache-system-health',
        name: 'Cache System Health Check',
        description: 'Verify cache system is functioning correctly',
        type: 'integration',
        async execute(context: TestContext): Promise<TestResult> {
          const startTime = Date.now();
          const errors: string[] = [];
          
          try {
            // Test cache by making a TTS request and checking if it's cached on second request
            const testRequest = {
              text: 'Hello world test',
              language: 'en-US' as const,
              speed: 'normal' as const,
            };
            
            // First request
            const response1 = await fetch('/api/azure-tts/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(testRequest),
            });
            
            if (!response1.ok) {
              errors.push(`First TTS request failed: ${response1.status}`);
            } else {
              const data1 = await response1.json();
              
              // Second request (should be cached)
              const response2 = await fetch('/api/azure-tts/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testRequest),
              });
              
              if (response2.ok) {
                const data2 = await response2.json();
                if (!data2.cached) {
                  errors.push('Cache not working - second request was not cached');
                }
              } else {
                errors.push(`Second TTS request failed: ${response2.status}`);
              }
            }
            
            return {
              testId: 'cache-system-health',
              passed: errors.length === 0,
              score: errors.length === 0 ? 100 : 0,
              duration: Date.now() - startTime,
              errors,
              warnings: [],
              metrics: {
                totalRequests: 2,
                cacheWorking: errors.length === 0,
              },
            };
            
          } catch (error) {
            return {
              testId: 'cache-system-health',
              passed: false,
              score: 0,
              duration: Date.now() - startTime,
              errors: [error instanceof Error ? error.message : String(error)],
              warnings: [],
              metrics: {},
            };
          }
        },
      },
    ],
  },

  audioQuality: {
    id: 'audio-quality',
    name: 'Audio Quality Assessment',
    description: 'Compare audio quality between Azure TTS and static files',
    tests: [
      {
        id: 'azure-vs-static-comparison',
        name: 'Azure TTS vs Static Audio Comparison',
        description: 'Generate and compare audio quality metrics',
        type: 'performance',
        timeout: 60000, // 1 minute
        async execute(context: TestContext): Promise<TestResult> {
          const startTime = Date.now();
          const errors: string[] = [];
          const warnings: string[] = [];
          
          try {
            const testSentence = context.sentences[0] || 'Hello world test sentence';
            
            // Generate Azure TTS audio
            const azureRequest = {
              text: testSentence,
              language: context.language,
              speed: 'normal' as const,
              storySlug: context.storySlug,
              chapterPage: `ch${context.chapter}/page-${context.page}`,
            };
            
            const azureResponse = await fetch('/api/azure-tts/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(azureRequest),
            });
            
            let azureMetrics: Partial<AudioQualityMetrics> = {};
            let staticMetrics: Partial<AudioQualityMetrics> = {};
            
            if (azureResponse.ok) {
              const azureData = await azureResponse.json();
              azureMetrics = {
                audioSystem: 'azure',
                storySlug: context.storySlug,
                level: context.level,
                language: context.language,
                duration: azureData.duration,
                wordCount: azureData.wordTimings?.length || 0,
                wordTimingAccuracy: calculateTimingAccuracy(azureData.wordTimings),
                clarity: 4, // Would need audio analysis
                naturalness: 4,
                speed: 4,
                pronunciation: 4,
              };
            } else {
              errors.push(`Azure TTS generation failed: ${azureResponse.status}`);
            }
            
            // Test static audio
            const staticPath = `/audio/${context.language.split('-')[0]}/${context.storySlug}/${context.level}/ch${context.chapter}/page-${context.page}/line1.mp3`;
            const staticResponse = await fetch(staticPath, { method: 'HEAD' });
            
            if (staticResponse.ok) {
              staticMetrics = {
                audioSystem: 'static',
                storySlug: context.storySlug,
                level: context.level,
                language: context.language,
                clarity: 3, // Placeholder ratings
                naturalness: 3,
                speed: 3,
                pronunciation: 3,
              };
            } else {
              warnings.push(`Static audio file not found: ${staticPath}`);
            }
            
            const score = calculateQualityScore(azureMetrics, staticMetrics);
            
            return {
              testId: 'azure-vs-static-comparison',
              passed: errors.length === 0,
              score,
              duration: Date.now() - startTime,
              errors,
              warnings,
              metrics: {
                azureMetrics,
                staticMetrics,
                qualityScore: score,
              },
            };
            
          } catch (error) {
            return {
              testId: 'azure-vs-static-comparison',
              passed: false,
              score: 0,
              duration: Date.now() - startTime,
              errors: [error instanceof Error ? error.message : String(error)],
              warnings,
              metrics: {},
            };
          }
        },
      },
    ],
  },

  performance: {
    id: 'performance',
    name: 'Performance Testing',
    description: 'Test audio loading and playback performance',
    tests: [
      {
        id: 'load-time-comparison',
        name: 'Audio Load Time Comparison',
        description: 'Compare load times between Azure TTS and static audio',
        type: 'performance',
        async execute(context: TestContext): Promise<TestResult> {
          const startTime = Date.now();
          const errors: string[] = [];
          const loadTimes: { azure: number[]; static: number[] } = { azure: [], static: [] };
          
          try {
            // Test multiple sentences for statistical significance
            const testSentences = context.sentences.slice(0, 3);
            
            for (const sentence of testSentences) {
              // Test Azure TTS
              const azureStart = Date.now();
              const azureResponse = await fetch('/api/azure-tts/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: sentence,
                  language: context.language,
                  speed: 'normal',
                }),
              });
              
              if (azureResponse.ok) {
                loadTimes.azure.push(Date.now() - azureStart);
              } else {
                errors.push(`Azure TTS failed for sentence: ${sentence.substring(0, 50)}...`);
              }
              
              // Test static audio (simulate loading)
              const staticStart = Date.now();
              const staticPath = `/audio/${context.language.split('-')[0]}/${context.storySlug}/${context.level}/ch${context.chapter}/page-${context.page}/line${testSentences.indexOf(sentence) + 1}.mp3`;
              const staticResponse = await fetch(staticPath, { method: 'HEAD' });
              
              if (staticResponse.ok) {
                loadTimes.static.push(Date.now() - staticStart);
              }
            }
            
            const azureAvg = loadTimes.azure.reduce((a, b) => a + b, 0) / loadTimes.azure.length;
            const staticAvg = loadTimes.static.reduce((a, b) => a + b, 0) / loadTimes.static.length;
            
            // Score based on performance (lower is better)
            const score = Math.max(0, 100 - Math.max(0, azureAvg - 2000) / 50); // Penalty for >2s load times
            
            return {
              testId: 'load-time-comparison',
              passed: errors.length === 0 && azureAvg < 5000, // Less than 5 seconds
              score,
              duration: Date.now() - startTime,
              errors,
              warnings: [],
              metrics: {
                azureLoadTimes: loadTimes.azure,
                staticLoadTimes: loadTimes.static,
                azureAverage: azureAvg,
                staticAverage: staticAvg,
                performanceRatio: azureAvg / staticAvg,
              },
            };
            
          } catch (error) {
            return {
              testId: 'load-time-comparison',
              passed: false,
              score: 0,
              duration: Date.now() - startTime,
              errors: [error instanceof Error ? error.message : String(error)],
              warnings: [],
              metrics: { loadTimes },
            };
          }
        },
      },
    ],
  },

  userAcceptance: {
    id: 'user-acceptance',
    name: 'User Acceptance Testing',
    description: 'Validate user experience with migration features',
    tests: [
      {
        id: 'word-highlighting-accuracy',
        name: 'Word Highlighting Accuracy',
        description: 'Test accuracy of word-level highlighting in Azure TTS',
        type: 'user_acceptance',
        async execute(context: TestContext): Promise<TestResult> {
          const startTime = Date.now();
          const errors: string[] = [];
          
          try {
            const testSentence = context.sentences[0] || 'This is a test sentence for word highlighting';
            const words = testSentence.split(' ');
            
            const response = await fetch('/api/azure-tts/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: testSentence,
                language: context.language,
                speed: 'normal',
              }),
            });
            
            if (!response.ok) {
              errors.push(`TTS generation failed: ${response.status}`);
            } else {
              const data = await response.json();
              const wordTimings = data.wordTimings || [];
              
              // Validate word timings
              if (wordTimings.length !== words.length) {
                errors.push(`Word count mismatch: expected ${words.length}, got ${wordTimings.length}`);
              }
              
              // Check timing consistency
              let timingErrors = 0;
              for (let i = 1; i < wordTimings.length; i++) {
                if (wordTimings[i].startTime <= wordTimings[i - 1].endTime) {
                  timingErrors++;
                }
              }
              
              const accuracy = 1 - (timingErrors / wordTimings.length);
              const score = accuracy * 100;
              
              return {
                testId: 'word-highlighting-accuracy',
                passed: errors.length === 0 && accuracy > 0.9,
                score,
                duration: Date.now() - startTime,
                errors,
                warnings: timingErrors > 0 ? [`${timingErrors} timing inconsistencies found`] : [],
                metrics: {
                  expectedWords: words.length,
                  actualTimings: wordTimings.length,
                  timingErrors,
                  accuracy,
                  wordTimings,
                },
              };
            }
            
            return {
              testId: 'word-highlighting-accuracy',
              passed: false,
              score: 0,
              duration: Date.now() - startTime,
              errors,
              warnings: [],
              metrics: {},
            };
            
          } catch (error) {
            return {
              testId: 'word-highlighting-accuracy',
              passed: false,
              score: 0,
              duration: Date.now() - startTime,
              errors: [error instanceof Error ? error.message : String(error)],
              warnings: [],
              metrics: {},
            };
          }
        },
      },
    ],
  },
};

/**
 * Helper functions
 */
function calculateTimingAccuracy(wordTimings: any[]): number {
  if (!wordTimings || wordTimings.length === 0) return 0;
  
  let consistentTimings = 0;
  for (let i = 1; i < wordTimings.length; i++) {
    if (wordTimings[i].startTime > wordTimings[i - 1].endTime) {
      consistentTimings++;
    }
  }
  
  return consistentTimings / (wordTimings.length - 1);
}

function calculateQualityScore(azure: Partial<AudioQualityMetrics>, static: Partial<AudioQualityMetrics>): number {
  // Simple quality scoring based on available metrics
  const azureScore = (azure.clarity || 0) + (azure.naturalness || 0) + (azure.pronunciation || 0);
  const staticScore = (static.clarity || 0) + (static.naturalness || 0) + (static.pronunciation || 0);
  
  return Math.min(100, Math.max(0, (azureScore / 12) * 100));
}

/**
 * Test runner factory
 */
export function createTestRunner(config: MigrationConfig): MigrationTestRunner {
  return new MigrationTestRunner(config);
}

/**
 * Quick validation test for migration readiness
 */
export async function runMigrationReadinessCheck(
  storySlug: string,
  level: string,
  config: MigrationConfig
): Promise<{ ready: boolean; issues: string[]; score: number }> {
  const runner = createTestRunner(config);
  const context: TestContext = {
    storySlug,
    level,
    chapter: 1,
    page: 1,
    language: 'es-ES',
    audioSystem: 'hybrid',
    sentences: ['Test sentence for validation'],
    config,
    metrics: [],
  };
  
  const results = await runner.runTestSuite(migrationTestSuites.preDeployment, context);
  const summary = runner.getSummary();
  
  const issues: string[] = [];
  results.forEach(result => {
    if (!result.passed) {
      issues.push(`${result.testId}: ${result.errors.join(', ')}`);
    }
  });
  
  return {
    ready: summary.passed === summary.total,
    issues,
    score: summary.averageScore,
  };
}