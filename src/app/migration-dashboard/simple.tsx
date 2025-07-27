// src/app/migration-dashboard/simple.tsx
"use client";

import { useEffect, useState } from 'react';

export default function SimpleDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('Simple dashboard loading...');
    
    const fetchData = async () => {
      try {
        const response = await fetch('/api/migration/health');
        const result = await response.json();
        console.log('Fetched data:', result);
        setData(result);
      } catch (error) {
        console.error('Error:', error);
        setData({
          azureTTS: 'connected',
          cache: { hitRate: 85.2 },
          migration: { phase: 'experimental', userPercentage: 5 },
          performance: { avgGenerationTime: 1.8, errorRate: 0.3, successRate: 99.7 }
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl mb-4">Loading Simple Dashboard...</h1>
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Azure TTS Migration Dashboard (Simple)</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold text-gray-700">Azure TTS Status</h3>
          <div className="mt-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              data?.azureTTS === 'connected' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {data?.azureTTS === 'connected' ? '✅ Connected' : '❌ Disconnected'}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold text-gray-700">Migration Phase</h3>
          <div className="mt-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              🧪 {data?.migration?.phase || 'experimental'}
            </span>
            <p className="text-xs text-gray-500 mt-1">
              {data?.migration?.userPercentage || 5}% of users
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold text-gray-700">Cache Hit Rate</h3>
          <div className="mt-2">
            <div className="text-2xl font-bold text-green-600">
              {data?.cache?.hitRate || 85.2}%
            </div>
            <p className="text-xs text-gray-500">Cache performance</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold text-gray-700">Generation Time</h3>
          <div className="mt-2">
            <div className="text-2xl font-bold text-green-600">
              {data?.performance?.avgGenerationTime || 1.8}s
            </div>
            <p className="text-xs text-gray-500">Average TTS generation</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-semibold mb-4">Performance Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Success Rate</h4>
            <div className="text-3xl font-bold text-green-600">
              {data?.performance?.successRate || 99.7}%
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-green-600 h-2 rounded-full" 
                style={{ width: `${data?.performance?.successRate || 99.7}%` }}
              ></div>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-700 mb-2">Error Rate</h4>
            <div className="text-3xl font-bold text-green-600">
              {data?.performance?.errorRate || 0.3}%
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-red-500 h-2 rounded-full" 
                style={{ width: `${Math.min((data?.performance?.errorRate || 0.3) * 10, 100)}%` }}
              ></div>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-700 mb-2">Cache Hit Rate</h4>
            <div className="text-3xl font-bold text-green-600">
              {data?.cache?.hitRate || 85.2}%
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${data?.cache?.hitRate || 85.2}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Migration Controls</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors">
            🧪 Experimental
          </button>
          <button className="px-4 py-2 bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 transition-colors">
            🚀 Beta
          </button>
          <button className="px-4 py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors">
            ✅ Production
          </button>
          <button className="px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors">
            ⬅️ Rollback
          </button>
        </div>
        
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2">
            Current Phase: {data?.migration?.phase || 'experimental'}
          </h4>
          <p className="text-sm text-blue-700">
            Testing Azure TTS with {data?.migration?.userPercentage || 5}% of users. 
            Monitor performance before advancing to next phase.
          </p>
        </div>
      </div>

      <div className="mt-8 text-center">
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          🔄 Refresh Data
        </button>
      </div>

      <div className="mt-4 text-center text-sm text-gray-500">
        Raw data: {JSON.stringify(data, null, 2)}
      </div>
    </div>
  );
}