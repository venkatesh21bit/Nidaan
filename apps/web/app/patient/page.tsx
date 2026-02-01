'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuthStore, useAudioStore } from '@/lib/store'
import { 
  Mic, 
  MessageCircle, 
  Globe, 
  Send, 
  ChevronDown, 
  LogOut, 
  Clock, 
  CheckCircle2,
  FileText,
  Volume2,
  VolumeX,
  RotateCcw,
  StopCircle
} from 'lucide-react'

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

interface CollectedData {
  symptoms: string[]
  duration?: string
  severity?: string
  location?: string
  associated_symptoms: string[]
}

export default function PatientPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const { language, setLanguage } = useAudioStore()
  
  // UI State
  const [activeMode, setActiveMode] = useState<'voice' | 'chat'>('chat')
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  
  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI health assistant. Please describe your symptoms naturally - tell me what\'s bothering you, when it started, and how severe it is. Take your time, and when you\'re done, click "End Conversation" to submit to your doctor.',
      timestamp: new Date()
    }
  ])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [collectedData, setCollectedData] = useState<CollectedData>({
    symptoms: [],
    associated_symptoms: []
  })
  const [conversationEnded, setConversationEnded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  
  // Voice State
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceMessages, setVoiceMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI health assistant. Please tap the microphone and tell me about your symptoms. I\'ll ask follow-up questions to understand your condition better.',
      timestamp: new Date()
    }
  ])
  const [voiceCollectedData, setVoiceCollectedData] = useState<CollectedData>({
    symptoms: [],
    associated_symptoms: []
  })
  const [voiceConversationEnded, setVoiceConversationEnded] = useState(false)
  const [voiceSubmitted, setVoiceSubmitted] = useState(false)
  
  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null)
  const voiceChatEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)

  // Check authentication
  useEffect(() => {
    if (!user) {
      router.push('/login')
    }
  }, [user, router])

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis
    }
  }, [])

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  useEffect(() => {
    voiceChatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [voiceMessages])

  // ==================== Chat Functions ====================
  
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || isTyping || conversationEnded) return
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
      timestamp: new Date()
    }
    
    setChatMessages(prev => [...prev, userMessage])
    const currentInput = chatInput
    setChatInput('')
    setIsTyping(true)
    
    try {
      const conversationHistory = chatMessages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }))
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://nidaan-api.25r5a6g2yvmy.eu-de.codeengine.appdomain.cloud/api/v1'}/patients/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify({
          message: currentInput,
          conversation_history: conversationHistory,
          language: language
        })
      })
      
      if (!response.ok) throw new Error('Chat API failed')
      
      const data = await response.json()
      
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      }
      setChatMessages(prev => [...prev, aiResponse])
      
      // Update collected data
      if (data.collected_symptoms) {
        setCollectedData(prev => ({
          ...prev,
          symptoms: data.collected_symptoms
        }))
      }
    } catch (error) {
      console.error('Chat error:', error)
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I understand. Is there anything else you'd like to add about your symptoms?",
        timestamp: new Date()
      }
      setChatMessages(prev => [...prev, aiResponse])
    } finally {
      setIsTyping(false)
    }
  }

  const handleEndConversation = () => {
    setConversationEnded(true)
    const summaryMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `Thank you for sharing your symptoms. Here's what I've collected:\n\n${
        collectedData.symptoms.length > 0 
          ? `**Symptoms:** ${collectedData.symptoms.join(', ')}\n` 
          : ''
      }${
        collectedData.duration ? `**Duration:** ${collectedData.duration}\n` : ''
      }${
        collectedData.severity ? `**Severity:** ${collectedData.severity}/10\n` : ''
      }${
        collectedData.associated_symptoms.length > 0 
          ? `**Associated symptoms:** ${collectedData.associated_symptoms.join(', ')}\n` 
          : ''
      }\nClick "Submit to Doctor" when you're ready, or "Continue" to add more details.`,
      timestamp: new Date()
    }
    setChatMessages(prev => [...prev, summaryMessage])
  }

  const handleContinueConversation = () => {
    setConversationEnded(false)
    const continueMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: "No problem! Please continue describing any additional symptoms or details you'd like to share.",
      timestamp: new Date()
    }
    setChatMessages(prev => [...prev, continueMessage])
  }

  const handleSubmitToDoctor = async () => {
    setSubmitting(true)
    try {
      // Compile all messages into symptom details
      const symptomDetails = chatMessages
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .join('. ')
      
      // Create an appointment with the collected symptoms
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://nidaan-api.25r5a6g2yvmy.eu-de.codeengine.appdomain.cloud/api/v1'}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify({
          patient_name: user?.name || 'Patient',
          patient_email: user?.email || '',
          symptoms: collectedData.symptoms,
          symptom_details: symptomDetails,
          severity: collectedData.severity || null,
          duration: collectedData.duration || null,
          notes: `Collected via AI chat on ${new Date().toLocaleDateString()}`,
          language: language
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setSubmitted(true)
        const successMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `✅ **Appointment Request Submitted!**\n\n**Appointment ID:** ${data.id}\n**Status:** Pending confirmation\n\nYour symptoms have been recorded and sent to the doctor. You will receive a confirmation once your appointment is scheduled.\n\n**Symptoms Recorded:**\n${collectedData.symptoms.map(s => `• ${s}`).join('\n')}\n\nThank you for using Nidaan.ai!`,
          timestamp: new Date()
        }
        setChatMessages(prev => [...prev, successMessage])
      } else {
        throw new Error('Failed to create appointment')
      }
    } catch (error) {
      console.error('Submit error:', error)
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '❌ Sorry, there was an error submitting your appointment. Please try again.',
        timestamp: new Date()
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetChat = async () => {
    // Reset server-side conversation data
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://nidaan-api.25r5a6g2yvmy.eu-de.codeengine.appdomain.cloud/api/v1'}/patients/chat/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        }
      })
    } catch (e) {
      console.error('Reset API error:', e)
    }
    
    // Reset local state
    setChatMessages([{
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI health assistant. Please describe your symptoms naturally. When you\'re done, click "End Conversation" to submit.',
      timestamp: new Date()
    }])
    setCollectedData({ symptoms: [], associated_symptoms: [] })
    setConversationEnded(false)
    setSubmitted(false)
  }

  // ==================== Voice Functions ====================

  const speakText = useCallback((text: string, autoListen: boolean = true) => {
    if (!synthRef.current) return
    
    synthRef.current.cancel()
    
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = language
    utterance.rate = 0.9
    utterance.pitch = 1
    
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => {
      setIsSpeaking(false)
      // Auto-start listening after AI finishes speaking (if enabled and conversation not ended)
      if (autoListen && !voiceConversationEnded && !voiceSubmitted) {
        setTimeout(() => {
          console.log('Auto-starting voice recognition after speech...')
          startListening()
        }, 800)
      }
    }
    utterance.onerror = (e) => {
      console.error('Speech synthesis error:', e)
      setIsSpeaking(false)
    }
    
    synthRef.current.speak(utterance)
  }, [language, voiceConversationEnded, voiceSubmitted])

  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Please use Chrome.')
      return
    }
    
    // Don't start if already listening or if conversation ended
    if (isListening || isSpeaking || voiceConversationEnded || voiceSubmitted) {
      console.log('Skipping startListening - already active or ended')
      return
    }
    
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    recognitionRef.current = new SpeechRecognition()
    
    recognitionRef.current.continuous = false
    recognitionRef.current.interimResults = true
    recognitionRef.current.lang = language
    recognitionRef.current.maxAlternatives = 1
    
    recognitionRef.current.onstart = () => {
      console.log('Voice recognition started')
      setIsListening(true)
    }
    
    recognitionRef.current.onresult = async (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('')
      
      if (event.results[0].isFinal && transcript.trim()) {
        console.log('Final transcript:', transcript)
        const userMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'user',
          content: transcript,
          timestamp: new Date()
        }
        setVoiceMessages(prev => [...prev, userMessage])
        
        await processVoiceInput(transcript)
      }
    }
    
    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
      // Auto-retry on no-speech error
      if (event.error === 'no-speech' && !voiceConversationEnded && !voiceSubmitted) {
        setTimeout(() => startListening(), 1000)
      }
    }
    
    recognitionRef.current.onend = () => {
      console.log('Voice recognition ended')
      setIsListening(false)
    }
    
    try {
      recognitionRef.current.start()
    } catch (e) {
      console.error('Failed to start recognition:', e)
      setIsListening(false)
    }
  }, [language, isListening, isSpeaking, voiceConversationEnded, voiceSubmitted])

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
  }

  const processVoiceInput = async (transcript: string) => {
    try {
      const conversationHistory = voiceMessages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }))
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://nidaan-api.25r5a6g2yvmy.eu-de.codeengine.appdomain.cloud/api/v1'}/patients/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify({
          message: transcript,
          conversation_history: conversationHistory,
          language: language
        })
      })
      
      if (!response.ok) throw new Error('Chat API failed')
      
      const data = await response.json()
      
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      }
      setVoiceMessages(prev => [...prev, aiResponse])
      
      if (data.collected_symptoms) {
        setVoiceCollectedData(prev => ({
          ...prev,
          symptoms: data.collected_symptoms
        }))
      }
      
      // Speak the response (clean markdown)
      speakText(data.response.replace(/[*#•]/g, '').replace(/\n+/g, '. '))
      
    } catch (error) {
      console.error('Voice processing error:', error)
      const errorResponse = "I'm sorry, I didn't catch that. Could you please repeat?"
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorResponse,
        timestamp: new Date()
      }
      setVoiceMessages(prev => [...prev, aiResponse])
      speakText(errorResponse)
    }
  }

  const handleVoiceOrbClick = () => {
    if (isSpeaking) {
      synthRef.current?.cancel()
      setIsSpeaking(false)
    } else if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  const handleEndVoiceConversation = () => {
    setVoiceConversationEnded(true)
    stopListening()
    synthRef.current?.cancel()
    
    const summaryMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `Thank you for sharing your symptoms. I've collected the following information:\n\n${
        voiceCollectedData.symptoms.length > 0 
          ? `Symptoms: ${voiceCollectedData.symptoms.join(', ')}\n` 
          : 'Your symptoms have been recorded.\n'
      }\nClick "Submit to Doctor" to send this to your healthcare provider.`,
      timestamp: new Date()
    }
    setVoiceMessages(prev => [...prev, summaryMessage])
  }

  const handleVoiceSubmitToDoctor = async () => {
    setSubmitting(true)
    try {
      // Compile voice messages into symptom details
      const symptomDetails = voiceMessages
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .join('. ')
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://nidaan-api.25r5a6g2yvmy.eu-de.codeengine.appdomain.cloud/api/v1'}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify({
          patient_name: user?.name || 'Patient',
          patient_email: user?.email || '',
          symptoms: voiceCollectedData.symptoms,
          symptom_details: symptomDetails,
          notes: `Collected via voice assistant on ${new Date().toLocaleDateString()}`,
          language: language
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setVoiceSubmitted(true)
        const successMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `✅ Appointment request submitted! ID: ${data.id}. You will be notified when confirmed.`,
          timestamp: new Date()
        }
        setVoiceMessages(prev => [...prev, successMessage])
      }
    } catch (error) {
      console.error('Submit error:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetVoice = async () => {
    // Reset server-side conversation data
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://nidaan-api.25r5a6g2yvmy.eu-de.codeengine.appdomain.cloud/api/v1'}/patients/chat/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        }
      })
    } catch (e) {
      console.error('Reset API error:', e)
    }
    
    setVoiceMessages([{
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI health assistant. Please tap the microphone and tell me about your symptoms.',
      timestamp: new Date()
    }])
    setVoiceCollectedData({ symptoms: [], associated_symptoms: [] })
    setVoiceConversationEnded(false)
    setVoiceSubmitted(false)
  }

  const handleLogout = () => {
    clearAuth()
    router.push('/login')
  }

  const selectedLanguage = LANGUAGES.find(l => l.code === language) || LANGUAGES[5]

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
      <main className="container mx-auto px-4 py-6">
        {activeMode === 'chat' ? (
          /* Chat Mode Interface */
          <div className="max-w-2xl mx-auto">
            <Card className="bg-slate-800/50 border-slate-700/50 overflow-hidden h-[calc(100vh-280px)] flex flex-col">
              {/* Chat Header */}
              <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/80 flex justify-between items-center">
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
                {!submitted && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetChat}
                    className="text-slate-400 hover:text-white"
                  >
                    <RotateCcw size={16} className="mr-1" />
                    Reset
                  </Button>
                )}
              </div>

              {/* Collected Symptoms Badge */}
              {collectedData.symptoms.length > 0 && (
                <div className="px-4 py-2 bg-blue-900/30 border-b border-blue-800/30">
                  <p className="text-xs text-blue-300">
                    <strong>Collected symptoms:</strong> {collectedData.symptoms.join(', ')}
                  </p>
                </div>
              )}

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
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
                
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-slate-700/70 rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex space-x-1.5">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input or Action Buttons */}
              <div className="p-4 border-t border-slate-700/50 bg-slate-800/50">
                {submitted ? (
                  <div className="text-center text-green-400 py-2">
                    <CheckCircle2 className="inline mr-2" size={20} />
                    Submitted successfully!
                  </div>
                ) : conversationEnded ? (
                  <div className="flex space-x-3">
                    <Button
                      onClick={handleContinueConversation}
                      variant="outline"
                      className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      Continue Adding
                    </Button>
                    <Button
                      onClick={handleSubmitToDoctor}
                      disabled={submitting}
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white"
                    >
                      {submitting ? 'Submitting...' : (
                        <>
                          <FileText className="mr-2" size={18} />
                          Submit to Doctor
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <form onSubmit={handleChatSubmit} className="flex items-center space-x-3">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Describe your symptoms..."
                        className="flex-1 bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                      />
                      <Button
                        type="submit"
                        disabled={!chatInput.trim() || isTyping}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-3 h-auto"
                      >
                        <Send size={20} />
                      </Button>
                    </form>
                    <Button
                      onClick={handleEndConversation}
                      disabled={chatMessages.length < 3}
                      className="w-full bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600 text-white"
                    >
                      <StopCircle className="mr-2" size={18} />
                      End Conversation & Review
                    </Button>
                  </div>
                )}
              </div>
            </Card>

            {/* Quick Actions */}
            {!conversationEnded && !submitted && (
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
            )}
          </div>
        ) : (
          /* Voice Mode Interface */
          <div className="max-w-2xl mx-auto">
            {/* Voice Conversation Display */}
            <Card className="bg-slate-800/50 border-slate-700/50 overflow-hidden mb-6">
              <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/80 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isSpeaking ? 'bg-gradient-to-br from-green-500 to-emerald-400 animate-pulse' : 
                    isListening ? 'bg-gradient-to-br from-red-500 to-rose-400 animate-pulse' :
                    'bg-gradient-to-br from-blue-500 to-cyan-400'
                  }`}>
                    {isSpeaking ? <Volume2 className="text-white" size={20} /> :
                     isListening ? <Mic className="text-white" size={20} /> :
                     <MessageCircle className="text-white" size={20} />}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Voice Assistant</h3>
                    <p className="text-xs text-green-400">
                      {isSpeaking ? '🔊 Speaking...' : isListening ? '🎤 Listening...' : 'Ready'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetVoice}
                  className="text-slate-400 hover:text-white"
                >
                  <RotateCcw size={16} className="mr-1" />
                  Reset
                </Button>
              </div>

              {/* Collected Symptoms Badge */}
              {voiceCollectedData.symptoms.length > 0 && (
                <div className="px-4 py-2 bg-blue-900/30 border-b border-blue-800/30">
                  <p className="text-xs text-blue-300">
                    <strong>Collected symptoms:</strong> {voiceCollectedData.symptoms.join(', ')}
                  </p>
                </div>
              )}

              {/* Voice Messages */}
              <div className="h-64 overflow-y-auto p-4 space-y-3">
                {voiceMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-md'
                          : 'bg-slate-700/70 text-slate-100 rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={voiceChatEndRef} />
              </div>
            </Card>

            {/* Voice Orb */}
            <div className="flex flex-col items-center">
              <div 
                onClick={handleVoiceOrbClick}
                className={`w-32 h-32 rounded-full flex items-center justify-center cursor-pointer transition-all transform hover:scale-105 ${
                  isSpeaking ? 'bg-gradient-to-br from-green-500 to-emerald-400 animate-pulse shadow-lg shadow-green-500/50' :
                  isListening ? 'bg-gradient-to-br from-red-500 to-rose-400 animate-pulse shadow-lg shadow-red-500/50' :
                  'bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/30'
                }`}
              >
                {isSpeaking ? (
                  <VolumeX className="text-white" size={48} />
                ) : isListening ? (
                  <StopCircle className="text-white" size={48} />
                ) : (
                  <Mic className="text-white" size={48} />
                )}
              </div>
              
              <p className="mt-4 text-slate-400 text-center">
                {isSpeaking ? 'Tap to stop AI speaking' :
                 isListening ? 'Tap to stop listening' :
                 'Tap to start speaking'}
              </p>

              {/* Voice Action Buttons */}
              <div className="mt-6 flex space-x-4">
                {voiceSubmitted ? (
                  <div className="text-green-400 flex items-center">
                    <CheckCircle2 className="mr-2" size={20} />
                    Submitted successfully!
                  </div>
                ) : !voiceConversationEnded ? (
                  <Button
                    onClick={handleEndVoiceConversation}
                    disabled={voiceMessages.length < 3}
                    className="bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600 text-white"
                  >
                    <StopCircle className="mr-2" size={18} />
                    End Conversation
                  </Button>
                ) : (
                  <Button
                    onClick={handleVoiceSubmitToDoctor}
                    disabled={submitting}
                    className="bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white"
                  >
                    {submitting ? 'Submitting...' : (
                      <>
                        <FileText className="mr-2" size={18} />
                        Submit to Doctor
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Instructions */}
            <Card className="mt-8 bg-slate-800/30 border-slate-700/50">
              <CardContent className="p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center">
                  <Clock className="mr-2 text-blue-400" size={18} />
                  Two-Way Voice Conversation
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-400 font-bold">1</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">Tap & Speak</p>
                      <p className="text-slate-400">Describe your symptoms naturally</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-cyan-600/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-cyan-400 font-bold">2</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">AI Responds</p>
                      <p className="text-slate-400">Listen & answer follow-up questions</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-green-600/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-green-400 font-bold">3</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">End & Submit</p>
                      <p className="text-slate-400">Review and send to your doctor</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
