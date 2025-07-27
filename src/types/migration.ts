// src/types/migration.ts

export type MigrationPhase = 'disabled' | 'experimental' | 'sandbox' | 'beta' | 'production' | 'complete';
export type AudioSystem = 'static' | 'azure' | 'hybrid';
export type FallbackStrategy = 'auto' | 'static' | 'azure' | 'user-choice';

export interface MigrationConfig {
  // Global settings
  enabled: boolean;
  currentPhase: MigrationPhase;
  audioSystem: AudioSystem;
  fallbackStrategy: FallbackStrategy;
  
  // Targeting
  storyWhitelist: string[];
  levelWhitelist: string[];
  userPercentage: number; // 0-100 for A/B testing
  premiumOnly: boolean;
  
  // Performance thresholds
  performance: {
    maxLoadTime: number; // ms
    minCacheHitRate: number; // 0-1
    maxErrorRate: number; // 0-1
    maxRetryAttempts: number;
  };
  
  // Monitoring
  monitoring: {
    enabled: boolean;
    sampleRate: number; // 0-1
    debugMode: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
  };
  
  // Testing
  testing: {
    enableMetrics: boolean;
    compareWithStatic: boolean;
    validateWordTimings: boolean;
    audioQualityChecks: boolean;
  };
}

export interface MigrationState {
  phase: MigrationPhase;
  startTime: number;
  lastUpdate: number;
  totalUsers: number;
  azureUsers: number;
  staticUsers: number;
  successRate: number;
  errorRate: number;
  avgLoadTime: number;
  cacheHitRate: number;
  rollbackCount: number;
}

export interface UserMigrationProfile {
  userId: string;
  assignedGroup: 'azure' | 'static' | 'control';
  assignedAt: number;
  lastActivity: number;
  sessionCount: number;
  errorCount: number;
  preferredSystem: AudioSystem;
  feedback: UserFeedback[];
}

export interface UserFeedback {
  timestamp: number;
  type: 'audio_quality' | 'loading_speed' | 'word_sync' | 'error' | 'general';
  rating: number; // 1-5
  comment?: string;
  context: {
    storySlug: string;
    level: string;
    chapter: number;
    page: number;
    audioSystem: AudioSystem;
  };
}

export interface PerformanceMetrics {
  timestamp: number;
  userId?: string;
  sessionId: string;
  
  // Audio metrics
  audioSystem: AudioSystem;
  generationTime?: number; // Azure TTS only
  loadTime: number;
  playbackStartTime: number;
  
  // Quality metrics
  wordTimingAccuracy?: number; // Azure TTS only
  audioQuality: number; // 1-5 user rating
  syncQuality: number; // 1-5 user rating
  
  // Error metrics
  errors: ErrorMetric[];
  retryCount: number;
  fallbackUsed: boolean;
  
  // Context
  storyContext: {
    storySlug: string;
    level: string;
    chapter: number;
    page: number;
    sentenceIndex: number;
    language: string;
    speed: 'normal' | 'slow';
  };
}

export interface ErrorMetric {
  timestamp: number;
  type: 'generation' | 'network' | 'playback' | 'sync' | 'cache';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  resolution?: string;
}

export interface MigrationTestResult {
  testId: string;
  timestamp: number;
  type: 'unit' | 'integration' | 'performance' | 'user_acceptance';
  passed: boolean;
  score: number; // 0-100
  duration: number;
  errors: string[];
  metrics: Record<string, any>;
  context: {
    environment: 'development' | 'staging' | 'production';
    audioSystem: AudioSystem;
    testGroup: string;
  };
}

export interface ABTestConfig {
  testId: string;
  name: string;
  description: string;
  enabled: boolean;
  
  // Groups
  controlGroup: {
    percentage: number;
    audioSystem: AudioSystem;
  };
  testGroup: {
    percentage: number;
    audioSystem: AudioSystem;
  };
  
  // Targeting
  targeting: {
    stories: string[];
    levels: string[];
    userTypes: ('free' | 'premium')[];
    newUsersOnly: boolean;
  };
  
  // Success criteria
  successCriteria: {
    minSampleSize: number;
    maxDuration: number; // days
    significanceLevel: number; // 0.01, 0.05, etc.
    primaryMetric: 'loading_time' | 'error_rate' | 'user_satisfaction' | 'cache_hit_rate';
    secondaryMetrics: string[];
  };
  
  // Current state
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
  startTime?: number;
  endTime?: number;
  results?: ABTestResults;
}

export interface ABTestResults {
  controlMetrics: TestGroupMetrics;
  testMetrics: TestGroupMetrics;
  significance: number;
  confidence: number;
  winner: 'control' | 'test' | 'inconclusive';
  recommendation: string;
  rawData: PerformanceMetrics[];
}

export interface TestGroupMetrics {
  sampleSize: number;
  avgLoadTime: number;
  errorRate: number;
  cacheHitRate: number;
  userSatisfaction: number;
  completionRate: number;
  retentionRate: number;
}

export interface RollbackPlan {
  triggeredBy: 'manual' | 'automatic' | 'scheduled';
  reason: string;
  timestamp: number;
  affectedUsers: number;
  estimatedDuration: number; // minutes
  steps: RollbackStep[];
  verification: RollbackVerification[];
}

export interface RollbackStep {
  id: string;
  description: string;
  type: 'config_change' | 'cache_clear' | 'service_restart' | 'user_notification';
  completed: boolean;
  duration?: number;
  error?: string;
}

export interface RollbackVerification {
  id: string;
  description: string;
  type: 'health_check' | 'user_test' | 'metric_validation';
  passed: boolean;
  details?: string;
}

export interface MigrationEnvironment {
  name: 'development' | 'staging' | 'production';
  config: MigrationConfig;
  state: MigrationState;
  healthCheck: EnvironmentHealth;
  lastChecked: number;
}

export interface EnvironmentHealth {
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  services: {
    azureTTS: ServiceHealth;
    staticAudio: ServiceHealth;
    cache: ServiceHealth;
    database: ServiceHealth;
    monitoring: ServiceHealth;
  };
  issues: HealthIssue[];
}

export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  errorRate: number;
  lastCheck: number;
  uptime: number; // percentage
}

export interface HealthIssue {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  service: string;
  message: string;
  timestamp: number;
  resolved: boolean;
  impact: string;
}

export interface CacheStatistics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  avgResponseTime: number;
  totalSize: number; // bytes
  entriesCount: number;
  oldestEntry: number; // timestamp
  newestEntry: number; // timestamp
  evictions: number;
  errors: number;
}

export interface AudioQualityMetrics {
  audioSystem: AudioSystem;
  storySlug: string;
  level: string;
  language: string;
  
  // Technical quality
  bitRate: number;
  sampleRate: number;
  duration: number;
  fileSize: number;
  
  // User perceived quality
  clarity: number; // 1-5
  naturalness: number; // 1-5
  speed: number; // 1-5
  pronunciation: number; // 1-5
  
  // Word timing quality (Azure only)
  wordTimingAccuracy?: number; // 0-1
  wordCount?: number;
  timingGaps?: number[];
  timingOverlaps?: number[];
}

export interface ComparisonReport {
  testId: string;
  timestamp: number;
  storySlug: string;
  level: string;
  language: string;
  
  staticAudio: AudioQualityMetrics;
  azureAudio: AudioQualityMetrics;
  
  comparison: {
    loadTimeComparison: number; // Azure time / Static time
    qualityComparison: number; // -1 to 1 (Azure vs Static)
    userPreference: 'static' | 'azure' | 'no_preference';
    recommendation: string;
  };
  
  userFeedback: UserFeedback[];
}