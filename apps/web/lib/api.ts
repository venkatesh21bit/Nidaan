/**
 * API Client - Centralized HTTP client for backend communication
 */
import axios, { AxiosInstance, AxiosError } from 'axios'

// Use deployed IBM Cloud API URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://nidaan-api.25r5a6g2yvmy.eu-de.codeengine.appdomain.cloud/api/v1'

// ============= TypeScript Interfaces =============

export interface AuthResponse {
  access_token: string
  user_id: string
  name: string
  role: 'doctor' | 'patient' | 'admin'
  clinic_id?: string
}

export interface SOAPNote {
  subjective: string
  objective: string
  assessment: string
  plan: string
}

export interface DifferentialDiagnosis {
  diagnosis: string
  probability: 'HIGH' | 'MEDIUM' | 'LOW'
  supporting_factors: string[]
  against: string[]
  next_steps: string[]
}

export interface RedFlag {
  category: string
  finding: string
  urgency: 'CRITICAL' | 'URGENT' | 'ROUTINE'
  action: string
}

export interface RedFlagAnalysis {
  has_red_flags: boolean
  severity: 'ROUTINE' | 'LOW' | 'MODERATE' | 'HIGH' | 'URGENT' | 'CRITICAL'
  red_flags_detected: RedFlag[]
  triage_recommendation: string
}

export type VisitStatus = 'PENDING' | 'PROCESSING' | 'TRANSCRIBING' | 'ANALYZING' | 'COMPLETED' | 'FAILED'

export interface Visit {
  visit_id: string
  patient_id: string
  clinic_id: string
  doctor_id?: string
  status: VisitStatus
  language_code: string
  audio_s3_key?: string
  transcript?: string
  translated_text?: string
  soap_note?: SOAPNote
  differential_diagnosis?: DifferentialDiagnosis[]
  red_flags?: RedFlagAnalysis
  risk_level?: string
  created_at: string
  updated_at: string
  processing_time_seconds?: number
  patient_name?: string
  patient_age?: number
  patient_gender?: string
  chief_complaint?: string
  has_red_flags?: boolean
  reviewed_at?: string
}

export interface UploadUrlResponse {
  upload_url: string
  audio_s3_key: string
  expiration_seconds: number
}

export interface ProcessingStatus {
  visit_id: string
  status: VisitStatus
  current_step?: string
  progress?: number
  error?: string
}

export interface DashboardStats {
  total_visits_today: number
  pending_reviews: number
  critical_alerts: number
  completed_today: number
  pending_visits?: number
  high_risk_visits?: number
  average_processing_time_seconds?: number
}

// ============= API Client =============

// Create axios instance
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Helper functions
export const getAuthToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('auth_token')
  }
  return null
}

export const setAuthToken = (token: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth_token', token)
  }
}

export const clearAuthToken = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_data')
  }
}

// API Methods
export const authAPI = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', { email, password })
    return response.data
  },
  
  register: async (userData: {
    email: string
    password: string
    name: string
    role: 'doctor' | 'patient'
    clinic_id?: string
  }): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', userData)
    return response.data
  },
  
  refreshToken: async (): Promise<AuthResponse> => {
    const response = await api.post('/auth/refresh')
    return response.data
  },
}

export const audioAPI = {
  getUploadUrl: async (visitId: string, fileExtension: string = 'webm'): Promise<UploadUrlResponse> => {
    const response = await api.post('/audio/upload-url', {
      visit_id: visitId,
      file_extension: fileExtension,
      content_type: `audio/${fileExtension}`,
    })
    return response.data
  },
  
  createVisit: async (visitData: {
    patient_id: string
    clinic_id?: string
    doctor_id?: string
    language_code?: string
    audio_duration_seconds?: number
  }): Promise<Visit> => {
    const response = await api.post('/audio/visits', visitData)
    return response.data
  },
  
  processAudio: async (visitId: string, audioS3Key: string): Promise<{ message: string; visit_id: string; status: string }> => {
    const response = await api.post(`/audio/process/${visitId}`, null, {
      params: { audio_s3_key: audioS3Key },
    })
    return response.data
  },
  
  getProcessingStatus: async (visitId: string): Promise<ProcessingStatus> => {
    const response = await api.get(`/audio/status/${visitId}`)
    return response.data
  },
}

export const doctorAPI = {
  getDashboardVisits: async (statusFilter?: string, limit: number = 50): Promise<Visit[]> => {
    const response = await api.get('/doctors/dashboard/visits', {
      params: { status_filter: statusFilter, limit },
    })
    return response.data
  },
  
  getVisitDetails: async (visitId: string): Promise<Visit> => {
    const response = await api.get(`/doctors/visits/${visitId}`)
    return response.data
  },
  
  getDashboardStats: async (): Promise<DashboardStats> => {
    const response = await api.get('/doctors/stats/summary')
    return response.data
  },
}

export const patientAPI = {
  createPatient: async (patientData: {
    name: string
    date_of_birth: string
    gender: 'male' | 'female' | 'other'
    phone: string
    address?: string
  }): Promise<{ patient_id: string }> => {
    const response = await api.post('/patients/', patientData)
    return response.data
  },
  
  getPatient: async (patientId: string): Promise<any> => {
    const response = await api.get(`/patients/${patientId}`)
    return response.data
  },
  
  getPatientVisits: async (patientId: string): Promise<Visit[]> => {
    const response = await api.get(`/patients/${patientId}/visits`)
    return response.data
  },
}

export const demoAPI = {
  seedVisits: async (count: number = 5): Promise<{ message: string; visits_created: number; visit_ids: string[] }> => {
    const response = await api.post('/demo/seed-visits', null, {
      params: { count },
    })
    return response.data
  },
  
  clearVisits: async (): Promise<{ message: string }> => {
    const response = await api.delete('/demo/clear-visits')
    return response.data
  },
}

export const triageAPI = {
  getUrgentCases: async (): Promise<{ cases: any[]; total: number }> => {
    const response = await api.get('/triage/urgent-cases')
    return response.data
  },
  
  markCaseSeen: async (caseId: string, doctorId?: string): Promise<{ message: string }> => {
    const response = await api.post(`/triage/mark-seen/${caseId}`, null, {
      params: { doctor_id: doctorId },
    })
    return response.data
  },
  
  submitVoiceTriage: async (data: {
    patient_name: string
    patient_age?: number
    patient_gender?: string
    symptoms: string[]
    transcript: string
    vitals?: {
      heart_rate?: number
      blood_pressure?: string
      temperature?: number
      oxygen_level?: number
    }
  }): Promise<{
    case_id: string
    severity: string
    recommended_action: string
    analysis?: any
    confidence?: number
    waiting_time?: string
  }> => {
    const response = await api.post('/triage/voice', data)
    return response.data
  },
  
  submitSurveyTriage: async (data: {
    patient_name: string
    patient_age?: number
    responses: Record<string, any>
  }): Promise<any> => {
    const response = await api.post('/triage/survey', data)
    return response.data
  },
  
  getCaseDetails: async (caseId: string): Promise<any> => {
    const response = await api.get(`/triage/case/${caseId}`)
    return response.data
  },
}

// Upload file directly to S3 using presigned URL
// For demo/mock mode (no S3 configured), the URL will be "MOCK_UPLOAD:key" and we skip upload
export const uploadToS3 = async (presignedUrl: string, file: Blob): Promise<void> => {
  // Handle mock upload for demo environments
  if (presignedUrl.startsWith('MOCK_UPLOAD:')) {
    console.log('[Demo Mode] Skipping S3 upload, audio recorded locally')
    // In demo mode, we simulate successful upload
    return
  }
  
  await axios.put(presignedUrl, file, {
    headers: {
      'Content-Type': file.type,
    },
  })
}

export default api
