// src/lib/fallback-manager.ts

import type { 
  PerformanceMetrics, 
  ErrorMetric, 
  MigrationConfig 
} from '@/types/migration';

export type FallbackStrategy = 'immediate' | 'gradual' | 'circuit_breaker' | 'canary';
export type FallbackTrigger = 'error_rate' | 'latency' | 'availability' | 'manual' | 'user_feedback';

export interface FallbackConfig {
  strategy: FallbackStrategy;
  triggers: FallbackTriggerConfig[];
  recovery: RecoveryConfig;
  monitoring: MonitoringConfig;
  notification: NotificationConfig;
}

export interface FallbackTriggerConfig {
  type: FallbackTrigger;
  threshold: number;
  timeWindow: number; // seconds
  consecutiveFailures?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'alert' | 'partial_fallback' | 'full_fallback' | 'circuit_break';
}

export interface RecoveryConfig {
  autoRecovery: boolean;
  recoveryDelay: number; // seconds
  gradualRecovery: boolean;
  recoverySteps: number;
  healthCheckInterval: number; // seconds
  maxRecoveryAttempts: number;
}

export interface MonitoringConfig {
  enabled: boolean;
  metricsRetention: number; // hours
  alertThresholds: {
    errorRate: number;
    latency: number;
    availability: number;
  };
  dashboardRefresh: number; // seconds
}

export interface NotificationConfig {
  channels: ('email' | 'slack' | 'webhook' | 'sms')[];
  recipients: string[];
  escalation: {
    levels: EscalationLevel[];
    timeouts: number[]; // minutes
  };
}

export interface EscalationLevel {
  level: number;
  recipients: string[];
  channels: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface FallbackState {
  isActive: boolean;
  strategy: FallbackStrategy;
  triggeredBy: FallbackTrigger;
  startTime: number;
  endTime?: number;
  affectedPercentage: number;
  recoveryAttempts: number;
  status: 'triggering' | 'active' | 'recovering' | 'recovered' | 'failed';
  metrics: FallbackMetrics;
}

export interface FallbackMetrics {
  triggerCount: number;
  avgFallbackDuration: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  totalDowntime: number;
  affectedUsers: number;
  errorsSuppressed: number;
}

export interface HealthCheck {
  id: string;
  name: string;
  type: 'endpoint' | 'synthetic' | 'user_journey' | 'dependency';
  url?: string;
  method?: 'GET' | 'POST' | 'HEAD';
  timeout: number;
  interval: number;
  retries: number;
  expectedStatus?: number;
  expectedResponse?: string;
  critical: boolean;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  lastFailureTime: number;
  successCount: number;
  nextAttemptTime: number;
}

/**
 * Fallback Manager for handling Azure TTS failures
 */
export class FallbackManager {
  private state: FallbackState | null = null;
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private healthChecks: HealthCheck[] = [];
  private metrics: PerformanceMetrics[] = [];
  private errorHistory: ErrorMetric[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(
    private config: FallbackConfig,
    private notificationService?: NotificationService
  ) {
    this.initializeHealthChecks();
    this.startMonitoring();
  }

  /**
   * Check if fallback should be triggered
   */
  async evaluateFallback(
    error?: Error,
    metrics?: PerformanceMetrics,
    context?: { storySlug: string; level: string; userId?: string }
  ): Promise<{ shouldFallback: boolean; trigger?: FallbackTrigger; action?: string }> {
    
    // Add error to history if provided
    if (error) {
      this.addError(error, context);
    }

    // Add metrics if provided
    if (metrics) {
      this.addMetrics(metrics);
    }

    // Check each trigger
    for (const trigger of this.config.triggers) {
      const shouldTrigger = await this.evaluateTrigger(trigger);
      
      if (shouldTrigger) {
        console.log(`Fallback trigger activated: ${trigger.type} (${trigger.severity})`);
        
        if (trigger.action === 'full_fallback' || trigger.action === 'partial_fallback') {
          await this.activateFallback(trigger.type, trigger.action === 'partial_fallback' ? 50 : 100);
          return { shouldFallback: true, trigger: trigger.type, action: trigger.action };
        } else if (trigger.action === 'circuit_break') {
          this.openCircuitBreaker('azure-tts');
          return { shouldFallback: true, trigger: trigger.type, action: 'circuit_break' };
        }
      }
    }

    return { shouldFallback: false };
  }

  /**
   * Manually trigger fallback
   */
  async triggerFallback(
    reason: string,
    percentage: number = 100,
    duration?: number
  ): Promise<void> {
    console.log(`Manual fallback triggered: ${reason}`);
    await this.activateFallback('manual', percentage, duration);
  }

  /**
   * Get current fallback state
   */
  getFallbackState(): FallbackState | null {
    return this.state;
  }

  /**
   * Check if fallback is currently active
   */
  isFallbackActive(): boolean {
    return this.state?.isActive || false;
  }

  /**
   * Get fallback percentage for user
   */
  getFallbackPercentage(userId?: string): number {
    if (!this.state?.isActive) {
      return 0;
    }

    // For gradual fallback, determine user's fallback status
    if (this.state.strategy === 'gradual' && userId) {
      const userHash = this.hashString(userId);
      const userPercentage = userHash % 100;
      return userPercentage < this.state.affectedPercentage ? 100 : 0;
    }

    return this.state.affectedPercentage;
  }

  /**
   * Check circuit breaker state
   */
  isCircuitOpen(service: string): boolean {
    const breaker = this.circuitBreakers.get(service);
    return breaker?.state === 'open' || false;
  }

  /**
   * Try to recover from fallback
   */
  async attemptRecovery(): Promise<boolean> {
    if (!this.state?.isActive) {
      return true; // Already recovered
    }

    console.log('Attempting fallback recovery...');
    this.state.status = 'recovering';
    this.state.recoveryAttempts++;

    try {
      // Run health checks
      const healthStatus = await this.runHealthChecks();
      
      if (healthStatus.allPassing) {
        await this.completeRecovery();
        return true;
      } else {
        console.log('Health checks failed, recovery postponed');
        
        if (this.state.recoveryAttempts >= this.config.recovery.maxRecoveryAttempts) {
          console.error('Max recovery attempts reached, fallback will remain active');
          this.state.status = 'failed';
          await this.sendNotification('recovery_failed', {
            attempts: this.state.recoveryAttempts,
            failedChecks: healthStatus.failedChecks,
          });
        } else {
          this.state.status = 'active';
        }
        
        return false;
      }
    } catch (error) {
      console.error('Recovery attempt failed:', error);
      this.state.status = 'active';
      return false;
    }
  }

  /**
   * Force recovery (manual override)
   */
  async forceRecovery(): Promise<void> {
    if (this.state) {
      console.log('Forcing fallback recovery...');
      await this.completeRecovery();
    }
  }

  /**
   * Get fallback metrics
   */
  getMetrics(): FallbackMetrics {
    return this.state?.metrics || {
      triggerCount: 0,
      avgFallbackDuration: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      totalDowntime: 0,
      affectedUsers: 0,
      errorsSuppressed: 0,
    };
  }

  /**
   * Get error history
   */
  getErrorHistory(timeWindow?: number): ErrorMetric[] {
    const cutoff = timeWindow ? Date.now() - (timeWindow * 1000) : 0;
    return this.errorHistory.filter(error => error.timestamp > cutoff);
  }

  /**
   * Initialize health checks
   */
  private initializeHealthChecks(): void {
    this.healthChecks = [
      {
        id: 'azure-tts-endpoint',
        name: 'Azure TTS API Health',
        type: 'endpoint',
        url: '/api/azure-tts/generate',
        method: 'GET',
        timeout: 5000,
        interval: 30000, // 30 seconds
        retries: 3,
        expectedStatus: 200,
        critical: true,
      },
      {
        id: 'static-audio-fallback',
        name: 'Static Audio Availability',
        type: 'endpoint',
        url: '/audio/es/the-last-word/l1/ch1/page-1/line1.mp3',
        method: 'HEAD',
        timeout: 3000,
        interval: 60000, // 1 minute
        retries: 2,
        expectedStatus: 200,
        critical: true,
      },
      {
        id: 'cache-system',
        name: 'Cache System Health',
        type: 'synthetic',
        timeout: 5000,
        interval: 120000, // 2 minutes
        retries: 2,
        critical: false,
      },
    ];
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    if (!this.config.monitoring.enabled) {
      return;
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.runHealthChecks();
        await this.cleanupOldData();
        
        // Auto-recovery check
        if (this.state?.isActive && this.config.recovery.autoRecovery) {
          const timeSinceLastAttempt = Date.now() - (this.state.endTime || this.state.startTime);
          if (timeSinceLastAttempt > this.config.recovery.recoveryDelay * 1000) {
            await this.attemptRecovery();
          }
        }
      } catch (error) {
        console.error('Monitoring error:', error);
      }
    }, this.config.monitoring.dashboardRefresh * 1000);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Evaluate a specific trigger
   */
  private async evaluateTrigger(trigger: FallbackTriggerConfig): Promise<boolean> {
    const timeWindow = trigger.timeWindow * 1000; // Convert to milliseconds
    const cutoffTime = Date.now() - timeWindow;

    switch (trigger.type) {
      case 'error_rate':
        return this.evaluateErrorRate(trigger, cutoffTime);
      
      case 'latency':
        return this.evaluateLatency(trigger, cutoffTime);
      
      case 'availability':
        return await this.evaluateAvailability(trigger);
      
      case 'user_feedback':
        return this.evaluateUserFeedback(trigger, cutoffTime);
      
      default:
        return false;
    }
  }

  /**
   * Evaluate error rate trigger
   */
  private evaluateErrorRate(trigger: FallbackTriggerConfig, cutoffTime: number): boolean {
    const recentErrors = this.errorHistory.filter(error => error.timestamp > cutoffTime);
    const recentMetrics = this.metrics.filter(metric => metric.timestamp > cutoffTime);
    
    if (recentMetrics.length === 0) {
      return false;
    }

    const errorRate = recentErrors.length / recentMetrics.length;
    return errorRate > trigger.threshold;
  }

  /**
   * Evaluate latency trigger
   */
  private evaluateLatency(trigger: FallbackTriggerConfig, cutoffTime: number): boolean {
    const recentMetrics = this.metrics.filter(metric => metric.timestamp > cutoffTime);
    
    if (recentMetrics.length === 0) {
      return false;
    }

    const avgLatency = recentMetrics.reduce((sum, metric) => sum + metric.loadTime, 0) / recentMetrics.length;
    return avgLatency > trigger.threshold;
  }

  /**
   * Evaluate availability trigger
   */
  private async evaluateAvailability(trigger: FallbackTriggerConfig): Promise<boolean> {
    const healthStatus = await this.runHealthChecks();
    const criticalChecks = this.healthChecks.filter(check => check.critical);
    const failedCriticalChecks = healthStatus.failedChecks.filter(check => 
      criticalChecks.some(c => c.id === check.id)
    );
    
    const availability = (criticalChecks.length - failedCriticalChecks.length) / criticalChecks.length;
    return availability < trigger.threshold;
  }

  /**
   * Evaluate user feedback trigger
   */
  private evaluateUserFeedback(trigger: FallbackTriggerConfig, cutoffTime: number): boolean {
    // This would integrate with user feedback system
    // For now, return false as placeholder
    return false;
  }

  /**
   * Activate fallback
   */
  private async activateFallback(
    triggeredBy: FallbackTrigger,
    percentage: number,
    duration?: number
  ): Promise<void> {
    if (this.state?.isActive) {
      console.log('Fallback already active, updating configuration');
      this.state.affectedPercentage = Math.max(this.state.affectedPercentage, percentage);
      return;
    }

    this.state = {
      isActive: true,
      strategy: this.config.strategy,
      triggeredBy,
      startTime: Date.now(),
      affectedPercentage: percentage,
      recoveryAttempts: 0,
      status: 'triggering',
      metrics: {
        triggerCount: 1,
        avgFallbackDuration: 0,
        successfulRecoveries: 0,
        failedRecoveries: 0,
        totalDowntime: 0,
        affectedUsers: 0,
        errorsSuppressed: 0,
      },
    };

    // Implement gradual fallback if strategy is gradual
    if (this.config.strategy === 'gradual') {
      await this.implementGradualFallback(percentage);
    } else {
      this.state.status = 'active';
    }

    console.log(`Fallback activated: ${percentage}% of users affected`);
    
    await this.sendNotification('fallback_activated', {
      trigger: triggeredBy,
      percentage,
      strategy: this.config.strategy,
    });

    // Set auto-recovery timer if duration is specified
    if (duration) {
      setTimeout(async () => {
        await this.attemptRecovery();
      }, duration * 1000);
    }
  }

  /**
   * Implement gradual fallback
   */
  private async implementGradualFallback(targetPercentage: number): Promise<void> {
    const steps = this.config.recovery.recoverySteps || 5;
    const stepSize = targetPercentage / steps;
    
    for (let i = 1; i <= steps; i++) {
      this.state!.affectedPercentage = Math.min(i * stepSize, targetPercentage);
      
      console.log(`Gradual fallback step ${i}/${steps}: ${this.state!.affectedPercentage}% affected`);
      
      if (i < steps) {
        await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute between steps
      }
    }
    
    this.state!.status = 'active';
  }

  /**
   * Complete recovery
   */
  private async completeRecovery(): Promise<void> {
    if (!this.state) {
      return;
    }

    const duration = Date.now() - this.state.startTime;
    
    this.state.isActive = false;
    this.state.status = 'recovered';
    this.state.endTime = Date.now();
    this.state.metrics.successfulRecoveries++;
    this.state.metrics.totalDowntime += duration;
    this.state.metrics.avgFallbackDuration = 
      (this.state.metrics.avgFallbackDuration * (this.state.metrics.triggerCount - 1) + duration) / 
      this.state.metrics.triggerCount;

    console.log(`Fallback recovery completed after ${duration / 1000} seconds`);
    
    await this.sendNotification('fallback_recovered', {
      duration: duration / 1000,
      affectedPercentage: this.state.affectedPercentage,
    });

    // Reset circuit breakers
    this.circuitBreakers.clear();
    
    // Keep state for metrics but mark as inactive
    // In a real implementation, you might want to archive this data
  }

  /**
   * Open circuit breaker
   */
  private openCircuitBreaker(service: string): void {
    this.circuitBreakers.set(service, {
      state: 'open',
      failureCount: 0,
      lastFailureTime: Date.now(),
      successCount: 0,
      nextAttemptTime: Date.now() + (30 * 1000), // 30 seconds
    });

    console.log(`Circuit breaker opened for service: ${service}`);
  }

  /**
   * Run health checks
   */
  private async runHealthChecks(): Promise<{ allPassing: boolean; failedChecks: any[] }> {
    const results = [];
    
    for (const check of this.healthChecks) {
      try {
        const result = await this.runSingleHealthCheck(check);
        results.push({ ...check, passed: result });
      } catch (error) {
        results.push({ ...check, passed: false, error: error.message });
      }
    }

    const failedChecks = results.filter(r => !r.passed);
    
    return {
      allPassing: failedChecks.length === 0,
      failedChecks,
    };
  }

  /**
   * Run single health check
   */
  private async runSingleHealthCheck(check: HealthCheck): Promise<boolean> {
    if (check.type === 'endpoint') {
      try {
        const response = await fetch(check.url!, {
          method: check.method || 'GET',
          signal: AbortSignal.timeout(check.timeout),
        });
        
        return check.expectedStatus ? response.status === check.expectedStatus : response.ok;
      } catch (error) {
        return false;
      }
    } else if (check.type === 'synthetic') {
      // Implement synthetic checks (e.g., cache test)
      return Math.random() > 0.1; // 90% success rate for demo
    }
    
    return true;
  }

  /**
   * Add error to history
   */
  private addError(error: Error, context?: any): void {
    this.errorHistory.push({
      timestamp: Date.now(),
      type: 'generation',
      message: error.message,
      severity: 'medium',
      resolved: false,
    });

    // Keep only recent errors
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    this.errorHistory = this.errorHistory.filter(e => e.timestamp > cutoff);
  }

  /**
   * Add metrics
   */
  private addMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);

    // Keep only recent metrics
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-5000); // Keep last 5000
    }
  }

  /**
   * Cleanup old data
   */
  private async cleanupOldData(): Promise<void> {
    const retention = this.config.monitoring.metricsRetention * 60 * 60 * 1000; // Convert to ms
    const cutoff = Date.now() - retention;

    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    this.errorHistory = this.errorHistory.filter(e => e.timestamp > cutoff);
  }

  /**
   * Send notification
   */
  private async sendNotification(event: string, data: any): Promise<void> {
    if (this.notificationService) {
      try {
        await this.notificationService.send(this.config.notification, event, data);
      } catch (error) {
        console.error('Failed to send notification:', error);
      }
    }
  }

  /**
   * Hash string for consistent user assignment
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

/**
 * Notification service interface
 */
interface NotificationService {
  send(config: NotificationConfig, event: string, data: any): Promise<void>;
}

/**
 * Create fallback manager with default configuration
 */
export function createFallbackManager(
  customConfig?: Partial<FallbackConfig>,
  notificationService?: NotificationService
): FallbackManager {
  const defaultConfig: FallbackConfig = {
    strategy: 'gradual',
    triggers: [
      {
        type: 'error_rate',
        threshold: 0.1, // 10% error rate
        timeWindow: 300, // 5 minutes
        severity: 'high',
        action: 'partial_fallback',
      },
      {
        type: 'latency',
        threshold: 5000, // 5 seconds
        timeWindow: 180, // 3 minutes
        severity: 'medium',
        action: 'partial_fallback',
      },
      {
        type: 'availability',
        threshold: 0.9, // 90% availability
        timeWindow: 60, // 1 minute
        severity: 'critical',
        action: 'full_fallback',
      },
    ],
    recovery: {
      autoRecovery: true,
      recoveryDelay: 300, // 5 minutes
      gradualRecovery: true,
      recoverySteps: 5,
      healthCheckInterval: 60, // 1 minute
      maxRecoveryAttempts: 3,
    },
    monitoring: {
      enabled: true,
      metricsRetention: 24, // 24 hours
      alertThresholds: {
        errorRate: 0.05,
        latency: 3000,
        availability: 0.95,
      },
      dashboardRefresh: 30, // 30 seconds
    },
    notification: {
      channels: ['email'],
      recipients: ['admin@example.com'],
      escalation: {
        levels: [
          {
            level: 1,
            recipients: ['oncall@example.com'],
            channels: ['email'],
            severity: 'high',
          },
          {
            level: 2,
            recipients: ['manager@example.com'],
            channels: ['email', 'sms'],
            severity: 'critical',
          },
        ],
        timeouts: [15, 30], // minutes
      },
    },
  };

  const config = { ...defaultConfig, ...customConfig };
  return new FallbackManager(config, notificationService);
}