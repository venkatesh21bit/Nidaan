"""
Main API Router - Aggregates all route modules
"""
from fastapi import APIRouter
from app.api.v1 import audio, patients, doctors, websocket, demo, triage

api_router = APIRouter()

# Include all route modules
api_router.include_router(audio.router)
api_router.include_router(patients.router)
api_router.include_router(doctors.router)
api_router.include_router(websocket.router)
api_router.include_router(demo.router)  # Demo/dev endpoints
api_router.include_router(triage.router)  # Voice Triage & Orchestrate API


@api_router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "nidaan-api",
        "version": "1.0.0"
    }

