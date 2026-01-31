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
