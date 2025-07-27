// src/lib/ab-testing.ts

import type { 
  ABTestConfig, 
  ABTestResults, 
  TestGroupMetrics, 
  UserMigrationProfile, 
  PerformanceMetrics 
} from '@/types/migration';

export interface ABTestManager {
  createTest(config: ABTestConfig): Promise<string>;
  startTest(testId: string): Promise<void>;
  pauseTest(testId: string): Promise<void>;
  stopTest(testId: string): Promise<ABTestResults>;
  getTestStatus(testId: string): Promise<ABTestConfig | null>;
  getUserAssignment(testId: string, userId: string, context: TestContext): Promise<'control' | 'test' | 'excluded'>;
  recordMetric(testId: string, userId: string, metric: ABTestMetric): Promise<void>;
  getTestResults(testId: string): Promise<ABTestResults | null>;
  analyzeResults(testId: string): Promise<ABTestAnalysis>;
}

export interface TestContext {
  storySlug: string;
  level: string;
  isPremium: boolean;
  isNewUser: boolean;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  userAgent?: string;
  location?: string;
}

export interface ABTestMetric {
  type: 'loading_time' | 'error_rate' | 'user_satisfaction' | 'cache_hit_rate' | 'completion_rate' | 'retention_rate';
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ABTestAnalysis {
  testId: string;
  startTime: number;
  endTime?: number;
  sampleSizes: {
    control: number;
    test: number;
    total: number;
  };
  metrics: {
    [key: string]: {
      control: TestGroupMetrics;
      test: TestGroupMetrics;
      difference: number;
      percentChange: number;
      significance: number;
      confidenceInterval: [number, number];
    };
  };
  conclusions: {
    primaryMetric: {
      winner: 'control' | 'test' | 'inconclusive';
      confidence: number;
      effect: 'positive' | 'negative' | 'neutral';
      magnitude: 'small' | 'medium' | 'large';
    };
    secondaryMetrics: Record<string, any>;
  };
  recommendations: string[];
  risks: string[];
}

/**
 * A/B Test Manager Implementation
 */
export class DefaultABTestManager implements ABTestManager {
  private tests = new Map<string, ABTestConfig>();
  private assignments = new Map<string, Map<string, 'control' | 'test'>>(); // testId -> userId -> group
  private metrics = new Map<string, ABTestMetric[]>();

  constructor(private storage?: ABTestStorage) {}

  /**
   * Create a new A/B test
   */
  async createTest(config: ABTestConfig): Promise<string> {
    // Validate configuration
    this.validateTestConfig(config);

    // Generate test ID if not provided
    const testId = config.testId || `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const testConfig: ABTestConfig = {
      ...config,
      testId,
      status: 'draft',
    };

    this.tests.set(testId, testConfig);
    this.assignments.set(testId, new Map());
    this.metrics.set(testId, []);

    if (this.storage) {
      await this.storage.saveTest(testConfig);
    }

    return testId;
  }

  /**
   * Start an A/B test
   */
  async startTest(testId: string): Promise<void> {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }

    if (test.status !== 'draft') {
      throw new Error(`Test is not in draft status: ${test.status}`);
    }

    test.status = 'running';
    test.startTime = Date.now();

    this.tests.set(testId, test);

    if (this.storage) {
      await this.storage.saveTest(test);
    }

    console.log(`A/B test started: ${testId}`);
  }

  /**
   * Pause an A/B test
   */
  async pauseTest(testId: string): Promise<void> {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }

    test.status = 'paused';

    this.tests.set(testId, test);

    if (this.storage) {
      await this.storage.saveTest(test);
    }

    console.log(`A/B test paused: ${testId}`);
  }

  /**
   * Stop an A/B test and return results
   */
  async stopTest(testId: string): Promise<ABTestResults> {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }

    test.status = 'completed';
    test.endTime = Date.now();

    const results = await this.generateTestResults(testId);
    test.results = results;

    this.tests.set(testId, test);

    if (this.storage) {
      await this.storage.saveTest(test);
      await this.storage.saveResults(testId, results);
    }

    console.log(`A/B test completed: ${testId}`);
    return results;
  }

  /**
   * Get test status
   */
  async getTestStatus(testId: string): Promise<ABTestConfig | null> {
    if (this.storage) {
      return await this.storage.getTest(testId);
    }
    return this.tests.get(testId) || null;
  }

  /**
   * Get user assignment for a test
   */
  async getUserAssignment(testId: string, userId: string, context: TestContext): Promise<'control' | 'test' | 'excluded'> {
    const test = this.tests.get(testId);
    if (!test || test.status !== 'running') {
      return 'excluded';
    }

    // Check if user is already assigned
    const testAssignments = this.assignments.get(testId);
    if (testAssignments?.has(userId)) {
      return testAssignments.get(userId)!;
    }

    // Check targeting criteria
    if (!this.isUserEligible(test, context)) {
      return 'excluded';
    }

    // Assign user to group
    const assignment = this.assignUserToGroup(test, userId, context);
    
    if (assignment !== 'excluded') {
      testAssignments?.set(userId, assignment);
      
      if (this.storage) {
        await this.storage.saveAssignment(testId, userId, assignment);
      }
    }

    return assignment;
  }

  /**
   * Record a metric for the test
   */
  async recordMetric(testId: string, userId: string, metric: ABTestMetric): Promise<void> {
    const test = this.tests.get(testId);
    if (!test || test.status !== 'running') {
      return;
    }

    const testAssignments = this.assignments.get(testId);
    const userGroup = testAssignments?.get(userId);
    
    if (!userGroup) {
      return; // User not in test
    }

    const enrichedMetric: ABTestMetric = {
      ...metric,
      metadata: {
        ...metric.metadata,
        testId,
        userId,
        userGroup,
        timestamp: metric.timestamp || Date.now(),
      },
    };

    const testMetrics = this.metrics.get(testId) || [];
    testMetrics.push(enrichedMetric);
    this.metrics.set(testId, testMetrics);

    if (this.storage) {
      await this.storage.saveMetric(testId, enrichedMetric);
    }
  }

  /**
   * Get test results
   */
  async getTestResults(testId: string): Promise<ABTestResults | null> {
    if (this.storage) {
      return await this.storage.getResults(testId);
    }

    const test = this.tests.get(testId);
    return test?.results || null;
  }

  /**
   * Analyze test results with statistical significance
   */
  async analyzeResults(testId: string): Promise<ABTestAnalysis> {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }

    const metrics = this.metrics.get(testId) || [];
    const assignments = this.assignments.get(testId) || new Map();

    // Group metrics by user group
    const controlMetrics = metrics.filter(m => m.metadata?.userGroup === 'control');
    const testMetrics = metrics.filter(m => m.metadata?.userGroup === 'test');

    // Calculate group metrics
    const controlGroupMetrics = this.calculateGroupMetrics(controlMetrics);
    const testGroupMetrics = this.calculateGroupMetrics(testMetrics);

    // Perform statistical analysis
    const analysis: ABTestAnalysis = {
      testId,
      startTime: test.startTime || Date.now(),
      endTime: test.endTime,
      sampleSizes: {
        control: Array.from(assignments.values()).filter(g => g === 'control').length,
        test: Array.from(assignments.values()).filter(g => g === 'test').length,
        total: assignments.size,
      },
      metrics: {},
      conclusions: {
        primaryMetric: {
          winner: 'inconclusive',
          confidence: 0,
          effect: 'neutral',
          magnitude: 'small',
        },
        secondaryMetrics: {},
      },
      recommendations: [],
      risks: [],
    };

    // Analyze primary metric
    const primaryMetric = test.successCriteria.primaryMetric;
    analysis.metrics[primaryMetric] = this.analyzeMetric(
      primaryMetric,
      controlGroupMetrics,
      testGroupMetrics
    );

    // Analyze secondary metrics
    for (const metric of test.successCriteria.secondaryMetrics) {
      analysis.metrics[metric] = this.analyzeMetric(
        metric,
        controlGroupMetrics,
        testGroupMetrics
      );
    }

    // Determine winner and conclusions
    const primaryResult = analysis.metrics[primaryMetric];
    if (primaryResult.significance > test.successCriteria.significanceLevel) {
      analysis.conclusions.primaryMetric.winner = primaryResult.difference > 0 ? 'test' : 'control';
      analysis.conclusions.primaryMetric.confidence = primaryResult.significance;
      analysis.conclusions.primaryMetric.effect = Math.abs(primaryResult.percentChange) < 5 ? 'neutral' :
                                                   primaryResult.percentChange > 0 ? 'positive' : 'negative';
      analysis.conclusions.primaryMetric.magnitude = Math.abs(primaryResult.percentChange) < 10 ? 'small' :
                                                     Math.abs(primaryResult.percentChange) < 25 ? 'medium' : 'large';
    }

    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(analysis, test);
    analysis.risks = this.identifyRisks(analysis, test);

    return analysis;
  }

  /**
   * Validate test configuration
   */
  private validateTestConfig(config: ABTestConfig): void {
    if (!config.name || config.name.trim().length === 0) {
      throw new Error('Test name is required');
    }

    if (config.controlGroup.percentage + config.testGroup.percentage > 100) {
      throw new Error('Total group percentages cannot exceed 100%');
    }

    if (config.successCriteria.minSampleSize < 10) {
      throw new Error('Minimum sample size must be at least 10');
    }

    if (config.successCriteria.significanceLevel <= 0 || config.successCriteria.significanceLevel >= 1) {
      throw new Error('Significance level must be between 0 and 1');
    }
  }

  /**
   * Check if user is eligible for the test
   */
  private isUserEligible(test: ABTestConfig, context: TestContext): boolean {
    // Check story targeting
    if (test.targeting.stories.length > 0 && !test.targeting.stories.includes(context.storySlug)) {
      return false;
    }

    // Check level targeting
    if (test.targeting.levels.length > 0 && !test.targeting.levels.includes(context.level)) {
      return false;
    }

    // Check user type targeting
    if (test.targeting.userTypes.length > 0) {
      const userType = context.isPremium ? 'premium' : 'free';
      if (!test.targeting.userTypes.includes(userType)) {
        return false;
      }
    }

    // Check new user targeting
    if (test.targeting.newUsersOnly && !context.isNewUser) {
      return false;
    }

    return true;
  }

  /**
   * Assign user to test group
   */
  private assignUserToGroup(test: ABTestConfig, userId: string, context: TestContext): 'control' | 'test' | 'excluded' {
    // Use consistent hashing for stable assignments
    const hash = this.hashString(`${test.testId}-${userId}`);
    const percentage = hash % 100;

    if (percentage < test.controlGroup.percentage) {
      return 'control';
    } else if (percentage < test.controlGroup.percentage + test.testGroup.percentage) {
      return 'test';
    } else {
      return 'excluded';
    }
  }

  /**
   * Simple hash function for consistent user assignment
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Calculate group metrics
   */
  private calculateGroupMetrics(metrics: ABTestMetric[]): TestGroupMetrics {
    if (metrics.length === 0) {
      return {
        sampleSize: 0,
        avgLoadTime: 0,
        errorRate: 0,
        cacheHitRate: 0,
        userSatisfaction: 0,
        completionRate: 0,
        retentionRate: 0,
      };
    }

    const loadTimeMetrics = metrics.filter(m => m.type === 'loading_time');
    const errorMetrics = metrics.filter(m => m.type === 'error_rate');
    const cacheMetrics = metrics.filter(m => m.type === 'cache_hit_rate');
    const satisfactionMetrics = metrics.filter(m => m.type === 'user_satisfaction');
    const completionMetrics = metrics.filter(m => m.type === 'completion_rate');
    const retentionMetrics = metrics.filter(m => m.type === 'retention_rate');

    return {
      sampleSize: new Set(metrics.map(m => m.metadata?.userId)).size,
      avgLoadTime: loadTimeMetrics.length > 0 
        ? loadTimeMetrics.reduce((sum, m) => sum + m.value, 0) / loadTimeMetrics.length 
        : 0,
      errorRate: errorMetrics.length > 0 
        ? errorMetrics.reduce((sum, m) => sum + m.value, 0) / errorMetrics.length 
        : 0,
      cacheHitRate: cacheMetrics.length > 0 
        ? cacheMetrics.reduce((sum, m) => sum + m.value, 0) / cacheMetrics.length 
        : 0,
      userSatisfaction: satisfactionMetrics.length > 0 
        ? satisfactionMetrics.reduce((sum, m) => sum + m.value, 0) / satisfactionMetrics.length 
        : 0,
      completionRate: completionMetrics.length > 0 
        ? completionMetrics.reduce((sum, m) => sum + m.value, 0) / completionMetrics.length 
        : 0,
      retentionRate: retentionMetrics.length > 0 
        ? retentionMetrics.reduce((sum, m) => sum + m.value, 0) / retentionMetrics.length 
        : 0,
    };
  }

  /**
   * Analyze a specific metric
   */
  private analyzeMetric(metricName: string, control: TestGroupMetrics, test: TestGroupMetrics) {
    const controlValue = this.getMetricValue(metricName, control);
    const testValue = this.getMetricValue(metricName, test);
    
    const difference = testValue - controlValue;
    const percentChange = controlValue !== 0 ? (difference / controlValue) * 100 : 0;
    
    // Simple statistical significance calculation (t-test approximation)
    // In a real implementation, you'd use proper statistical libraries
    const significance = this.calculateSignificance(controlValue, testValue, control.sampleSize, test.sampleSize);
    
    const confidenceInterval = this.calculateConfidenceInterval(difference, significance);

    return {
      control,
      test,
      difference,
      percentChange,
      significance,
      confidenceInterval,
    };
  }

  /**
   * Get metric value from group metrics
   */
  private getMetricValue(metricName: string, groupMetrics: TestGroupMetrics): number {
    switch (metricName) {
      case 'loading_time': return groupMetrics.avgLoadTime;
      case 'error_rate': return groupMetrics.errorRate;
      case 'user_satisfaction': return groupMetrics.userSatisfaction;
      case 'cache_hit_rate': return groupMetrics.cacheHitRate;
      case 'completion_rate': return groupMetrics.completionRate;
      case 'retention_rate': return groupMetrics.retentionRate;
      default: return 0;
    }
  }

  /**
   * Calculate statistical significance (simplified)
   */
  private calculateSignificance(controlValue: number, testValue: number, controlSize: number, testSize: number): number {
    if (controlSize < 10 || testSize < 10) {
      return 0; // Insufficient sample size
    }

    // Simplified significance calculation
    // In practice, you'd use proper statistical methods
    const pooledStd = Math.sqrt((controlValue + testValue) / 2);
    const standardError = pooledStd * Math.sqrt(1/controlSize + 1/testSize);
    
    if (standardError === 0) {
      return 0;
    }

    const tStat = Math.abs(testValue - controlValue) / standardError;
    
    // Convert t-statistic to approximate p-value
    // This is a very rough approximation
    const pValue = Math.max(0, 1 - Math.min(1, tStat / 3));
    
    return 1 - pValue; // Return confidence level
  }

  /**
   * Calculate confidence interval (simplified)
   */
  private calculateConfidenceInterval(difference: number, significance: number): [number, number] {
    const margin = Math.abs(difference) * (1 - significance) * 2;
    return [difference - margin, difference + margin];
  }

  /**
   * Generate test results
   */
  private async generateTestResults(testId: string): Promise<ABTestResults> {
    const metrics = this.metrics.get(testId) || [];
    const assignments = this.assignments.get(testId) || new Map();

    const controlMetrics = metrics.filter(m => m.metadata?.userGroup === 'control');
    const testMetrics = metrics.filter(m => m.metadata?.userGroup === 'test');

    const controlGroupMetrics = this.calculateGroupMetrics(controlMetrics);
    const testGroupMetrics = this.calculateGroupMetrics(testMetrics);

    // Determine winner based on primary metric
    const test = this.tests.get(testId)!;
    const primaryMetric = test.successCriteria.primaryMetric;
    const controlValue = this.getMetricValue(primaryMetric, controlGroupMetrics);
    const testValue = this.getMetricValue(primaryMetric, testGroupMetrics);
    
    let winner: 'control' | 'test' | 'inconclusive' = 'inconclusive';
    const significance = this.calculateSignificance(controlValue, testValue, controlGroupMetrics.sampleSize, testGroupMetrics.sampleSize);
    
    if (significance > test.successCriteria.significanceLevel) {
      winner = testValue > controlValue ? 'test' : 'control';
    }

    return {
      controlMetrics: controlGroupMetrics,
      testMetrics: testGroupMetrics,
      significance,
      confidence: significance,
      winner,
      recommendation: this.generateWinnerRecommendation(winner, primaryMetric, testValue, controlValue),
      rawData: metrics.map(m => ({
        timestamp: m.timestamp,
        userId: m.metadata?.userId,
        sessionId: `session_${m.timestamp}`,
        audioSystem: m.metadata?.userGroup === 'test' ? 'azure' : 'static',
        loadTime: m.type === 'loading_time' ? m.value : 1000,
        playbackStartTime: m.timestamp,
        errors: [],
        retryCount: 0,
        fallbackUsed: false,
        storyContext: {
          storySlug: 'the-last-word',
          level: 'l1',
          chapter: 1,
          page: 1,
          sentenceIndex: 0,
          language: 'es',
          speed: 'normal',
        },
      })),
    };
  }

  /**
   * Generate winner recommendation
   */
  private generateWinnerRecommendation(winner: string, metric: string, testValue: number, controlValue: number): string {
    if (winner === 'inconclusive') {
      return 'Results are inconclusive. Consider running the test longer or with a larger sample size.';
    }

    const improvement = Math.abs(((testValue - controlValue) / controlValue) * 100);
    const system = winner === 'test' ? 'Azure TTS' : 'static audio';
    
    return `${system} shows better performance for ${metric} with ${improvement.toFixed(1)}% improvement. Recommend proceeding with ${system}.`;
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(analysis: ABTestAnalysis, test: ABTestConfig): string[] {
    const recommendations: string[] = [];
    
    if (analysis.conclusions.primaryMetric.winner === 'test') {
      recommendations.push('Consider rolling out Azure TTS to more users based on positive results.');
    } else if (analysis.conclusions.primaryMetric.winner === 'control') {
      recommendations.push('Continue with static audio system based on better performance.');
    } else {
      recommendations.push('Results are inconclusive. Consider extending the test duration or increasing sample size.');
    }

    if (analysis.sampleSizes.total < test.successCriteria.minSampleSize) {
      recommendations.push('Sample size is below minimum threshold. Extend test duration to reach statistical significance.');
    }

    if (analysis.conclusions.primaryMetric.confidence < 0.95) {
      recommendations.push('Statistical confidence is low. Consider running test longer for more reliable results.');
    }

    return recommendations;
  }

  /**
   * Identify potential risks
   */
  private identifyRisks(analysis: ABTestAnalysis, test: ABTestConfig): string[] {
    const risks: string[] = [];
    
    if (analysis.sampleSizes.control < 50 || analysis.sampleSizes.test < 50) {
      risks.push('Small sample sizes may lead to unreliable results.');
    }

    const primaryMetric = analysis.metrics[test.successCriteria.primaryMetric];
    if (primaryMetric && Math.abs(primaryMetric.percentChange) > 50) {
      risks.push('Large performance differences detected. Verify results before wide rollout.');
    }

    if (analysis.conclusions.primaryMetric.winner === 'test') {
      risks.push('Monitor for potential issues when scaling Azure TTS to larger user base.');
    }

    return risks;
  }
}

/**
 * Storage interface for A/B tests
 */
interface ABTestStorage {
  saveTest(config: ABTestConfig): Promise<void>;
  getTest(testId: string): Promise<ABTestConfig | null>;
  saveAssignment(testId: string, userId: string, group: 'control' | 'test'): Promise<void>;
  saveMetric(testId: string, metric: ABTestMetric): Promise<void>;
  saveResults(testId: string, results: ABTestResults): Promise<void>;
  getResults(testId: string): Promise<ABTestResults | null>;
}

/**
 * Create A/B test manager
 */
export function createABTestManager(storage?: ABTestStorage): ABTestManager {
  return new DefaultABTestManager(storage);
}

/**
 * Create default Azure TTS vs Static Audio test
 */
export function createDefaultAzureTTSTest(): ABTestConfig {
  return {
    testId: 'azure-tts-vs-static-2024',
    name: 'Azure TTS vs Static Audio Performance Test',
    description: 'Compare user experience between Azure TTS and static audio files',
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
      minSampleSize: 200,
      maxDuration: 14, // days
      significanceLevel: 0.05,
      primaryMetric: 'loading_time',
      secondaryMetrics: ['error_rate', 'user_satisfaction', 'cache_hit_rate'],
    },
    
    status: 'draft',
  };
}