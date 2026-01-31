/**
 * Global State Management with Zustand
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  user_id: string
  name: string
  email: string
  role: string
  clinic_id?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      
      setAuth: (user, token) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', token)
          localStorage.setItem('user_data', JSON.stringify(user))
        }
        set({ user, token, isAuthenticated: true })
      },
      
      clearAuth: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token')
          localStorage.removeItem('user_data')
        }
        set({ user: null, token: null, isAuthenticated: false })
      },
    }),
    {
      name: 'auth-storage',
    }
  )
)

interface Visit {
  visit_id: string
  patient_name: string
  patient_age: number
  status: string
  risk_level?: string
  created_at: string
  has_red_flags: boolean
}

interface VisitState {
  visits: Visit[]
  currentVisit: any | null
  setVisits: (visits: Visit[]) => void
  addVisit: (visit: Visit) => void
  setCurrentVisit: (visit: any) => void
  updateVisit: (visitId: string, updates: Partial<Visit>) => void
}

export const useVisitStore = create<VisitState>((set) => ({
  visits: [],
  currentVisit: null,
  
  setVisits: (visits) => set({ visits }),
  
  addVisit: (visit) => set((state) => ({
    visits: [visit, ...state.visits],
  })),
  
  setCurrentVisit: (visit) => set({ currentVisit: visit }),
  
  updateVisit: (visitId, updates) => set((state) => ({
    visits: state.visits.map((v) =>
      v.visit_id === visitId ? { ...v, ...updates } : v
    ),
  })),
}))

interface AudioRecordingState {
  isRecording: boolean
  audioBlob: Blob | null
  duration: number
  language: string
  setRecording: (recording: boolean) => void
  setAudioBlob: (blob: Blob | null) => void
  setDuration: (duration: number) => void
  setLanguage: (language: string) => void
  reset: () => void
}

export const useAudioStore = create<AudioRecordingState>((set) => ({
  isRecording: false,
  audioBlob: null,
  duration: 0,
  language: 'hi-IN',
  
  setRecording: (isRecording) => set({ isRecording }),
  setAudioBlob: (audioBlob) => set({ audioBlob }),
  setDuration: (duration) => set({ duration }),
  setLanguage: (language) => set({ language }),
  
  reset: () => set({
    isRecording: false,
    audioBlob: null,
    duration: 0,
  }),
}))
