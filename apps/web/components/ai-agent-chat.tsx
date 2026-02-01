'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { 
  MessageCircle, 
  Send, 
  X, 
  Minimize2, 
  Maximize2,
  Bot,
  User,
  Sparkles,
  AlertCircle,
  Loader2,
  ChevronDown
} from 'lucide-react'
import { doctorAPI, Visit } from '@/lib/api'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  data?: any // For structured data like visit lists
  isTyping?: boolean
}

interface AIAgentChatProps {
  clinicId?: string
  onVisitSelect?: (visitId: string) => void
}

// Quick action buttons for common queries
const QUICK_ACTIONS = [
  { label: '🚨 Urgent patients', query: 'Do we have any urgent patients waiting?' },
  { label: '📊 Today\'s summary', query: 'Give me a summary of today\'s visits' },
  { label: '⚠️ Red flag cases', query: 'Show me cases with red flags' },
  { label: '⏳ Pending reviews', query: 'How many cases are pending my review?' },
]

export function AIAgentChat({ clinicId, onVisitSelect }: AIAgentChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello, Doctor! I\'m Nidaan AI Assistant. I can help you with:\n\n• Checking urgent patients in triage\n• Viewing patient symptoms and red flags\n• Getting case summaries\n\nHow can I assist you today?',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus()
    }
  }, [isOpen, isMinimized])

  const processQuery = useCallback(async (query: string): Promise<{ content: string; data?: any }> => {
    const lowerQuery = query.toLowerCase()
    
    try {
      // Check for urgent/high-priority patients
      if (lowerQuery.includes('urgent') || lowerQuery.includes('priority') || lowerQuery.includes('waiting')) {
        const visits = await doctorAPI.getDashboardVisits()
        const urgentVisits = visits.filter((v: Visit) => 
          v.risk_level === 'CRITICAL' || v.risk_level === 'HIGH' || v.red_flags?.has_red_flags
        )
        
        if (urgentVisits.length === 0) {
          return { content: '✅ **Good news!** There are no high-priority patients waiting right now. All current cases are stable.' }
        }
        
        let response = `🚨 **${urgentVisits.length} urgent patient(s) require attention:**\n\n`
        urgentVisits.slice(0, 5).forEach((v: Visit, i: number) => {
          response += `**${i + 1}. ${v.patient_name || 'Patient'}** (${v.patient_age || 'N/A'} yrs)\n`
          response += `   • Risk: ${v.risk_level || 'MODERATE'}\n`
          response += `   • Chief Complaint: ${v.chief_complaint || 'Processing...'}\n`
          if (v.red_flags?.has_red_flags) {
            response += `   • ⚠️ RED FLAGS DETECTED\n`
          }
          response += '\n'
        })
        
        return { content: response, data: { visits: urgentVisits, type: 'urgent' } }
      }
      
      // Check for red flags
      if (lowerQuery.includes('red flag') || lowerQuery.includes('critical') || lowerQuery.includes('alert')) {
        const visits = await doctorAPI.getDashboardVisits()
        const redFlagVisits = visits.filter((v: Visit) => v.red_flags?.has_red_flags)
        
        if (redFlagVisits.length === 0) {
          return { content: '✅ No cases with red flags currently. All patients appear stable.' }
        }
        
        let response = `⚠️ **${redFlagVisits.length} case(s) with red flags:**\n\n`
        redFlagVisits.forEach((v: Visit, i: number) => {
          response += `**${i + 1}. ${v.patient_name || 'Patient'}**\n`
          response += `   • ${v.chief_complaint || 'Symptoms being analyzed...'}\n`
          response += `   • Severity: ${v.red_flags?.severity || v.risk_level || 'HIGH'}\n\n`
        })
        
        return { content: response, data: { visits: redFlagVisits, type: 'red_flags' } }
      }
      
      // Summary request
      if (lowerQuery.includes('summary') || lowerQuery.includes('overview') || lowerQuery.includes('today')) {
        const [visits, stats] = await Promise.all([
          doctorAPI.getDashboardVisits(),
          doctorAPI.getDashboardStats()
        ])
        
        const completed = visits.filter((v: Visit) => v.status === 'COMPLETED').length
        const pending = visits.filter((v: Visit) => v.status === 'PENDING' || v.status === 'PROCESSING').length
        const highRisk = visits.filter((v: Visit) => v.risk_level === 'CRITICAL' || v.risk_level === 'HIGH').length
        
        let response = `📊 **Today's Summary:**\n\n`
        response += `• **Total Visits:** ${stats.total_visits_today || visits.length}\n`
        response += `• **Completed:** ${completed}\n`
        response += `• **Pending Review:** ${pending}\n`
        response += `• **High Risk:** ${highRisk}\n`
        response += `• **Avg Processing Time:** ${stats.average_processing_time_seconds || 0}s\n\n`
        
        if (highRisk > 0) {
          response += `⚠️ *${highRisk} high-risk case(s) need your attention.*`
        } else {
          response += `✅ *No critical cases at the moment.*`
        }
        
        return { content: response, data: { stats, visits, type: 'summary' } }
      }
      
      // Pending reviews
      if (lowerQuery.includes('pending') || lowerQuery.includes('review') || lowerQuery.includes('queue')) {
        const visits = await doctorAPI.getDashboardVisits()
        const pendingVisits = visits.filter((v: Visit) => 
          v.status === 'COMPLETED' && !v.reviewed_at
        )
        
        if (pendingVisits.length === 0) {
          return { content: '✅ **All caught up!** No cases pending your review.' }
        }
        
        let response = `📋 **${pendingVisits.length} case(s) pending review:**\n\n`
        pendingVisits.slice(0, 5).forEach((v: Visit, i: number) => {
          response += `**${i + 1}. ${v.patient_name || 'Patient'}** (${v.patient_age || 'N/A'} yrs)\n`
          response += `   • ${v.chief_complaint || 'View for details'}\n\n`
        })
        
        if (pendingVisits.length > 5) {
          response += `*...and ${pendingVisits.length - 5} more*`
        }
        
        return { content: response, data: { visits: pendingVisits, type: 'pending' } }
      }
      
      // Patient lookup by name
      if (lowerQuery.includes('patient') || lowerQuery.includes('find') || lowerQuery.includes('search')) {
        const visits = await doctorAPI.getDashboardVisits()
        
        // Try to extract a name from the query
        const words = query.split(' ')
        const nameMatch = visits.find((v: Visit) => 
          words.some(word => 
            v.patient_name?.toLowerCase().includes(word.toLowerCase()) && word.length > 2
          )
        )
        
        if (nameMatch) {
          let response = `📋 **Found patient: ${nameMatch.patient_name}**\n\n`
          response += `• **Age:** ${nameMatch.patient_age || 'N/A'}\n`
          response += `• **Status:** ${nameMatch.status}\n`
          response += `• **Risk Level:** ${nameMatch.risk_level || 'N/A'}\n`
          response += `• **Chief Complaint:** ${nameMatch.chief_complaint || 'Processing...'}\n`
          
          return { content: response, data: { visit: nameMatch, type: 'patient' } }
        }
        
        return { content: 'I couldn\'t find a specific patient. Could you provide more details or check the patient list?' }
      }
      
      // Default response
      return { 
        content: 'I can help you with:\n\n• **"Urgent patients"** - Check high-priority cases\n• **"Today\'s summary"** - Get overview of visits\n• **"Red flag cases"** - View cases with alerts\n• **"Pending reviews"** - Check your review queue\n\nTry asking one of these questions!' 
      }
      
    } catch (error) {
      console.error('Error processing query:', error)
      return { content: '❌ Sorry, I encountered an error fetching the data. Please try again.' }
    }
  }, [])

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsProcessing(true)

    // Add typing indicator
    const typingId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, {
      id: typingId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isTyping: true
    }])

    // Process the query
    const result = await processQuery(input)

    // Replace typing indicator with actual response
    setMessages(prev => prev.filter(m => m.id !== typingId))
    
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 2).toString(),
      role: 'assistant',
      content: result.content,
      timestamp: new Date(),
      data: result.data
    }

    setMessages(prev => [...prev, assistantMessage])
    setIsProcessing(false)
  }

  const handleQuickAction = (query: string) => {
    setInput(query)
    // Automatically send after setting
    setTimeout(() => {
      const event = new Event('submit')
      document.getElementById('ai-chat-form')?.dispatchEvent(event)
    }, 100)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Floating action button when chat is closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group z-50"
      >
        <Bot className="w-7 h-7 text-white group-hover:scale-110 transition-transform" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900 animate-pulse" />
      </button>
    )
  }

  return (
    <div 
      className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
        isMinimized ? 'w-72' : 'w-96'
      }`}
    >
      <Card className="bg-slate-800 border-slate-600 shadow-2xl overflow-hidden">
        {/* Header */}
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white text-sm font-semibold">Nidaan AI Assistant</CardTitle>
                <p className="text-blue-100 text-xs">Powered by IBM watsonx</p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 hover:bg-white/20 rounded transition-colors"
              >
                {isMinimized ? (
                  <Maximize2 className="w-4 h-4 text-white" />
                ) : (
                  <Minimize2 className="w-4 h-4 text-white" />
                )}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </CardHeader>

        {!isMinimized && (
          <>
            {/* Messages */}
            <CardContent className="p-0">
              <div className="h-80 overflow-y-auto p-4 space-y-4 bg-slate-850">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-md'
                          : 'bg-slate-700 text-slate-100 rounded-bl-md'
                      }`}
                    >
                      {message.isTyping ? (
                        <div className="flex items-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">Analyzing...</span>
                        </div>
                      ) : (
                        <>
                          <div className="text-sm whitespace-pre-wrap leading-relaxed">
                            {message.content.split('\n').map((line, i) => {
                              // Simple markdown-like rendering
                              const boldLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                              return (
                                <div 
                                  key={i} 
                                  dangerouslySetInnerHTML={{ __html: boldLine }}
                                  className="mb-1"
                                />
                              )
                            })}
                          </div>
                          
                          {/* Show action buttons for visit data */}
                          {message.data?.visits && message.data.visits.length > 0 && (
                            <div className="mt-3 pt-2 border-t border-slate-600">
                              <button
                                onClick={() => onVisitSelect?.(message.data.visits[0].visit_id)}
                                className="text-xs text-blue-400 hover:text-blue-300 flex items-center"
                              >
                                View first case →
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Quick Actions */}
              <div className="px-4 py-2 border-t border-slate-700 bg-slate-800/50">
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ACTIONS.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuickAction(action.query)}
                      disabled={isProcessing}
                      className="text-xs px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full transition-colors disabled:opacity-50"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input */}
              <form 
                id="ai-chat-form"
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="p-3 border-t border-slate-700 bg-slate-800"
              >
                <div className="flex items-center space-x-2">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about patients..."
                    disabled={isProcessing}
                    className="flex-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 text-sm"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!input.trim() || isProcessing}
                    className="bg-blue-600 hover:bg-blue-500 px-3"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}

export default AIAgentChat
