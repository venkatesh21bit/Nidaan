'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/lib/store'
import { api } from '@/lib/api'
import { AgentControlPanel } from '@/components/agent-control-panel'
import { 
  Calendar, 
  Users, 
  Clock, 
  AlertCircle, 
  Bot, 
  RefreshCw,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Eye,
  Edit,
  Trash2,
  Play,
  CheckCircle2,
  XCircle,
  LogOut,
  Settings
} from 'lucide-react'

// Types
interface Appointment {
  _id: string
  patient_id: string
  patient_name: string
  patient_email?: string
  patient_phone?: string
  doctor_id: string
  doctor_name?: string
  appointment_date: string
  appointment_time: string
  duration_minutes: number
  reason?: string
  status: string
  created_at: string
}

interface Patient {
  patient_id: string
  patient_name: string
  patient_age?: number
  patient_gender?: string
  patient_email?: string
  patient_phone?: string
  total_visits: number
  last_visit?: string
  risk_level?: string
}

interface DashboardStats {
  total_appointments_today: number
  upcoming_appointments_week: number
  pending_surveys: number
  high_risk_patients: number
  total_patients: number
  agent_tasks_pending: number
  agent_tasks_completed_today: number
}

type TabType = 'appointments' | 'patients' | 'agents'

export default function AdminDashboard() {
  const router = useRouter()
  const { user, clearAuth } = useAuthStore()
  
  // State
  const [activeTab, setActiveTab] = useState<TabType>('appointments')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false)

  // Auth check - allow both admin and doctor roles
  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'doctor')) {
      router.push('/login')
    }
  }, [user, router])

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Fetch stats
      const statsRes = await api.get('/admin/dashboard/stats')
      setStats(statsRes.data)
      
      // Fetch appointments for selected date
      const apptRes = await api.get('/admin/appointments', {
        params: { start_date: selectedDate, end_date: selectedDate }
      })
      setAppointments(apptRes.data)
      
      // Fetch patients
      const patientsRes = await api.get('/admin/patients', {
        params: { search: searchQuery || undefined }
      })
      setPatients(patientsRes.data)
      
    } catch (error) {
      console.error('Error fetching admin data:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedDate, searchQuery])

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchData()
    }
  }, [user, fetchData])

  const handleLogout = () => {
    clearAuth()
    router.push('/login')
  }

  const handleDateChange = (days: number) => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + days)
    setSelectedDate(newDate.toISOString().split('T')[0])
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: 'bg-blue-900/50 text-blue-300 border-blue-700',
      survey_sent: 'bg-purple-900/50 text-purple-300 border-purple-700',
      checked_in: 'bg-green-900/50 text-green-300 border-green-700',
      completed: 'bg-slate-700 text-slate-300 border-slate-600',
      cancelled: 'bg-red-900/50 text-red-300 border-red-700',
    }
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded border ${colors[status] || colors.scheduled}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    )
  }

  const getRiskBadge = (riskLevel?: string) => {
    if (!riskLevel) return null
    const colors: Record<string, string> = {
      CRITICAL: 'bg-red-900/50 text-red-300',
      HIGH: 'bg-orange-900/50 text-orange-300',
      MODERATE: 'bg-yellow-900/50 text-yellow-300',
      LOW: 'bg-green-900/50 text-green-300',
    }
    return (
      <span className={`px-2 py-0.5 text-xs font-semibold rounded ${colors[riskLevel] || colors.LOW}`}>
        {riskLevel}
      </span>
    )
  }

  if (!user || user.role !== 'admin') return null

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <nav className="border-b border-slate-700 bg-slate-800 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <div className="text-2xl font-bold text-blue-400">Nidaan.ai</div>
            <div className="text-sm text-slate-400">Admin Dashboard</div>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/admin/agents')}
              className="border-purple-600 text-purple-400 hover:bg-purple-900/50"
            >
              <Bot size={14} className="mr-1" />
              🤖 AI Agents
            </Button>
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
              <div className="text-xs text-slate-400">Administrator</div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              className="border-slate-600 text-slate-200 hover:bg-slate-700"
            >
              <LogOut size={14} className="mr-1" />
              Logout
            </Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          <Card className="bg-slate-800/80 border-slate-600">
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-300 text-xs">Today's Appointments</CardDescription>
              <CardTitle className="text-2xl text-white">{stats?.total_appointments_today || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-xs text-slate-400">
                <Calendar size={12} className="mr-1" />
                Scheduled
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/80 border-slate-600">
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-300 text-xs">This Week</CardDescription>
              <CardTitle className="text-2xl text-white">{stats?.upcoming_appointments_week || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-xs text-slate-400">
                <Clock size={12} className="mr-1" />
                Upcoming
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/80 border-slate-600">
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-300 text-xs">Pending Surveys</CardDescription>
              <CardTitle className="text-2xl text-purple-400">{stats?.pending_surveys || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-xs text-purple-300">
                <Mail size={12} className="mr-1" />
                Awaiting response
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/80 border-red-700/50">
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-300 text-xs">High Risk</CardDescription>
              <CardTitle className="text-2xl text-red-400">{stats?.high_risk_patients || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-xs text-red-300">
                <AlertCircle size={12} className="mr-1" />
                Patients
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/80 border-slate-600">
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-300 text-xs">Total Patients</CardDescription>
              <CardTitle className="text-2xl text-white">{stats?.total_patients || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-xs text-slate-400">
                <Users size={12} className="mr-1" />
                Registered
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/80 border-blue-700/50">
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-300 text-xs">Agent Tasks</CardDescription>
              <CardTitle className="text-2xl text-blue-400">{stats?.agent_tasks_pending || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-xs text-blue-300">
                <Bot size={12} className="mr-1" />
                Pending
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/80 border-green-700/50">
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-300 text-xs">Completed Today</CardDescription>
              <CardTitle className="text-2xl text-green-400">{stats?.agent_tasks_completed_today || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-xs text-green-300">
                <CheckCircle2 size={12} className="mr-1" />
                Agent tasks
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 mb-6">
          <Button
            variant={activeTab === 'appointments' ? 'default' : 'outline'}
            onClick={() => setActiveTab('appointments')}
            className={activeTab === 'appointments' ? 'bg-blue-600' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
          >
            <Calendar size={16} className="mr-2" />
            Appointments
          </Button>
          <Button
            variant={activeTab === 'patients' ? 'default' : 'outline'}
            onClick={() => setActiveTab('patients')}
            className={activeTab === 'patients' ? 'bg-blue-600' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
          >
            <Users size={16} className="mr-2" />
            Patients
          </Button>
          <Button
            variant={activeTab === 'agents' ? 'default' : 'outline'}
            onClick={() => setActiveTab('agents')}
            className={activeTab === 'agents' ? 'bg-blue-600' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
          >
            <Bot size={16} className="mr-2" />
            AI Agents
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === 'appointments' && (
          <Card className="bg-slate-800/80 border-slate-600">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Appointments</CardTitle>
                  <CardDescription className="text-slate-300">
                    Manage patient appointments and scheduling
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-4">
                  {/* Date Navigation */}
                  <div className="flex items-center space-x-2 bg-slate-700 rounded-lg px-3 py-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDateChange(-1)}
                      className="p-1 h-auto text-slate-300 hover:text-white"
                    >
                      <ChevronLeft size={18} />
                    </Button>
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-40 bg-transparent border-0 text-white text-center"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDateChange(1)}
                      className="p-1 h-auto text-slate-300 hover:text-white"
                    >
                      <ChevronRight size={18} />
                    </Button>
                  </div>
                  <Button
                    onClick={() => setShowNewAppointmentModal(true)}
                    className="bg-blue-600 hover:bg-blue-500"
                  >
                    <Plus size={16} className="mr-2" />
                    New Appointment
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-slate-400">Loading appointments...</div>
              ) : appointments.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No appointments for this date</p>
                  <Button
                    onClick={() => setShowNewAppointmentModal(true)}
                    className="mt-4 bg-blue-600 hover:bg-blue-500"
                  >
                    <Plus size={16} className="mr-2" />
                    Schedule Appointment
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {appointments.map((appt) => (
                    <div
                      key={appt._id}
                      className="p-4 border border-slate-600 rounded-lg hover:bg-slate-700/50 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="text-2xl font-bold text-blue-400">
                            {appt.appointment_time}
                          </div>
                          <div>
                            <div className="font-semibold text-white">
                              {appt.patient_name}
                            </div>
                            <div className="text-sm text-slate-400">
                              {appt.reason || 'General consultation'}
                            </div>
                            <div className="flex items-center space-x-3 mt-1 text-xs text-slate-500">
                              {appt.patient_email && (
                                <span className="flex items-center">
                                  <Mail size={12} className="mr-1" />
                                  {appt.patient_email}
                                </span>
                              )}
                              {appt.patient_phone && (
                                <span className="flex items-center">
                                  <Phone size={12} className="mr-1" />
                                  {appt.patient_phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          {getStatusBadge(appt.status)}
                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-400 hover:text-white"
                            >
                              <Eye size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-400 hover:text-white"
                            >
                              <Edit size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-400 hover:text-red-400"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'patients' && (
          <Card className="bg-slate-800/80 border-slate-600">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Patients</CardTitle>
                  <CardDescription className="text-slate-300">
                    View and manage patient records
                  </CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                  <Input
                    placeholder="Search patients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-64 bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-slate-400">Loading patients...</div>
              ) : patients.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Users size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No patients found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-600">
                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Patient</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Age/Gender</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Contact</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Visits</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Risk</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Last Visit</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patients.map((patient) => (
                        <tr key={patient.patient_id} className="border-b border-slate-700 hover:bg-slate-700/50">
                          <td className="py-3 px-4">
                            <div className="font-medium text-white">{patient.patient_name}</div>
                            <div className="text-xs text-slate-500">{patient.patient_id}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {patient.patient_age ? `${patient.patient_age} yrs` : '-'} / {patient.patient_gender || '-'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm text-slate-300">{patient.patient_email || '-'}</div>
                            <div className="text-xs text-slate-500">{patient.patient_phone || '-'}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-300">{patient.total_visits}</td>
                          <td className="py-3 px-4">{getRiskBadge(patient.risk_level)}</td>
                          <td className="py-3 px-4 text-slate-400 text-sm">
                            {patient.last_visit ? new Date(patient.last_visit).toLocaleDateString() : '-'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/admin/patients/${patient.patient_id}`)}
                                className="text-slate-400 hover:text-white"
                              >
                                <Eye size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-slate-400 hover:text-blue-400"
                                title="Schedule Appointment"
                              >
                                <Calendar size={16} />
                              </Button>
                            </div>
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

        {activeTab === 'agents' && (
          <AgentControlPanel />
        )}
      </main>

      {/* New Appointment Modal */}
      {showNewAppointmentModal && (
        <NewAppointmentModal
          onClose={() => setShowNewAppointmentModal(false)}
          onSuccess={() => {
            setShowNewAppointmentModal(false)
            fetchData()
          }}
          selectedDate={selectedDate}
        />
      )}
    </div>
  )
}

// New Appointment Modal Component
function NewAppointmentModal({
  onClose,
  onSuccess,
  selectedDate,
}: {
  onClose: () => void
  onSuccess: () => void
  selectedDate: string
}) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    patient_name: '',
    patient_id: `PAT_${Date.now()}`,
    patient_email: '',
    patient_phone: '',
    doctor_id: 'USR_DEMO_DOC',
    doctor_name: 'Dr. Ram Kumar',
    appointment_date: selectedDate,
    appointment_time: '09:00',
    duration_minutes: 30,
    reason: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      await api.post('/admin/appointments', formData)
      onSuccess()
    } catch (error) {
      console.error('Error creating appointment:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-lg bg-slate-800 border-slate-600">
        <CardHeader>
          <CardTitle className="text-white">New Appointment</CardTitle>
          <CardDescription className="text-slate-300">
            Schedule a new patient appointment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Patient Name *</label>
                <Input
                  required
                  value={formData.patient_name}
                  onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Patient Email</label>
                <Input
                  type="email"
                  value={formData.patient_email}
                  onChange={(e) => setFormData({ ...formData, patient_email: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Date *</label>
                <Input
                  type="date"
                  required
                  value={formData.appointment_date}
                  onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Time *</label>
                <Input
                  type="time"
                  required
                  value={formData.appointment_time}
                  onChange={(e) => setFormData({ ...formData, appointment_time: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm text-slate-300 mb-1">Reason for Visit</label>
              <Input
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="e.g., Follow-up, Chest pain, Annual checkup"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            
            <div className="bg-slate-700/50 rounded-lg p-3 text-sm text-slate-300">
              <div className="flex items-center space-x-2 mb-2">
                <Bot size={16} className="text-blue-400" />
                <span className="font-medium">AI Agents will automatically:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-400 ml-6">
                <li>Send pre-check-in survey 48 hours before</li>
                <li>Send appointment reminders at 48h, 24h, and 2h</li>
                <li>Process survey responses and assign triage severity</li>
              </ul>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-500"
              >
                {loading ? 'Creating...' : 'Create Appointment'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
