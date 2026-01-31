"""
Patient endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict
from datetime import datetime
import uuid
import logging

from app.core.security import get_current_user
from app.core.db import db_client
from app.schemas.patient import PatientCreate, PatientResponse, PatientUpdate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/patients", tags=["patients"])


@router.post("/", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    patient_data: PatientCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Create a new patient"""
    try:
        patient_id = f"PAT_{uuid.uuid4().hex[:12].upper()}"
        
        # In production, store in a separate patients table
        # For MVP, we'll keep it simple
        
        logger.info(f"Created patient {patient_id}")
        
        return PatientResponse(
            patient_id=patient_id,
            **patient_data.dict(),
            created_at=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error(f"Error creating patient: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create patient: {str(e)}"
        )


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get patient details"""
    # Mock response for MVP
    return PatientResponse(
        patient_id=patient_id,
        name="Mock Patient",
        age=45,
        gender="male",
        phone="+919876543210",
        language_preference="hi-IN",
        clinic_id=current_user.get("clinic_id"),
        created_at=datetime.utcnow()
    )


@router.get("/{patient_id}/visits")
async def get_patient_visits(
    patient_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get all visits for a patient"""
    try:
        visits = db_client.list_patient_visits(patient_id, limit=50)
        return {"visits": visits}
        
    except Exception as e:
        logger.error(f"Error fetching patient visits: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch visits: {str(e)}"
        )
