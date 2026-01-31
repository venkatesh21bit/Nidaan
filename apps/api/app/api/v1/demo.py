"""
Demo endpoints - For development and testing only
Creates seed data and demonstrates the system
"""
from fastapi import APIRouter, Depends
from typing import Dict
import uuid
from datetime import datetime, timedelta
import random
import logging

from app.core.security import get_current_user
from app.core.db import db_client
from app.schemas.medical import VisitStatus

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/demo", tags=["demo"])


# Sample patient data for demo
DEMO_PATIENTS = [
    {"name": "Rajesh Kumar", "age": 55, "gender": "male"},
    {"name": "Priya Sharma", "age": 32, "gender": "female"},
    {"name": "Amit Patel", "age": 67, "gender": "male"},
    {"name": "Sunita Devi", "age": 45, "gender": "female"},
    {"name": "Mohammad Ali", "age": 28, "gender": "male"},
    {"name": "Lakshmi Iyer", "age": 52, "gender": "female"},
]

# Sample chief complaints
DEMO_COMPLAINTS = [
    "Chest pain radiating to left arm",
    "Severe headache for 3 days",
    "Fever and cough since yesterday",
    "Abdominal pain and vomiting",
    "Joint pain in both knees",
    "Shortness of breath on exertion",
]

# Sample transcripts in different languages
DEMO_TRANSCRIPTS = {
    "hi-IN": "मुझे सीने में दर्द हो रहा है जो बाएं हाथ में फैल रहा है। यह सुबह से शुरू हुआ है।",
    "ta-IN": "எனக்கு நெஞ்சில் வலி இருக்கிறது, அது இடது கையில் பரவுகிறது.",
    "te-IN": "నాకు ఛాతీ నొప్పి వస్తోంది, అది ఎడమ చేతికి వ్యాపిస్తోంది.",
    "en-IN": "I have chest pain that is spreading to my left arm. It started this morning.",
}


@router.post("/seed-visits")
async def seed_demo_visits(
    count: int = 5,
    current_user: Dict = Depends(get_current_user)
):
    """
    Create demo visits for testing the dashboard
    
    Creates visits with varying statuses and risk levels
    """
    clinic_id = current_user.get('clinic_id', 'CLINIC_DEMO')
    created_visits = []
    
    for i in range(count):
        patient = random.choice(DEMO_PATIENTS)
        complaint = random.choice(DEMO_COMPLAINTS)
        language = random.choice(list(DEMO_TRANSCRIPTS.keys()))
        
        # Vary the status
        if i == 0:
            status = VisitStatus.COMPLETED
            risk = random.choice(["CRITICAL", "HIGH"])
        elif i < count // 2:
            status = VisitStatus.COMPLETED
            risk = random.choice(["MODERATE", "LOW"])
        else:
            status = random.choice([VisitStatus.PENDING, VisitStatus.PROCESSING])
            risk = None
        
        visit_id = f"VIS_{uuid.uuid4().hex[:12].upper()}"
        patient_id = f"PAT_{uuid.uuid4().hex[:8].upper()}"
        
        # Create mock SOAP note for completed visits
        soap_note = None
        differential = None
        red_flags = None
        translated = None
        transcript = DEMO_TRANSCRIPTS.get(language, DEMO_TRANSCRIPTS["en-IN"])
        
        if status == VisitStatus.COMPLETED:
            translated = "Patient reports chest pain radiating to the left arm, which started this morning. Associated with shortness of breath."
            
            soap_note = {
                "subjective": f"Chief Complaint: {complaint}\n\nHistory of Present Illness:\n- {patient['age']}-year-old {patient['gender']} presenting with {complaint.lower()}\n- Symptoms started today\n- Severity: Moderate to severe",
                "objective": "Vital Signs: To be recorded\nPhysical Examination: Pending\nGeneral: Patient appears anxious",
                "assessment": f"Clinical Impression: {complaint}\nRisk Level: {risk}",
                "plan": "1. Immediate evaluation required\n2. Order relevant investigations\n3. Monitor vital signs\n4. Consider specialist referral if needed"
            }
            
            differential = [
                {
                    "diagnosis": "Primary condition related to " + complaint,
                    "probability": "HIGH",
                    "supporting_factors": ["Patient symptoms match", "Age appropriate"],
                    "against": ["No prior history"],
                    "next_steps": ["Order tests", "Monitor closely"]
                },
                {
                    "diagnosis": "Alternative diagnosis",
                    "probability": "MEDIUM",
                    "supporting_factors": ["Some symptoms align"],
                    "against": ["Typical presentation differs"],
                    "next_steps": ["Consider if primary diagnosis ruled out"]
                }
            ]
            
            red_flags = {
                "has_red_flags": risk in ["CRITICAL", "HIGH"],
                "severity": risk,
                "red_flags_detected": [
                    {
                        "category": "Cardiovascular" if "chest" in complaint.lower() else "General",
                        "finding": complaint,
                        "urgency": "URGENT" if risk == "HIGH" else "CRITICAL" if risk == "CRITICAL" else "ROUTINE",
                        "action": "Immediate evaluation and monitoring"
                    }
                ] if risk in ["CRITICAL", "HIGH"] else [],
                "triage_recommendation": "Priority care" if risk in ["CRITICAL", "HIGH"] else "Routine appointment"
            }
        
        # Create visit record
        visit_data = {
            'visit_id': visit_id,
            'patient_id': patient_id,
            'patient_name': patient["name"],
            'patient_age': patient["age"],
            'patient_gender': patient["gender"],
            'clinic_id': clinic_id,
            'doctor_id': current_user.get('user_id'),
            'status': status,
            'language_code': language,
            'chief_complaint': complaint,
            'transcript': transcript if status == VisitStatus.COMPLETED else None,
            'translated_text': translated,
            'soap_note': soap_note,
            'differential_diagnosis': differential,
            'red_flags': red_flags,
            'risk_level': risk,
            'audio_duration_seconds': random.uniform(30, 180),
            'processing_time_seconds': random.uniform(5, 15) if status == VisitStatus.COMPLETED else None
        }
        
        db_client.create_visit(visit_data)
        created_visits.append({
            "visit_id": visit_id,
            "patient_name": patient["name"],
            "status": status,
            "risk_level": risk
        })
        
        logger.info(f"Created demo visit: {visit_id}")
    
    return {
        "message": f"Created {count} demo visits",
        "clinic_id": clinic_id,
        "visits": created_visits
    }


@router.delete("/clear-visits")
async def clear_demo_visits(
    current_user: Dict = Depends(get_current_user)
):
    """
    Clear all visits for the current clinic (demo/dev only)
    """
    clinic_id = current_user.get('clinic_id', 'CLINIC_DEMO')
    
    # Get all visits
    visits = db_client.list_clinic_visits(clinic_id, limit=100)
    
    # Delete each visit (in production, use batch delete)
    deleted_count = 0
    for visit in visits:
        try:
            # DynamoDB delete
            table = db_client.resource.Table(db_client.table_name)
            table.delete_item(
                Key={
                    'PK': visit['PK'],
                    'SK': visit['SK']
                }
            )
            deleted_count += 1
        except Exception as e:
            logger.error(f"Error deleting visit: {str(e)}")
    
    return {
        "message": f"Deleted {deleted_count} visits",
        "clinic_id": clinic_id
    }


@router.get("/health-check")
async def demo_health():
    """
    Check if demo endpoints are working
    """
    return {
        "status": "ok",
        "message": "Demo endpoints are active",
        "endpoints": [
            "POST /demo/seed-visits - Create test data",
            "DELETE /demo/clear-visits - Clear test data"
        ]
    }
