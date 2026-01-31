'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface AnalyticsData {
  triageCases: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
  responseTime: {
    average: number;
    trend: 'up' | 'down' | 'stable';
  };
  accuracy: {
    nlu: number;
    stt: number;
    overall: number;
  };
  hourlyVolume: { hour: string; count: number }[];
  topSymptoms: { name: string; count: number }[];
  agentPerformance: {
    totalActions: number;
    successfulActions: number;
    avgLatency: number;
  };
}

interface AnalyticsDashboardProps {
  className?: string;
}

export function AnalyticsDashboard({ className }: AnalyticsDashboardProps) {
  const [data, setData] = useState<AnalyticsData>({
    triageCases: { total: 47, high: 12, medium: 23, low: 12 },
    responseTime: { average: 2.4, trend: 'down' },
    accuracy: { nlu: 98.5, stt: 97.2, overall: 97.8 },
    hourlyVolume: [
      { hour: '6AM', count: 3 },
      { hour: '8AM', count: 8 },
      { hour: '10AM', count: 12 },
      { hour: '12PM', count: 15 },
      { hour: '2PM', count: 11 },
      { hour: '4PM', count: 9 },
      { hour: '6PM', count: 6 },
      { hour: '8PM', count: 4 },
    ],
    topSymptoms: [
      { name: 'Chest Pain', count: 15 },
      { name: 'Shortness of Breath', count: 12 },
      { name: 'Headache', count: 10 },
      { name: 'Fever', count: 8 },
      { name: 'Dizziness', count: 6 },
    ],
    agentPerformance: {
      totalActions: 315,
      successfulActions: 308,
      avgLatency: 1.8
    }
  });

  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');

  const maxHourlyCount = Math.max(...data.hourlyVolume.map(h => h.count));
  const maxSymptomCount = Math.max(...data.topSymptoms.map(s => s.count));

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Analytics Dashboard</h2>
          <p className="text-gray-400">Real-time insights from Nidaan AI agents</p>
        </div>
        <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1">
          {(['today', 'week', 'month'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                "px-3 py-1 rounded text-sm font-medium transition-colors",
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded">+12%</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{data.triageCases.total}</div>
          <div className="text-sm text-gray-400">Total Cases</div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <span className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">Urgent</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{data.triageCases.high}</div>
          <div className="text-sm text-gray-400">High Priority</div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className={cn(
              "text-xs px-2 py-1 rounded flex items-center gap-1",
              data.responseTime.trend === 'down' ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'
            )}>
              {data.responseTime.trend === 'down' ? '↓' : '↑'} 0.3s
            </span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{data.responseTime.average}s</div>
          <div className="text-sm text-gray-400">Avg Response Time</div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{data.accuracy.overall}%</div>
          <div className="text-sm text-gray-400">AI Accuracy</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Hourly Volume Chart */}
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Case Volume by Hour</h3>
          <div className="flex items-end justify-between h-40 gap-2">
            {data.hourlyVolume.map((item, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-400"
                  style={{ height: `${(item.count / maxHourlyCount) * 100}%` }}
                />
                <span className="text-xs text-gray-500 mt-2">{item.hour}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Severity Distribution */}
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Severity Distribution</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-400">High Priority</span>
                <span className="text-sm text-red-400">{data.triageCases.high}</span>
              </div>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all"
                  style={{ width: `${(data.triageCases.high / data.triageCases.total) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-400">Medium Priority</span>
                <span className="text-sm text-yellow-400">{data.triageCases.medium}</span>
              </div>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500 rounded-full transition-all"
                  style={{ width: `${(data.triageCases.medium / data.triageCases.total) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-400">Low Priority</span>
                <span className="text-sm text-green-400">{data.triageCases.low}</span>
              </div>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${(data.triageCases.low / data.triageCases.total) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Pie chart visual */}
          <div className="mt-6 flex items-center justify-center">
            <div className="relative w-32 h-32">
              <svg viewBox="0 0 100 100" className="transform -rotate-90">
                <circle
                  cx="50" cy="50" r="40"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="20"
                  strokeDasharray={`${(data.triageCases.low / data.triageCases.total) * 251.2} 251.2`}
                />
                <circle
                  cx="50" cy="50" r="40"
                  fill="none"
                  stroke="#eab308"
                  strokeWidth="20"
                  strokeDasharray={`${(data.triageCases.medium / data.triageCases.total) * 251.2} 251.2`}
                  strokeDashoffset={`-${(data.triageCases.low / data.triageCases.total) * 251.2}`}
                />
                <circle
                  cx="50" cy="50" r="40"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="20"
                  strokeDasharray={`${(data.triageCases.high / data.triageCases.total) * 251.2} 251.2`}
                  strokeDashoffset={`-${((data.triageCases.low + data.triageCases.medium) / data.triageCases.total) * 251.2}`}
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Top Symptoms */}
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Top Symptoms</h3>
          <div className="space-y-3">
            {data.topSymptoms.map((symptom, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-sm text-gray-400 w-4">{idx + 1}.</span>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-white">{symptom.name}</span>
                    <span className="text-sm text-gray-400">{symptom.count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${(symptom.count / maxSymptomCount) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Accuracy */}
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">AI Service Accuracy</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500/20 rounded flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-400">NLU</span>
                </div>
                <span className="text-sm text-gray-400">Watson NLU</span>
              </div>
              <span className="text-lg font-semibold text-white">{data.accuracy.nlu}%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-500/20 rounded flex items-center justify-center">
                  <span className="text-xs font-bold text-purple-400">STT</span>
                </div>
                <span className="text-sm text-gray-400">Speech-to-Text</span>
              </div>
              <span className="text-lg font-semibold text-white">{data.accuracy.stt}%</span>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-gray-700">
              <span className="text-sm text-gray-400">Overall System</span>
              <span className="text-xl font-bold text-green-400">{data.accuracy.overall}%</span>
            </div>
          </div>
        </div>

        {/* Agent Performance */}
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Agent Performance</h3>
          <div className="text-center py-4">
            <div className="text-4xl font-bold text-white mb-1">{data.agentPerformance.totalActions}</div>
            <div className="text-sm text-gray-400 mb-4">Total Actions Today</div>
            
            <div className="flex justify-center gap-8">
              <div>
                <div className="text-2xl font-semibold text-green-400">
                  {Math.round((data.agentPerformance.successfulActions / data.agentPerformance.totalActions) * 100)}%
                </div>
                <div className="text-xs text-gray-500">Success Rate</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-blue-400">{data.agentPerformance.avgLatency}s</div>
                <div className="text-xs text-gray-500">Avg Latency</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsDashboard;
