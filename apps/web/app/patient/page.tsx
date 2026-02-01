'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuthStore, useAudioStore } from '@/lib/store'
import { audioAPI, uploadToS3 } from '@/lib/api'
import { AIVoiceOrb, VoiceState } from '@/components/ai-voice-orb'
import { Mic, MessageCircle, Globe, Send, X, ChevronDown, LogOut, Clock, CheckCircle2 } from 'lucide-react'

const LANGUAGES = [
  { code: 'hi-IN', name: 'हिन्दी', fullName: 'Hindi' },
  { code: 'ta-IN', name: 'தமிழ்', fullName: 'Tamil' },
  { code: 'te-IN', name: 'తెలుగు', fullName: 'Telugu' },
  { code: 'mr-IN', name: 'मराठी', fullName: 'Marathi' },
  { code: 'bn-IN', name: 'বাংলা', fullName: 'Bengali' },
  { code: 'en-IN', name: 'English', fullName: 'English' },
]

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

export default function PatientPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const { isRecording, audioBlob, duration, language, setRecording, setAudioBlob, setDuration, setLanguage, reset } = useAudioStore()
  
  // UI State
  const [activeMode, setActiveMode] = useState<'voice' | 'chat'>('voice')
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [audioLevel, setAudioLevel] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  
  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI health assistant. You can describe your symptoms here, and I\'ll help prepare information for your doctor. How are you feeling today?',
      timestamp: new Date()
    }
  ])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  
  // Processing State
  const [visitId, setVisitId] = useState<string | null>(null)
  const [processingStage, setProcessingStage] = useState<string>('')
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Check authentication
  useEffect(() => {
    if (!user) {
      router.push('/login')
    }
  }, [user, router])

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Audio level visualization
  const startAudioVisualization = useCallback((stream: MediaStream) => {
    audioContextRef.current = new AudioContext()
    analyserRef.current = audioContextRef.current.createAnalyser()
    const source = audioContextRef.current.createMediaStreamSource(stream)
    source.connect(analyserRef.current)
    analyserRef.current.fftSize = 256
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    
    const updateLevel = () => {
      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length
        setAudioLevel(Math.min(100, average * 1.5))
      }
      animationFrameRef.current = requestAnimationFrame(updateLevel)
    }
    
    updateLevel()
  }, [])

  const stopAudioVisualization = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
    }
    setAudioLevel(0)
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
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
        stream.getTracks().forEach((track) => track.stop())
        stopAudioVisualization()
      }
      
      mediaRecorder.start()
      setRecording(true)
      setVoiceState('listening')
      startAudioVisualization(stream)
      
      // Start timer
      let seconds = 0
      timerRef.current = setInterval(() => {
        seconds++
        setDuration(seconds)
      }, 1000)
      
    } catch (error) {
      console.error('Error accessing microphone:', error)
      setVoiceState('error')
      setStatusMessage('Could not access microphone')
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

  const handleOrbClick = () => {
    if (voiceState === 'idle') {
      startRecording()
    } else if (voiceState === 'listening') {
      stopRecording()
      // Show stopped state, let user manually submit or re-record
      setVoiceState('idle')
    } else if (voiceState === 'error') {
      setVoiceState('idle')
      reset()
    }
  }

  const handleSubmit = () => {
    if (audioBlob) {
      uploadAndProcess()
    }
  }

  const handleReRecord = () => {
    reset()
    setVoiceState('idle')
    setStatusMessage('')
  }

  const pollProcessingStatus = async (visitId: string, retries = 30) => {
    for (let i = 0; i < retries; i++) {
      try {
        const status = await audioAPI.getProcessingStatus(visitId)
        
        switch (status.status) {
          case 'TRANSCRIBING':
            setProcessingStage('Transcribing your voice...')
            break
          case 'ANALYZING':
            setProcessingStage('AI analyzing symptoms...')
            break
          case 'COMPLETED':
            setVoiceState('speaking')
            setProcessingStage('Complete!')
            setStatusMessage('Your doctor will review this shortly')
            setTimeout(() => {
              setVoiceState('idle')
              reset()
              setVisitId(null)
              setProcessingStage('')
              setStatusMessage('')
            }, 4000)
            return
          case 'FAILED':
            setVoiceState('error')
            setStatusMessage('Processing failed. Please try again.')
            return
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000))
        
      } catch (error) {
        console.error('Error polling status:', error)
      }
    }
    
    setStatusMessage('Processing taking longer than expected.')
    setVoiceState('idle')
  }

  const uploadAndProcess = async () => {
    if (!audioBlob) return
    
    setVoiceState('processing')
    setProcessingStage('Creating visit record...')
    
    try {
      const visitData = {
        patient_id: user?.user_id || 'DEMO_PATIENT',
        clinic_id: user?.clinic_id || 'CLINIC_DEMO',
        language_code: language,
        audio_duration_seconds: duration,
      }
      
      const visit = await audioAPI.createVisit(visitData)
      setVisitId(visit.visit_id)
      
      setProcessingStage('Uploading audio...')
      const uploadData = await audioAPI.getUploadUrl(visit.visit_id, 'webm')
      
      await uploadToS3(uploadData.upload_url, audioBlob)
      
      setProcessingStage('Starting AI analysis...')
      await audioAPI.processAudio(visit.visit_id, uploadData.audio_s3_key)
      
      await pollProcessingStatus(visit.visit_id)
      
    } catch (error: any) {
      console.error('Upload error:', error)
      setVoiceState('error')
      setStatusMessage(error.message || 'Upload failed')
    }
  }

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || isTyping) return
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
      timestamp: new Date()
    }
    
    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setIsTyping(true)
    
    // Simulate AI response (in production, this would call the API)
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateAIResponse(chatInput),
        timestamp: new Date()
      }
      setChatMessages(prev => [...prev, aiResponse])
      setIsTyping(false)
    }, 1500)
  }

  const generateAIResponse = (input: string): string => {
    const lower = input.toLowerCase()
    if (lower.includes('headache') || lower.includes('head pain')) {
      return "I understand you're experiencing headaches. Can you tell me:\n\n• How long have you had this headache?\n• Is it on one side or both sides?\n• On a scale of 1-10, how severe is the pain?\n• Do you have any other symptoms like nausea or sensitivity to light?"
    }
    if (lower.includes('fever') || lower.includes('temperature')) {
      return "I see you have a fever. Let me ask a few questions:\n\n• What is your current temperature if you've measured it?\n• When did the fever start?\n• Do you have any other symptoms like cough, body aches, or chills?"
    }
    if (lower.includes('chest') || lower.includes('heart')) {
      return "⚠️ Chest-related symptoms need careful attention. Please describe:\n\n• Is it a pain, pressure, or tightness?\n• Does it spread to your arm, jaw, or back?\n• Do you have shortness of breath?\n\nIf you're experiencing severe chest pain, please seek immediate medical attention."
    }
    if (lower.includes('stomach') || lower.includes('abdominal') || lower.includes('vomit')) {
      return "I'll help document your stomach issues. Please tell me:\n\n• Where exactly is the pain?\n• When did it start?\n• Have you had any vomiting or diarrhea?\n• What was the last thing you ate?"
    }
    return "Thank you for sharing that. To help your doctor better understand your condition, could you please describe:\n\n• When did these symptoms start?\n• How severe are they (mild, moderate, severe)?\n• Is there anything that makes them better or worse?"
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleLogout = () => {
    clearAuth()
    router.push('/login')
  }

  const selectedLanguage = LANGUAGES.find(l => l.code === language) || LANGUAGES[0]

  if (!user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <nav className="border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <div>
              <div className="text-xl font-bold text-white">Nidaan.ai</div>
              <div className="text-xs text-slate-400">AI Health Assistant</div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 hover:bg-slate-700/50 transition-colors"
              >
                <Globe size={16} className="text-slate-400" />
                <span className="text-sm text-white">{selectedLanguage.name}</span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>
              
              {showLanguageMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code)
                        setShowLanguageMenu(false)
                      }}
                      className={`w-full px-4 py-2.5 text-left hover:bg-slate-700 transition-colors flex justify-between items-center ${
                        language === lang.code ? 'bg-blue-600/20 text-blue-400' : 'text-white'
                      }`}
                    >
                      <span>{lang.name}</span>
                      <span className="text-xs text-slate-400">{lang.fullName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* User Info */}
            <div className="hidden sm:block text-right">
              <div className="text-sm font-medium text-white">{user.name}</div>
              <div className="text-xs text-slate-400">Patient</div>
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

      {/* Mode Toggle */}
      <div className="container mx-auto px-4 pt-6">
        <div className="flex justify-center">
          <div className="inline-flex bg-slate-800/50 rounded-xl p-1 border border-slate-700/50">
            <button
              onClick={() => setActiveMode('voice')}
              className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg transition-all ${
                activeMode === 'voice' 
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Mic size={18} />
              <span className="font-medium">Voice Mode</span>
            </button>
            <button
              onClick={() => setActiveMode('chat')}
              className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg transition-all ${
                activeMode === 'chat' 
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageCircle size={18} />
              <span className="font-medium">Chat Mode</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {activeMode === 'voice' ? (
          /* Voice Mode Interface */
          <div className="flex flex-col items-center max-w-2xl mx-auto">
            {/* Title */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">
                Describe Your Symptoms
              </h1>
              <p className="text-slate-400">
                Speak naturally in {selectedLanguage.fullName}. Our AI will understand and help.
              </p>
            </div>

            {/* Voice Orb */}
            <div className="relative">
              <AIVoiceOrb
                state={voiceState}
                audioLevel={audioLevel}
                onClick={handleOrbClick}
                size="lg"
                statusText={voiceState === 'processing' ? processingStage : undefined}
              />
              
              {/* Duration Display */}
              {voiceState === 'listening' && (
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-slate-800/90 px-4 py-1.5 rounded-full border border-slate-700">
                  <span className="text-cyan-400 font-mono text-lg">{formatTime(duration)}</span>
                </div>
              )}
            </div>

            {/* Recording Saved - Show Submit/Re-record buttons */}
            {audioBlob && voiceState === 'idle' && !statusMessage && (
              <div className="mt-6 flex flex-col items-center space-y-4">
                <div className="text-green-400 font-medium flex items-center">
                  <CheckCircle2 className="mr-2" size={20} />
                  Recording saved ({formatTime(duration)})
                </div>
                <div className="flex space-x-4">
                  <Button
                    onClick={handleSubmit}
                    className="bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white px-6 py-2"
                  >
                    <Send className="mr-2" size={18} />
                    Submit to Doctor
                  </Button>
                  <Button
                    onClick={handleReRecord}
                    variant="outline"
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    <Mic className="mr-2" size={18} />
                    Re-record
                  </Button>
                </div>
              </div>
            )}

            {/* Status Message */}
            {statusMessage && (
              <div className="mt-6 text-center">
                <p className="text-slate-300 flex items-center justify-center space-x-2">
                  {voiceState === 'speaking' && <CheckCircle2 className="text-green-400" size={20} />}
                  <span>{statusMessage}</span>
                </p>
              </div>
            )}

            {/* Instructions Card */}
            <Card className="mt-12 w-full bg-slate-800/30 border-slate-700/50">
              <CardContent className="p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center">
                  <Clock className="mr-2 text-blue-400" size={18} />
                  How It Works
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-400 font-bold">1</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">Tap the Orb</p>
                      <p className="text-slate-400 text-sm">Start speaking about your symptoms</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-cyan-600/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-cyan-400 font-bold">2</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">AI Processes</p>
                      <p className="text-slate-400 text-sm">We transcribe and analyze your symptoms</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-green-600/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-green-400 font-bold">3</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">Doctor Reviews</p>
                      <p className="text-slate-400 text-sm">Your doctor receives a detailed report</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Example */}
            <div className="mt-6 w-full p-4 rounded-lg bg-amber-950/30 border border-amber-800/30">
              <p className="text-amber-200 text-sm font-medium mb-2">💡 Example ({selectedLanguage.fullName}):</p>
              {language === 'hi-IN' ? (
                <p className="text-slate-300 text-sm italic">
                  "मुझे कल रात से सीने में दर्द हो रहा है। दर्द बाएं हाथ में भी जा रहा है। सांस लेने में भी थोड़ी तकलीफ है।"
                </p>
              ) : language === 'ta-IN' ? (
                <p className="text-slate-300 text-sm italic">
                  "நேற்று இரவிலிருந்து எனக்கு நெஞ்சு வலி இருக்கிறது. வலி இடது கையிலும் பரவுகிறது."
                </p>
              ) : (
                <p className="text-slate-300 text-sm italic">
                  "I've been having chest pain since last night. The pain is also spreading to my left arm. I'm also having some difficulty breathing."
                </p>
              )}
            </div>
          </div>
        ) : (
          /* Chat Mode Interface */
          <div className="max-w-2xl mx-auto">
            <Card className="bg-slate-800/50 border-slate-700/50 overflow-hidden h-[calc(100vh-280px)] flex flex-col">
              {/* Chat Header */}
              <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/80">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                    <MessageCircle className="text-white" size={20} />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">AI Health Assistant</h3>
                    <p className="text-xs text-green-400 flex items-center">
                      <span className="w-2 h-2 bg-green-400 rounded-full mr-1.5 animate-pulse" />
                      Online • Powered by watsonx
                    </p>
                  </div>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-md'
                          : 'bg-slate-700/70 text-slate-100 rounded-bl-md'
                      }`}
                    >
                      <p className="whitespace-pre-line text-sm leading-relaxed">{msg.content}</p>
                      <p className={`text-xs mt-1.5 ${msg.role === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                
                {/* Typing Indicator */}
                {isTyping && (
                  <div className="flex justify-start animate-slide-up">
                    <div className="bg-slate-700/70 rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex space-x-1.5">
                        <div className="w-2 h-2 bg-slate-400 rounded-full typing-dot-1" />
                        <div className="w-2 h-2 bg-slate-400 rounded-full typing-dot-2" />
                        <div className="w-2 h-2 bg-slate-400 rounded-full typing-dot-3" />
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleChatSubmit} className="p-4 border-t border-slate-700/50 bg-slate-800/50">
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Describe your symptoms..."
                    className="flex-1 bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <Button
                    type="submit"
                    disabled={!chatInput.trim() || isTyping}
                    className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white rounded-xl px-4 py-3 h-auto"
                  >
                    <Send size={20} />
                  </Button>
                </div>
              </form>
            </Card>

            {/* Quick Actions */}
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {['I have a headache', 'Feeling feverish', 'Stomach pain', 'Feeling dizzy'].map((action) => (
                <button
                  key={action}
                  onClick={() => setChatInput(action)}
                  className="px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700 text-slate-300 text-sm hover:bg-slate-700/50 hover:text-white transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
