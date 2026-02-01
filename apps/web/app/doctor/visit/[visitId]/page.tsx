'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/lib/store'
import { doctorAPI } from '@/lib/api'
import { ArrowLeft, AlertTriangle, CheckCircle2, Activity, FileText, CheckSquare, Loader2 } from 'lucide-react'

export default function VisitDetailPage() {
  const router = useRouter()
  const params = useParams()
  const visitId = params?.visitId as string
  const user = useAuthStore((state) => state.user)
  
  const [visit, setVisit] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('soap')
  const [marking, setMarking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user || (user.role !== 'doctor' && user.role !== 'admin')) {
      router.push('/login')
      return
    }
    
    if (visitId) {
      fetchVisitDetails()
    }
  }, [user, router, visitId])

  const fetchVisitDetails = async () => {
    try {
      setError(null)
      const data = await doctorAPI.getVisitDetails(visitId)
      setVisit(data)
      setLoading(false)
    } catch (error: any) {
      console.error('Error fetching visit details:', error)
      setError(error?.response?.data?.detail || 'Failed to load visit details')
      setLoading(false)
    }
  }

  const handleMarkComplete = async () => {
    setMarking(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://nidaan-api.25r5a6g2yvmy.eu-de.codeengine.appdomain.cloud/api/v1'}/doctors/visits/${visitId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify({ status: 'COMPLETED' })
      })
      
      if (response.ok) {
        setVisit((prev: any) => ({ ...prev, status: 'COMPLETED' }))
      } else {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to update')
      }
    } catch (error) {
      console.error('Error marking complete:', error)
    } finally {
      setMarking(false)
    }
  }

  if (!user) return null

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <Activity className="animate-spin mx-auto mb-4 text-blue-400" size={48} />
          <p className="text-slate-300">Loading visit details...</p>
        </div>
      </div>
    )
  }

  if (!visit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <p className="text-red-400 mb-2">Visit not found</p>
          {error && <p className="text-sm text-slate-400 mb-4 max-w-md">{error}</p>}
          <Button onClick={() => router.push('/doctor/dashboard')} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white">
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <nav className="border-b border-slate-700 bg-slate-800 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/doctor/dashboard')}
            className="mb-2 text-slate-300 hover:text-white hover:bg-slate-700"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">Visit Details</h1>
              <p className="text-sm text-slate-400">Visit ID: {visit.visit_id}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm text-slate-400">Patient</div>
                <div className="font-semibold text-white">{visit.patient_id}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-400">Status</div>
                <div className={`font-semibold ${visit.status === 'COMPLETED' ? 'text-green-400' : 'text-yellow-400'}`}>
                  {visit.status}
                </div>
              </div>
              {visit.status !== 'COMPLETED' && (
                <Button 
                  onClick={handleMarkComplete}
                  disabled={marking}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {marking ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Marking...
                    </>
                  ) : (
                    <>
                      <CheckSquare size={16} className="mr-2" />
                      Mark as Complete
                    </>
                  )}
                </Button>
              )}
              {visit.status === 'COMPLETED' && (
                <div className="flex items-center px-3 py-2 bg-green-900/30 border border-green-700 rounded text-green-400">
                  <CheckCircle2 size={16} className="mr-2" />
                  Reviewed
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        {/* Red Flags Alert */}
        {visit.red_flags?.has_red_flags && (
          <Card className="mb-6 border-red-700 bg-red-900/30">
            <CardHeader>
              <CardTitle className="flex items-center text-red-400">
                <AlertTriangle size={24} className="mr-2" />
                RED FLAGS DETECTED
              </CardTitle>
              <CardDescription className="text-red-300">
                {visit.red_flags.triage_recommendation}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {visit.red_flags.red_flags_detected?.map((flag: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-800 rounded border border-red-700">
                    <div className="font-semibold text-red-400">{flag.category}</div>
                    <div className="text-sm text-slate-300">{flag.finding}</div>
                    <div className="text-sm text-slate-400 mt-1">
                      <strong className="text-slate-300">Action:</strong> {flag.action}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <div className="mb-6 flex space-x-2 border-b border-slate-700">
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'soap' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
            onClick={() => setActiveTab('soap')}
          >
            <FileText size={16} className="inline mr-2" />
            SOAP Note
          </button>
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'diagnosis' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
            onClick={() => setActiveTab('diagnosis')}
          >
            <CheckCircle2 size={16} className="inline mr-2" />
            Differential Diagnosis
          </button>
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'transcript' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
            onClick={() => setActiveTab('transcript')}
          >
            <Activity size={16} className="inline mr-2" />
            Original Transcript
          </button>
        </div>

        {/* SOAP Note Tab */}
        {activeTab === 'soap' && visit.soap_note && (
          <div className="space-y-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Subjective</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-slate-300">{visit.soap_note.subjective}</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Objective</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-slate-300">{visit.soap_note.objective}</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-slate-300">{visit.soap_note.assessment}</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-slate-300">{visit.soap_note.plan}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Differential Diagnosis Tab */}
        {activeTab === 'diagnosis' && (
          <div className="space-y-4">
            {visit.differential_diagnosis && visit.differential_diagnosis.length > 0 ? (
              visit.differential_diagnosis.map((dd: any, idx: number) => (
                <Card key={idx} className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-white">
                      <span>{idx + 1}. {dd.diagnosis}</span>
                      <span className={`text-sm px-3 py-1 rounded ${
                        dd.probability === 'HIGH' ? 'bg-red-900/50 text-red-300 border border-red-700' :
                        dd.probability === 'MEDIUM' ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700' :
                        'bg-green-900/50 text-green-300 border border-green-700'
                      }`}>
                        {dd.probability}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-green-400 mb-1">Supporting Factors:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {dd.supporting_factors?.map((factor: string, i: number) => (
                          <li key={i} className="text-sm text-slate-300">{factor}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-red-400 mb-1">Against:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {dd.against?.map((factor: string, i: number) => (
                          <li key={i} className="text-sm text-slate-300">{factor}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-blue-400 mb-1">Next Steps:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {dd.next_steps?.map((step: string, i: number) => (
                          <li key={i} className="text-sm text-slate-300">{step}</li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="text-center py-8 text-slate-400">
                  No differential diagnosis available yet
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Transcript Tab */}
        {activeTab === 'transcript' && (
          <div className="space-y-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Original Transcript ({visit.language_code})</CardTitle>
                <CardDescription className="text-slate-400">Patient's original description in their language</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-lg text-slate-300">
                  {visit.transcript || 'Transcription in progress...'}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Translated to Medical English</CardTitle>
                <CardDescription className="text-slate-400">AI-translated and medicalized version</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-slate-300">
                  {visit.translated_text || 'Translation in progress...'}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
