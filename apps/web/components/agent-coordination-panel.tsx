'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface Agent {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'idle' | 'processing' | 'error';
  lastAction?: string;
  lastActionTime?: Date;
  metrics: {
    tasksCompleted: number;
    avgResponseTime: number;
    successRate: number;
  };
}

interface AgentAction {
  id: string;
  agentId: string;
  agentName: string;
  action: string;
  input?: string;
  output?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  timestamp: Date;
  duration?: number;
}

interface AgentCoordinationPanelProps {
  className?: string;
  onClose?: () => void;
}

export function AgentCoordinationPanel({ className, onClose }: AgentCoordinationPanelProps) {
  const [agents] = useState<Agent[]>([
    {
      id: 'triage-agent',
      name: 'Triage Agent',
      description: 'Processes patient symptoms and assigns severity',
      status: 'active',
      lastAction: 'Processed patient triage case',
      lastActionTime: new Date(),
      metrics: { tasksCompleted: 47, avgResponseTime: 2.3, successRate: 98.5 }
    },
    {
      id: 'nlu-agent',
      name: 'NLU Processor',
      description: 'Extracts medical entities from text using Watson NLU',
      status: 'idle',
      lastAction: 'Extracted symptoms from transcript',
      lastActionTime: new Date(Date.now() - 120000),
      metrics: { tasksCompleted: 156, avgResponseTime: 1.8, successRate: 99.2 }
    },
    {
      id: 'alert-agent',
      name: 'Alert Coordinator',
      description: 'Sends notifications for critical cases',
      status: 'active',
      lastAction: 'Sent nurse alert for HIGH severity case',
      lastActionTime: new Date(Date.now() - 60000),
      metrics: { tasksCompleted: 23, avgResponseTime: 0.5, successRate: 100 }
    },
    {
      id: 'orchestrate-agent',
      name: 'watsonx Orchestrate',
      description: 'AI assistant for doctor queries',
      status: 'idle',
      lastAction: 'Responded to urgent cases query',
      lastActionTime: new Date(Date.now() - 300000),
      metrics: { tasksCompleted: 89, avgResponseTime: 3.2, successRate: 97.8 }
    }
  ]);

  const [recentActions, setRecentActions] = useState<AgentAction[]>([
    {
      id: '1',
      agentId: 'triage-agent',
      agentName: 'Triage Agent',
      action: 'process_triage',
      input: 'Patient: Meera Patel - Severe headache, confusion',
      output: 'Severity: HIGH, Red flags: stroke symptoms',
      status: 'completed',
      timestamp: new Date(),
      duration: 2.1
    },
    {
      id: '2',
      agentId: 'alert-agent',
      agentName: 'Alert Coordinator',
      action: 'send_nurse_alert',
      input: 'Case triage_b679dc07daf7',
      output: 'Alert sent to nurse station',
      status: 'completed',
      timestamp: new Date(Date.now() - 30000),
      duration: 0.4
    },
    {
      id: '3',
      agentId: 'nlu-agent',
      agentName: 'NLU Processor',
      action: 'extract_entities',
      input: 'Severe chest pain radiating to left arm...',
      output: 'Entities: chest pain, shortness of breath, sweating',
      status: 'completed',
      timestamp: new Date(Date.now() - 60000),
      duration: 1.6
    }
  ]);

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'processing': return 'bg-blue-500 animate-pulse';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBg = (status: Agent['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 border-green-500/30';
      case 'processing': return 'bg-blue-500/10 border-blue-500/30';
      case 'error': return 'bg-red-500/10 border-red-500/30';
      default: return 'bg-gray-500/10 border-gray-500/30';
    }
  };

  const formatTimestamp = (date: Date) => {
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return date.toLocaleTimeString();
  };

  return (
    <div className={cn("bg-gray-900 rounded-xl border border-gray-700", className)}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Agent Coordination
            </h2>
            <p className="text-sm text-gray-400 mt-1">Real-time autonomous agent activity</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              {agents.filter(a => a.status === 'active').length} Active
            </span>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="p-6">
        <h3 className="text-sm font-medium text-gray-400 mb-3">AGENTS</h3>
        <div className="grid grid-cols-2 gap-4 mb-6">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className={cn(
                "p-4 rounded-lg border transition-all",
                getStatusBg(agent.status)
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn("w-2 h-2 rounded-full", getStatusColor(agent.status))}></span>
                  <span className="font-medium text-white">{agent.name}</span>
                </div>
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded",
                  agent.status === 'active' ? 'bg-green-500/20 text-green-400' :
                  agent.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                  agent.status === 'error' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-500/20 text-gray-400'
                )}>
                  {agent.status}
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-3">{agent.description}</p>
              
              {/* Metrics */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="text-lg font-semibold text-white">{agent.metrics.tasksCompleted}</div>
                  <div className="text-xs text-gray-500">Tasks</div>
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="text-lg font-semibold text-white">{agent.metrics.avgResponseTime}s</div>
                  <div className="text-xs text-gray-500">Avg Time</div>
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="text-lg font-semibold text-white">{agent.metrics.successRate}%</div>
                  <div className="text-xs text-gray-500">Success</div>
                </div>
              </div>

              {/* Last action */}
              {agent.lastAction && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <p className="text-xs text-gray-500">
                    Last: {agent.lastAction}
                  </p>
                  <p className="text-xs text-gray-600">
                    {agent.lastActionTime && formatTimestamp(agent.lastActionTime)}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Recent Actions */}
        <h3 className="text-sm font-medium text-gray-400 mb-3">RECENT ACTIVITY</h3>
        <div className="space-y-3">
          {recentActions.map((action) => (
            <div
              key={action.id}
              className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg"
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                action.status === 'completed' ? 'bg-green-500/20' :
                action.status === 'running' ? 'bg-blue-500/20' :
                action.status === 'error' ? 'bg-red-500/20' :
                'bg-gray-500/20'
              )}>
                {action.status === 'completed' && (
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {action.status === 'running' && (
                  <svg className="w-4 h-4 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{action.agentName}</span>
                  <span className="text-xs text-gray-500">{formatTimestamp(action.timestamp)}</span>
                </div>
                <p className="text-sm text-gray-400 mt-0.5">{action.action}</p>
                {action.input && (
                  <p className="text-xs text-gray-500 mt-1 truncate">Input: {action.input}</p>
                )}
                {action.output && (
                  <p className="text-xs text-green-400 mt-0.5 truncate">→ {action.output}</p>
                )}
                {action.duration && (
                  <span className="text-xs text-gray-600">{action.duration}s</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AgentCoordinationPanel;
