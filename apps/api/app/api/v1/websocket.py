"""
WebSocket endpoints for real-time updates
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Dict, Set
import json
import logging
import asyncio

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])


class ConnectionManager:
    """Manages WebSocket connections"""
    
    def __init__(self):
        # Map clinic_id -> set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, clinic_id: str):
        """Accept and register a new connection"""
        await websocket.accept()
        
        if clinic_id not in self.active_connections:
            self.active_connections[clinic_id] = set()
        
        self.active_connections[clinic_id].add(websocket)
        logger.info(f"WebSocket connected for clinic {clinic_id}")
    
    def disconnect(self, websocket: WebSocket, clinic_id: str):
        """Remove a connection"""
        if clinic_id in self.active_connections:
            self.active_connections[clinic_id].discard(websocket)
            if not self.active_connections[clinic_id]:
                del self.active_connections[clinic_id]
        logger.info(f"WebSocket disconnected for clinic {clinic_id}")
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send message to a specific connection"""
        await websocket.send_json(message)
    
    async def broadcast_to_clinic(self, clinic_id: str, message: dict):
        """Broadcast message to all connections for a clinic"""
        if clinic_id in self.active_connections:
            disconnected = set()
            for connection in self.active_connections[clinic_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    disconnected.add(connection)
            
            # Remove disconnected clients
            for conn in disconnected:
                self.active_connections[clinic_id].discard(conn)


# Global connection manager
manager = ConnectionManager()


@router.websocket("/ws/{clinic_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    clinic_id: str,
    token: str = Query(None)
):
    """
    WebSocket endpoint for real-time updates
    
    Clients connect to receive:
    - New visit notifications
    - Processing status updates
    - Red flag alerts
    """
    # Validate token if provided
    if token:
        try:
            from app.core.security import decode_access_token
            payload = decode_access_token(token)
            # Optionally verify clinic_id matches
            user_clinic = payload.get('clinic_id')
            if user_clinic and user_clinic != clinic_id:
                await websocket.close(code=4003, reason="Clinic ID mismatch")
                return
        except Exception as e:
            logger.warning(f"WebSocket token validation failed: {e}")
            # Allow connection for demo purposes, but log the warning
    
    await manager.connect(websocket, clinic_id)
    
    try:
        while True:
            # Keep connection alive and listen for any client messages
            data = await websocket.receive_text()
            
            # Echo back or handle client messages
            if data == "ping":
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, clinic_id)
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        manager.disconnect(websocket, clinic_id)


# ==================== Patient Chat WebSocket ====================

# In-memory conversation storage for WebSocket chat
_ws_conversations: Dict[str, list] = {}
_ws_collected_data: Dict[str, Dict] = {}


@router.websocket("/ws/patient/chat")
async def patient_chat_websocket(
    websocket: WebSocket,
    token: str = Query(None)
):
    """
    WebSocket endpoint for real-time patient symptom chat
    
    Protocol:
    - Client sends: {"type": "message", "content": "I have a headache"}
    - Server responds: {"type": "response", "content": "...", "symptoms": [...], "severity": "..."}
    """
    user_id = "anonymous"
    
    # Validate token
    if token:
        try:
            from app.core.security import decode_access_token
            payload = decode_access_token(token)
            user_id = payload.get('user_id', 'anonymous')
        except Exception as e:
            logger.warning(f"WebSocket token validation failed: {e}")
    
    await websocket.accept()
    logger.info(f"Patient chat WebSocket connected: {user_id}")
    
    # Initialize conversation data for this user
    if user_id not in _ws_collected_data:
        _ws_collected_data[user_id] = {
            'symptoms': [],
            'duration': None,
            'severity': None,
            'location': None,
            'associated_symptoms': [],
        }
    if user_id not in _ws_conversations:
        _ws_conversations[user_id] = []
    
    # Send welcome message
    await websocket.send_json({
        "type": "connected",
        "message": "Connected to AI Health Assistant",
        "user_id": user_id
    })
    
    try:
        while True:
            data = await websocket.receive_text()
            
            try:
                message_data = json.loads(data)
            except json.JSONDecodeError:
                message_data = {"type": "message", "content": data}
            
            msg_type = message_data.get("type", "message")
            
            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue
            
            if msg_type == "message":
                content = message_data.get("content", "")
                
                # Process the message
                from app.api.v1.patients import _process_patient_message, ChatMessage
                
                history = [ChatMessage(role=m['role'], content=m['content']) 
                          for m in _ws_conversations[user_id][-10:]]
                
                response, follow_ups, severity = await _process_patient_message(
                    content.lower(), history, _ws_collected_data[user_id]
                )
                
                # Store conversation
                _ws_conversations[user_id].append({'role': 'user', 'content': content})
                _ws_conversations[user_id].append({'role': 'assistant', 'content': response})
                
                # Send response
                await websocket.send_json({
                    "type": "response",
                    "content": response,
                    "symptoms": _ws_collected_data[user_id]['symptoms'],
                    "severity": severity,
                    "follow_up_questions": follow_ups,
                    "collected_data": {
                        "duration": _ws_collected_data[user_id].get('duration'),
                        "location": _ws_collected_data[user_id].get('location'),
                        "associated": _ws_collected_data[user_id].get('associated_symptoms', [])
                    }
                })
            
            elif msg_type == "reset":
                # Reset conversation
                _ws_collected_data[user_id] = {
                    'symptoms': [],
                    'duration': None,
                    'severity': None,
                    'location': None,
                    'associated_symptoms': [],
                }
                _ws_conversations[user_id] = []
                await websocket.send_json({
                    "type": "reset_complete",
                    "message": "Conversation reset. How can I help you today?"
                })
                
    except WebSocketDisconnect:
        logger.info(f"Patient chat WebSocket disconnected: {user_id}")
    except Exception as e:
        logger.error(f"Patient chat WebSocket error: {str(e)}")


async def notify_visit_update(clinic_id: str, visit_id: str, status: str, data: dict = None):
    """
    Notify all connected clients about a visit update
    
    Called from the audio processing pipeline
    """
    message = {
        "type": "visit_update",
        "visit_id": visit_id,
        "status": status,
        "data": data or {}
    }
    await manager.broadcast_to_clinic(clinic_id, message)


async def notify_red_flag(clinic_id: str, visit_id: str, red_flags: dict):
    """
    Notify about detected red flags - high priority alert
    """
    message = {
        "type": "red_flag_alert",
        "visit_id": visit_id,
        "severity": red_flags.get("severity", "UNKNOWN"),
        "red_flags": red_flags
    }
    await manager.broadcast_to_clinic(clinic_id, message)
