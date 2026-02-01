'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authAPI, setAuthToken } from '@/lib/api'
import { useAuthStore } from '@/lib/store'

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore((state) => state.setAuth)
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await authAPI.login(email, password)
      
      // Store token and user data
      setAuthToken(response.access_token)
      setAuth(
        {
          user_id: response.user_id,
          name: response.name,
          email: email,
          role: response.role,
          clinic_id: response.clinic_id,
        },
        response.access_token
      )

      // Redirect based on role
      if (response.role === 'admin') {
        router.push('/admin/appointments')
      } else if (response.role === 'doctor') {
        router.push('/doctor/dashboard')
      } else {
        router.push('/patient')
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <Card className="w-full max-w-md mx-4 bg-slate-800 border-slate-700">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-white">
            Login to Nidaan.ai
          </CardTitle>
          <CardDescription className="text-center text-slate-300">
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-300 bg-red-900/50 border border-red-700 rounded">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-200">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="doctor@nidaan.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-slate-200">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <span className="text-slate-400">Don't have an account? </span>
            <Link href="/register" className="text-blue-400 hover:underline">
              Register
            </Link>
          </div>

          {/* Demo Credentials Section */}
          <div className="mt-6 space-y-3">
            <div className="p-4 bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg border border-blue-700/50">
              <p className="font-semibold mb-3 text-white text-center">🔐 Demo Credentials</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                  <span className="text-slate-300">👨‍⚕️ Doctor</span>
                  <code className="text-blue-400">doctor@nidaan.ai / doctor123</code>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                  <span className="text-slate-300">🤒 Patient</span>
                  <code className="text-green-400">patient@nidaan.ai / patient123</code>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                  <span className="text-slate-300">👑 Admin</span>
                  <code className="text-purple-400">admin@nidaan.ai / admin123</code>
                </div>
              </div>
            </div>

            {/* AI Triage Departments Info */}
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="font-semibold mb-2 text-white text-sm">🏥 AI Triage Departments</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  <span className="text-slate-400">Cardiac - Chest/Heart</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span className="text-slate-400">Respiratory - Breathing</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                  <span className="text-slate-400">Gastro - Stomach</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  <span className="text-slate-400">Neuro - Brain/Nerve</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                  <span className="text-slate-400">Ortho - Bone/Joint</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-slate-400">General - Others</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
