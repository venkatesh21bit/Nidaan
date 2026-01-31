'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
}

interface ToolCall {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: any;
}

interface AIChatInterfaceProps {
  onSendMessage?: (message: string) => Promise<void>;
  onToolCall?: (tool: string, params: any) => void;
  messages?: Message[];
  isLoading?: boolean;
  placeholder?: string;
  title?: string;
  className?: string;
  compact?: boolean;
}

export function AIChatInterface({
  onSendMessage,
  onToolCall,
  messages: externalMessages,
  isLoading = false,
  placeholder = "Ask about urgent patients, symptoms, or medical guidance...",
  title = "AI Medical Assistant",
  className,
  compact = false
}: AIChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [internalMessages, setInternalMessages] = useState<Message[]>([]);
  const messages = externalMessages || internalMessages;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const message = input;
    setInput('');
    
    if (onSendMessage) {
      await onSendMessage(message);
    } else {
      // Internal message handling with simulated AI response
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: message,
        timestamp: new Date()
      };
      setInternalMessages(prev => [...prev, userMessage]);
      
      // Simulate AI response
      setTimeout(() => {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: getSimulatedResponse(message),
          timestamp: new Date(),
          toolCalls: message.toLowerCase().includes('urgent') ? [
            { name: 'getUrgentCases', status: 'completed', result: { count: 9 } }
          ] : undefined
        };
        setInternalMessages(prev => [...prev, aiResponse]);
        
        // Call tool callback if needed
        if (message.toLowerCase().includes('urgent') && onToolCall) {
          onToolCall('getUrgentCases', {});
        }
      }, 1000);
    }
  };

  const getSimulatedResponse = (query: string): string => {
    const q = query.toLowerCase();
    if (q.includes('urgent') || q.includes('critical')) {
      return "I found 9 urgent cases requiring attention. The highest priority is Amit Singh with severe chest pain. Would you like me to show the full details?";
    }
    if (q.includes('chest pain')) {
      return "Chest pain cases require immediate attention. Consider cardiac causes (MI, angina), pulmonary (PE, pneumothorax), or GI (GERD). Recommend ECG and troponin levels.";
    }
    if (q.includes('symptom')) {
      return "I can help analyze symptoms. Please describe the patient's complaints, duration, and any associated symptoms.";
    }
    return "I'm your AI medical assistant powered by watsonx. I can help with triage analysis, symptom assessment, and urgent case management.";
  };

  const quickActions = [
    "Show urgent patients",
    "Any chest pain cases?",
    "High priority cases today",
    "Patient summary"
  ];

  return (
    <div className={cn("flex flex-col h-full bg-gray-900 rounded-xl border border-gray-700", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-white">{title}</h3>
            <p className="text-xs text-gray-400">Powered by watsonx</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-green-400">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            Connected
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h4 className="text-lg font-medium text-white mb-2">How can I help you?</h4>
            <p className="text-gray-400 text-sm mb-4">Ask about patients, triage cases, or medical guidance</p>
            
            {/* Quick actions */}
            <div className="flex flex-wrap justify-center gap-2">
              {quickActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInput(action);
                    handleSubmit({ preventDefault: () => {} } as React.FormEvent);
                  }}
                  className="px-3 py-1.5 text-sm bg-gray-800 text-gray-300 rounded-full hover:bg-gray-700 transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2",
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.role === 'system'
                  ? 'bg-yellow-500/20 text-yellow-200 border border-yellow-500/30'
                  : 'bg-gray-800 text-gray-100'
              )}
            >
              {message.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-purple-400 font-medium">Nidaan AI</span>
                </div>
              )}
              
              <div className="whitespace-pre-wrap">{message.content}</div>
              
              {/* Tool calls indicator */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-700">
                  {message.toolCalls.map((tool, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-gray-400">
                      {tool.status === 'running' && (
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {tool.status === 'completed' && (
                        <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      <span>Used: {tool.name}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {message.isStreaming && (
                <span className="inline-block w-2 h-4 ml-1 bg-gray-400 animate-pulse"></span>
              )}
              
              <div className="text-xs text-gray-500 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
                <span className="text-xs text-gray-400">Analyzing...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            disabled={isLoading}
            className="flex-1 bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}

export default AIChatInterface;
