'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/store'
import { doctorAPI, triageAPI, Visit, DashboardStats } from '@/lib/api'
import { useWebSocket } from '@/lib/useWebSocket'
import { AIChatInterface } from '@/components/ai-chat-interface'
import { AgentCoordinationPanel } from '@/components/agent-coordination-panel'
import { UrgentCaseList } from '@/components/urgent-case-card'
import { NotificationCenter, ToastContainer, Toast } from '@/components/notification-center'
import { AnalyticsDashboard } from '@/components/analytics-dashboard'
import { 
  AlertCircle, Clock, Users, Activity, Eye, RefreshCw, 
  Plus, Settings, Bell, Search, Menu, X, Brain, Mic,
  TrendingUp, FileText, Stethoscope, MessageSquare
} from 'lucide-react'

interface UrgentCase {
  id: string;
  patient_name: string;
  age?: number;
  gender?: string;
  symptoms: string[];
  severity_score: 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: string;
  vitals?: any;
  ai_assessment?: string;
  recommended_action?: string;
  status: 'pending' | 'in_progress' | 'seen' | 'resolved';
}

interface Notification {
  id: string;
  type: 'urgent' | 'info' | 'success' | 'warning';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  caseId?: string;
}

export default function DoctorDashboardEnhanced() {
  const router = useRouter()
  const { user, clearAuth } = useAuthStore()
  
  const [activeTab, setActiveTab] = useState<'overview' | 'cases' | 'analytics' | 'ai-assistant'>('overview')
  const [urgentCases, setUrgentCases] = useState<UrgentCase[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    total_visits_today: 0,
    pending_reviews: 0,
    critical_alerts: 0,
    completed_today: 0
  })
  const [loading, setLoading] = useState(true)
  const [showAgentPanel, setShowAgentPanel] = useState(true)
  const [showChat, setShowChat] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  
  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'urgent',
      title: 'Critical Case Alert',
      message: 'Patient Amit Singh requires immediate attention - severe chest pain',
      timestamp: new Date(Date.now() - 5 * 60000),
      read: false,
      caseId: 'case-001'
    },
    {
      id: '2',
      type: 'info',
      title: 'New Triage Completed',
      message: 'AI agent completed triage for 3 new patients',
      timestamp: new Date(Date.now() - 15 * 60000),
      read: false
    },
    {
      id: '3',
      type: 'success',
      title: 'watsonx Analysis Complete',
      message: 'NLU processing finished for batch of 12 cases',
      timestamp: new Date(Date.now() - 30 * 60000),
      read: true
    }
  ])

  const [toasts, setToasts] = useState<Array<{id: string; type: any; title: string; message: string}>>([])

  // WebSocket for real-time updates
  const { isConnected } = useWebSocket({
    onVisitUpdate: (visitId, status, data) => {
      console.log('Visit update:', visitId, status)
      fetchData()
      addToast('info', 'Case Updated', `Visit ${visitId} status changed to ${status}`)
    },
    onRedFlagAlert: (visitId, redFlags) => {
      console.log('Red flag alert:', visitId, redFlags)
      addNotification('urgent', 'Red Flag Alert', `Critical findings detected for visit ${visitId}`)
      addToast('urgent', '🚨 Red Flag Alert', `Critical case requires immediate attention`)
      fetchData()
    }
  })

  useEffect(() => {
    if (!user || (user.role !== 'doctor' && user.role !== 'admin')) {
      router.push('/login')
      return
    }
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    
    fetchData()
    
    // Poll for updates every 15 seconds
    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
  }, [user, router])

  const fetchData = async () => {
    try {
      const [visitsData, statsData, urgentData] = await Promise.all([
        doctorAPI.getDashboardVisits(),
        doctorAPI.getDashboardStats(),
        triageAPI.getUrgentCases().catch(() => ({ cases: [] }))
      ])
      
      setVisits(visitsData)
      setStats(statsData)
      
      // Transform urgent cases
      if (urgentData.cases) {
        const transformedCases = urgentData.cases.map((c: any) => ({
          id: c.id || c._id,
          patient_name: c.patient_name || 'Unknown Patient',
          age: c.patient_age,
          gender: c.patient_gender,
          symptoms: c.symptoms || [],
          severity_score: c.severity_score || 'MEDIUM',
          timestamp: c.timestamp || c.created_at || new Date().toISOString(),
          vitals: c.vitals,
          ai_assessment: c.ai_assessment || c.analysis?.summary,
          recommended_action: c.recommended_action || c.analysis?.recommended_action,
          status: c.status || 'pending'
        }))
        setUrgentCases(transformedCases)
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      setLoading(false)
    }
  }

  const addNotification = (type: Notification['type'], title: string, message: string, caseId?: string) => {
    const newNotification: Notification = {
      id: Date.now().toString(),
      type,
      title,
      message,
      timestamp: new Date(),
      read: false,
      caseId
    }
    setNotifications(prev => [newNotification, ...prev])
  }

  const addToast = (type: any, title: string, message: string) => {
    const newToast = {
      id: Date.now().toString(),
      type,
      title,
      message
    }
    setToasts(prev => [...prev, newToast])
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const handleMarkSeen = async (caseId: string) => {
    try {
      await triageAPI.markCaseSeen(caseId)
      setUrgentCases(prev => 
        prev.map(c => c.id === caseId ? { ...c, status: 'seen' as const } : c)
      )
      addToast('success', 'Case Updated', 'Case marked as seen successfully')
    } catch (error) {
      console.error('Error marking case seen:', error)
      addToast('error', 'Error', 'Failed to update case status')
    }
  }

  const handleLogout = () => {
    clearAuth()
    router.push('/login')
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-gray-900 border-b border-gray-800 z-50">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5 text-gray-400" />
            </button>
            
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Nidaan.ai</h1>
                <p className="text-xs text-gray-500">Agentic Medical Intelligence</p>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-xl mx-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search patients, cases, or ask AI..."
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs text-gray-500 bg-gray-700 rounded">⌘K</kbd>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
              isConnected ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
              {isConnected ? 'Live' : 'Offline'}
            </div>

            {/* Notifications */}
            <NotificationCenter 
              notifications={notifications}
              onMarkRead={(id) => setNotifications(prev => 
                prev.map(n => n.id === id ? { ...n, read: true } : n)
              )}
              onMarkAllRead={() => setNotifications(prev => 
                prev.map(n => ({ ...n, read: true }))
              )}
              onDismiss={(id) => setNotifications(prev => 
                prev.filter(n => n.id !== id)
              )}
            />

            {/* AI Chat Toggle */}
            <button
              onClick={() => setShowChat(!showChat)}
              className={`p-2 rounded-lg transition-colors ${
                showChat ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-400'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
            </button>

            {/* Settings */}
            <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
              <Settings className="w-5 h-5 text-gray-400" />
            </button>

            {/* User Menu */}
            <div className="flex items-center gap-3 pl-4 border-l border-gray-700">
              <div className="text-right">
                <div className="text-sm font-medium text-white">{user.name}</div>
                <div className="text-xs text-gray-500 capitalize">{user.role}</div>
              </div>
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout} className="text-gray-400 border-gray-700">
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`fixed left-0 top-16 bottom-0 w-64 bg-gray-900 border-r border-gray-800 z-40 transition-transform ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <nav className="p-4 space-y-2">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'cases', label: 'Urgent Cases', icon: AlertCircle },
            { id: 'analytics', label: 'Analytics', icon: TrendingUp },
            { id: 'ai-assistant', label: 'AI Assistant', icon: Brain },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === item.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
              {item.id === 'cases' && urgentCases.filter(c => c.severity_score === 'HIGH').length > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {urgentCases.filter(c => c.severity_score === 'HIGH').length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Agent Status */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
          <div className="text-xs text-gray-500 mb-2">AI Agents Status</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Triage Agent</span>
              <span className="flex items-center gap-1 text-green-400 text-xs">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">NLU Engine</span>
              <span className="flex items-center gap-1 text-green-400 text-xs">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Speech Agent</span>
              <span className="flex items-center gap-1 text-blue-400 text-xs">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                Standby
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`pt-16 transition-all ${sidebarOpen ? 'ml-64' : 'ml-0'} ${showChat ? 'mr-96' : 'mr-0'}`}>
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-gray-900 border-gray-800">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400">Today's Cases</p>
                        <p className="text-3xl font-bold text-white">{stats.total_visits_today || urgentCases.length}</p>
                      </div>
                      <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <Users className="w-6 h-6 text-blue-400" />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center text-sm text-green-400">
                      <TrendingUp className="w-4 h-4 mr-1" />
                      +12% from yesterday
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-900 border-gray-800">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400">High Priority</p>
                        <p className="text-3xl font-bold text-red-400">
                          {urgentCases.filter(c => c.severity_score === 'HIGH').length}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center">
                        <AlertCircle className="w-6 h-6 text-red-400" />
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-gray-400">
                      Requires immediate attention
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-900 border-gray-800">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400">Pending Review</p>
                        <p className="text-3xl font-bold text-yellow-400">
                          {urgentCases.filter(c => c.status === 'pending').length}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                        <Clock className="w-6 h-6 text-yellow-400" />
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-gray-400">
                      Awaiting your review
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-900 border-gray-800">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400">AI Accuracy</p>
                        <p className="text-3xl font-bold text-green-400">97.8%</p>
                      </div>
                      <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                        <Brain className="w-6 h-6 text-green-400" />
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-gray-400">
                      Watson NLU + STT combined
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Agent Coordination Panel */}
              {showAgentPanel && (
                <AgentCoordinationPanel 
                  className="mb-6"
                  onClose={() => setShowAgentPanel(false)}
                />
              )}

              {/* Urgent Cases Preview */}
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      </span>
                      Urgent Cases Requiring Attention
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Real-time triage data from AI agents
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={fetchData}
                      className="border-gray-700 text-gray-400"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => setActiveTab('cases')}
                      className="bg-blue-600 hover:bg-blue-500"
                    >
                      View All Cases
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <UrgentCaseList 
                    cases={urgentCases.slice(0, 3)}
                    onMarkSeen={handleMarkSeen}
                    isLoading={loading}
                  />
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { time: '2 min ago', action: 'AI Triage completed', patient: 'Meera Patel', type: 'success' },
                      { time: '5 min ago', action: 'Voice intake processed', patient: 'Amit Singh', type: 'info' },
                      { time: '8 min ago', action: 'Red flag detected', patient: 'Rajesh Kumar', type: 'warning' },
                      { time: '12 min ago', action: 'Case marked as seen', patient: 'Priya Sharma', type: 'success' },
                    ].map((activity, idx) => (
                      <div key={idx} className="flex items-center gap-4 p-3 bg-gray-800 rounded-lg">
                        <div className={`w-2 h-2 rounded-full ${
                          activity.type === 'success' ? 'bg-green-400' :
                          activity.type === 'warning' ? 'bg-yellow-400' : 'bg-blue-400'
                        }`} />
                        <div className="flex-1">
                          <p className="text-sm text-white">{activity.action}</p>
                          <p className="text-xs text-gray-500">{activity.patient}</p>
                        </div>
                        <span className="text-xs text-gray-500">{activity.time}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Cases Tab */}
          {activeTab === 'cases' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">Urgent Cases</h2>
                  <p className="text-gray-400">All cases requiring doctor attention</p>
                </div>
                <Button onClick={fetchData} className="bg-blue-600 hover:bg-blue-500">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Cases
                </Button>
              </div>
              
              <UrgentCaseList 
                cases={urgentCases}
                onMarkSeen={handleMarkSeen}
                isLoading={loading}
              />
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <AnalyticsDashboard />
          )}

          {/* AI Assistant Tab */}
          {activeTab === 'ai-assistant' && (
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white">AI Medical Assistant</h2>
                <p className="text-gray-400">Powered by watsonx Orchestrate</p>
              </div>
              <AIChatInterface 
                className="h-[calc(100vh-240px)]"
                onToolCall={(tool, params) => {
                  console.log('Tool called:', tool, params)
                  if (tool === 'getUrgentCases') {
                    fetchData()
                  }
                }}
              />
            </div>
          )}
        </div>
      </main>

      {/* AI Chat Sidebar */}
      {showChat && (
        <aside className="fixed right-0 top-16 bottom-0 w-96 bg-gray-900 border-l border-gray-800 z-40">
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">AI Assistant</h3>
                <p className="text-xs text-gray-500">watsonx Orchestrate</p>
              </div>
              <button 
                onClick={() => setShowChat(false)}
                className="p-1 hover:bg-gray-800 rounded"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <AIChatInterface 
                compact
                onToolCall={(tool, params) => {
                  console.log('Tool called:', tool, params)
                  if (tool === 'getUrgentCases') {
                    fetchData()
                  }
                }}
              />
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}
