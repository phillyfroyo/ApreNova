// src/lib/migration-config.ts

import type { 
  MigrationConfig, 
  MigrationEnvironment, 
  UserMigrationProfile,
  ABTestConfig 
} from '@/types/migration';

/**
 * Default migration configuration
 */
const DEFAULT_CONFIG: MigrationConfig = {
  enabled: false,
  currentPhase: 'disabled',
  audioSystem: 'static',
  fallbackStrategy: 'auto',
  
  storyWhitelist: [],
  levelWhitelist: [],
  userPercentage: 0,
  premiumOnly: false,
  
  performance: {
    maxLoadTime: 5000, // 5 seconds
    minCacheHitRate: 0.8, // 80%
    maxErrorRate: 0.05, // 5%
    maxRetryAttempts: 3,
  },
  
  monitoring: {
    enabled: true,
    sampleRate: 0.1, // 10% of requests
    debugMode: false,
    logLevel: 'info',
  },
  
  testing: {
    enableMetrics: true,
    compareWithStatic: false,
    validateWordTimings: true,
    audioQualityChecks: false,
  },
};

/**
 * Environment-specific configurations
 */
const ENVIRONMENT_CONFIGS: Record<string, Partial<MigrationConfig>> = {
  development: {
    enabled: true,
    currentPhase: 'experimental',
    audioSystem: 'hybrid',
    storyWhitelist: ['the-last-word'],
    levelWhitelist: ['l1', 'l2'],
    userPercentage: 100,
    monitoring: {
      enabled: true,
      sampleRate: 1.0, // 100% sampling in dev
      debugMode: true,
      logLevel: 'debug',
    },
    testing: {
      enableMetrics: true,
      compareWithStatic: true,
      validateWordTimings: true,
      audioQualityChecks: true,
    },
  },
  
  staging: {
    enabled: true,
    currentPhase: 'sandbox',
    audioSystem: 'hybrid',
    storyWhitelist: ['the-last-word'],
    levelWhitelist: ['l1', 'l2', 'l3'],
    userPercentage: 50,
    monitoring: {
      enabled: true,
      sampleRate: 0.5, // 50% sampling
      debugMode: false,
      logLevel: 'info',
    },
    testing: {
      enableMetrics: true,
      compareWithStatic: true,
      validateWordTimings: true,
      audioQualityChecks: true,
    },
  },
  
  production: {
    enabled: false, // Start disabled for safety
    currentPhase: 'disabled',
    audioSystem: 'static',
    storyWhitelist: [],
    levelWhitelist: [],
    userPercentage: 0,
    monitoring: {
      enabled: true,
      sampleRate: 0.1, // 10% sampling
      debugMode: false,
      logLevel: 'warn',
    },
    testing: {
      enableMetrics: true,
      compareWithStatic: false,
      validateWordTimings: false,
      audioQualityChecks: false,
    },
  },
};

/**
 * Get migration configuration for current environment
 */
export function getMigrationConfig(): MigrationConfig {
  const env = process.env.NODE_ENV || 'development';
  const envConfig = ENVIRONMENT_CONFIGS[env] || {};
  
  return {
    ...DEFAULT_CONFIG,
    ...envConfig,
  };
}

/**
 * Phase-based configuration overrides
 */
const PHASE_CONFIGS: Record<string, Partial<MigrationConfig>> = {
  disabled: {
    enabled: false,
    audioSystem: 'static',
    userPercentage: 0,
  },
  
  experimental: {
    enabled: true,
    audioSystem: 'azure',
    storyWhitelist: ['the-last-word'],
    levelWhitelist: ['l1'],
    userPercentage: 100,
    premiumOnly: true,
  },
  
  sandbox: {
    enabled: true,
    audioSystem: 'hybrid',
    storyWhitelist: ['the-last-word'],
    levelWhitelist: ['l1', 'l2'],
    userPercentage: 100,
  },
  
  beta: {
    enabled: true,
    audioSystem: 'hybrid',
    storyWhitelist: ['the-last-word'],
    levelWhitelist: ['l1', 'l2', 'l3'],
    userPercentage: 25,
    fallbackStrategy: 'auto',
  },
  
  production: {
    enabled: true,
    audioSystem: 'hybrid',
    userPercentage: 100,
    fallbackStrategy: 'auto',
  },
  
  complete: {
    enabled: true,
    audioSystem: 'azure',
    userPercentage: 100,
    fallbackStrategy: 'static',
  },
};

/**
 * Get configuration for specific migration phase
 */
export function getPhaseConfig(phase: string): Partial<MigrationConfig> {
  return PHASE_CONFIGS[phase] || {};
}

/**
 * Check if user should use Azure TTS based on migration rules
 */
export function shouldUseAzureTTS(
  config: MigrationConfig,
  userProfile: UserMigrationProfile | null,
  context: {
    storySlug: string;
    level: string;
    isPremium: boolean;
    userId?: string;
  }
): boolean {
  // If migration is disabled, use static
  if (!config.enabled || config.currentPhase === 'disabled') {
    return false;
  }
  
  // If system is set to static only, don't use Azure
  if (config.audioSystem === 'static') {
    return false;
  }
  
  // If system is set to Azure only, use Azure
  if (config.audioSystem === 'azure') {
    return true;
  }
  
  // For hybrid system, check additional rules
  
  // Check premium requirement
  if (config.premiumOnly && !context.isPremium) {
    return false;
  }
  
  // Check story whitelist
  if (config.storyWhitelist.length > 0 && !config.storyWhitelist.includes(context.storySlug)) {
    return false;
  }
  
  // Check level whitelist
  if (config.levelWhitelist.length > 0 && !config.levelWhitelist.includes(context.level)) {
    return false;
  }
  
  // Check user assignment (A/B testing)
  if (userProfile) {
    return userProfile.assignedGroup === 'azure';
  }
  
  // For new users, use percentage-based assignment
  if (context.userId) {
    const userHash = hashString(context.userId);
    const userPercentage = userHash % 100;
    return userPercentage < config.userPercentage;
  }
  
  // Default to static for anonymous users
  return false;
}

/**
 * Simple hash function for consistent user assignment
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get user's migration group assignment
 */
export function assignUserToGroup(
  config: MigrationConfig,
  userId: string,
  context: {
    storySlug: string;
    level: string;
    isPremium: boolean;
  }
): 'azure' | 'static' | 'control' {
  if (!config.enabled) {
    return 'static';
  }
  
  const userHash = hashString(userId + context.storySlug + context.level);
  const userPercentage = userHash % 100;
  
  if (userPercentage < config.userPercentage) {
    return 'azure';
  } else if (userPercentage < config.userPercentage + 10) {
    return 'control'; // Small control group for comparison
  } else {
    return 'static';
  }
}

/**
 * Validate migration configuration
 */
export function validateMigrationConfig(config: MigrationConfig): string[] {
  const errors: string[] = [];
  
  if (config.userPercentage < 0 || config.userPercentage > 100) {
    errors.push('userPercentage must be between 0 and 100');
  }
  
  if (config.performance.maxLoadTime <= 0) {
    errors.push('maxLoadTime must be positive');
  }
  
  if (config.performance.minCacheHitRate < 0 || config.performance.minCacheHitRate > 1) {
    errors.push('minCacheHitRate must be between 0 and 1');
  }
  
  if (config.performance.maxErrorRate < 0 || config.performance.maxErrorRate > 1) {
    errors.push('maxErrorRate must be between 0 and 1');
  }
  
  if (config.monitoring.sampleRate < 0 || config.monitoring.sampleRate > 1) {
    errors.push('monitoring.sampleRate must be between 0 and 1');
  }
  
  return errors;
}

/**
 * Get A/B test configuration for story
 */
export function getABTestConfig(storySlug: string): ABTestConfig | null {
  // This would typically come from a database or config service
  // For now, return a sample config for the last word story
  
  if (storySlug === 'the-last-word') {
    return {
      testId: 'azure-tts-vs-static-v1',
      name: 'Azure TTS vs Static Audio Comparison',
      description: 'Compare Azure TTS with static audio for user experience and performance',
      enabled: true,
      
      controlGroup: {
        percentage: 50,
        audioSystem: 'static',
      },
      testGroup: {
        percentage: 50,
        audioSystem: 'azure',
      },
      
      targeting: {
        stories: ['the-last-word'],
        levels: ['l1', 'l2'],
        userTypes: ['free', 'premium'],
        newUsersOnly: false,
      },
      
      successCriteria: {
        minSampleSize: 100,
        maxDuration: 14, // 2 weeks
        significanceLevel: 0.05,
        primaryMetric: 'loading_time',
        secondaryMetrics: ['error_rate', 'user_satisfaction', 'cache_hit_rate'],
      },
      
      status: 'running',
      startTime: Date.now() - (7 * 24 * 60 * 60 * 1000), // Started 1 week ago
    };
  }
  
  return null;
}

/**
 * Check if current configuration meets performance thresholds
 */
export function checkPerformanceThresholds(
  config: MigrationConfig,
  metrics: {
    avgLoadTime: number;
    cacheHitRate: number;
    errorRate: number;
  }
): { passed: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (metrics.avgLoadTime > config.performance.maxLoadTime) {
    issues.push(`Average load time (${metrics.avgLoadTime}ms) exceeds threshold (${config.performance.maxLoadTime}ms)`);
  }
  
  if (metrics.cacheHitRate < config.performance.minCacheHitRate) {
    issues.push(`Cache hit rate (${metrics.cacheHitRate}) below threshold (${config.performance.minCacheHitRate})`);
  }
  
  if (metrics.errorRate > config.performance.maxErrorRate) {
    issues.push(`Error rate (${metrics.errorRate}) exceeds threshold (${config.performance.maxErrorRate})`);
  }
  
  return {
    passed: issues.length === 0,
    issues,
  };
}

/**
 * Generate migration rollback plan
 */
export function generateRollbackPlan(
  reason: string,
  affectedUsers: number
): import('@/types/migration').RollbackPlan {
  return {
    triggeredBy: 'automatic',
    reason,
    timestamp: Date.now(),
    affectedUsers,
    estimatedDuration: 5, // 5 minutes
    steps: [
      {
        id: 'disable-azure-tts',
        description: 'Disable Azure TTS feature flag',
        type: 'config_change',
        completed: false,
      },
      {
        id: 'clear-azure-cache',
        description: 'Clear Azure TTS cache to prevent stale data',
        type: 'cache_clear',
        completed: false,
      },
      {
        id: 'notify-users',
        description: 'Send notification to affected users about service restoration',
        type: 'user_notification',
        completed: false,
      },
    ],
    verification: [
      {
        id: 'static-audio-health',
        description: 'Verify static audio system is functioning correctly',
        type: 'health_check',
        passed: false,
      },
      {
        id: 'user-playback-test',
        description: 'Test audio playback from user perspective',
        type: 'user_test',
        passed: false,
      },
      {
        id: 'error-rate-validation',
        description: 'Confirm error rate has returned to normal levels',
        type: 'metric_validation',
        passed: false,
      },
    ],
  };
}