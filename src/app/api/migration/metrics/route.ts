// src/app/api/migration/metrics/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import type { PerformanceMetrics } from '@/types/migration';

/**
 * POST /api/migration/metrics
 * Collect performance metrics from client
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Parse request body
    const body = await request.json();
    const { metrics, timestamp } = body;
    
    if (!Array.isArray(metrics)) {
      return NextResponse.json(
        { error: 'Invalid metrics format' },
        { status: 400 }
      );
    }
    
    // Validate metrics structure
    const validatedMetrics: PerformanceMetrics[] = [];
    for (const metric of metrics) {
      if (isValidMetric(metric)) {
        validatedMetrics.push({
          ...metric,
          userId: session?.user?.id,
          timestamp: timestamp || Date.now(),
        });
      }
    }
    
    if (validatedMetrics.length === 0) {
      return NextResponse.json(
        { error: 'No valid metrics provided' },
        { status: 400 }
      );
    }
    
    // In a real implementation, you would:
    // 1. Store metrics in database
    // 2. Send to analytics service (e.g., DataDog, New Relic)
    // 3. Trigger alerts if thresholds are exceeded
    
    console.log('Migration metrics received:', {
      count: validatedMetrics.length,
      userId: session?.user?.id,
      timestamp,
    });
    
    // For now, just log the metrics (replace with actual storage)
    await logMetricsToStorage(validatedMetrics);
    
    // Check for performance issues
    const issues = await checkPerformanceThresholds(validatedMetrics);
    if (issues.length > 0) {
      console.warn('Performance issues detected:', issues);
      // In production, you might trigger alerts here
    }
    
    return NextResponse.json({
      success: true,
      processed: validatedMetrics.length,
      issues: issues.length,
    });
    
  } catch (error) {
    console.error('Error processing migration metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/migration/metrics
 * Retrieve aggregated metrics for dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Only allow admins to view metrics
    if (!session?.user?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const url = new URL(request.url);
    const timeRange = url.searchParams.get('timeRange') || '24h';
    const storySlug = url.searchParams.get('storySlug');
    const audioSystem = url.searchParams.get('audioSystem');
    
    // Calculate time range
    const now = Date.now();
    const timeRangeMs = parseTimeRange(timeRange);
    const startTime = now - timeRangeMs;
    
    // Fetch metrics from storage (placeholder implementation)
    const metrics = await fetchMetricsFromStorage({
      startTime,
      endTime: now,
      storySlug,
      audioSystem,
    });
    
    // Aggregate metrics
    const aggregated = aggregateMetrics(metrics);
    
    return NextResponse.json({
      timeRange,
      startTime,
      endTime: now,
      metrics: aggregated,
      totalEvents: metrics.length,
    });
    
  } catch (error) {
    console.error('Error fetching migration metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Validate metric structure
 */
function isValidMetric(metric: any): metric is PerformanceMetrics {
  return (
    typeof metric === 'object' &&
    typeof metric.timestamp === 'number' &&
    typeof metric.sessionId === 'string' &&
    typeof metric.audioSystem === 'string' &&
    ['azure', 'static'].includes(metric.audioSystem) &&
    typeof metric.loadTime === 'number' &&
    metric.loadTime >= 0 &&
    typeof metric.storyContext === 'object' &&
    typeof metric.storyContext.storySlug === 'string' &&
    typeof metric.storyContext.level === 'string'
  );
}

/**
 * Log metrics to storage (placeholder implementation)
 */
async function logMetricsToStorage(metrics: PerformanceMetrics[]): Promise<void> {
  // In a real implementation, this would:
  // 1. Insert into database (PostgreSQL, MongoDB, etc.)
  // 2. Send to time-series database (InfluxDB, TimescaleDB)
  // 3. Send to analytics service (DataDog, New Relic, etc.)
  
  console.log(`Storing ${metrics.length} migration metrics:`, {
    audioSystems: [...new Set(metrics.map(m => m.audioSystem))],
    avgLoadTime: metrics.reduce((sum, m) => sum + m.loadTime, 0) / metrics.length,
    errorCount: metrics.filter(m => m.errors.length > 0).length,
  });
  
  // Simulate async storage
  await new Promise(resolve => setTimeout(resolve, 10));
}

/**
 * Check performance thresholds
 */
async function checkPerformanceThresholds(metrics: PerformanceMetrics[]): Promise<string[]> {
  const issues: string[] = [];
  
  // Check average load time
  const avgLoadTime = metrics.reduce((sum, m) => sum + m.loadTime, 0) / metrics.length;
  if (avgLoadTime > 5000) {
    issues.push(`High average load time: ${avgLoadTime.toFixed(0)}ms`);
  }
  
  // Check error rate
  const errorRate = metrics.filter(m => m.errors.length > 0).length / metrics.length;
  if (errorRate > 0.1) {
    issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
  }
  
  // Check fallback usage
  const fallbackRate = metrics.filter(m => m.fallbackUsed).length / metrics.length;
  if (fallbackRate > 0.2) {
    issues.push(`High fallback usage: ${(fallbackRate * 100).toFixed(1)}%`);
  }
  
  return issues;
}

/**
 * Parse time range string to milliseconds
 */
function parseTimeRange(timeRange: string): number {
  const ranges: Record<string, number> = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };
  
  return ranges[timeRange] || ranges['24h'];
}

/**
 * Fetch metrics from storage (placeholder implementation)
 */
async function fetchMetricsFromStorage(filters: {
  startTime: number;
  endTime: number;
  storySlug?: string | null;
  audioSystem?: string | null;
}): Promise<PerformanceMetrics[]> {
  // In a real implementation, this would query your database
  // For now, return empty array
  return [];
}

/**
 * Aggregate metrics for dashboard
 */
function aggregateMetrics(metrics: PerformanceMetrics[]) {
  if (metrics.length === 0) {
    return {
      totalEvents: 0,
      avgLoadTime: 0,
      errorRate: 0,
      fallbackRate: 0,
      audioSystems: {},
      stories: {},
      hourlyBreakdown: [],
    };
  }
  
  const avgLoadTime = metrics.reduce((sum, m) => sum + m.loadTime, 0) / metrics.length;
  const errorRate = metrics.filter(m => m.errors.length > 0).length / metrics.length;
  const fallbackRate = metrics.filter(m => m.fallbackUsed).length / metrics.length;
  
  // Group by audio system
  const audioSystems = metrics.reduce((acc, m) => {
    acc[m.audioSystem] = (acc[m.audioSystem] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Group by story
  const stories = metrics.reduce((acc, m) => {
    const key = m.storyContext.storySlug;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Hourly breakdown (last 24 hours)
  const now = Date.now();
  const hourlyBreakdown = [];
  for (let i = 23; i >= 0; i--) {
    const hourStart = now - (i * 60 * 60 * 1000);
    const hourEnd = hourStart + (60 * 60 * 1000);
    const hourMetrics = metrics.filter(m => m.timestamp >= hourStart && m.timestamp < hourEnd);
    
    hourlyBreakdown.push({
      hour: new Date(hourStart).getHours(),
      timestamp: hourStart,
      events: hourMetrics.length,
      avgLoadTime: hourMetrics.length > 0 
        ? hourMetrics.reduce((sum, m) => sum + m.loadTime, 0) / hourMetrics.length 
        : 0,
      errorCount: hourMetrics.filter(m => m.errors.length > 0).length,
    });
  }
  
  return {
    totalEvents: metrics.length,
    avgLoadTime,
    errorRate,
    fallbackRate,
    audioSystems,
    stories,
    hourlyBreakdown,
  };
}