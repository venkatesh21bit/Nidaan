"""
Doctor dashboard endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Dict, Optional
import logging
from datetime import datetime, timedelta

from app.core.security import get_current_user, require_role
from app.core.db import db_client
from app.schemas.medical import VisitResponse, VisitSummary, VisitStatus

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/doctors", tags=["doctors"])


@router.get("/dashboard/visits", response_model=List[VisitSummary])
async def get_dashboard_visits(
    status_filter: Optional[VisitStatus] = Query(None),
    limit: int = Query(50, le=100),
    current_user: Dict = Depends(require_role(["doctor", "admin"]))
):
    """
    Get visits for doctor's dashboard
    
    Returns a list of visits with summary information, sorted by creation time
    """
    try:
        clinic_id = current_user.get('clinic_id')
        
        # Get visits from database
        visits = db_client.list_clinic_visits(clinic_id, limit=limit)
        
        # Filter by status if provided
        if status_filter:
            visits = [v for v in visits if v.get('status') == status_filter]
        
        # Convert to summary format
        visit_summaries = []
        for visit in visits:
            visit_summaries.append(VisitSummary(
                visit_id=visit.get('visit_id'),
                patient_name=visit.get('patient_name', 'Unknown'),
                patient_age=visit.get('patient_age', 0),
                chief_complaint=visit.get('chief_complaint', 'Processing...'),
                status=visit.get('status', VisitStatus.PENDING),
                risk_level=visit.get('risk_level'),
                created_at=datetime.fromisoformat(visit.get('created_at')),
                has_red_flags=visit.get('red_flags', {}).get('has_red_flags', False)
            ))
        
        return visit_summaries
        
    except Exception as e:
        logger.error(f"Error fetching dashboard visits: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch visits: {str(e)}"
        )


@router.get("/visits/{visit_id}", response_model=VisitResponse)
async def get_visit_details(
    visit_id: str,
    current_user: Dict = Depends(require_role(["doctor", "admin"]))
):
    """
    Get detailed information for a specific visit
    
    Includes full SOAP note, differential diagnosis, and red flags
    """
    try:
        clinic_id = current_user.get('clinic_id')
        
        # Get all visits and find the specific one
        visits = db_client.list_clinic_visits(clinic_id, limit=100)
        visit = next((v for v in visits if v.get('visit_id') == visit_id), None)
        
        if not visit:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Visit {visit_id} not found"
            )
        
        # Convert to response format
        from app.schemas.medical import SOAPNote, DifferentialDiagnosis, RedFlagAnalysis, RedFlag
        
        return VisitResponse(
            visit_id=visit.get('visit_id'),
            patient_id=visit.get('patient_id'),
            clinic_id=visit.get('clinic_id'),
            doctor_id=visit.get('doctor_id'),
            status=visit.get('status', VisitStatus.PENDING),
            language_code=visit.get('language_code', 'hi-IN'),
            audio_s3_key=visit.get('audio_s3_key'),
            transcript=visit.get('transcript'),
            translated_text=visit.get('translated_text'),
            soap_note=SOAPNote(**visit.get('soap_note')) if visit.get('soap_note') else None,
            differential_diagnosis=[DifferentialDiagnosis(**dd) for dd in visit.get('differential_diagnosis', [])] if visit.get('differential_diagnosis') else None,
            red_flags=RedFlagAnalysis(
                has_red_flags=visit.get('red_flags', {}).get('has_red_flags', False),
                severity=visit.get('red_flags', {}).get('severity', 'ROUTINE'),
                red_flags_detected=[RedFlag(**rf) for rf in visit.get('red_flags', {}).get('red_flags_detected', [])],
                triage_recommendation=visit.get('red_flags', {}).get('triage_recommendation', '')
            ) if visit.get('red_flags') else None,
            risk_level=visit.get('risk_level'),
            created_at=datetime.fromisoformat(visit.get('created_at')),
            updated_at=datetime.fromisoformat(visit.get('updated_at')),
            processing_time_seconds=visit.get('processing_time_seconds')
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching visit details: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch visit details: {str(e)}"
        )


@router.get("/stats/summary")
async def get_dashboard_stats(
    current_user: Dict = Depends(require_role(["doctor", "admin"]))
):
    """
    Get summary statistics for the dashboard
    
    Returns:
    - Total visits today
    - Pending visits
    - High-risk visits
    - Average processing time
    """
    try:
        clinic_id = current_user.get('clinic_id')
        
        # Get today's visits
        visits = db_client.list_clinic_visits(clinic_id, limit=100)
        
        today = datetime.utcnow().date()
        today_visits = [
            v for v in visits 
            if datetime.fromisoformat(v.get('created_at')).date() == today
        ]
        
        pending_count = len([v for v in visits if v.get('status') == VisitStatus.PENDING])
        processing_count = len([v for v in visits if v.get('status') in [VisitStatus.PROCESSING, VisitStatus.TRANSCRIBING, VisitStatus.ANALYZING]])
        high_risk_count = len([v for v in visits if v.get('risk_level') in ['HIGH', 'CRITICAL']])
        
        # Calculate average processing time
        completed_visits = [v for v in visits if v.get('processing_time_seconds')]
        avg_processing_time = (
            sum(v.get('processing_time_seconds', 0) for v in completed_visits) / len(completed_visits)
            if completed_visits else 0
        )
        
        return {
            "total_visits_today": len(today_visits),
            "pending_visits": pending_count,
            "processing_visits": processing_count,
            "high_risk_visits": high_risk_count,
            "average_processing_time_seconds": round(avg_processing_time, 2),
            "clinic_id": clinic_id
        }
        
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch statistics: {str(e)}"
        )


@router.post("/admin/seed-data")
async def seed_clinic_data(
    current_user: Dict = Depends(require_role(["doctor", "admin"]))
):
    """
    Seed initial data for the clinic (admin only)
    
    Creates real patient visit records if the database is empty
    """
    try:
        clinic_id = current_user.get('clinic_id', 'CLINIC_DEMO')
        
        from app.services.seed_data import check_and_seed_if_empty
        result = check_and_seed_if_empty(clinic_id)
        
        return result
        
    except Exception as e:
        logger.error(f"Error seeding data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to seed data: {str(e)}"
        )
