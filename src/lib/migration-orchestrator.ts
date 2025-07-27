// src/lib/migration-orchestrator.ts

import { getMigrationConfig, checkPerformanceThresholds, generateRollbackPlan } from './migration-config';
import { createTestRunner, migrationTestSuites, runMigrationReadinessCheck } from './migration-testing';
import type { 
  MigrationConfig, 
  MigrationPhase, 
  MigrationState, 
  RollbackPlan,
  MigrationTestResult,
  PerformanceMetrics
} from '@/types/migration';

export interface MigrationPlan {
  id: string;
  name: string;
  description: string;
  phases: MigrationPhaseConfig[];
  rollbackStrategy: RollbackStrategy;
  validationRules: ValidationRule[];
  notifications: NotificationConfig[];
}

export interface MigrationPhaseConfig {
  phase: MigrationPhase;
  name: string;
  description: string;
  duration: number; // hours
  criteria: MigrationCriteria;
  rolloutPercentage: number;
  targetStories: string[];
  targetLevels: string[];
  validationTests: string[];
  autoAdvance: boolean;
  rollbackTriggers: RollbackTrigger[];
}

export interface MigrationCriteria {
  minSuccessRate: number; // 0-1
  maxErrorRate: number; // 0-1
  maxLoadTime: number; // ms
  minCacheHitRate: number; // 0-1
  minSampleSize: number;
  userFeedbackThreshold: number; // 1-5
}

export interface RollbackStrategy {
  automatic: boolean;
  triggers: RollbackTrigger[];
  maxAttempts: number;
  cooldownPeriod: number; // hours
  notificationChannels: string[];
}

export interface RollbackTrigger {
  type: 'error_rate' | 'load_time' | 'user_feedback' | 'manual' | 'test_failure';
  threshold: number;
  duration: number; // minutes
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'alert' | 'pause' | 'rollback';
}

export interface ValidationRule {
  id: string;
  name: string;
  type: 'pre_deployment' | 'post_deployment' | 'continuous';
  testSuite: string;
  frequency: number; // minutes
  required: boolean;
  failureAction: 'continue' | 'pause' | 'rollback';
}

export interface NotificationConfig {
  channel: 'email' | 'slack' | 'webhook' | 'sms';
  recipients: string[];
  events: ('phase_start' | 'phase_complete' | 'error' | 'rollback' | 'success')[];
  template: string;
}

export interface MigrationExecution {
  planId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'rolled_back';
  currentPhase: MigrationPhase;
  startTime: number;
  endTime?: number;
  progress: number; // 0-1
  metrics: PerformanceMetrics[];
  testResults: MigrationTestResult[];
  rollbackHistory: RollbackPlan[];
  logs: MigrationLog[];
}

export interface MigrationLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: 'phase' | 'test' | 'metrics' | 'rollback' | 'notification';
  message: string;
  data?: any;
}

/**
 * Main orchestrator class for managing migration execution
 */
export class MigrationOrchestrator {
  private executions = new Map<string, MigrationExecution>();
  private currentExecution: string | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(private notificationService?: NotificationService) {}

  /**
   * Start a new migration execution
   */
  async startMigration(plan: MigrationPlan): Promise<string> {
    if (this.currentExecution) {
      throw new Error('Another migration is already running');
    }

    const executionId = `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const execution: MigrationExecution = {
      planId: plan.id,
      status: 'pending',
      currentPhase: plan.phases[0]?.phase || 'disabled',
      startTime: Date.now(),
      progress: 0,
      metrics: [],
      testResults: [],
      rollbackHistory: [],
      logs: [],
    };

    this.executions.set(executionId, execution);
    this.currentExecution = executionId;

    this.log(executionId, 'info', 'phase', `Starting migration: ${plan.name}`);

    try {
      // Pre-migration validation
      await this.runPreMigrationValidation(executionId, plan);
      
      // Start execution
      execution.status = 'running';
      this.startMonitoring(executionId, plan);
      
      // Execute phases
      await this.executePhases(executionId, plan);
      
      execution.status = 'completed';
      execution.endTime = Date.now();
      execution.progress = 1;
      
      this.log(executionId, 'info', 'phase', 'Migration completed successfully');
      await this.sendNotification(plan, 'success', { executionId });

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = Date.now();
      
      this.log(executionId, 'error', 'phase', `Migration failed: ${error}`);
      await this.sendNotification(plan, 'error', { executionId, error: error.message });
      
      // Attempt rollback
      await this.executeRollback(executionId, plan, `Migration failed: ${error}`);
    } finally {
      this.stopMonitoring();
      this.currentExecution = null;
    }

    return executionId;
  }

  /**
   * Pause current migration
   */
  async pauseMigration(reason: string): Promise<void> {
    if (!this.currentExecution) {
      throw new Error('No migration is currently running');
    }

    const execution = this.executions.get(this.currentExecution)!;
    execution.status = 'paused';
    
    this.log(this.currentExecution, 'info', 'phase', `Migration paused: ${reason}`);
    this.stopMonitoring();
  }

  /**
   * Resume paused migration
   */
  async resumeMigration(planId: string): Promise<void> {
    if (!this.currentExecution) {
      throw new Error('No migration is currently paused');
    }

    const execution = this.executions.get(this.currentExecution)!;
    if (execution.status !== 'paused') {
      throw new Error('Migration is not in paused state');
    }

    execution.status = 'running';
    this.log(this.currentExecution, 'info', 'phase', 'Migration resumed');
    
    // Resume monitoring
    const plan = await this.loadMigrationPlan(planId);
    this.startMonitoring(this.currentExecution, plan);
  }

  /**
   * Force rollback of current migration
   */
  async forceRollback(reason: string): Promise<void> {
    if (!this.currentExecution) {
      throw new Error('No migration is currently running');
    }

    const execution = this.executions.get(this.currentExecution)!;
    const plan = await this.loadMigrationPlan(execution.planId);
    
    await this.executeRollback(this.currentExecution, plan, reason, true);
  }

  /**
   * Get migration status
   */
  getMigrationStatus(executionId?: string): MigrationExecution | null {
    const id = executionId || this.currentExecution;
    return id ? this.executions.get(id) || null : null;
  }

  /**
   * Get all migration executions
   */
  getAllExecutions(): MigrationExecution[] {
    return Array.from(this.executions.values());
  }

  /**
   * Run pre-migration validation
   */
  private async runPreMigrationValidation(executionId: string, plan: MigrationPlan): Promise<void> {
    this.log(executionId, 'info', 'test', 'Running pre-migration validation');

    const preValidationRules = plan.validationRules.filter(rule => rule.type === 'pre_deployment');
    
    for (const rule of preValidationRules) {
      try {
        const testSuite = migrationTestSuites[rule.testSuite];
        if (!testSuite) {
          throw new Error(`Test suite not found: ${rule.testSuite}`);
        }

        const config = getMigrationConfig();
        const runner = createTestRunner(config);
        
        const context = {
          storySlug: plan.phases[0]?.targetStories[0] || 'the-last-word',
          level: plan.phases[0]?.targetLevels[0] || 'l1',
          chapter: 1,
          page: 1,
          language: 'es-ES' as const,
          audioSystem: 'hybrid' as const,
          sentences: ['Test sentence for validation'],
          config,
          metrics: [],
        };

        const results = await runner.runTestSuite(testSuite, context);
        const execution = this.executions.get(executionId)!;
        execution.testResults.push(...results);

        const failedTests = results.filter(r => !r.passed);
        if (failedTests.length > 0 && rule.required) {
          if (rule.failureAction === 'rollback') {
            throw new Error(`Required validation failed: ${rule.name}`);
          } else if (rule.failureAction === 'pause') {
            await this.pauseMigration(`Validation failed: ${rule.name}`);
            return;
          }
        }

        this.log(executionId, 'info', 'test', `Validation passed: ${rule.name}`);

      } catch (error) {
        this.log(executionId, 'error', 'test', `Validation failed: ${rule.name} - ${error}`);
        
        if (rule.required && rule.failureAction === 'rollback') {
          throw error;
        }
      }
    }
  }

  /**
   * Execute migration phases
   */
  private async executePhases(executionId: string, plan: MigrationPlan): Promise<void> {
    const execution = this.executions.get(executionId)!;
    
    for (let i = 0; i < plan.phases.length; i++) {
      const phase = plan.phases[i];
      
      if (execution.status !== 'running') {
        this.log(executionId, 'info', 'phase', `Execution paused at phase: ${phase.name}`);
        return;
      }

      execution.currentPhase = phase.phase;
      execution.progress = i / plan.phases.length;
      
      this.log(executionId, 'info', 'phase', `Starting phase: ${phase.name}`);
      await this.sendNotification(plan, 'phase_start', { executionId, phase: phase.name });

      try {
        await this.executePhase(executionId, plan, phase);
        
        this.log(executionId, 'info', 'phase', `Completed phase: ${phase.name}`);
        await this.sendNotification(plan, 'phase_complete', { executionId, phase: phase.name });

      } catch (error) {
        this.log(executionId, 'error', 'phase', `Phase failed: ${phase.name} - ${error}`);
        
        // Check if we should rollback or continue
        const shouldRollback = await this.evaluateRollbackTriggers(executionId, plan, phase);
        if (shouldRollback) {
          await this.executeRollback(executionId, plan, `Phase failed: ${phase.name}`);
          return;
        }
      }
    }
  }

  /**
   * Execute a single migration phase
   */
  private async executePhase(executionId: string, plan: MigrationPlan, phase: MigrationPhaseConfig): Promise<void> {
    // Update migration configuration for this phase
    await this.updateMigrationConfig(phase);
    
    // Wait for phase duration or until criteria are met
    const startTime = Date.now();
    const maxDuration = phase.duration * 60 * 60 * 1000; // Convert hours to ms
    
    while (Date.now() - startTime < maxDuration) {
      // Check if execution is paused
      const execution = this.executions.get(executionId)!;
      if (execution.status !== 'running') {
        return;
      }

      // Run validation tests
      await this.runPhaseValidation(executionId, plan, phase);
      
      // Check success criteria
      const metricsCheck = await this.checkPhaseCriteria(executionId, phase);
      if (metricsCheck.success) {
        if (phase.autoAdvance) {
          this.log(executionId, 'info', 'phase', `Phase criteria met, auto-advancing: ${phase.name}`);
          return;
        } else {
          this.log(executionId, 'info', 'phase', `Phase criteria met: ${phase.name}`);
        }
      }

      // Check rollback triggers
      const shouldRollback = await this.evaluateRollbackTriggers(executionId, plan, phase);
      if (shouldRollback) {
        throw new Error('Rollback triggered by performance criteria');
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute
    }

    this.log(executionId, 'info', 'phase', `Phase duration completed: ${phase.name}`);
  }

  /**
   * Update migration configuration for phase
   */
  private async updateMigrationConfig(phase: MigrationPhaseConfig): Promise<void> {
    // In a real implementation, this would update the configuration in your config service
    // For now, we'll just log the configuration change
    console.log('Updating migration configuration:', {
      phase: phase.phase,
      rolloutPercentage: phase.rolloutPercentage,
      targetStories: phase.targetStories,
      targetLevels: phase.targetLevels,
    });
  }

  /**
   * Run validation tests for current phase
   */
  private async runPhaseValidation(executionId: string, plan: MigrationPlan, phase: MigrationPhaseConfig): Promise<void> {
    const validationRules = plan.validationRules.filter(
      rule => rule.type === 'continuous' && phase.validationTests.includes(rule.testSuite)
    );

    for (const rule of validationRules) {
      try {
        const readinessCheck = await runMigrationReadinessCheck(
          phase.targetStories[0] || 'the-last-word',
          phase.targetLevels[0] || 'l1',
          getMigrationConfig()
        );

        if (!readinessCheck.ready && rule.required) {
          this.log(executionId, 'warn', 'test', `Validation warning: ${rule.name} - ${readinessCheck.issues.join(', ')}`);
        }

      } catch (error) {
        this.log(executionId, 'error', 'test', `Validation error: ${rule.name} - ${error}`);
      }
    }
  }

  /**
   * Check if phase success criteria are met
   */
  private async checkPhaseCriteria(executionId: string, phase: MigrationPhaseConfig): Promise<{ success: boolean; details: any }> {
    // Get recent metrics
    const execution = this.executions.get(executionId)!;
    const recentMetrics = execution.metrics.slice(-100); // Last 100 metrics

    if (recentMetrics.length < phase.criteria.minSampleSize) {
      return { success: false, details: { reason: 'Insufficient sample size' } };
    }

    // Calculate success metrics
    const successfulRequests = recentMetrics.filter(m => m.errors.length === 0);
    const successRate = successfulRequests.length / recentMetrics.length;
    
    const avgLoadTime = recentMetrics.reduce((sum, m) => sum + m.loadTime, 0) / recentMetrics.length;
    const errorRate = 1 - successRate;

    // Check criteria
    const criteria = phase.criteria;
    const checks = {
      successRate: successRate >= criteria.minSuccessRate,
      errorRate: errorRate <= criteria.maxErrorRate,
      loadTime: avgLoadTime <= criteria.maxLoadTime,
      sampleSize: recentMetrics.length >= criteria.minSampleSize,
    };

    const allPassed = Object.values(checks).every(Boolean);

    return {
      success: allPassed,
      details: {
        successRate,
        errorRate,
        avgLoadTime,
        sampleSize: recentMetrics.length,
        checks,
      },
    };
  }

  /**
   * Evaluate rollback triggers
   */
  private async evaluateRollbackTriggers(executionId: string, plan: MigrationPlan, phase: MigrationPhaseConfig): Promise<boolean> {
    const execution = this.executions.get(executionId)!;
    const recentMetrics = execution.metrics.slice(-50); // Last 50 metrics

    if (recentMetrics.length === 0) return false;

    for (const trigger of phase.rollbackTriggers) {
      let shouldTrigger = false;

      switch (trigger.type) {
        case 'error_rate':
          const errorRate = recentMetrics.filter(m => m.errors.length > 0).length / recentMetrics.length;
          shouldTrigger = errorRate > trigger.threshold;
          break;

        case 'load_time':
          const avgLoadTime = recentMetrics.reduce((sum, m) => sum + m.loadTime, 0) / recentMetrics.length;
          shouldTrigger = avgLoadTime > trigger.threshold;
          break;

        case 'test_failure':
          const recentTests = execution.testResults.slice(-10);
          const failureRate = recentTests.filter(t => !t.passed).length / recentTests.length;
          shouldTrigger = failureRate > trigger.threshold;
          break;
      }

      if (shouldTrigger) {
        this.log(executionId, 'warn', 'rollback', `Rollback trigger activated: ${trigger.type} (${trigger.severity})`);
        
        if (trigger.action === 'rollback') {
          return true;
        } else if (trigger.action === 'pause') {
          await this.pauseMigration(`Trigger: ${trigger.type}`);
        }
      }
    }

    return false;
  }

  /**
   * Execute rollback
   */
  private async executeRollback(executionId: string, plan: MigrationPlan, reason: string, forced = false): Promise<void> {
    this.log(executionId, 'info', 'rollback', `Starting rollback: ${reason}`);
    
    const execution = this.executions.get(executionId)!;
    const rollbackPlan = generateRollbackPlan(reason, 1000); // Estimate affected users

    execution.rollbackHistory.push(rollbackPlan);
    execution.status = 'rolled_back';

    try {
      // Execute rollback steps
      for (const step of rollbackPlan.steps) {
        this.log(executionId, 'info', 'rollback', `Executing rollback step: ${step.description}`);
        
        // Execute the step (implementation would depend on step type)
        await this.executeRollbackStep(step);
        
        step.completed = true;
        this.log(executionId, 'info', 'rollback', `Completed rollback step: ${step.description}`);
      }

      // Run verification
      for (const verification of rollbackPlan.verification) {
        const passed = await this.verifyRollbackStep(verification);
        verification.passed = passed;
        
        if (!passed) {
          this.log(executionId, 'error', 'rollback', `Rollback verification failed: ${verification.description}`);
        }
      }

      this.log(executionId, 'info', 'rollback', 'Rollback completed successfully');
      await this.sendNotification(plan, 'rollback', { executionId, reason, forced });

    } catch (error) {
      this.log(executionId, 'error', 'rollback', `Rollback failed: ${error}`);
      throw error;
    }
  }

  /**
   * Execute individual rollback step
   */
  private async executeRollbackStep(step: any): Promise<void> {
    // Implementation would depend on step type
    // For now, just simulate execution
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Verify rollback step
   */
  private async verifyRollbackStep(verification: any): Promise<boolean> {
    // Implementation would depend on verification type
    // For now, just simulate verification
    return Math.random() > 0.1; // 90% success rate
  }

  /**
   * Start monitoring
   */
  private startMonitoring(executionId: string, plan: MigrationPlan): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics(executionId);
        await this.checkHealthStatus(executionId, plan);
      } catch (error) {
        this.log(executionId, 'error', 'metrics', `Monitoring error: ${error}`);
      }
    }, 60000); // Every minute
  }

  /**
   * Stop monitoring
   */
  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Collect metrics
   */
  private async collectMetrics(executionId: string): Promise<void> {
    // In a real implementation, this would fetch recent metrics from the metrics API
    // For now, just simulate metric collection
    const execution = this.executions.get(executionId)!;
    
    // Add simulated metric
    const metric: PerformanceMetrics = {
      timestamp: Date.now(),
      sessionId: `session_${Date.now()}`,
      audioSystem: 'azure',
      loadTime: 1000 + Math.random() * 2000,
      playbackStartTime: Date.now(),
      errors: [],
      retryCount: 0,
      fallbackUsed: Math.random() > 0.8,
      storyContext: {
        storySlug: 'the-last-word',
        level: 'l1',
        chapter: 1,
        page: 1,
        sentenceIndex: 0,
        language: 'es',
        speed: 'normal',
      },
    };

    execution.metrics.push(metric);
    
    // Keep only last 1000 metrics
    if (execution.metrics.length > 1000) {
      execution.metrics = execution.metrics.slice(-1000);
    }
  }

  /**
   * Check health status
   */
  private async checkHealthStatus(executionId: string, plan: MigrationPlan): Promise<void> {
    try {
      const response = await fetch('/api/migration/health');
      if (response.ok) {
        const healthData = await response.json();
        
        if (healthData.status === 'critical') {
          this.log(executionId, 'error', 'metrics', 'Critical health status detected');
          
          // Check if automatic rollback is enabled
          if (plan.rollbackStrategy.automatic) {
            await this.executeRollback(executionId, plan, 'Critical health status detected');
          }
        }
      }
    } catch (error) {
      this.log(executionId, 'warn', 'metrics', `Health check failed: ${error}`);
    }
  }

  /**
   * Send notification
   */
  private async sendNotification(plan: MigrationPlan, event: string, data: any): Promise<void> {
    if (this.notificationService) {
      const relevantNotifications = plan.notifications.filter(n => n.events.includes(event as any));
      
      for (const notification of relevantNotifications) {
        try {
          await this.notificationService.send(notification, event, data);
        } catch (error) {
          console.error('Failed to send notification:', error);
        }
      }
    }
  }

  /**
   * Log message
   */
  private log(executionId: string, level: string, category: string, message: string, data?: any): void {
    const execution = this.executions.get(executionId);
    if (execution) {
      execution.logs.push({
        timestamp: Date.now(),
        level: level as any,
        category: category as any,
        message,
        data,
      });
      
      // Keep only last 1000 logs
      if (execution.logs.length > 1000) {
        execution.logs = execution.logs.slice(-1000);
      }
    }

    console.log(`[${level.toUpperCase()}] [${category}] ${message}`, data || '');
  }

  /**
   * Load migration plan (placeholder)
   */
  private async loadMigrationPlan(planId: string): Promise<MigrationPlan> {
    // In a real implementation, this would load from database
    return getDefaultMigrationPlan();
  }
}

/**
 * Notification service interface
 */
interface NotificationService {
  send(config: NotificationConfig, event: string, data: any): Promise<void>;
}

/**
 * Get default migration plan
 */
export function getDefaultMigrationPlan(): MigrationPlan {
  return {
    id: 'azure-tts-migration-v1',
    name: 'Azure TTS Migration',
    description: 'Gradual migration from static audio to Azure TTS',
    phases: [
      {
        phase: 'experimental',
        name: 'Experimental Phase',
        description: 'Test with small group of premium users',
        duration: 24, // hours
        criteria: {
          minSuccessRate: 0.95,
          maxErrorRate: 0.05,
          maxLoadTime: 3000,
          minCacheHitRate: 0.8,
          minSampleSize: 50,
          userFeedbackThreshold: 4,
        },
        rolloutPercentage: 5,
        targetStories: ['the-last-word'],
        targetLevels: ['l1'],
        validationTests: ['preDeployment', 'audioQuality'],
        autoAdvance: true,
        rollbackTriggers: [
          {
            type: 'error_rate',
            threshold: 0.1,
            duration: 30,
            severity: 'high',
            action: 'rollback',
          },
          {
            type: 'load_time',
            threshold: 5000,
            duration: 15,
            severity: 'medium',
            action: 'pause',
          },
        ],
      },
      {
        phase: 'beta',
        name: 'Beta Phase',
        description: 'Expand to more users and stories',
        duration: 72, // hours
        criteria: {
          minSuccessRate: 0.92,
          maxErrorRate: 0.08,
          maxLoadTime: 4000,
          minCacheHitRate: 0.75,
          minSampleSize: 200,
          userFeedbackThreshold: 3.5,
        },
        rolloutPercentage: 25,
        targetStories: ['the-last-word'],
        targetLevels: ['l1', 'l2'],
        validationTests: ['audioQuality', 'performance'],
        autoAdvance: false,
        rollbackTriggers: [
          {
            type: 'error_rate',
            threshold: 0.15,
            duration: 60,
            severity: 'high',
            action: 'rollback',
          },
        ],
      },
      {
        phase: 'production',
        name: 'Production Phase',
        description: 'Full rollout to all users',
        duration: 168, // hours (1 week)
        criteria: {
          minSuccessRate: 0.90,
          maxErrorRate: 0.1,
          maxLoadTime: 5000,
          minCacheHitRate: 0.7,
          minSampleSize: 1000,
          userFeedbackThreshold: 3,
        },
        rolloutPercentage: 100,
        targetStories: ['the-last-word', 'aventura'],
        targetLevels: ['l1', 'l2', 'l3', 'l4', 'l5'],
        validationTests: ['audioQuality', 'performance', 'userAcceptance'],
        autoAdvance: false,
        rollbackTriggers: [
          {
            type: 'error_rate',
            threshold: 0.2,
            duration: 120,
            severity: 'critical',
            action: 'rollback',
          },
        ],
      },
    ],
    rollbackStrategy: {
      automatic: true,
      triggers: [
        {
          type: 'error_rate',
          threshold: 0.25,
          duration: 60,
          severity: 'critical',
          action: 'rollback',
        },
      ],
      maxAttempts: 3,
      cooldownPeriod: 24,
      notificationChannels: ['email', 'slack'],
    },
    validationRules: [
      {
        id: 'pre-deployment-health',
        name: 'Pre-deployment Health Check',
        type: 'pre_deployment',
        testSuite: 'preDeployment',
        frequency: 0,
        required: true,
        failureAction: 'rollback',
      },
      {
        id: 'continuous-monitoring',
        name: 'Continuous Performance Monitoring',
        type: 'continuous',
        testSuite: 'performance',
        frequency: 60,
        required: false,
        failureAction: 'continue',
      },
    ],
    notifications: [
      {
        channel: 'email',
        recipients: ['admin@example.com'],
        events: ['phase_start', 'phase_complete', 'error', 'rollback'],
        template: 'migration-status',
      },
      {
        channel: 'slack',
        recipients: ['#engineering-alerts'],
        events: ['error', 'rollback'],
        template: 'alert',
      },
    ],
  };
}

/**
 * Create migration orchestrator instance
 */
export function createMigrationOrchestrator(notificationService?: NotificationService): MigrationOrchestrator {
  return new MigrationOrchestrator(notificationService);
}