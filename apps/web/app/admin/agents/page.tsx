'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// API Base URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://nidaan-api.25r5a6g2yvmy.eu-de.codeengine.appdomain.cloud';

interface AgentStatus {
  status: string;
  agents: {
    symptom_analyzer: string;
    appointment_scheduler: string;
    triage_agent: string;
    followup_agent: string;
  };
  orchestrator: string;
  total_workflows_processed: number;
  pending_followups: number;
  active_workflows: number;
}

interface WorkflowHistory {
  workflow_id: string;
  appointment_id: string;
  patient_name: string;
  started_at: string;
  completed_at: string;
  stages: {
    symptom_analysis: string;
    scheduling: string;
    triage: string;
    followup: string;
  };
  final_status: string;
  urgency: string;
  department: string;
}

interface TriageItem {
  appointment_id: string;
  patient_name: string;
  symptoms: string[];
  care_level: number;
  department: string;
  urgency: string;
  needs_escalation: boolean;
  time_in_queue: string;
}

interface FollowUpItem {
  appointment_id: string;
  patient_name: string;
  scheduled_date: string;
  followup_type: string;
  urgency: string;
  overdue: boolean;
  days_overdue?: number;
}

export default function AIAgentsDashboard() {
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [workflowHistory, setWorkflowHistory] = useState<WorkflowHistory[]>([]);
  const [triageQueue, setTriageQueue] = useState<TriageItem[]>([]);
  const [pendingFollowups, setPendingFollowups] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'workflows' | 'triage' | 'followups'>('overview');

  // Get auth token
  const getToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  };

  // Fetch agent status
  const fetchAgentStatus = async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/v1/ai-agents/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAgentStatus(data);
      }
    } catch (err) {
      console.error('Error fetching agent status:', err);
    }
  };

  // Fetch workflow history
  const fetchWorkflowHistory = async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/v1/ai-agents/history`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setWorkflowHistory(data.workflows || []);
      }
    } catch (err) {
      console.error('Error fetching workflow history:', err);
    }
  };

  // Fetch triage queue
  const fetchTriageQueue = async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/v1/ai-agents/triage-queue`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setTriageQueue(data.queue || []);
      }
    } catch (err) {
      console.error('Error fetching triage queue:', err);
    }
  };

  // Fetch pending followups
  const fetchPendingFollowups = async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/v1/ai-agents/pending-followups`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setPendingFollowups(data.followups || []);
      }
    } catch (err) {
      console.error('Error fetching pending followups:', err);
    }
  };

  // Load all data
  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchAgentStatus(),
        fetchWorkflowHistory(),
        fetchTriageQueue(),
        fetchPendingFollowups()
      ]);
    } catch (err) {
      setError('Failed to load AI agent data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadAllData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'completed':
      case 'ready':
        return 'text-green-600 bg-green-100';
      case 'pending':
      case 'processing':
        return 'text-yellow-600 bg-yellow-100';
      case 'error':
      case 'failed':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // Get urgency color
  const getUrgencyColor = (urgency: string) => {
    switch (urgency.toLowerCase()) {
      case 'critical':
        return 'text-red-700 bg-red-200';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // Get care level color
  const getCareLevelColor = (level: number) => {
    switch (level) {
      case 1:
        return 'text-red-700 bg-red-200';
      case 2:
        return 'text-orange-600 bg-orange-100';
      case 3:
        return 'text-yellow-600 bg-yellow-100';
      case 4:
        return 'text-blue-600 bg-blue-100';
      case 5:
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading AI Agents Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              🤖 AI Agents Dashboard
            </h1>
            <p className="text-purple-200 text-sm">watsonx.ai Powered Automation</p>
          </div>
          <div className="flex gap-4">
            <Button 
              onClick={loadAllData}
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              🔄 Refresh
            </Button>
            <a href="/admin/dashboard">
              <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                ← Back to Admin
              </Button>
            </a>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Agent Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Symptom Analyzer</p>
                  <p className="text-2xl font-bold">🔬</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(agentStatus?.agents?.symptom_analyzer || 'unknown')}`}>
                  {agentStatus?.agents?.symptom_analyzer || 'Unknown'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">Analyzes symptoms & determines urgency</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Scheduler</p>
                  <p className="text-2xl font-bold">📅</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(agentStatus?.agents?.appointment_scheduler || 'unknown')}`}>
                  {agentStatus?.agents?.appointment_scheduler || 'Unknown'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">Auto-schedules appointments by urgency</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Triage Agent</p>
                  <p className="text-2xl font-bold">🏥</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(agentStatus?.agents?.triage_agent || 'unknown')}`}>
                  {agentStatus?.agents?.triage_agent || 'Unknown'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">Routes patients to departments</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Follow-up Agent</p>
                  <p className="text-2xl font-bold">📋</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(agentStatus?.agents?.followup_agent || 'unknown')}`}>
                  {agentStatus?.agents?.followup_agent || 'Unknown'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">Creates follow-up & care plans</p>
            </CardContent>
          </Card>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-purple-600">{agentStatus?.total_workflows_processed || 0}</p>
              <p className="text-sm text-gray-500">Total Workflows</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{agentStatus?.active_workflows || 0}</p>
              <p className="text-sm text-gray-500">Active Workflows</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-orange-600">{triageQueue.length}</p>
              <p className="text-sm text-gray-500">In Triage Queue</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{pendingFollowups.length}</p>
              <p className="text-sm text-gray-500">Pending Follow-ups</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {['overview', 'workflows', 'triage', 'followups'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab === 'overview' && '📊 Overview'}
              {tab === 'workflows' && '🔄 Workflows'}
              {tab === 'triage' && '🏥 Triage Queue'}
              {tab === 'followups' && '📋 Follow-ups'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* How It Works */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🧠 How AI Agents Work
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold">1</div>
                    <div>
                      <p className="font-medium">Patient Submits Symptoms</p>
                      <p className="text-sm text-gray-500">Patient describes symptoms via chat or appointment form</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-green-100 text-green-600 rounded-full w-8 h-8 flex items-center justify-center font-bold">2</div>
                    <div>
                      <p className="font-medium">Symptom Analyzer</p>
                      <p className="text-sm text-gray-500">AI analyzes symptoms, determines urgency & possible conditions</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-orange-100 text-orange-600 rounded-full w-8 h-8 flex items-center justify-center font-bold">3</div>
                    <div>
                      <p className="font-medium">Auto-Scheduling</p>
                      <p className="text-sm text-gray-500">Based on urgency, appointment is scheduled with right doctor</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-purple-100 text-purple-600 rounded-full w-8 h-8 flex items-center justify-center font-bold">4</div>
                    <div>
                      <p className="font-medium">Triage & Follow-up</p>
                      <p className="text-sm text-gray-500">Patient routed to department, follow-up plan created</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Orchestrator Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  ⚡ Orchestrator Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Orchestrator</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(agentStatus?.orchestrator || 'unknown')}`}>
                      {agentStatus?.orchestrator || 'Unknown'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-green-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-600">✓</p>
                      <p className="text-sm text-gray-600">Automated Processing</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-600">24/7</p>
                      <p className="text-sm text-gray-600">Always Available</p>
                    </div>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <p className="text-sm text-purple-600 font-medium">Powered by watsonx.ai</p>
                    <p className="text-xs text-gray-500 mt-1">Enterprise-grade AI for healthcare automation</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'workflows' && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Workflow History</CardTitle>
            </CardHeader>
            <CardContent>
              {workflowHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-4xl mb-2">📭</p>
                  <p>No workflows processed yet</p>
                  <p className="text-sm">Workflows appear when patients submit appointments</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-3 text-left text-sm font-medium text-gray-600">Workflow ID</th>
                        <th className="p-3 text-left text-sm font-medium text-gray-600">Patient</th>
                        <th className="p-3 text-left text-sm font-medium text-gray-600">Urgency</th>
                        <th className="p-3 text-left text-sm font-medium text-gray-600">Department</th>
                        <th className="p-3 text-left text-sm font-medium text-gray-600">Stages</th>
                        <th className="p-3 text-left text-sm font-medium text-gray-600">Status</th>
                        <th className="p-3 text-left text-sm font-medium text-gray-600">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {workflowHistory.map((workflow) => (
                        <tr key={workflow.workflow_id} className="hover:bg-gray-50">
                          <td className="p-3 text-sm font-mono">{workflow.workflow_id.slice(0, 12)}...</td>
                          <td className="p-3 text-sm">{workflow.patient_name}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getUrgencyColor(workflow.urgency)}`}>
                              {workflow.urgency}
                            </span>
                          </td>
                          <td className="p-3 text-sm">{workflow.department}</td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              <span className={`w-2 h-2 rounded-full ${workflow.stages.symptom_analysis === 'completed' ? 'bg-green-500' : 'bg-gray-300'}`} title="Analysis"></span>
                              <span className={`w-2 h-2 rounded-full ${workflow.stages.scheduling === 'completed' ? 'bg-green-500' : 'bg-gray-300'}`} title="Scheduling"></span>
                              <span className={`w-2 h-2 rounded-full ${workflow.stages.triage === 'completed' ? 'bg-green-500' : 'bg-gray-300'}`} title="Triage"></span>
                              <span className={`w-2 h-2 rounded-full ${workflow.stages.followup === 'completed' ? 'bg-green-500' : 'bg-gray-300'}`} title="Follow-up"></span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(workflow.final_status)}`}>
                              {workflow.final_status}
                            </span>
                          </td>
                          <td className="p-3 text-sm text-gray-500">
                            {new Date(workflow.started_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'triage' && (
          <Card>
            <CardHeader>
              <CardTitle>🏥 Triage Queue</CardTitle>
            </CardHeader>
            <CardContent>
              {triageQueue.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-4xl mb-2">✓</p>
                  <p>Triage queue is empty</p>
                  <p className="text-sm">All patients have been processed</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {triageQueue.map((item) => (
                    <div key={item.appointment_id} className={`p-4 rounded-lg border ${item.needs_escalation ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium">{item.patient_name}</p>
                          <p className="text-sm text-gray-500">ID: {item.appointment_id}</p>
                        </div>
                        <div className="flex gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getCareLevelColor(item.care_level)}`}>
                            Level {item.care_level}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getUrgencyColor(item.urgency)}`}>
                            {item.urgency}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {item.symptoms.map((symptom, idx) => (
                          <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                            {symptom}
                          </span>
                        ))}
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Department: <strong>{item.department}</strong></span>
                        <span className="text-gray-500">Time in queue: {item.time_in_queue}</span>
                        {item.needs_escalation && (
                          <span className="text-red-600 font-medium">⚠️ Needs Escalation</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'followups' && (
          <Card>
            <CardHeader>
              <CardTitle>📋 Pending Follow-ups</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingFollowups.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-4xl mb-2">✓</p>
                  <p>No pending follow-ups</p>
                  <p className="text-sm">Follow-ups will appear after appointments are processed</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-3 text-left text-sm font-medium text-gray-600">Patient</th>
                        <th className="p-3 text-left text-sm font-medium text-gray-600">Follow-up Type</th>
                        <th className="p-3 text-left text-sm font-medium text-gray-600">Scheduled Date</th>
                        <th className="p-3 text-left text-sm font-medium text-gray-600">Urgency</th>
                        <th className="p-3 text-left text-sm font-medium text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pendingFollowups.map((item) => (
                        <tr key={item.appointment_id} className={item.overdue ? 'bg-red-50' : ''}>
                          <td className="p-3 text-sm font-medium">{item.patient_name}</td>
                          <td className="p-3 text-sm">{item.followup_type}</td>
                          <td className="p-3 text-sm">{new Date(item.scheduled_date).toLocaleDateString()}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getUrgencyColor(item.urgency)}`}>
                              {item.urgency}
                            </span>
                          </td>
                          <td className="p-3">
                            {item.overdue ? (
                              <span className="text-red-600 font-medium">
                                ⚠️ Overdue ({item.days_overdue} days)
                              </span>
                            ) : (
                              <span className="text-green-600">Scheduled</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
