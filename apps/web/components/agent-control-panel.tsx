'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import {
  Bot,
  Play,
  Pause,
  Settings,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  FileText,
  AlertCircle,
  Activity,
  Loader2,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react'

interface Agent {
  name: string
  description: string
  enabled: boolean
  status: string
  pending_tasks: number
}

interface AgentTask {
  _id: string
  task_type: string
  target_id: string
  status: string
  triggered_at: string
  completed_at?: string
  error?: string
  result?: any
}

interface AgentConfig {
  auto_send_reminders: boolean
  reminder_hours_before: number[]
  auto_send_surveys: boolean
  survey_hours_before: number
  auto_followup: boolean
  followup_days_after: number
  auto_triage: boolean
}

export function AgentControlPanel() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [config, setConfig] = useState<AgentConfig | null>(null)
  const [logs, setLogs] = useState<AgentTask[]>([])
  const [loading, setLoading] = useState(true)
  const [configExpanded, setConfigExpanded] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [triggeringTask, setTriggeringTask] = useState<string | null>(null)

  const fetchAgentStatus = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.get('/admin/agents/status')
      setAgents(response.data.agents)
      setConfig(response.data.config)
      setLogs(response.data.recent_activity || [])
    } catch (error) {
      console.error('Error fetching agent status:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAgentStatus()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAgentStatus, 30000)
    return () => clearInterval(interval)
  }, [fetchAgentStatus])

  const saveConfig = async () => {
    if (!config) return
    
    setSavingConfig(true)
    try {
      await api.put('/admin/agents/config', {
        agent_name: 'all',
        enabled: true,
        ...config,
      })
      await fetchAgentStatus()
    } catch (error) {
      console.error('Error saving config:', error)
    } finally {
      setSavingConfig(false)
    }
  }

  const triggerTask = async (taskType: string, targetId: string = 'manual') => {
    setTriggeringTask(taskType)
    try {
      await api.post('/admin/agents/trigger', {
        task_type: taskType,
        target_id: targetId,
      })
      await fetchAgentStatus()
    } catch (error) {
      console.error('Error triggering task:', error)
    } finally {
      setTriggeringTask(null)
    }
  }

  const getAgentIcon = (name: string) => {
    switch (name) {
      case 'Reminder Agent':
        return <Clock className="w-5 h-5" />
      case 'Survey Agent':
        return <FileText className="w-5 h-5" />
      case 'Follow-up Agent':
        return <Mail className="w-5 h-5" />
      case 'Triage Agent':
        return <AlertCircle className="w-5 h-5" />
      default:
        return <Bot className="w-5 h-5" />
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
      case 'pending':
      case 'scheduled':
        return <Clock className="w-4 h-4 text-yellow-400" />
      default:
        return <Clock className="w-4 h-4 text-slate-400" />
    }
  }

  const getTaskTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      send_reminder: '📧 Send Reminder',
      send_survey: '📋 Send Survey',
      schedule_followup: '📅 Schedule Follow-up',
      auto_triage: '🔍 Auto Triage',
    }
    return labels[type] || type
  }

  if (loading) {
    return (
      <Card className="bg-slate-800/80 border-slate-600">
        <CardContent className="py-12 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          Loading AI Agents...
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Agent Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {agents.map((agent) => (
          <Card
            key={agent.name}
            className={`bg-slate-800/80 border-slate-600 ${
              agent.enabled ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-slate-500'
            }`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`p-2 rounded-lg ${agent.enabled ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                    {getAgentIcon(agent.name)}
                  </div>
                  <div>
                    <CardTitle className="text-sm text-white">{agent.name}</CardTitle>
                    <span className={`text-xs ${agent.enabled ? 'text-green-400' : 'text-slate-500'}`}>
                      {agent.status}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400 mb-3">{agent.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">
                  <span className="font-bold text-lg">{agent.pending_tasks}</span> pending
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => triggerTask(agent.name.toLowerCase().replace(' agent', '').replace('-', '_'))}
                  disabled={!agent.enabled || triggeringTask !== null}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs"
                >
                  {triggeringTask === agent.name ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Configuration Section */}
      <Card className="bg-slate-800/80 border-slate-600">
        <CardHeader
          className="cursor-pointer"
          onClick={() => setConfigExpanded(!configExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Settings className="w-5 h-5 text-blue-400" />
              <CardTitle className="text-white">Agent Configuration</CardTitle>
            </div>
            {configExpanded ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <CardDescription className="text-slate-300">
            Configure autonomous agent behavior and timing
          </CardDescription>
        </CardHeader>
        {configExpanded && config && (
          <CardContent className="space-y-6">
            {/* Reminder Settings */}
            <div className="p-4 bg-slate-700/50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="font-medium text-white">Appointment Reminders</span>
                </div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.auto_send_reminders}
                    onChange={(e) => setConfig({ ...config, auto_send_reminders: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-600 border-slate-500"
                  />
                  <span className="text-sm text-slate-300">Enabled</span>
                </label>
              </div>
              <p className="text-sm text-slate-400 mb-3">
                Send reminder emails at configured intervals before appointments
              </p>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Reminder hours before appointment</label>
                <Input
                  value={config.reminder_hours_before.join(', ')}
                  onChange={(e) => setConfig({
                    ...config,
                    reminder_hours_before: e.target.value.split(',').map(h => parseInt(h.trim())).filter(n => !isNaN(n))
                  })}
                  placeholder="48, 24, 2"
                  className="bg-slate-600 border-slate-500 text-white"
                />
              </div>
            </div>

            {/* Survey Settings */}
            <div className="p-4 bg-slate-700/50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <span className="font-medium text-white">Pre-Check-in Surveys</span>
                </div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.auto_send_surveys}
                    onChange={(e) => setConfig({ ...config, auto_send_surveys: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-600 border-slate-500"
                  />
                  <span className="text-sm text-slate-300">Enabled</span>
                </label>
              </div>
              <p className="text-sm text-slate-400 mb-3">
                Automatically send pre-consultation surveys with AI-generated questions
              </p>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Hours before appointment</label>
                <Input
                  type="number"
                  value={config.survey_hours_before}
                  onChange={(e) => setConfig({ ...config, survey_hours_before: parseInt(e.target.value) || 48 })}
                  className="bg-slate-600 border-slate-500 text-white w-32"
                />
              </div>
            </div>

            {/* Follow-up Settings */}
            <div className="p-4 bg-slate-700/50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-green-400" />
                  <span className="font-medium text-white">Post-Visit Follow-ups</span>
                </div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.auto_followup}
                    onChange={(e) => setConfig({ ...config, auto_followup: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-600 border-slate-500"
                  />
                  <span className="text-sm text-slate-300">Enabled</span>
                </label>
              </div>
              <p className="text-sm text-slate-400 mb-3">
                Schedule automatic follow-up communications after completed visits
              </p>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Days after visit</label>
                <Input
                  type="number"
                  value={config.followup_days_after}
                  onChange={(e) => setConfig({ ...config, followup_days_after: parseInt(e.target.value) || 7 })}
                  className="bg-slate-600 border-slate-500 text-white w-32"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                onClick={saveConfig}
                disabled={savingConfig}
                className="bg-blue-600 hover:bg-blue-500"
              >
                {savingConfig ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Save Configuration
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Activity Log */}
      <Card className="bg-slate-800/80 border-slate-600">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-blue-400" />
              <CardTitle className="text-white">Agent Activity Log</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAgentStatus}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <CardDescription className="text-slate-300">
            Recent autonomous agent actions and their results
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No agent activity yet</p>
              <p className="text-sm mt-1">Tasks will appear here as agents execute them</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log._id}
                  className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(log.status)}
                    <div>
                      <div className="text-sm font-medium text-white">
                        {getTaskTypeLabel(log.task_type)}
                      </div>
                      <div className="text-xs text-slate-400">
                        Target: {log.target_id}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-medium ${
                      log.status === 'completed' ? 'text-green-400' :
                      log.status === 'failed' ? 'text-red-400' :
                      log.status === 'running' ? 'text-blue-400' :
                      'text-yellow-400'
                    }`}>
                      {log.status.toUpperCase()}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(log.triggered_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border-blue-700/50">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <CardTitle className="text-white">Quick Agent Actions</CardTitle>
          </div>
          <CardDescription className="text-slate-300">
            Manually trigger agent tasks for testing or immediate execution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => triggerTask('send_reminder', 'test_appointment')}
              disabled={triggeringTask !== null}
              className="bg-blue-600 hover:bg-blue-500"
            >
              <Mail className="w-4 h-4 mr-2" />
              Test Reminder Email
            </Button>
            <Button
              onClick={() => triggerTask('send_survey', 'test_appointment')}
              disabled={triggeringTask !== null}
              className="bg-purple-600 hover:bg-purple-500"
            >
              <FileText className="w-4 h-4 mr-2" />
              Test Survey Email
            </Button>
            <Button
              onClick={() => triggerTask('auto_triage', 'test_case')}
              disabled={triggeringTask !== null}
              className="bg-orange-600 hover:bg-orange-500"
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              Test Auto Triage
            </Button>
            <Button
              onClick={() => triggerTask('schedule_followup', 'test_visit')}
              disabled={triggeringTask !== null}
              className="bg-green-600 hover:bg-green-500"
            >
              <Clock className="w-4 h-4 mr-2" />
              Test Follow-up
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AgentControlPanel
