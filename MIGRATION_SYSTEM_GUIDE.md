# Azure TTS Migration System - Complete Guide

This document provides a comprehensive guide to the Azure TTS migration system, including setup, configuration, testing, and deployment procedures.

## 🎯 Overview

The Azure TTS Migration System is a production-ready framework designed to safely transition from static audio files to Azure Text-to-Speech with zero downtime and comprehensive monitoring.

### Key Features

- **Intelligent Hybrid Component**: Seamlessly switches between static and Azure TTS
- **A/B Testing Framework**: Gradual user rollout with statistical significance testing  
- **Comprehensive Monitoring**: Real-time performance metrics and health monitoring
- **Robust Fallback Mechanisms**: Automatic error recovery with circuit breakers
- **Migration Orchestration**: Controlled phase-based rollout with automatic rollback
- **Validation Tools**: Pre-migration checks and continuous health monitoring

## 📁 System Architecture

```
src/
├── components/
│   ├── StoryLayoutHybrid.tsx      # Main hybrid component
│   └── MigrationDashboard.tsx     # Monitoring dashboard
├── lib/
│   ├── migration-config.ts        # Configuration management
│   ├── migration-testing.ts       # Testing framework
│   ├── migration-orchestrator.ts  # Rollout orchestration
│   ├── ab-testing.ts              # A/B testing system
│   ├── fallback-manager.ts        # Error handling & recovery
│   └── migration-validator.ts     # Pre-migration validation
├── hooks/
│   └── useMigrationMetrics.ts     # Metrics collection
├── types/
│   └── migration.ts               # TypeScript definitions
└── app/api/migration/
    ├── metrics/route.ts           # Metrics API
    └── health/route.ts            # Health monitoring API
```

## 🚀 Quick Start

### 1. Environment Setup

Set the required environment variables:

```bash
# Azure Speech Services
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=your_azure_region

# Application
NEXTAUTH_SECRET=your_secret
DATABASE_URL=your_database_url
NODE_ENV=development|staging|production
```

### 2. Basic Migration Configuration

```typescript
// Example: Enable migration for development
import { getMigrationConfig } from '@/lib/migration-config';

const config = getMigrationConfig();
// Development: Enabled with Azure TTS for testing
// Staging: Hybrid mode with 50% users  
// Production: Disabled by default (safety first)
```

### 3. Replace StoryLayout Component

Replace the existing StoryLayout with the hybrid version:

```typescript
// Before
import StoryLayout from '@/components/StoryLayout';

// After  
import StoryLayoutHybrid from '@/components/StoryLayoutHybrid';

// Usage remains the same
<StoryLayoutHybrid
  sentences={sentences}
  initialLevel={level}
  storySlug={storySlug}
  title={title}
  storyMap={storyMap}
/>
```

## 📊 Migration Dashboard

Access the migration dashboard to monitor system health and performance:

```typescript
import MigrationDashboard from '@/components/MigrationDashboard';

// In your admin interface
<MigrationDashboard />
```

### Dashboard Features

- **Real-time Health Status**: Service availability and response times
- **Performance Metrics**: Load times, error rates, cache hit rates  
- **Migration Configuration**: Current phase and rollout percentage
- **Test Results**: Automated validation results
- **Quick Actions**: Manual controls for emergency situations

## 🧪 Testing & Validation

### Pre-Migration Validation

Run comprehensive validation before any migration:

```typescript
import { createMigrationValidator } from '@/lib/migration-validator';

const validator = createMigrationValidator();
const result = await validator.validateMigrationReadiness('the-last-word', 'l1');

if (result.passed) {
  console.log('✅ Migration ready');
} else {
  console.log('❌ Issues found:', result.blockingIssues);
}
```

### Automated Testing

The system includes comprehensive test suites:

```typescript
import { createTestRunner, migrationTestSuites } from '@/lib/migration-testing';

const runner = createTestRunner(config);

// Run pre-deployment tests
const results = await runner.runTestSuite(migrationTestSuites.preDeployment, context);

// Run performance tests  
const perfResults = await runner.runTestSuite(migrationTestSuites.performance, context);
```

### Test Suites Available

- **preDeployment**: Basic connectivity and configuration
- **audioQuality**: Audio generation and quality validation
- **performance**: Load time and caching performance
- **userAcceptance**: Word highlighting and user experience

## 🎛️ Migration Phases

The system supports controlled phase-based rollout:

### Phase 1: Experimental (5% users)
- Premium users only
- Single story (the-last-word)
- Level 1 only
- Comprehensive monitoring

### Phase 2: Beta (25% users)  
- All user types
- Single story
- Levels 1-2
- A/B testing active

### Phase 3: Production (100% users)
- All stories and levels
- Full monitoring
- Automatic fallback enabled

### Manual Phase Control

```typescript
import { createMigrationOrchestrator } from '@/lib/migration-orchestrator';

const orchestrator = createMigrationOrchestrator();

// Start migration
const executionId = await orchestrator.startMigration(migrationPlan);

// Monitor progress
const status = orchestrator.getMigrationStatus(executionId);

// Emergency rollback
await orchestrator.forceRollback('Critical issue detected');
```

## 📈 A/B Testing

### Create and Run A/B Tests

```typescript
import { createABTestManager } from '@/lib/ab-testing';

const testManager = createABTestManager();

// Create test
const testConfig = {
  name: 'Azure TTS vs Static Audio',
  controlGroup: { percentage: 50, audioSystem: 'static' },
  testGroup: { percentage: 50, audioSystem: 'azure' },
  targeting: {
    stories: ['the-last-word'],
    levels: ['l1', 'l2'],
    userTypes: ['free', 'premium'],
  },
  successCriteria: {
    minSampleSize: 200,
    significanceLevel: 0.05,
    primaryMetric: 'loading_time',
  },
};

const testId = await testManager.createTest(testConfig);
await testManager.startTest(testId);

// Get user assignment
const assignment = await testManager.getUserAssignment(testId, userId, context);

// Record metrics
await testManager.recordMetric(testId, userId, {
  type: 'loading_time',
  value: 1500, // ms
  timestamp: Date.now(),
});

// Analyze results
const analysis = await testManager.analyzeResults(testId);
```

## 🛡️ Fallback & Error Recovery

### Automatic Fallback Configuration

```typescript
import { createFallbackManager } from '@/lib/fallback-manager';

const fallbackManager = createFallbackManager({
  strategy: 'gradual',
  triggers: [
    {
      type: 'error_rate',
      threshold: 0.1, // 10% error rate
      timeWindow: 300, // 5 minutes
      action: 'partial_fallback',
    },
    {
      type: 'latency', 
      threshold: 5000, // 5 seconds
      timeWindow: 180, // 3 minutes
      action: 'partial_fallback',
    },
  ],
  recovery: {
    autoRecovery: true,
    recoveryDelay: 300, // 5 minutes
    gradualRecovery: true,
  },
});

// Check if fallback should be triggered
const { shouldFallback, trigger } = await fallbackManager.evaluateFallback(error, metrics);

// Manual fallback trigger
await fallbackManager.triggerFallback('Manual intervention', 100);

// Check fallback status
const isActive = fallbackManager.isFallbackActive();
const percentage = fallbackManager.getFallbackPercentage(userId);
```

### Circuit Breaker Pattern

The system includes circuit breakers that automatically stop attempting failed operations:

- **Closed**: Normal operation
- **Open**: All requests fail fast (fallback immediately)
- **Half-Open**: Limited requests allowed to test recovery

## 📊 Metrics Collection

### Automatic Metrics

The system automatically collects:

- **Performance Metrics**: Load times, cache hit rates
- **Error Metrics**: Failure rates, error types
- **User Metrics**: Assignment groups, feedback
- **System Metrics**: Service health, availability

### Custom Metrics

```typescript
import { useMigrationMetrics } from '@/hooks/useMigrationMetrics';

const metrics = useMigrationMetrics({
  storySlug: 'the-last-word',
  level: 'l1', 
  enabled: true,
  sampleRate: 0.1, // 10% sampling
});

// Track events
metrics.trackPlaybackStart(sentenceIndex, 'azure', false);
metrics.trackLoadTime(sentenceIndex, 1500, 'azure'); 
metrics.trackError('generation', 'Azure TTS timeout', sentenceIndex);
metrics.trackUserFeedback('audio_quality', 4, 'Sounds great!');
```

## 🔧 Configuration Management

### Environment-Specific Configuration

The system automatically configures based on environment:

```typescript
// Development
{
  enabled: true,
  currentPhase: 'experimental',
  audioSystem: 'hybrid',
  userPercentage: 100,
  monitoring: { debugMode: true, sampleRate: 1.0 }
}

// Staging  
{
  enabled: true,
  currentPhase: 'sandbox',
  audioSystem: 'hybrid', 
  userPercentage: 50,
  monitoring: { debugMode: false, sampleRate: 0.5 }
}

// Production
{
  enabled: false, // Start disabled for safety
  currentPhase: 'disabled',
  audioSystem: 'static',
  userPercentage: 0,
  monitoring: { debugMode: false, sampleRate: 0.1 }
}
```

### Runtime Configuration Updates

```typescript
import { getMigrationConfig, shouldUseAzureTTS } from '@/lib/migration-config';

// Check if user should get Azure TTS
const shouldUseAzure = shouldUseAzureTTS(config, userProfile, {
  storySlug: 'the-last-word',
  level: 'l1',
  isPremium: true,
  userId: 'user123',
});

// Assign user to test group
const group = assignUserToGroup(config, userId, context);
```

## 🚨 Monitoring & Alerting

### Health Monitoring

```typescript
// Check system health
const response = await fetch('/api/migration/health');
const health = await response.json();

// Health status: 'healthy' | 'warning' | 'critical' | 'offline'
console.log('System status:', health.status);

// Service-specific health
console.log('Azure TTS:', health.services.azureTTS.status);
console.log('Static Audio:', health.services.staticAudio.status);
```

### Performance Metrics API

```typescript
// Get aggregated metrics
const response = await fetch('/api/migration/metrics?timeRange=24h');
const metrics = await response.json();

console.log('Average load time:', metrics.metrics.avgLoadTime);
console.log('Error rate:', metrics.metrics.errorRate);
console.log('Cache hit rate:', metrics.metrics.cacheHitRate);
```

## 🛠️ Deployment Guide

### 1. Development Deployment

```bash
# 1. Set environment variables
export AZURE_SPEECH_KEY=your_dev_key
export AZURE_SPEECH_REGION=your_region
export NODE_ENV=development

# 2. Run validation
npm run migrate:validate

# 3. Run tests
npm run migrate:test

# 4. Start development server
npm run dev
```

### 2. Staging Deployment

```bash
# 1. Deploy to staging environment
npm run deploy:staging

# 2. Run comprehensive validation
npm run migrate:validate:staging

# 3. Run performance tests
npm run migrate:test:performance

# 4. Monitor for 24 hours before production
```

### 3. Production Deployment

```bash
# 1. Final validation
npm run migrate:validate:production

# 2. Deploy with migration disabled
npm run deploy:production

# 3. Gradually enable migration
# - Start with experimental phase (5% users)
# - Monitor for 48 hours
# - Progress to beta phase (25% users) 
# - Monitor for 1 week
# - Progress to production (100% users)
```

## 🆘 Emergency Procedures

### Immediate Rollback

```bash
# Via API
curl -X POST /api/migration/rollback \
  -H "Content-Type: application/json" \
  -d '{"reason": "Critical issue", "immediate": true}'

# Via Dashboard
# 1. Access Migration Dashboard
# 2. Click "Force Rollback" 
# 3. Confirm with reason
```

### Gradual Rollback

```typescript
// Reduce percentage gradually
await orchestrator.updateMigrationPhase('beta'); // 25% -> 25%
await orchestrator.updateMigrationPhase('experimental'); // 25% -> 5%  
await orchestrator.updateMigrationPhase('disabled'); // 5% -> 0%
```

## 📋 Troubleshooting

### Common Issues

**1. Azure TTS Not Working**
```bash
# Check configuration
curl /api/azure-tts/generate

# Check environment variables
echo $AZURE_SPEECH_KEY
echo $AZURE_SPEECH_REGION
```

**2. High Error Rates**
- Check fallback trigger logs
- Verify static audio files are accessible  
- Monitor network connectivity to Azure

**3. Poor Performance**
- Check cache hit rates
- Monitor Azure TTS response times
- Verify CDN configuration for static files

### Debug Mode

Enable debug mode in development:

```typescript
const config = getMigrationConfig();
config.monitoring.debugMode = true;
config.monitoring.logLevel = 'debug';
```

## 📚 API Reference

### Health API

```typescript
GET /api/migration/health
// Returns system health status

POST /api/migration/health/test  
// Runs comprehensive health tests
```

### Metrics API

```typescript
GET /api/migration/metrics?timeRange=24h&storySlug=the-last-word
// Returns aggregated metrics

POST /api/migration/metrics
// Submit metrics batch
```

### Configuration API

```typescript
GET /api/migration/config
// Get current configuration

PUT /api/migration/config
// Update configuration (admin only)
```

## 🔐 Security Considerations

### Environment Variables
- Never expose Azure Speech keys in client-side code
- Use environment-specific keys (dev/staging/prod)
- Rotate keys regularly

### API Access
- Migration APIs require authentication
- Admin-only endpoints for configuration changes
- Rate limiting on all endpoints

### Data Privacy
- No personal user data sent to Azure TTS
- Metrics collection respects user privacy
- GDPR compliance for EU users

## 📈 Performance Optimization

### Caching Strategy
- Azure TTS responses cached for 30 days
- Static audio files served via CDN
- Browser caching for repeated requests

### Load Balancing
- Multiple Azure Speech service regions
- Automatic failover between regions
- Circuit breakers prevent cascade failures

### Monitoring
- Real-time performance metrics
- Automated alerting on performance degradation
- Historical trending and analysis

## 🤝 Contributing

### Adding New Test Suites

```typescript
// Add to migration-testing.ts
export const migrationTestSuites = {
  // ... existing suites
  customSuite: {
    id: 'custom-suite',
    name: 'Custom Test Suite',
    description: 'Custom validation tests',
    tests: [
      {
        id: 'custom-test',
        name: 'Custom Test',
        type: 'integration',
        async execute(context) {
          // Test implementation
          return { passed: true, score: 100, duration: 1000, errors: [] };
        },
      },
    ],
  },
};
```

### Adding New Metrics

```typescript
// Add to migration types
interface CustomMetric extends PerformanceMetrics {
  customField: number;
}

// Track in useMigrationMetrics hook
const trackCustomMetric = (value: number) => {
  // Implementation
};
```

## 📞 Support

For issues, questions, or feature requests:

1. Check this documentation first
2. Review the troubleshooting section
3. Check the Migration Dashboard for system status
4. Contact the engineering team with:
   - Error messages and logs
   - Steps to reproduce
   - Environment details
   - Migration phase and configuration

---

This migration system provides enterprise-grade reliability and monitoring for your Azure TTS transition. Follow the phased approach and monitoring guidelines for a successful migration with zero user impact.