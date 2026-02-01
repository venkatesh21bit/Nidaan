"""
AI Agents API Endpoints
Exposes watsonx-powered AI agent capabilities
"""
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from typing import List, Dict, Optional
from datetime import datetime
from pydantic import BaseModel
import logging

from app.core.security import get_current_user
from app.services.ai_agents.orchestrator import get_orchestrator, AgentOrchestrator

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai-agents", tags=["ai-agents"])

# ==================== Models ====================

class ProcessAppointmentRequest(BaseModel):
    appointment_id: str
    patient_name: str
    symptoms: List[str]
    symptom_details: Optional[str] = None
    severity: Optional[str] = None
    duration: Optional[str] = None
    preferred_date: Optional[str] = None
    preferred_time: Optional[str] = None

class AgentStatusResponse(BaseModel):
    orchestrator: Dict
    agents: List[Dict]
    queue_status: Dict
    pending_followups: int

# ==================== In-Memory Storage for Processed Results ====================

_processed_appointments: Dict[str, Dict] = {}

# ==================== Endpoints ====================

@router.get("/status")
async def get_agents_status(
    current_user: Dict = Depends(get_current_user)
):
    """
    Get status of all AI agents
    """
    try:
        orchestrator = get_orchestrator()
        status = await orchestrator.get_agent_status()
        return status
    except Exception as e:
        logger.error(f"Get agent status error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/process")
async def process_appointment_with_ai(
    request: ProcessAppointmentRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict = Depends(get_current_user)
):
    """
    Process an appointment through the complete AI workflow:
    1. Symptom Analysis
    2. Auto-Scheduling
    3. Triage
    4. Follow-Up Plan
    
    Returns immediately with workflow_id, processes in background.
    """
    try:
        orchestrator = get_orchestrator()
        
        # Create appointment data
        appointment_data = {
            "id": request.appointment_id,
            "patient_name": request.patient_name,
            "symptoms": request.symptoms,
            "symptom_details": request.symptom_details,
            "severity": request.severity,
            "duration": request.duration,
            "preferred_date": request.preferred_date,
            "preferred_time": request.preferred_time
        }
        
        # Process synchronously for demo (in production, use background task)
        result = await orchestrator.process_appointment(appointment_data)
        
        # Store result
        _processed_appointments[request.appointment_id] = result
        
        return {
            "message": "Appointment processed by AI agents",
            "workflow_id": result.get('workflow_id'),
            "status": result.get('final_status'),
            "summary": result.get('summary'),
            "appointment_updates": result.get('appointment_updates')
        }
        
    except Exception as e:
        logger.error(f"Process appointment error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/workflow/{workflow_id}")
async def get_workflow_details(
    workflow_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """
    Get detailed workflow execution results
    """
    try:
        orchestrator = get_orchestrator()
        history = orchestrator.get_workflow_history(limit=50)
        
        workflow = next((w for w in history if w.get('workflow_id') == workflow_id), None)
        
        if not workflow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow not found"
            )
        
        return workflow
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get workflow error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/processed/{appointment_id}")
async def get_processed_appointment(
    appointment_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """
    Get AI processing results for a specific appointment
    """
    if appointment_id not in _processed_appointments:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No AI processing results found for this appointment"
        )
    
    return _processed_appointments[appointment_id]


@router.get("/history")
async def get_workflow_history(
    limit: int = 10,
    current_user: Dict = Depends(get_current_user)
):
    """
    Get recent AI workflow execution history
    """
    try:
        role = current_user.get('role', 'patient')
        
        if role not in ['admin', 'doctor']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins and doctors can view workflow history"
            )
        
        orchestrator = get_orchestrator()
        history = orchestrator.get_workflow_history(limit=limit)
        
        return {
            "total": len(history),
            "workflows": history
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get history error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/analyze-symptoms")
async def analyze_symptoms_only(
    symptoms: List[str],
    symptom_details: Optional[str] = None,
    severity: Optional[str] = None,
    duration: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """
    Run symptom analysis only (without full workflow)
    """
    try:
        orchestrator = get_orchestrator()
        result = await orchestrator.symptom_analyzer.analyze(
            symptoms=symptoms,
            symptom_details=symptom_details or "",
            severity=severity,
            duration=duration
        )
        return result
        
    except Exception as e:
        logger.error(f"Symptom analysis error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/triage-queue")
async def get_triage_queue(
    current_user: Dict = Depends(get_current_user)
):
    """
    Get current triage queue status
    """
    try:
        role = current_user.get('role', 'patient')
        
        if role not in ['admin', 'doctor']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins and doctors can view triage queue"
            )
        
        orchestrator = get_orchestrator()
        return orchestrator.triage.get_queue_status()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get triage queue error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/pending-followups")
async def get_pending_followups(
    current_user: Dict = Depends(get_current_user)
):
    """
    Get pending patient follow-ups
    """
    try:
        role = current_user.get('role', 'patient')
        
        if role not in ['admin', 'doctor']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins and doctors can view follow-ups"
            )
        
        orchestrator = get_orchestrator()
        followups = orchestrator.followup.get_pending_followups()
        
        return {
            "total": len(followups),
            "followups": followups
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get followups error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
