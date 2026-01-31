'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { VoiceTriageWidget } from '@/components/voice-triage-widget'
import { triageAPI } from '@/lib/api'
import { 
  Mic, Send, ArrowRight, CheckCircle, AlertTriangle, 
  Heart, Thermometer, Activity, User, 
  FileText, Stethoscope, Brain, Clock, Shield
} from 'lucide-react'

interface PatientInfo {
  name: string;
  age: string;
  gender: string;
  phone: string;
  emergency_contact: string;
}

interface SymptomEntry {
  id: string;
  text: string;
  timestamp: Date;
  source: 'voice' | 'text';
  entities?: {
    type: string;
    value: string;
    confidence: number;
  }[];
}

interface TriageResult {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  symptoms: string[];
  recommended_action: string;
  ai_assessment: string;
  confidence: number;
  waiting_time_estimate?: string;
}

export default function PatientTriageEnhancedPage() {
  const router = useRouter()
  const [step, setStep] = useState<'info' | 'symptoms' | 'vitals' | 'review' | 'submitted'>('info')
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    name: '',
    age: '',
    gender: '',
    phone: '',
    emergency_contact: ''
  })
  const [symptoms, setSymptoms] = useState<SymptomEntry[]>([])
  const [textInput, setTextInput] = useState('')
  const [vitals, setVitals] = useState({
    heart_rate: '',
    blood_pressure_systolic: '',
    blood_pressure_diastolic: '',
    temperature: '',
    oxygen_level: ''
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null)
  const [caseId, setCaseId] = useState<string | null>(null)

  const handleVoiceResult = (transcript: string, analysis: any) => {
    const newSymptom: SymptomEntry = {
      id: Date.now().toString(),
      text: transcript,
      timestamp: new Date(),
      source: 'voice',
      entities: analysis?.entities || []
    }
    setSymptoms(prev => [...prev, newSymptom])
  }

  const handleTextSubmit = () => {
    if (!textInput.trim()) return
    
    const newSymptom: SymptomEntry = {
      id: Date.now().toString(),
      text: textInput,
      timestamp: new Date(),
      source: 'text'
    }
    setSymptoms(prev => [...prev, newSymptom])
    setTextInput('')
  }

  const handleSubmitTriage = async () => {
    setIsProcessing(true)
    try {
      const combinedSymptoms = symptoms.map(s => s.text).join('. ')
      
      const response = await triageAPI.submitVoiceTriage({
        patient_name: patientInfo.name,
        patient_age: parseInt(patientInfo.age),
        patient_gender: patientInfo.gender,
        symptoms: symptoms.map(s => s.text),
        transcript: combinedSymptoms,
        vitals: vitals.heart_rate ? {
          heart_rate: parseInt(vitals.heart_rate),
          blood_pressure: `${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic}`,
          temperature: parseFloat(vitals.temperature),
          oxygen_level: parseInt(vitals.oxygen_level)
        } : undefined
      })

      setCaseId(response.case_id)
      setTriageResult({
        severity: (response.severity as any) || 'MEDIUM',
        symptoms: symptoms.map(s => s.text),
        recommended_action: response.recommended_action || 'Please wait for a healthcare provider',
        ai_assessment: response.analysis?.summary || 'Your symptoms have been analyzed by our AI system.',
        confidence: response.confidence || 0.85,
        waiting_time_estimate: response.waiting_time
      })
      setStep('submitted')
    } catch (error) {
      console.error('Triage submission error:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return 'text-red-400 bg-red-500/20 border-red-500'
      case 'MEDIUM': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500'
      case 'LOW': return 'text-green-400 bg-green-500/20 border-green-500'
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-blue-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Stethoscope className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Nidaan.ai</h1>
                <p className="text-xs text-gray-400">AI-Powered Patient Triage</p>
              </div>
            </div>
            
            {/* Progress Indicator */}
            <div className="flex items-center gap-2">
              {['info', 'symptoms', 'vitals', 'review'].map((s, idx) => (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    step === s || ['info', 'symptoms', 'vitals', 'review'].indexOf(step) > idx
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-500'
                  }`}>
                    {['info', 'symptoms', 'vitals', 'review'].indexOf(step) > idx ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  {idx < 3 && (
                    <div className={`w-8 h-0.5 ${
                      ['info', 'symptoms', 'vitals', 'review'].indexOf(step) > idx
                        ? 'bg-blue-600'
                        : 'bg-gray-800'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Step 1: Patient Information */}
        {step === 'info' && (
          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
            <CardHeader>
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
                <User className="w-6 h-6 text-blue-400" />
              </div>
              <CardTitle className="text-2xl text-white">Patient Information</CardTitle>
              <CardDescription className="text-gray-400">
                Please provide your basic details to begin the triage process
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Full Name *</label>
                  <Input
                    value={patientInfo.name}
                    onChange={(e) => setPatientInfo(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your full name"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Age *</label>
                  <Input
                    type="number"
                    value={patientInfo.age}
                    onChange={(e) => setPatientInfo(prev => ({ ...prev, age: e.target.value }))}
                    placeholder="Age"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Gender *</label>
                  <select
                    value={patientInfo.gender}
                    onChange={(e) => setPatientInfo(prev => ({ ...prev, gender: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
                  <Input
                    type="tel"
                    value={patientInfo.phone}
                    onChange={(e) => setPatientInfo(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+91 XXXXX XXXXX"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Emergency Contact</label>
                  <Input
                    type="tel"
                    value={patientInfo.emergency_contact}
                    onChange={(e) => setPatientInfo(prev => ({ ...prev, emergency_contact: e.target.value }))}
                    placeholder="+91 XXXXX XXXXX"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
              </div>

              <Button
                onClick={() => setStep('symptoms')}
                disabled={!patientInfo.name || !patientInfo.age || !patientInfo.gender}
                className="w-full bg-blue-600 hover:bg-blue-500 py-6 text-lg"
              >
                Continue to Symptoms
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Symptoms Collection */}
        {step === 'symptoms' && (
          <div className="space-y-6">
            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                  <Brain className="w-6 h-6 text-purple-400" />
                </div>
                <CardTitle className="text-2xl text-white">Describe Your Symptoms</CardTitle>
                <CardDescription className="text-gray-400">
                  Use voice or text to describe what you're experiencing. Our AI will analyze your symptoms.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Voice Input */}
                <div className="flex justify-center">
                  <VoiceTriageWidget
                    onResult={handleVoiceResult}
                    onError={(error) => console.error('Voice error:', error)}
                    language="en-IN"
                  />
                </div>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-700" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-gray-900 text-gray-500">or type your symptoms</span>
                  </div>
                </div>

                {/* Text Input */}
                <div className="flex gap-2">
                  <Input
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Type your symptoms here..."
                    className="bg-gray-800 border-gray-700 text-white flex-1"
                    onKeyPress={(e) => e.key === 'Enter' && handleTextSubmit()}
                  />
                  <Button onClick={handleTextSubmit} className="bg-blue-600 hover:bg-blue-500">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>

                {/* Collected Symptoms */}
                {symptoms.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-300">Recorded Symptoms:</h4>
                    {symptoms.map((symptom) => (
                      <div
                        key={symptom.id}
                        className="p-3 bg-gray-800 rounded-lg border border-gray-700"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2">
                            {symptom.source === 'voice' ? (
                              <Mic className="w-4 h-4 text-purple-400 mt-1" />
                            ) : (
                              <FileText className="w-4 h-4 text-blue-400 mt-1" />
                            )}
                            <p className="text-white">{symptom.text}</p>
                          </div>
                          <button
                            onClick={() => setSymptoms(prev => prev.filter(s => s.id !== symptom.id))}
                            className="text-gray-500 hover:text-red-400"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep('info')}
                    className="flex-1 border-gray-700 text-gray-300"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep('vitals')}
                    disabled={symptoms.length === 0}
                    className="flex-1 bg-blue-600 hover:bg-blue-500"
                  >
                    Continue to Vitals
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Vitals (Optional) */}
        {step === 'vitals' && (
          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
            <CardHeader>
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center mb-4">
                <Heart className="w-6 h-6 text-red-400" />
              </div>
              <CardTitle className="text-2xl text-white">Vital Signs (Optional)</CardTitle>
              <CardDescription className="text-gray-400">
                If you have access to vital sign measurements, please provide them
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Heart className="w-4 h-4 inline mr-1 text-red-400" />
                    Heart Rate (bpm)
                  </label>
                  <Input
                    type="number"
                    value={vitals.heart_rate}
                    onChange={(e) => setVitals(prev => ({ ...prev, heart_rate: e.target.value }))}
                    placeholder="e.g., 72"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Thermometer className="w-4 h-4 inline mr-1 text-yellow-400" />
                    Temperature (°F)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={vitals.temperature}
                    onChange={(e) => setVitals(prev => ({ ...prev, temperature: e.target.value }))}
                    placeholder="e.g., 98.6"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Activity className="w-4 h-4 inline mr-1 text-blue-400" />
                    Blood Pressure (mmHg)
                  </label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      value={vitals.blood_pressure_systolic}
                      onChange={(e) => setVitals(prev => ({ ...prev, blood_pressure_systolic: e.target.value }))}
                      placeholder="Systolic"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                    <span className="text-gray-500">/</span>
                    <Input
                      type="number"
                      value={vitals.blood_pressure_diastolic}
                      onChange={(e) => setVitals(prev => ({ ...prev, blood_pressure_diastolic: e.target.value }))}
                      placeholder="Diastolic"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Shield className="w-4 h-4 inline mr-1 text-green-400" />
                    Oxygen Level (%)
                  </label>
                  <Input
                    type="number"
                    value={vitals.oxygen_level}
                    onChange={(e) => setVitals(prev => ({ ...prev, oxygen_level: e.target.value }))}
                    placeholder="e.g., 98"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-sm text-blue-300">
                  💡 Don't have vital sign measurements? No problem! You can skip this step.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep('symptoms')}
                  className="flex-1 border-gray-700 text-gray-300"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setStep('review')}
                  className="flex-1 bg-blue-600 hover:bg-blue-500"
                >
                  Review & Submit
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Review */}
        {step === 'review' && (
          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
            <CardHeader>
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mb-4">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <CardTitle className="text-2xl text-white">Review Your Information</CardTitle>
              <CardDescription className="text-gray-400">
                Please review before submitting for AI triage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Patient Info Summary */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Patient Information</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Name:</span>
                    <span className="text-white ml-2">{patientInfo.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Age:</span>
                    <span className="text-white ml-2">{patientInfo.age} years</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Gender:</span>
                    <span className="text-white ml-2 capitalize">{patientInfo.gender}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Phone:</span>
                    <span className="text-white ml-2">{patientInfo.phone || 'Not provided'}</span>
                  </div>
                </div>
              </div>

              {/* Symptoms Summary */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Reported Symptoms</h4>
                <div className="space-y-2">
                  {symptoms.map((symptom, idx) => (
                    <div key={symptom.id} className="flex items-start gap-2">
                      <span className="text-blue-400">{idx + 1}.</span>
                      <span className="text-white">{symptom.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep('vitals')}
                  className="flex-1 border-gray-700 text-gray-300"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmitTriage}
                  disabled={isProcessing}
                  className="flex-1 bg-green-600 hover:bg-green-500"
                >
                  {isProcessing ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Processing with AI...
                    </>
                  ) : (
                    <>
                      Submit for AI Triage
                      <Brain className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Submitted */}
        {step === 'submitted' && triageResult && (
          <div className="space-y-6">
            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
              <CardContent className="pt-8 text-center">
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 ${
                  triageResult.severity === 'HIGH' ? 'bg-red-500/20' :
                  triageResult.severity === 'MEDIUM' ? 'bg-yellow-500/20' : 'bg-green-500/20'
                }`}>
                  {triageResult.severity === 'HIGH' ? (
                    <AlertTriangle className="w-10 h-10 text-red-400" />
                  ) : triageResult.severity === 'MEDIUM' ? (
                    <Clock className="w-10 h-10 text-yellow-400" />
                  ) : (
                    <CheckCircle className="w-10 h-10 text-green-400" />
                  )}
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">Triage Complete</h2>
                <p className="text-gray-400 mb-6">Your case has been analyzed by our AI system</p>

                <div className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-semibold border ${getSeverityColor(triageResult.severity)}`}>
                  {triageResult.severity === 'HIGH' ? '🚨 HIGH PRIORITY' :
                   triageResult.severity === 'MEDIUM' ? '⚠️ MEDIUM PRIORITY' : '✓ LOW PRIORITY'}
                </div>

                {caseId && (
                  <p className="mt-4 text-sm text-gray-500">Case ID: {caseId}</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-400" />
                  AI Assessment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-300">{triageResult.ai_assessment}</p>
                
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <h4 className="font-medium text-blue-400 mb-2">Recommended Action</h4>
                  <p className="text-gray-300">{triageResult.recommended_action}</p>
                </div>

                {triageResult.waiting_time_estimate && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>Estimated wait time: {triageResult.waiting_time_estimate}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>AI Confidence:</span>
                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${triageResult.confidence * 100}%` }}
                    />
                  </div>
                  <span>{Math.round(triageResult.confidence * 100)}%</span>
                </div>
              </CardContent>
            </Card>

            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
              <p className="text-gray-400 mb-4">
                A healthcare provider will review your case shortly.
              </p>
              <Button
                onClick={() => {
                  setStep('info')
                  setSymptoms([])
                  setVitals({ heart_rate: '', blood_pressure_systolic: '', blood_pressure_diastolic: '', temperature: '', oxygen_level: '' })
                  setPatientInfo({ name: '', age: '', gender: '', phone: '', emergency_contact: '' })
                  setTriageResult(null)
                  setCaseId(null)
                }}
                variant="outline"
                className="border-gray-700 text-gray-300"
              >
                Start New Triage
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-gray-900/50 py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          <p>Powered by IBM Watson • watsonx Orchestrate • IBM Cloudant</p>
          <p className="mt-1">© 2024 Nidaan.ai - Autonomous Patient Intake & Triage</p>
        </div>
      </footer>
    </div>
  )
}
