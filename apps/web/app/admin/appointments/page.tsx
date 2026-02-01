'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/lib/store'
import { 
  Calendar,
  Clock, 
  User,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  LogOut,
  ChevronLeft,
  ChevronRight,
  FileText,
  Stethoscope,
  Filter,
  Search
} from 'lucide-react'

interface Appointment {
  id: string
  patient_id: string
  patient_name: string
  patient_email?: string
  patient_phone?: string
  symptoms: string[]
  symptom_details?: string
  severity?: string
  duration?: string
  preferred_date?: string
  preferred_time?: string
  scheduled_date?: string
  scheduled_time?: string
  status: string
  notes?: string
  doctor_id?: string
  doctor_name?: string
  created_at: string
  updated_at: string
}

interface Stats {
  total: number
  pending: number
  confirmed: number
  completed: number
  cancelled: number
  today: number
}

export default function AppointmentsPage() {
  const router = useRouter()
  const { user, clearAuth } = useAuthStore()
  
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [updating, setUpdating] = useState(false)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://nidaan-api.25r5a6g2yvmy.eu-de.codeengine.appdomain.cloud/api/v1'

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'doctor')) {
      router.push('/login')
    }
  }, [user, router])

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('auth_token')
      
      // Fetch appointments
      const url = statusFilter === 'all' 
        ? `${API_URL}/appointments` 
        : `${API_URL}/appointments?status_filter=${statusFilter}`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setAppointments(data)
      }
      
      // Fetch stats
      const statsResponse = await fetch(`${API_URL}/appointments/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData)
      }
    } catch (error) {
      console.error('Error fetching appointments:', error)
    } finally {
      setLoading(false)
    }
  }, [API_URL, statusFilter])

  useEffect(() => {
    if (user) {
      fetchAppointments()
    }
  }, [user, fetchAppointments])

  const updateAppointment = async (id: string, updates: any) => {
    try {
      setUpdating(true)
      const token = localStorage.getItem('auth_token')
      
      const response = await fetch(`${API_URL}/appointments/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })
      
      if (response.ok) {
        fetchAppointments()
        setSelectedAppointment(null)
      }
    } catch (error) {
      console.error('Error updating appointment:', error)
    } finally {
      setUpdating(false)
    }
  }

  const cancelAppointment = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent opening modal
    if (!confirm('Are you sure you want to cancel this appointment?')) return
    
    try {
      setUpdating(true)
      const token = localStorage.getItem('auth_token')
      
      const response = await fetch(`${API_URL}/appointments/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        fetchAppointments()
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error)
    } finally {
      setUpdating(false)
    }
  }

  const handleLogout = () => {
    clearAuth()
    router.push('/login')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-500/20 text-amber-400 border-amber-500/50'
      case 'confirmed': return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
      case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/50'
      case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500/50'
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/50'
    }
  }

  const filteredAppointments = appointments.filter(apt => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return apt.patient_name.toLowerCase().includes(query) ||
             apt.patient_email?.toLowerCase().includes(query) ||
             apt.symptoms.some(s => s.toLowerCase().includes(query))
    }
    return true
  })

  if (!user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <nav className="border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-400 flex items-center justify-center">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <div>
              <div className="text-xl font-bold text-white">Nidaan Admin</div>
              <div className="text-xs text-slate-400">Appointments Management</div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/admin/dashboard')}
              className="text-slate-400 hover:text-white"
            >
              Dashboard
            </Button>
            <div className="hidden sm:block text-right">
              <div className="text-sm font-medium text-white">{user?.name}</div>
              <div className="text-xs text-purple-400 capitalize">{user?.role}</div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <LogOut size={18} />
            </Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-xs">Total</p>
                    <p className="text-2xl font-bold text-white">{stats.total}</p>
                  </div>
                  <Calendar className="text-slate-500" size={24} />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-amber-900/30 border-amber-700/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-400 text-xs">Pending</p>
                    <p className="text-2xl font-bold text-amber-300">{stats.pending}</p>
                  </div>
                  <AlertCircle className="text-amber-500" size={24} />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-blue-900/30 border-blue-700/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-400 text-xs">Confirmed</p>
                    <p className="text-2xl font-bold text-blue-300">{stats.confirmed}</p>
                  </div>
                  <Clock className="text-blue-500" size={24} />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-green-900/30 border-green-700/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-400 text-xs">Completed</p>
                    <p className="text-2xl font-bold text-green-300">{stats.completed}</p>
                  </div>
                  <CheckCircle2 className="text-green-500" size={24} />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-red-900/30 border-red-700/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-400 text-xs">Cancelled</p>
                    <p className="text-2xl font-bold text-red-300">{stats.cancelled}</p>
                  </div>
                  <XCircle className="text-red-500" size={24} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patients, symptoms..."
                className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
          <Button onClick={fetchAppointments} variant="outline" className="border-slate-700 text-slate-300">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>

        {/* Appointments List */}
        <div className="grid gap-4">
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="animate-spin mx-auto text-purple-500" size={32} />
              <p className="mt-4 text-slate-400">Loading appointments...</p>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-12 text-center">
                <Calendar className="mx-auto text-slate-600" size={48} />
                <p className="mt-4 text-slate-400">No appointments found</p>
              </CardContent>
            </Card>
          ) : (
            filteredAppointments.map((apt) => (
              <Card 
                key={apt.id} 
                className="bg-slate-800/50 border-slate-700/50 hover:border-purple-500/50 transition-colors cursor-pointer"
                onClick={() => setSelectedAppointment(apt)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-400 flex items-center justify-center">
                          <User className="text-white" size={20} />
                        </div>
                        <div>
                          <h3 className="text-white font-semibold">{apt.patient_name}</h3>
                          <div className="flex items-center gap-4 text-xs text-slate-400">
                            {apt.patient_email && (
                              <span className="flex items-center gap-1">
                                <Mail size={12} /> {apt.patient_email}
                              </span>
                            )}
                            {apt.patient_phone && (
                              <span className="flex items-center gap-1">
                                <Phone size={12} /> {apt.patient_phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-3 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {apt.symptoms.map((symptom, i) => (
                            <span 
                              key={i} 
                              className="px-2 py-1 bg-purple-900/30 text-purple-300 text-xs rounded-full"
                            >
                              {symptom}
                            </span>
                          ))}
                        </div>
                        
                        {apt.symptom_details && (
                          <p className="text-sm text-slate-300 line-clamp-2">{apt.symptom_details}</p>
                        )}
                        
                        <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                          {apt.severity && (
                            <span className="flex items-center gap-1">
                              <AlertCircle size={12} className="text-amber-400" /> 
                              Severity: {apt.severity}
                            </span>
                          )}
                          {apt.duration && (
                            <span className="flex items-center gap-1">
                              <Clock size={12} /> Duration: {apt.duration}
                            </span>
                          )}
                          {apt.preferred_date && (
                            <span className="flex items-center gap-1">
                              <Calendar size={12} /> Preferred: {apt.preferred_date} {apt.preferred_time}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(apt.status)}`}>
                        {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
                      </span>
                      
                      {apt.scheduled_date && (
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Scheduled</p>
                          <p className="text-sm text-white">{apt.scheduled_date}</p>
                          <p className="text-xs text-slate-300">{apt.scheduled_time}</p>
                        </div>
                      )}
                      
                      {apt.doctor_name && (
                        <div className="flex items-center gap-1 text-xs text-cyan-400">
                          <Stethoscope size={12} /> {apt.doctor_name}
                        </div>
                      )}
                      
                      <p className="text-xs text-slate-500">
                        {new Date(apt.created_at).toLocaleDateString()}
                      </p>
                      
                      {/* Cancel Button */}
                      {(apt.status === 'pending' || apt.status === 'confirmed') && (
                        <Button
                          onClick={(e) => cancelAppointment(apt.id, e)}
                          variant="outline"
                          size="sm"
                          className="border-red-700 text-red-400 hover:bg-red-900/30 mt-2"
                          disabled={updating}
                        >
                          <XCircle size={14} className="mr-1" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>

      {/* Appointment Detail Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <Card className="bg-slate-800 border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b border-slate-700">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-white">Appointment Details</CardTitle>
                  <p className="text-sm text-slate-400 mt-1">ID: {selectedAppointment.id}</p>
                </div>
                <button 
                  onClick={() => setSelectedAppointment(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <XCircle size={24} />
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Patient Info */}
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-2">Patient Information</h4>
                <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
                  <p className="text-white font-medium">{selectedAppointment.patient_name}</p>
                  {selectedAppointment.patient_email && (
                    <p className="text-sm text-slate-300 flex items-center gap-2">
                      <Mail size={14} /> {selectedAppointment.patient_email}
                    </p>
                  )}
                  {selectedAppointment.patient_phone && (
                    <p className="text-sm text-slate-300 flex items-center gap-2">
                      <Phone size={14} /> {selectedAppointment.patient_phone}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Symptoms */}
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-2">Symptoms</h4>
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedAppointment.symptoms.map((s, i) => (
                    <span key={i} className="px-3 py-1 bg-purple-900/30 text-purple-300 rounded-full text-sm">
                      {s}
                    </span>
                  ))}
                </div>
                {selectedAppointment.symptom_details && (
                  <p className="text-slate-300 bg-slate-900/50 rounded-lg p-3 text-sm">
                    {selectedAppointment.symptom_details}
                  </p>
                )}
              </div>
              
              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Severity</p>
                  <p className="text-white font-medium">{selectedAppointment.severity || 'Not specified'}</p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Duration</p>
                  <p className="text-white font-medium">{selectedAppointment.duration || 'Not specified'}</p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Preferred Date</p>
                  <p className="text-white font-medium">{selectedAppointment.preferred_date || 'Any'}</p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Preferred Time</p>
                  <p className="text-white font-medium">{selectedAppointment.preferred_time || 'Any'}</p>
                </div>
              </div>
              
              {/* Notes */}
              {selectedAppointment.notes && (
                <div>
                  <h4 className="text-sm font-medium text-slate-400 mb-2">Notes</h4>
                  <p className="text-slate-300 bg-slate-900/50 rounded-lg p-3 text-sm">
                    {selectedAppointment.notes}
                  </p>
                </div>
              )}
              
              {/* Status & Actions */}
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-2">Status & Actions</h4>
                <div className="flex items-center gap-2 mb-4">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(selectedAppointment.status)}`}>
                    {selectedAppointment.status.charAt(0).toUpperCase() + selectedAppointment.status.slice(1)}
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {selectedAppointment.status === 'pending' && (
                    <>
                      <Button
                        onClick={() => updateAppointment(selectedAppointment.id, {
                          status: 'confirmed',
                          scheduled_date: selectedAppointment.preferred_date || new Date().toISOString().split('T')[0],
                          scheduled_time: selectedAppointment.preferred_time || '10:00 AM',
                          doctor_id: user?.user_id,
                          doctor_name: user?.name
                        })}
                        disabled={updating}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <CheckCircle2 size={16} className="mr-1" />
                        Confirm Appointment
                      </Button>
                      <Button
                        onClick={() => updateAppointment(selectedAppointment.id, { status: 'cancelled' })}
                        disabled={updating}
                        variant="outline"
                        className="border-red-700 text-red-400 hover:bg-red-900/30"
                      >
                        <XCircle size={16} className="mr-1" />
                        Cancel
                      </Button>
                    </>
                  )}
                  {selectedAppointment.status === 'confirmed' && (
                    <>
                      <Button
                        onClick={() => updateAppointment(selectedAppointment.id, { status: 'completed' })}
                        disabled={updating}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle2 size={16} className="mr-1" />
                        Mark Completed
                      </Button>
                      <Button
                        onClick={() => updateAppointment(selectedAppointment.id, { status: 'cancelled' })}
                        disabled={updating}
                        variant="outline"
                        className="border-red-700 text-red-400 hover:bg-red-900/30"
                      >
                        <XCircle size={16} className="mr-1" />
                        Cancel Appointment
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
