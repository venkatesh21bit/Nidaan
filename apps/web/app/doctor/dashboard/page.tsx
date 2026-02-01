'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/lib/store'
import { doctorAPI, Visit, DashboardStats } from '@/lib/api'
import { useWebSocket } from '@/lib/useWebSocket'
import { AIAgentChat } from '@/components/ai-agent-chat'
import { AlertCircle, Clock, Users, Activity, Eye, RefreshCw, Wifi, WifiOff } from 'lucide-react'

export default function DoctorDashboard() {
  const router = useRouter()
  const { user, clearAuth } = useAuthStore()
  
  const [visits, setVisits] = useState<Visit[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    total_visits_today: 0,
    pending_reviews: 0,
    critical_alerts: 0,
    completed_today: 0
  })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  // WebSocket for real-time updates
  const { isConnected } = useWebSocket({
    onVisitUpdate: (visitId, status, data) => {
      console.log('Visit update:', visitId, status)
      // Refresh data when a visit is updated
      fetchData()
    },
    onRedFlagAlert: (visitId, redFlags) => {
      console.log('Red flag alert:', visitId, redFlags)
      // Show notification for red flags
      if (Notification.permission === 'granted') {
        new Notification('🚨 Red Flag Alert', {
          body: `Visit ${visitId} has critical findings: ${redFlags?.severity}`,
          icon: '/favicon.ico'
        })
      }
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
    
    // Poll for updates every 10 seconds (backup for WebSocket)
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [user, router, filter])

  const fetchData = async () => {
    try {
      const [visitsData, statsData] = await Promise.all([
        doctorAPI.getDashboardVisits(filter !== 'all' ? filter : undefined),
        doctorAPI.getDashboardStats(),
      ])
      
      setVisits(visitsData)
      setStats(statsData)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      setLoading(false)
    }
  }

  const handleLogout = () => {
    clearAuth()
    router.push('/login')
  }

  const getRiskBadge = (riskLevel?: string) => {
    const colors = {
      CRITICAL: 'bg-red-900/50 text-red-300 border-red-700',
      HIGH: 'bg-orange-900/50 text-orange-300 border-orange-700',
      MODERATE: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
      LOW: 'bg-green-900/50 text-green-300 border-green-700',
    }
    
    const level = riskLevel || 'LOW'
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded border ${colors[level as keyof typeof colors] || colors.LOW}`}>
        {level}
      </span>
    )
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      PENDING: 'bg-slate-700 text-slate-200',
      PROCESSING: 'bg-blue-900/50 text-blue-300',
      TRANSCRIBING: 'bg-purple-900/50 text-purple-300',
      ANALYZING: 'bg-indigo-900/50 text-indigo-300',
      COMPLETED: 'bg-green-900/50 text-green-300',
      FAILED: 'bg-red-900/50 text-red-300',
    }
    
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded ${colors[status as keyof typeof colors] || colors.PENDING}`}>
        {status}
      </span>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <nav className="border-b border-slate-700 bg-slate-800 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <div className="text-2xl font-bold text-blue-400">Nidaan.ai</div>
            <div className="flex items-center space-x-2 text-sm text-slate-400">
              <span>Doctor Dashboard</span>
              {isConnected ? (
                <span className="flex items-center text-green-400">
                  <Wifi size={14} className="mr-1" />
                  Live
                </span>
              ) : (
                <span className="flex items-center text-slate-500">
                  <WifiOff size={14} className="mr-1" />
                  Offline
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="border-slate-600 text-slate-200 hover:bg-slate-700"
            >
              <RefreshCw size={14} className="mr-1" />
              Refresh
            </Button>
            <div className="text-right">
              <div className="text-sm font-medium text-white">{user.name}</div>
              <div className="text-xs text-slate-400">{user.role}</div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="border-slate-600 text-slate-200 hover:bg-slate-700">
              Logout
            </Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800/80 border-slate-600">
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-300">Today's Visits</CardDescription>
              <CardTitle className="text-3xl text-white">{stats.total_visits_today || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-slate-300">
                <Users size={16} className="mr-1" />
                Total patients
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/80 border-slate-600">
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-300">Pending Review</CardDescription>
              <CardTitle className="text-3xl text-white">{stats.pending_visits || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-slate-300">
                <Clock size={16} className="mr-1" />
                Awaiting review
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/80 border-red-700/50">
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-300">High Risk</CardDescription>
              <CardTitle className="text-3xl text-red-400">{stats.high_risk_visits || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-red-300">
                <AlertCircle size={16} className="mr-1" />
                Urgent attention
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/80 border-slate-600">
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-300">Avg Processing</CardDescription>
              <CardTitle className="text-3xl text-white">{stats.average_processing_time_seconds || 0}s</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-slate-300">
                <Activity size={16} className="mr-1" />
                AI analysis time
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="mb-4 flex space-x-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className={filter === 'all' ? 'bg-blue-600 text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
          >
            All Visits
          </Button>
          <Button
            variant={filter === 'COMPLETED' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('COMPLETED')}
            className={filter === 'COMPLETED' ? 'bg-blue-600 text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
          >
            Completed
          </Button>
          <Button
            variant={filter === 'PROCESSING' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('PROCESSING')}
            className={filter === 'PROCESSING' ? 'bg-blue-600 text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
          >
            Processing
          </Button>
          <Button
            variant={filter === 'PENDING' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('PENDING')}
            className={filter === 'PENDING' ? 'bg-blue-600 text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
          >
            Pending
          </Button>
        </div>

        {/* Visits Table */}
        <Card className="bg-slate-800/80 border-slate-600">
          <CardHeader>
            <CardTitle className="text-white">Patient Visits</CardTitle>
            <CardDescription className="text-slate-300">
              Click on a visit to view detailed SOAP note and diagnosis
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-slate-300">Loading visits...</div>
            ) : visits.length === 0 ? (
              <div className="text-center py-8 text-slate-300">No visits found</div>
            ) : (
              <div className="space-y-3">
                {visits.map((visit: any) => (
                  <div
                    key={visit.visit_id}
                    className="p-4 border border-slate-600 rounded-lg hover:bg-slate-700/50 cursor-pointer transition"
                    onClick={() => router.push(`/doctor/visit/${visit.visit_id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-lg text-white">
                            {visit.patient_name || 'Patient'}
                          </h3>
                          <span className="text-sm text-slate-400">
                            Age: {visit.patient_age || 'N/A'}
                          </span>
                          {visit.has_red_flags && (
                            <span className="flex items-center text-red-400 text-sm font-semibold">
                              <AlertCircle size={16} className="mr-1" />
                              RED FLAGS
                            </span>
                          )}
                        </div>
                        
                        <div className="text-sm text-slate-300 mb-2">
                          {visit.chief_complaint || 'Processing...'}
                        </div>
                        
                        <div className="flex items-center space-x-2 text-xs text-slate-500">
                          <Clock size={14} />
                          <span>{new Date(visit.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end space-y-2">
                        {getRiskBadge(visit.risk_level)}
                        {getStatusBadge(visit.status)}
                        <Button size="sm" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
                          <Eye size={14} className="mr-1" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* AI Agent Chat */}
      <AIAgentChat 
        clinicId={user?.clinic_id}
        onVisitSelect={(visitId) => router.push(`/doctor/visit/${visitId}`)}
      />
    </div>
  )
}
