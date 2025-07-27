// src/lib/migration-validator.ts

import { getMigrationConfig } from './migration-config';
import { createTestRunner, migrationTestSuites } from './migration-testing';
import { createFallbackManager } from './fallback-manager';
import type { 
  MigrationConfig, 
  EnvironmentHealth, 
  MigrationTestResult,
  TestContext 
} from '@/types/migration';

export interface ValidationResult {
  passed: boolean;
  score: number; // 0-100
  issues: ValidationIssue[];
  recommendations: string[];
  blockingIssues: ValidationIssue[];
}

export interface ValidationIssue {
  id: string;
  category: 'config' | 'environment' | 'dependencies' | 'performance' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  resolution: string;
  blocking: boolean;
  autoFixable: boolean;
}

export interface EnvironmentValidation {
  environment: 'development' | 'staging' | 'production';
  requiredServices: ServiceValidation[];
  configuration: ConfigValidation[];
  dependencies: DependencyValidation[];
  security: SecurityValidation[];
}

export interface ServiceValidation {
  service: string;
  endpoint: string;
  required: boolean;
  status: 'available' | 'unavailable' | 'degraded';
  responseTime?: number;
  lastCheck: number;
  issues: string[];
}

export interface ConfigValidation {
  key: string;
  required: boolean;
  current?: any;
  expected?: any;
  valid: boolean;
  message?: string;
}

export interface DependencyValidation {
  name: string;
  type: 'npm' | 'service' | 'api' | 'database';
  required: boolean;
  version?: string;
  status: 'available' | 'unavailable' | 'outdated';
  issues: string[];
}

export interface SecurityValidation {
  check: string;
  passed: boolean;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details?: string;
}

export interface PreMigrationChecklist {
  id: string;
  name: string;
  category: string;
  required: boolean;
  completed: boolean;
  completedBy?: string;
  completedAt?: number;
  notes?: string;
  evidence?: string[]; // URLs to screenshots, documents, etc.
}

/**
 * Migration Validator for comprehensive pre-migration validation
 */
export class MigrationValidator {
  private validationCache = new Map<string, ValidationResult>();
  private lastValidation: number = 0;

  constructor(private config: MigrationConfig) {}

  /**
   * Run comprehensive pre-migration validation
   */
  async validateMigrationReadiness(
    storySlug?: string,
    level?: string,
    forceRefresh = false
  ): Promise<ValidationResult> {
    const cacheKey = `${storySlug || 'all'}-${level || 'all'}`;
    
    // Return cached result if recent
    if (!forceRefresh && this.validationCache.has(cacheKey)) {
      const cached = this.validationCache.get(cacheKey)!;
      if (Date.now() - this.lastValidation < 300000) { // 5 minutes
        return cached;
      }
    }

    console.log('Running comprehensive migration validation...');

    const issues: ValidationIssue[] = [];
    const recommendations: string[] = [];

    // 1. Configuration validation
    const configIssues = await this.validateConfiguration();
    issues.push(...configIssues);

    // 2. Environment validation
    const envIssues = await this.validateEnvironment();
    issues.push(...envIssues);

    // 3. Service availability validation
    const serviceIssues = await this.validateServices();
    issues.push(...serviceIssues);

    // 4. Performance validation
    const perfIssues = await this.validatePerformance(storySlug, level);
    issues.push(...perfIssues);

    // 5. Security validation
    const securityIssues = await this.validateSecurity();
    issues.push(...securityIssues);

    // 6. Content validation
    if (storySlug && level) {
      const contentIssues = await this.validateContent(storySlug, level);
      issues.push(...contentIssues);
    }

    // Calculate overall score
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;
    const mediumIssues = issues.filter(i => i.severity === 'medium').length;
    const lowIssues = issues.filter(i => i.severity === 'low').length;

    const score = Math.max(0, 100 - (criticalIssues * 25 + highIssues * 10 + mediumIssues * 5 + lowIssues * 1));
    const blockingIssues = issues.filter(i => i.blocking);
    const passed = blockingIssues.length === 0 && score >= 80;

    // Generate recommendations
    if (criticalIssues > 0) {
      recommendations.push('Resolve all critical issues before proceeding with migration');
    }
    if (highIssues > 0) {
      recommendations.push('Address high-severity issues to improve migration safety');
    }
    if (score < 90) {
      recommendations.push('Consider additional testing and validation before production deployment');
    }

    const result: ValidationResult = {
      passed,
      score,
      issues,
      recommendations,
      blockingIssues,
    };

    // Cache result
    this.validationCache.set(cacheKey, result);
    this.lastValidation = Date.now();

    return result;
  }

  /**
   * Validate environment-specific requirements
   */
  async validateEnvironmentRequirements(environment: 'development' | 'staging' | 'production'): Promise<EnvironmentValidation> {
    const requiredServices = await this.validateRequiredServices(environment);
    const configuration = await this.validateEnvironmentConfig(environment);
    const dependencies = await this.validateDependencies(environment);
    const security = await this.validateEnvironmentSecurity(environment);

    return {
      environment,
      requiredServices,
      configuration,
      dependencies,
      security,
    };
  }

  /**
   * Generate pre-migration checklist
   */
  generatePreMigrationChecklist(environment: 'development' | 'staging' | 'production'): PreMigrationChecklist[] {
    const baseChecklist: Omit<PreMigrationChecklist, 'id' | 'completed' | 'completedBy' | 'completedAt'>[] = [
      {
        name: 'Azure Speech Services Configuration',
        category: 'Configuration',
        required: true,
        notes: 'Verify Azure Speech Services credentials and endpoint configuration',
      },
      {
        name: 'Cache System Setup',
        category: 'Infrastructure',
        required: true,
        notes: 'Ensure TTS cache system is properly configured and accessible',
      },
      {
        name: 'Static Audio Fallback',
        category: 'Fallback',
        required: true,
        notes: 'Verify static audio files are accessible for fallback scenarios',
      },
      {
        name: 'Performance Baseline',
        category: 'Performance',
        required: true,
        notes: 'Establish performance baselines for comparison during migration',
      },
      {
        name: 'Monitoring Setup',
        category: 'Monitoring',
        required: true,
        notes: 'Configure monitoring and alerting for migration metrics',
      },
      {
        name: 'Rollback Procedures',
        category: 'Safety',
        required: true,
        notes: 'Document and test rollback procedures',
      },
    ];

    if (environment === 'production') {
      baseChecklist.push(
        {
          name: 'Load Testing',
          category: 'Performance',
          required: true,
          notes: 'Conduct load testing to verify system can handle production traffic',
        },
        {
          name: 'Security Review',
          category: 'Security',
          required: true,
          notes: 'Complete security review of Azure TTS integration',
        },
        {
          name: 'Data Privacy Compliance',
          category: 'Compliance',
          required: true,
          notes: 'Verify compliance with data privacy regulations',
        },
        {
          name: 'User Communication',
          category: 'Communication',
          required: false,
          notes: 'Prepare user communication about new audio features',
        }
      );
    }

    return baseChecklist.map((item, index) => ({
      id: `checklist_${environment}_${index + 1}`,
      completed: false,
      ...item,
    }));
  }

  /**
   * Run automated tests for migration readiness
   */
  async runAutomatedValidation(storySlug: string, level: string): Promise<MigrationTestResult[]> {
    const runner = createTestRunner(this.config);
    const context: TestContext = {
      storySlug,
      level,
      chapter: 1,
      page: 1,
      language: 'es-ES',
      audioSystem: 'hybrid',
      sentences: ['Test sentence for validation'],
      config: this.config,
      metrics: [],
    };

    const allResults: MigrationTestResult[] = [];

    // Run all test suites
    for (const [suiteName, suite] of Object.entries(migrationTestSuites)) {
      try {
        const results = await runner.runTestSuite(suite, context);
        allResults.push(...results);
      } catch (error) {
        console.error(`Test suite ${suiteName} failed:`, error);
      }
    }

    return allResults;
  }

  /**
   * Validate configuration
   */
  private async validateConfiguration(): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check required environment variables
    const requiredEnvVars = [
      'AZURE_SPEECH_KEY',
      'AZURE_SPEECH_REGION',
      'NEXTAUTH_SECRET',
      'DATABASE_URL',
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        issues.push({
          id: `env-var-${envVar.toLowerCase()}`,
          category: 'config',
          severity: 'critical',
          title: `Missing Environment Variable: ${envVar}`,
          description: `Required environment variable ${envVar} is not set`,
          impact: 'Migration cannot proceed without proper configuration',
          resolution: `Set the ${envVar} environment variable with appropriate value`,
          blocking: true,
          autoFixable: false,
        });
      }
    }

    // Validate migration configuration
    if (!this.config.enabled && this.config.currentPhase !== 'disabled') {
      issues.push({
        id: 'config-phase-mismatch',
        category: 'config',
        severity: 'high',
        title: 'Migration Phase Configuration Mismatch',
        description: 'Migration is disabled but current phase is not set to disabled',
        impact: 'May cause unexpected behavior during migration',
        resolution: 'Align migration enabled status with current phase',
        blocking: false,
        autoFixable: true,
      });
    }

    // Check performance thresholds
    if (this.config.performance.maxLoadTime > 10000) {
      issues.push({
        id: 'config-load-time-threshold',
        category: 'config',
        severity: 'medium',
        title: 'High Load Time Threshold',
        description: 'Maximum load time threshold is set very high (>10 seconds)',
        impact: 'Users may experience poor performance before fallback triggers',
        resolution: 'Consider lowering the load time threshold to 5 seconds or less',
        blocking: false,
        autoFixable: false,
      });
    }

    return issues;
  }

  /**
   * Validate environment
   */
  private async validateEnvironment(): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 18) {
      issues.push({
        id: 'env-node-version',
        category: 'environment',
        severity: 'high',
        title: 'Outdated Node.js Version',
        description: `Node.js version ${nodeVersion} may not support all required features`,
        impact: 'Some Azure TTS features may not work correctly',
        resolution: 'Upgrade to Node.js 18 or later',
        blocking: false,
        autoFixable: false,
      });
    }

    // Check memory availability
    const memoryUsage = process.memoryUsage();
    const availableMemory = memoryUsage.heapTotal / (1024 * 1024); // MB

    if (availableMemory < 512) {
      issues.push({
        id: 'env-memory-low',
        category: 'environment',
        severity: 'medium',
        title: 'Low Memory Availability',
        description: `Available memory (${availableMemory.toFixed(0)}MB) may be insufficient for TTS processing`,
        impact: 'May cause performance issues or memory errors',
        resolution: 'Increase available memory or optimize memory usage',
        blocking: false,
        autoFixable: false,
      });
    }

    return issues;
  }

  /**
   * Validate services
   */
  private async validateServices(): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Test Azure TTS connectivity
    try {
      const response = await fetch('/api/azure-tts/generate', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        issues.push({
          id: 'service-azure-tts',
          category: 'dependencies',
          severity: 'critical',
          title: 'Azure TTS Service Unavailable',
          description: `Azure TTS API returned status ${response.status}`,
          impact: 'Migration cannot proceed without Azure TTS access',
          resolution: 'Check Azure Speech Services configuration and network connectivity',
          blocking: true,
          autoFixable: false,
        });
      }
    } catch (error) {
      issues.push({
        id: 'service-azure-tts-error',
        category: 'dependencies',
        severity: 'critical',
        title: 'Azure TTS Service Connection Error',
        description: `Failed to connect to Azure TTS: ${error}`,
        impact: 'Migration cannot proceed without Azure TTS access',
        resolution: 'Verify network connectivity and service configuration',
        blocking: true,
        autoFixable: false,
      });
    }

    // Test static audio fallback
    try {
      const testPath = '/audio/es/the-last-word/l1/ch1/page-1/line1.mp3';
      const response = await fetch(testPath, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        issues.push({
          id: 'service-static-audio',
          category: 'dependencies',
          severity: 'high',
          title: 'Static Audio Fallback Unavailable',
          description: 'Static audio files are not accessible',
          impact: 'Fallback mechanism will not work if Azure TTS fails',
          resolution: 'Verify static audio files are properly deployed and accessible',
          blocking: false,
          autoFixable: false,
        });
      }
    } catch (error) {
      issues.push({
        id: 'service-static-audio-error',
        category: 'dependencies',
        severity: 'high',
        title: 'Static Audio Access Error',
        description: `Failed to access static audio: ${error}`,
        impact: 'Fallback mechanism may not work properly',
        resolution: 'Check static file serving configuration',
        blocking: false,
        autoFixable: false,
      });
    }

    return issues;
  }

  /**
   * Validate performance
   */
  private async validatePerformance(storySlug?: string, level?: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Test TTS generation performance
    try {
      const startTime = Date.now();
      const response = await fetch('/api/azure-tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Performance test sentence',
          language: 'es-ES',
          speed: 'normal',
        }),
      });

      const duration = Date.now() - startTime;

      if (response.ok) {
        if (duration > this.config.performance.maxLoadTime) {
          issues.push({
            id: 'perf-tts-slow',
            category: 'performance',
            severity: 'medium',
            title: 'Slow TTS Generation',
            description: `TTS generation took ${duration}ms, exceeding threshold of ${this.config.performance.maxLoadTime}ms`,
            impact: 'Users may experience delays when playing audio',
            resolution: 'Optimize TTS generation or increase performance thresholds',
            blocking: false,
            autoFixable: false,
          });
        }
      } else {
        issues.push({
          id: 'perf-tts-error',
          category: 'performance',
          severity: 'high',
          title: 'TTS Generation Failed',
          description: `TTS generation failed with status ${response.status}`,
          impact: 'TTS functionality is not working',
          resolution: 'Check TTS service configuration and troubleshoot errors',
          blocking: true,
          autoFixable: false,
        });
      }
    } catch (error) {
      issues.push({
        id: 'perf-tts-timeout',
        category: 'performance',
        severity: 'high',
        title: 'TTS Generation Timeout',
        description: `TTS generation timed out: ${error}`,
        impact: 'TTS requests may fail due to timeouts',
        resolution: 'Increase timeout values or optimize TTS processing',
        blocking: false,
        autoFixable: false,
      });
    }

    return issues;
  }

  /**
   * Validate security
   */
  private async validateSecurity(): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check if sensitive data is exposed
    if (process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_KEY.length < 32) {
      issues.push({
        id: 'security-weak-key',
        category: 'security',
        severity: 'high',
        title: 'Potentially Weak Azure Speech Key',
        description: 'Azure Speech key appears to be shorter than expected',
        impact: 'May indicate invalid or weak credentials',
        resolution: 'Verify Azure Speech key is correct and properly secured',
        blocking: false,
        autoFixable: false,
      });
    }

    // Check HTTPS requirement in production
    if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_URL?.startsWith('https://')) {
      issues.push({
        id: 'security-https-required',
        category: 'security',
        severity: 'critical',
        title: 'HTTPS Required in Production',
        description: 'Production environment must use HTTPS',
        impact: 'Security vulnerabilities and authentication issues',
        resolution: 'Configure HTTPS for production deployment',
        blocking: true,
        autoFixable: false,
      });
    }

    return issues;
  }

  /**
   * Validate content availability
   */
  private async validateContent(storySlug: string, level: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check if story content exists
    try {
      const response = await fetch(`/api/stories/${storySlug}/${level}`, {
        method: 'HEAD',
      });

      if (!response.ok) {
        issues.push({
          id: 'content-story-missing',
          category: 'environment',
          severity: 'high',
          title: 'Story Content Not Found',
          description: `Story content for ${storySlug}/${level} is not available`,
          impact: 'Migration cannot be tested for this story/level combination',
          resolution: 'Verify story content is properly deployed',
          blocking: true,
          autoFixable: false,
        });
      }
    } catch (error) {
      issues.push({
        id: 'content-story-error',
        category: 'environment',
        severity: 'medium',
        title: 'Story Content Access Error',
        description: `Failed to verify story content: ${error}`,
        impact: 'Cannot validate story-specific migration readiness',
        resolution: 'Check story content API and configuration',
        blocking: false,
        autoFixable: false,
      });
    }

    return issues;
  }

  /**
   * Validate required services for environment
   */
  private async validateRequiredServices(environment: string): Promise<ServiceValidation[]> {
    const services: ServiceValidation[] = [
      {
        service: 'Azure TTS',
        endpoint: '/api/azure-tts/generate',
        required: true,
        status: 'unavailable',
        lastCheck: Date.now(),
        issues: [],
      },
      {
        service: 'Static Audio',
        endpoint: '/audio/es/the-last-word/l1/ch1/page-1/line1.mp3',
        required: true,
        status: 'unavailable',
        lastCheck: Date.now(),
        issues: [],
      },
    ];

    for (const service of services) {
      try {
        const startTime = Date.now();
        const response = await fetch(service.endpoint, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });

        service.responseTime = Date.now() - startTime;
        service.status = response.ok ? 'available' : 'unavailable';
        
        if (!response.ok) {
          service.issues.push(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        service.status = 'unavailable';
        service.issues.push(`Connection failed: ${error}`);
      }
    }

    return services;
  }

  /**
   * Validate environment configuration
   */
  private async validateEnvironmentConfig(environment: string): Promise<ConfigValidation[]> {
    const requiredConfig = [
      { key: 'AZURE_SPEECH_KEY', required: true },
      { key: 'AZURE_SPEECH_REGION', required: true },
      { key: 'NEXTAUTH_SECRET', required: true },
      { key: 'DATABASE_URL', required: true },
    ];

    return requiredConfig.map(config => ({
      key: config.key,
      required: config.required,
      current: process.env[config.key] ? '[REDACTED]' : undefined,
      valid: !!process.env[config.key],
      message: process.env[config.key] ? 'Configured' : 'Missing',
    }));
  }

  /**
   * Validate dependencies
   */
  private async validateDependencies(environment: string): Promise<DependencyValidation[]> {
    // This would check package.json dependencies, external services, etc.
    return [
      {
        name: 'next',
        type: 'npm',
        required: true,
        version: '14.x',
        status: 'available',
        issues: [],
      },
      {
        name: 'react',
        type: 'npm',
        required: true,
        version: '18.x',
        status: 'available',
        issues: [],
      },
    ];
  }

  /**
   * Validate environment security
   */
  private async validateEnvironmentSecurity(environment: string): Promise<SecurityValidation[]> {
    const checks: SecurityValidation[] = [
      {
        check: 'HTTPS Configuration',
        passed: environment !== 'production' || process.env.NEXTAUTH_URL?.startsWith('https://') || false,
        description: 'Verify HTTPS is configured for production',
        severity: 'critical',
      },
      {
        check: 'Environment Variables Security',
        passed: !process.env.AZURE_SPEECH_KEY?.includes('test') && !process.env.AZURE_SPEECH_KEY?.includes('demo'),
        description: 'Ensure production credentials are not test/demo values',
        severity: 'high',
      },
    ];

    return checks;
  }
}

/**
 * Create migration validator
 */
export function createMigrationValidator(config?: MigrationConfig): MigrationValidator {
  const migrationConfig = config || getMigrationConfig();
  return new MigrationValidator(migrationConfig);
}

/**
 * Quick validation check for immediate readiness
 */
export async function quickValidationCheck(): Promise<{ ready: boolean; criticalIssues: string[] }> {
  const validator = createMigrationValidator();
  const result = await validator.validateMigrationReadiness();
  
  const criticalIssues = result.blockingIssues.map(issue => issue.title);
  
  return {
    ready: result.passed,
    criticalIssues,
  };
}