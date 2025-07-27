// src/components/MigrationDashboard.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { 
  MigrationConfig, 
  EnvironmentHealth, 
  PerformanceMetrics,
  ABTestConfig,
  MigrationTestResult
} from '@/types/migration';

interface DashboardData {
  health: EnvironmentHealth | null;
  metrics: {
    totalEvents: number;
    avgLoadTime: number;
    errorRate: number;
    fallbackRate: number;
    audioSystems: Record<string, number>;
    stories: Record<string, number>;
    hourlyBreakdown: Array<{
      hour: number;
      timestamp: number;
      events: number;
      avgLoadTime: number;
      errorCount: number;
    }>;
  } | null;
  config: MigrationConfig | null;
  tests: MigrationTestResult[];
  loading: boolean;
  error: string | null;
}

interface MigrationDashboardProps {
  className?: string;
}

export default function MigrationDashboard({ className = '' }: MigrationDashboardProps) {
  const [data, setData] = useState<DashboardData>({
    health: null,
    metrics: null,
    config: null,
    tests: [],
    loading: true,
    error: null,
  });

  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds

  /**
   * Fetch all dashboard data
   */
  const fetchDashboardData = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      // Fetch health status
      const healthResponse = await fetch('/api/migration/health?details=true');
      const healthData = healthResponse.ok ? await healthResponse.json() : null;

      // Fetch metrics
      const metricsResponse = await fetch(`/api/migration/metrics?timeRange=${selectedTimeRange}`);
      const metricsData = metricsResponse.ok ? await metricsResponse.json() : null;

      // Fetch test results
      const testsResponse = await fetch('/api/migration/tests');
      const testsData = testsResponse.ok ? await testsResponse.json() : { tests: [] };

      setData({
        health: healthData,
        metrics: metricsData?.metrics || null,
        config: healthData?.config || null,
        tests: testsData.tests || [],
        loading: false,
        error: null,
      });

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load dashboard data',
      }));
    }
  }, [selectedTimeRange]);

  /**
   * Run health tests
   */
  const runHealthTests = useCallback(async (testType: 'basic' | 'comprehensive' = 'basic') => {
    try {
      const response = await fetch('/api/migration/health/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType }),
      });

      if (response.ok) {
        const results = await response.json();
        console.log('Health test results:', results);
        // Refresh dashboard data to show updated status
        fetchDashboardData();
      } else {
        console.error('Health tests failed:', response.status);
      }
    } catch (error) {
      console.error('Failed to run health tests:', error);
    }
  }, [fetchDashboardData]);

  /**
   * Toggle migration phase
   */
  const updateMigrationPhase = useCallback(async (newPhase: string) => {
    try {
      const response = await fetch('/api/migration/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPhase: newPhase }),
      });

      if (response.ok) {
        fetchDashboardData();
      } else {
        console.error('Failed to update migration phase:', response.status);
      }
    } catch (error) {
      console.error('Failed to update migration phase:', error);
    }
  }, [fetchDashboardData]);

  // Initial data load
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchDashboardData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchDashboardData]);

  /**
   * Render status badge
   */
  const renderStatusBadge = (status: string) => {
    const statusColors = {
      healthy: 'bg-green-500',
      warning: 'bg-yellow-500',
      critical: 'bg-red-500',
      offline: 'bg-gray-500',
      up: 'bg-green-500',
      degraded: 'bg-yellow-500',
      down: 'bg-red-500',
    };

    return (
      <Badge className={`${statusColors[status as keyof typeof statusColors] || 'bg-gray-500'} text-white`}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  /**
   * Render metric card
   */
  const renderMetricCard = (title: string, value: string | number, subtitle?: string, trend?: 'up' | 'down' | 'stable') => (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-600">{title}</h3>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        {trend && (
          <div className={`text-sm ${trend === 'up' ? 'text-red-500' : trend === 'down' ? 'text-green-500' : 'text-gray-500'}`}>
            {trend === 'up' ? '↗️' : trend === 'down' ? '↘️' : '→'}
          </div>
        )}
      </div>
    </Card>
  );

  if (data.loading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className={`p-6 ${className}`}>
        <Card className="p-6 border-red-200 bg-red-50">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Dashboard Error</h2>
          <p className="text-red-600">{data.error}</p>
          <Button 
            onClick={fetchDashboardData} 
            className="mt-4"
            variant="outline"
          >
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className={`p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Migration Dashboard</h1>
          <p className="text-gray-600">
            Monitor Azure TTS migration progress and system health
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Auto-refresh toggle */}
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-2"
            />
            Auto-refresh
          </label>
          
          {/* Time range selector */}
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="border rounded px-3 py-1"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          
          {/* Refresh button */}
          <Button onClick={fetchDashboardData} variant="outline" size="sm">
            🔄 Refresh
          </Button>
        </div>
      </div>

      {/* Overall Health Status */}
      {data.health && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">System Health</h2>
            {renderStatusBadge(data.health.status)}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {Object.entries(data.health.services).map(([service, health]) => (
              <div key={service} className="text-center">
                <div className="font-medium text-sm text-gray-700 mb-1">
                  {service.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </div>
                {renderStatusBadge(health.status)}
                <div className="text-xs text-gray-500 mt-1">
                  {health.responseTime}ms
                </div>
              </div>
            ))}
          </div>
          
          {data.health.issues.length > 0 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
              <h3 className="font-medium text-yellow-800 mb-2">Active Issues</h3>
              <ul className="text-sm text-yellow-700 space-y-1">
                {data.health.issues.map((issue, index) => (
                  <li key={index}>
                    <Badge className="bg-yellow-500 text-white mr-2">{issue.severity}</Badge>
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Migration Configuration */}
      {data.config && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Migration Configuration</h2>
            <Badge className={data.config.enabled ? 'bg-green-500' : 'bg-gray-500'}>
              {data.config.enabled ? 'ENABLED' : 'DISABLED'}
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">Current Phase</div>
              <div className="font-medium">{data.config.currentPhase}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Audio System</div>
              <div className="font-medium">{data.config.audioSystem}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">User Percentage</div>
              <div className="font-medium">{data.config.userPercentage}%</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Fallback Strategy</div>
              <div className="font-medium">{data.config.fallbackStrategy}</div>
            </div>
          </div>
          
          {/* Phase controls */}
          <div className="mt-4 flex space-x-2">
            {['disabled', 'experimental', 'sandbox', 'beta', 'production'].map((phase) => (
              <Button
                key={phase}
                size="sm"
                variant={data.config.currentPhase === phase ? 'default' : 'outline'}
                onClick={() => updateMigrationPhase(phase)}
              >
                {phase.charAt(0).toUpperCase() + phase.slice(1)}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {/* Performance Metrics */}
      {data.metrics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {renderMetricCard(
              'Total Events',
              data.metrics.totalEvents.toLocaleString(),
              `Last ${selectedTimeRange}`
            )}
            {renderMetricCard(
              'Avg Load Time',
              `${data.metrics.avgLoadTime.toFixed(0)}ms`,
              'Azure TTS generation'
            )}
            {renderMetricCard(
              'Error Rate',
              `${(data.metrics.errorRate * 100).toFixed(1)}%`,
              'Failed requests'
            )}
            {renderMetricCard(
              'Fallback Rate',
              `${(data.metrics.fallbackRate * 100).toFixed(1)}%`,
              'Static audio usage'
            )}
          </div>

          {/* Audio System Distribution */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Audio System Usage</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-gray-700 mb-2">By System</h3>
                {Object.entries(data.metrics.audioSystems).map(([system, count]) => (
                  <div key={system} className="flex justify-between items-center py-1">
                    <span className="capitalize">{system}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="font-medium text-gray-700 mb-2">By Story</h3>
                {Object.entries(data.metrics.stories).slice(0, 5).map(([story, count]) => (
                  <div key={story} className="flex justify-between items-center py-1">
                    <span className="text-sm">{story}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Hourly Breakdown Chart */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Activity Over Time</h2>
            <div className="h-64 flex items-end space-x-1">
              {data.metrics.hourlyBreakdown.map((hour, index) => {
                const maxEvents = Math.max(...data.metrics!.hourlyBreakdown.map(h => h.events));
                const height = maxEvents > 0 ? (hour.events / maxEvents) * 100 : 0;
                
                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-blue-500 rounded-t"
                      style={{ height: `${height}%` }}
                      title={`Hour ${hour.hour}: ${hour.events} events, ${hour.avgLoadTime.toFixed(0)}ms avg`}
                    ></div>
                    <div className="text-xs text-gray-500 mt-1">{hour.hour}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}

      {/* Test Results */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Health Tests</h2>
          <div className="space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => runHealthTests('basic')}
            >
              Run Basic Tests
            </Button>
            <Button
              size="sm"
              onClick={() => runHealthTests('comprehensive')}
            >
              Run Full Tests
            </Button>
          </div>
        </div>
        
        {data.tests.length > 0 ? (
          <div className="space-y-2">
            {data.tests.slice(0, 10).map((test, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <div className="font-medium">{test.testId}</div>
                  <div className="text-sm text-gray-600">
                    {new Date(test.timestamp).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={test.passed ? 'bg-green-500' : 'bg-red-500'}>
                    {test.passed ? 'PASSED' : 'FAILED'}
                  </Badge>
                  <div className="text-sm text-gray-600">
                    {test.score.toFixed(0)}%
                  </div>
                  <div className="text-sm text-gray-600">
                    {test.duration}ms
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            No test results available. Run tests to see results here.
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
            <div className="text-2xl mb-1">📊</div>
            <div className="text-sm">View Metrics</div>
          </Button>
          <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
            <div className="text-2xl mb-1">🔄</div>
            <div className="text-sm">Clear Cache</div>
          </Button>
          <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
            <div className="text-2xl mb-1">⚡</div>
            <div className="text-sm">Force Rollback</div>
          </Button>
          <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
            <div className="text-2xl mb-1">📋</div>
            <div className="text-sm">Export Report</div>
          </Button>
        </div>
      </Card>
    </div>
  );
}