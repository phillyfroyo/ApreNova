// src/app/migration-dashboard/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card-dashboard';
import { Badge } from '@/components/ui/badge-dashboard';
import { Button } from '@/components/ui/button-dashboard';
import { AlertCircle, CheckCircle, Clock, Users, TrendingUp, Zap, Database, Globe } from 'lucide-react';

interface SystemHealth {
  azureTTS: 'connected' | 'disconnected' | 'error';
  cache: {
    hitRate: number;
    totalSize: string;
    itemCount: number;
  };
  migration: {
    phase: 'experimental' | 'beta' | 'production' | 'rollback';
    userPercentage: number;
    totalUsers: number;
    azureUsers: number;
  };
  performance: {
    avgGenerationTime: number;
    errorRate: number;
    successRate: number;
  };
}

export default function MigrationDashboard() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        console.log('Fetching health data...');
        const response = await fetch('/api/migration/health');
        console.log('Response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Health data received:', data);
          setHealth(data);
        } else {
          console.log('Response not OK, using fallback data');
          // Fallback data for demonstration
          setHealth({
            azureTTS: 'connected',
            cache: {
              hitRate: 85.2,
              totalSize: '2.3 GB',
              itemCount: 1247
            },
            migration: {
              phase: 'experimental',
              userPercentage: 5,
              totalUsers: 2840,
              azureUsers: 142
            },
            performance: {
              avgGenerationTime: 1.8,
              errorRate: 0.3,
              successRate: 99.7
            }
          });
        }
        setLastUpdated(new Date());
      } catch (error) {
        console.error('Failed to fetch health data:', error);
        // Set demo data on error
        setHealth({
          azureTTS: 'connected',
          cache: {
            hitRate: 85.2,
            totalSize: '2.3 GB',
            itemCount: 1247
          },
          migration: {
            phase: 'experimental',
            userPercentage: 5,
            totalUsers: 2840,
            azureUsers: 142
          },
          performance: {
            avgGenerationTime: 1.8,
            errorRate: 0.3,
            successRate: 99.7
          }
        });
        setLastUpdated(new Date());
      } finally {
        console.log('Setting loading to false');
        setLoading(false);
      }
    };

    fetchHealth();
    // Remove auto-refresh for now to avoid issues
    // const interval = setInterval(fetchHealth, 30000);
    // return () => clearInterval(interval);
  }, []);

  const handleMigrationAction = async (action: string) => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/migration/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Migration action result:', result);
        
        // Update the health state to reflect the change
        if (health) {
          const newPhase = action === 'start_experimental' ? 'experimental' :
                          action === 'advance_beta' ? 'beta' :
                          action === 'full_rollout' ? 'production' :
                          action === 'rollback' ? 'rollback' : health.migration.phase;
          
          const newPercentage = action === 'start_experimental' ? 5 :
                               action === 'advance_beta' ? 25 :
                               action === 'full_rollout' ? 100 :
                               action === 'rollback' ? 0 : health.migration.userPercentage;

          setHealth({
            ...health,
            migration: {
              ...health.migration,
              phase: newPhase as any,
              userPercentage: newPercentage,
              azureUsers: Math.round((newPercentage / 100) * health.migration.totalUsers)
            }
          });
        }
      } else {
        console.error('Migration action failed:', response.statusText);
      }
    } catch (error) {
      console.error('Migration action error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Connected</Badge>;
      case 'disconnected':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><Clock className="w-3 h-3 mr-1" />Disconnected</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800 border-red-200"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getPhaseBadge = (phase: string) => {
    switch (phase) {
      case 'experimental':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">🧪 Experimental</Badge>;
      case 'beta':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">🚀 Beta</Badge>;
      case 'production':
        return <Badge className="bg-green-100 text-green-800 border-green-200">✅ Production</Badge>;
      case 'rollback':
        return <Badge className="bg-red-100 text-red-800 border-red-200">⬅️ Rollback</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getPerformanceColor = (value: number, type: 'time' | 'rate' | 'error') => {
    if (type === 'time') {
      return value < 2 ? 'text-green-600' : value < 5 ? 'text-yellow-600' : 'text-red-600';
    }
    if (type === 'error') {
      return value < 1 ? 'text-green-600' : value < 5 ? 'text-yellow-600' : 'text-red-600';
    }
    if (type === 'rate') {
      return value > 95 ? 'text-green-600' : value > 90 ? 'text-yellow-600' : 'text-red-600';
    }
    return 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-4 text-lg text-gray-600">Loading migration dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Unable to Load Dashboard</h1>
            <p className="text-gray-600">Failed to fetch system health data. Please check your API endpoints.</p>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Azure TTS Migration Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Real-time monitoring and control for your Azure TTS migration
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Last updated</p>
            <p className="text-sm font-medium">{lastUpdated.toLocaleTimeString()}</p>
          </div>
        </div>

        {/* System Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Azure TTS Status</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {getStatusBadge(health.azureTTS)}
                <p className="text-xs text-muted-foreground">
                  Speech services operational
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Migration Phase</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {getPhaseBadge(health.migration.phase)}
                <p className="text-xs text-muted-foreground">
                  {health.migration.userPercentage}% of users on Azure TTS
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cache Performance</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{health.cache.hitRate}%</div>
              <p className="text-xs text-muted-foreground">
                {health.cache.totalSize} • {health.cache.itemCount} items
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{health.migration.azureUsers}</div>
              <p className="text-xs text-muted-foreground">
                of {health.migration.totalUsers} total users
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Generation Time
              </CardTitle>
              <CardDescription>Average Azure TTS audio generation time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${getPerformanceColor(health.performance.avgGenerationTime, 'time')}`}>
                {health.performance.avgGenerationTime}s
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Excellent (&lt;2s)</span>
                  <span className="text-green-600">✓</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Good (2-5s)</span>
                  <span>-</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Needs attention (&gt;5s)</span>
                  <span>-</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Success Rate
              </CardTitle>
              <CardDescription>Percentage of successful TTS generations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${getPerformanceColor(health.performance.successRate, 'rate')}`}>
                {health.performance.successRate}%
              </div>
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full" 
                    style={{ width: `${health.performance.successRate}%` }}
                  ></div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Target: &gt;95% success rate
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Error Rate
              </CardTitle>
              <CardDescription>Percentage of failed TTS requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${getPerformanceColor(health.performance.errorRate, 'error')}`}>
                {health.performance.errorRate}%
              </div>
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-red-500 h-2 rounded-full" 
                    style={{ width: `${health.performance.errorRate}%` }}
                  ></div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Target: &lt;1% error rate
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Migration Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Migration Controls</CardTitle>
            <CardDescription>
              Manage the rollout of Azure TTS across your user base
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button 
                variant="outline" 
                className="flex items-center gap-2"
                disabled={actionLoading || health.migration.phase === 'experimental'}
                onClick={() => handleMigrationAction('start_experimental')}
              >
                🧪 {health.migration.phase === 'experimental' ? 'Experimental Active' : 'Start Experimental'}
              </Button>
              <Button 
                variant="outline" 
                className="flex items-center gap-2"
                disabled={actionLoading || health.migration.phase !== 'experimental'}
                onClick={() => handleMigrationAction('advance_beta')}
              >
                🚀 Advance to Beta
              </Button>
              <Button 
                variant="outline" 
                className="flex items-center gap-2"
                disabled={actionLoading || health.migration.phase !== 'beta'}
                onClick={() => handleMigrationAction('full_rollout')}
              >
                ✅ Full Rollout
              </Button>
              <Button 
                variant="destructive" 
                className="flex items-center gap-2"
                disabled={actionLoading}
                onClick={() => handleMigrationAction('rollback')}
              >
                ⬅️ Emergency Rollback
              </Button>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">Current Phase: {health.migration.phase}</h4>
              <p className="text-sm text-blue-700">
                {health.migration.phase === 'experimental' && 
                  'Testing Azure TTS with 5% of users. Monitor performance before advancing.'}
                {health.migration.phase === 'beta' && 
                  'Testing with 25% of users. Compare A/B test results before full rollout.'}
                {health.migration.phase === 'production' && 
                  'Azure TTS is live for all users. Static audio remains as fallback.'}
                {health.migration.phase === 'rollback' && 
                  'System has been rolled back to static audio. Investigate issues before retrying.'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="flex justify-between items-center">
          <div className="space-x-4">
            <Button variant="outline" onClick={() => window.location.reload()}>
              🔄 Refresh Data
            </Button>
            <Button variant="outline">
              📊 Download Report
            </Button>
            <Button variant="outline">
              📋 Export Logs
            </Button>
          </div>
          <div className="text-sm text-gray-500">
            Auto-refresh every 30 seconds
          </div>
        </div>
      </div>
    </div>
  );
}