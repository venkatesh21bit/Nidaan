'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore, useAudioStore } from '@/lib/store'
import { audioAPI, uploadToS3 } from '@/lib/api'
import { Mic, Square, Upload, Loader2 } from 'lucide-react'

const LANGUAGES = [
  { code: 'hi-IN', name: 'हिन्दी (Hindi)', flag: '🇮🇳' },
  { code: 'ta-IN', name: 'தமிழ் (Tamil)', flag: '🇮🇳' },
  { code: 'te-IN', name: 'తెలుగు (Telugu)', flag: '🇮🇳' },
  { code: 'mr-IN', name: 'मराठी (Marathi)', flag: '🇮🇳' },
  { code: 'bn-IN', name: 'বাংলা (Bengali)', flag: '🇮🇳' },
  { code: 'en-IN', name: 'English', flag: '🇬🇧' },
]

export default function PatientPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const { isRecording, audioBlob, duration, language, setRecording, setAudioBlob, setDuration, setLanguage, reset } = useAudioStore()
  
  const [uploading, setUploading] = useState(false)
  const [visitId, setVisitId] = useState<string | null>(null)
  const [processingStatus, setProcessingStatus] = useState<string>('')
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Check authentication
  useEffect(() => {
    if (!user) {
      router.push('/login')
    }
  }, [user, router])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Use webm format for better compression
      const options = { mimeType: 'audio/webm;codecs=opus' }
      const mediaRecorder = new MediaRecorder(stream, options)
      
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop())
      }
      
      mediaRecorder.start()
      setRecording(true)
      
      // Start timer
      let seconds = 0
      timerRef.current = setInterval(() => {
        seconds++
        setDuration(seconds)
      }, 1000)
      
    } catch (error) {
      console.error('Error accessing microphone:', error)
      alert('Could not access microphone. Please grant permission.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      setRecording(false)
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  const pollProcessingStatus = async (visitId: string, retries = 30) => {
    for (let i = 0; i < retries; i++) {
      try {
        const status = await audioAPI.getProcessingStatus(visitId)
        
        switch (status.status) {
          case 'TRANSCRIBING':
            setProcessingStatus('🎤 Transcribing your voice...')
            break
          case 'ANALYZING':
            setProcessingStatus('🧠 AI analyzing symptoms...')
            break
          case 'COMPLETED':
            setProcessingStatus('✅ Complete! Your doctor will review this shortly.')
            setTimeout(() => {
              reset()
              setVisitId(null)
              setProcessingStatus('')
              setUploading(false)
            }, 3000)
            return
          case 'FAILED':
            setProcessingStatus('❌ Processing failed. Please try again.')
            setUploading(false)
            return
        }
        
        // Wait 2 seconds before polling again
        await new Promise(resolve => setTimeout(resolve, 2000))
        
      } catch (error) {
        console.error('Error polling status:', error)
      }
    }
    
    // Timeout
    setProcessingStatus('Processing taking longer than expected. The doctor will be notified.')
    setUploading(false)
  }

  const uploadAndProcess = async () => {
    if (!audioBlob) return
    
    setUploading(true)
    setProcessingStatus('📝 Creating visit record...')
    
    try {
      // Step 1: Create visit record
      const visitData = {
        patient_id: user?.user_id || 'DEMO_PATIENT',
        clinic_id: user?.clinic_id || 'CLINIC_DEMO',
        language_code: language,
        audio_duration_seconds: duration,
      }
      
      const visit = await audioAPI.createVisit(visitData)
      setVisitId(visit.visit_id)
      
      // Step 2: Get presigned URL for S3 upload
      setProcessingStatus('🔗 Getting upload URL...')
      const uploadData = await audioAPI.getUploadUrl(visit.visit_id, 'webm')
      
      // Step 3: Upload to S3
      setProcessingStatus('📤 Uploading audio...')
      await uploadToS3(uploadData.upload_url, audioBlob)
      
      // Step 4: Start processing
      setProcessingStatus('🚀 Starting AI analysis...')
      await audioAPI.processAudio(visit.visit_id, uploadData.audio_s3_key)
      
      // Step 5: Poll for processing status
      await pollProcessingStatus(visit.visit_id)
      
    } catch (error: any) {
      console.error('Upload error:', error)
      setProcessingStatus(`❌ Error: ${error.message || 'Upload failed'}`)
      setUploading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <nav className="border-b border-slate-700 bg-slate-800">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold text-blue-400">Nidaan.ai</div>
          <div className="text-sm text-slate-300">Welcome, {user.name}</div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-center text-2xl text-white">
              🗣️ Record Your Symptoms
            </CardTitle>
            <CardDescription className="text-center text-slate-300">
              Speak in your native language while you wait
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Language Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Select Your Language</label>
              <select
                className="flex h-10 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-white"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={isRecording || uploading}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Recording Interface */}
            <div className="flex flex-col items-center space-y-4 py-8">
              {isRecording && (
                <div className="text-4xl font-mono text-blue-400">
                  {formatTime(duration)}
                </div>
              )}
              
              {audioBlob && !isRecording && (
                <div className="text-green-400 font-semibold">
                  ✓ Recording saved ({formatTime(duration)})
                </div>
              )}
              
              <div className="flex space-x-4">
                {!isRecording && !audioBlob && (
                  <Button
                    size="lg"
                    onClick={startRecording}
                    className="bg-red-600 hover:bg-red-700 text-white w-32"
                  >
                    <Mic className="mr-2" size={20} />
                    Record
                  </Button>
                )}
                
                {isRecording && (
                  <Button
                    size="lg"
                    onClick={stopRecording}
                    variant="outline"
                    className="w-32 border-slate-600 text-slate-200 hover:bg-slate-700"
                  >
                    <Square className="mr-2" size={20} />
                    Stop
                  </Button>
                )}
                
                {audioBlob && !uploading && (
                  <>
                    <Button
                      size="lg"
                      onClick={uploadAndProcess}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Upload className="mr-2" size={20} />
                      Submit
                    </Button>
                    <Button
                      size="lg"
                      onClick={reset}
                      variant="outline"
                      className="border-slate-600 text-slate-200 hover:bg-slate-700"
                    >
                      Re-record
                    </Button>
                  </>
                )}
              </div>
              
              {uploading && (
                <div className="flex items-center space-x-2 text-blue-400">
                  <Loader2 className="animate-spin" />
                  <span>{processingStatus}</span>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-slate-700/50 p-4 rounded-lg space-y-2 text-sm border border-slate-600">
              <p className="font-semibold text-white">📝 Instructions:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-300">
                <li>Tap "Record" and describe your symptoms</li>
                <li>Speak clearly about what you're experiencing</li>
                <li>Mention when symptoms started and how severe they are</li>
                <li>The AI will translate and prepare a report for your doctor</li>
              </ul>
            </div>

            {/* Example */}
            <div className="bg-amber-900/30 p-4 rounded-lg text-sm border border-amber-700/50">
              <p className="font-semibold mb-2 text-amber-200">💡 Example (Hindi):</p>
              <p className="text-slate-300 italic">
                "मुझे कल रात से सीने में दर्द हो रहा है। दर्द बाएं हाथ में भी जा रहा है। 
                सांस लेने में भी थोड़ी तकलीफ है।"
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
