/**
 * WebSocket hook for real-time updates
 */
import { useEffect, useRef, useCallback, useState } from 'react'
import { useAuthStore } from './store'

// Use deployed API WebSocket URL, falling back to localhost for development
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://nidaan-api.25r5a6g2yvmy.eu-de.codeengine.appdomain.cloud/api/v1/ws'

interface WebSocketMessage {
  type: 'visit_update' | 'red_flag_alert' | 'pong'
  visit_id?: string
  status?: string
  severity?: string
  data?: any
  red_flags?: any
}

interface UseWebSocketOptions {
  onVisitUpdate?: (visitId: string, status: string, data: any) => void
  onRedFlagAlert?: (visitId: string, redFlags: any) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { user, token } = useAuthStore()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  
  // Store callbacks in refs to avoid reconnection loops
  const onVisitUpdateRef = useRef(options.onVisitUpdate)
  const onRedFlagAlertRef = useRef(options.onRedFlagAlert)
  const onConnectRef = useRef(options.onConnect)
  const onDisconnectRef = useRef(options.onDisconnect)
  
  // Update refs when options change
  useEffect(() => {
    onVisitUpdateRef.current = options.onVisitUpdate
    onRedFlagAlertRef.current = options.onRedFlagAlert
    onConnectRef.current = options.onConnect
    onDisconnectRef.current = options.onDisconnect
  }, [options.onVisitUpdate, options.onRedFlagAlert, options.onConnect, options.onDisconnect])
  
  const connect = useCallback(() => {
    if (!user?.clinic_id || !token) return
    
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close()
    }
    
    const wsUrl = `${WS_URL}/${user.clinic_id}?token=${token}`
    
    try {
      const ws = new WebSocket(wsUrl)
      
      ws.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        onConnectRef.current?.()
        
        // Start ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping')
          }
        }, 30000) // Ping every 30 seconds
      }
      
      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          
          switch (message.type) {
            case 'visit_update':
              if (message.visit_id && message.status) {
                onVisitUpdateRef.current?.(message.visit_id, message.status, message.data)
              }
              break
              
            case 'red_flag_alert':
              if (message.visit_id) {
                onRedFlagAlertRef.current?.(message.visit_id, message.red_flags)
              }
              break
              
            case 'pong':
              // Keep-alive response received
              break
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      }
      
      ws.onclose = () => {
        console.log('WebSocket disconnected')
        setIsConnected(false)
        onDisconnectRef.current?.()
        
        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
        }
        
        // Attempt to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, 5000)
      }
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
      
      wsRef.current = ws
      
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
    }
  }, [user?.clinic_id, token]) // Remove options from dependency array
  
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
  }, [])
  
  useEffect(() => {
    connect()
    
    return () => {
      disconnect()
    }
  }, [connect, disconnect])
  
  return {
    isConnected,
    reconnect: connect,
    disconnect,
  }
}

export default useWebSocket
