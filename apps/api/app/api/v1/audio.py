"""
Audio endpoints - Handle audio upload and processing
"""
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from typing import Dict
import uuid
from datetime import datetime
import logging
import asyncio

from app.core.security import get_current_user
from app.core.db import db_client
from app.schemas.medical import (
    AudioUploadRequest,
    AudioUploadResponse,
    VisitCreate,
    VisitResponse,
    ProcessingStatusResponse,
    VisitStatus
)
from app.services.storage import storage_service
from app.services.speech.transcribe import speech_service
from app.services.llm_engine.chain import rag_chain
from app.api.v1.websocket import notify_visit_update, notify_red_flag

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/audio", tags=["audio"])


@router.post("/upload-url", response_model=AudioUploadResponse)
async def get_upload_url(
    request: AudioUploadRequest,
    current_user: Dict = Depends(get_current_user)
):
    """
    Generate a presigned URL for uploading audio
    
    This allows the frontend to upload directly to S3 without
    going through the API server, reducing bandwidth costs
    """
    try:
        # Generate unique S3 key
        clinic_id = current_user.get("clinic_id")
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        audio_s3_key = f"audio/{clinic_id}/{request.visit_id}_{timestamp}.{request.file_extension}"
        
        # Generate presigned URL
        upload_url = storage_service.generate_presigned_url(
            object_key=audio_s3_key,
            operation='put_object'
        )
        
        logger.info(f"Generated upload URL for visit {request.visit_id}")
        
        return AudioUploadResponse(
            upload_url=upload_url,
            audio_s3_key=audio_s3_key,
            expiration_seconds=600
        )
        
    except Exception as e:
        logger.error(f"Error generating upload URL: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate upload URL: {str(e)}"
        )


@router.post("/mock-upload/{object_key:path}")
async def mock_upload_audio(
    object_key: str,
    file: bytes = None,
    current_user: Dict = Depends(get_current_user)
):
    """
    Mock upload endpoint for development without S3.
    Stores audio in memory when using InMemoryStorageService.
    """
    from fastapi import File, UploadFile
    from app.core.config import settings
    
    if settings.ENV != 'development':
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This endpoint is only available in development mode"
        )
    
    # Store file in memory storage
    if hasattr(storage_service, '_files'):
        storage_service._files[object_key] = file or b''
        logger.info(f"Mock stored file: {object_key}")
        return {"message": "File uploaded successfully", "object_key": object_key}
    
    return {"message": "File upload simulated", "object_key": object_key}


@router.put("/mock-upload/{object_key:path}")
async def mock_upload_audio_put(
    object_key: str,
    current_user: Dict = Depends(get_current_user)
):
    """PUT version of mock upload for presigned URL compatibility"""
    from fastapi import Request
    from app.core.config import settings
    
    if settings.ENV != 'development':
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This endpoint is only available in development mode"
        )
    
    logger.info(f"Mock PUT stored file: {object_key}")
    return {"message": "File uploaded successfully", "object_key": object_key}


@router.post("/visits", response_model=VisitResponse)
async def create_visit(
    visit_data: VisitCreate,
    background_tasks: BackgroundTasks,
    current_user: Dict = Depends(get_current_user)
):
    """
    Create a new visit record
    
    This initializes a visit record in PENDING status.
    Once audio is uploaded, call /process-audio to start AI processing
    """
    try:
        visit_id = f"VIS_{uuid.uuid4().hex[:12].upper()}"
        
        # Create visit record
        visit_record = db_client.create_visit({
            'visit_id': visit_id,
            'patient_id': visit_data.patient_id,
            'clinic_id': visit_data.clinic_id or current_user.get('clinic_id'),
            'doctor_id': visit_data.doctor_id or current_user.get('user_id'),
            'status': VisitStatus.PENDING,
            'language_code': visit_data.language_code,
            'audio_duration_seconds': visit_data.audio_duration_seconds
        })
        
        logger.info(f"Created visit {visit_id} for patient {visit_data.patient_id}")
        
        return VisitResponse(
            visit_id=visit_id,
            patient_id=visit_data.patient_id,
            clinic_id=visit_data.clinic_id or current_user.get('clinic_id'),
            doctor_id=visit_data.doctor_id or current_user.get('user_id'),
            status=VisitStatus.PENDING,
            language_code=visit_data.language_code,
            audio_s3_key=None,
            transcript=None,
            translated_text=None,
            soap_note=None,
            differential_diagnosis=None,
            red_flags=None,
            risk_level=None,
            created_at=datetime.fromisoformat(visit_record['created_at']),
            updated_at=datetime.fromisoformat(visit_record['updated_at']),
            processing_time_seconds=None
        )
        
    except Exception as e:
        logger.error(f"Error creating visit: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create visit: {str(e)}"
        )


@router.post("/process/{visit_id}")
async def process_audio(
    visit_id: str,
    audio_s3_key: str,
    background_tasks: BackgroundTasks,
    current_user: Dict = Depends(get_current_user)
):
    """
    Start processing audio for a visit
    
    This triggers the AI pipeline:
    1. Transcribe audio
    2. Translate to English
    3. Generate SOAP note
    4. Create differential diagnosis
    5. Detect red flags
    """
    try:
        clinic_id = current_user.get('clinic_id')
        
        # Get visit record
        visits = db_client.list_clinic_visits(clinic_id, limit=100)
        visit = next((v for v in visits if v.get('visit_id') == visit_id), None)
        
        if not visit:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Visit {visit_id} not found"
            )
        
        # Update status to PROCESSING
        db_client.update_visit(
            clinic_id=clinic_id,
            visit_sk=visit['SK'],
            updates={
                'status': VisitStatus.PROCESSING,
                'audio_s3_key': audio_s3_key
            }
        )
        
        # Add processing task to background
        background_tasks.add_task(
            process_audio_pipeline,
            visit_id=visit_id,
            audio_s3_key=audio_s3_key,
            clinic_id=clinic_id,
            visit_sk=visit['SK'],
            language_code=visit.get('language_code', 'hi-IN'),
            patient_age=visit.get('patient_age', 45),
            patient_gender=visit.get('patient_gender', 'male')
        )
        
        logger.info(f"Started processing audio for visit {visit_id}")
        
        return {
            "message": "Audio processing started",
            "visit_id": visit_id,
            "status": VisitStatus.PROCESSING
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting audio processing: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start processing: {str(e)}"
        )


@router.get("/status/{visit_id}", response_model=ProcessingStatusResponse)
async def get_processing_status(
    visit_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get the current processing status of a visit"""
    try:
        clinic_id = current_user.get('clinic_id')
        
        # Get visit record
        visits = db_client.list_clinic_visits(clinic_id, limit=100)
        visit = next((v for v in visits if v.get('visit_id') == visit_id), None)
        
        if not visit:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Visit {visit_id} not found"
            )
        
        # Calculate progress
        status = visit.get('status', VisitStatus.PENDING)
        progress_map = {
            VisitStatus.PENDING: 0,
            VisitStatus.PROCESSING: 10,
            VisitStatus.TRANSCRIBING: 30,
            VisitStatus.ANALYZING: 60,
            VisitStatus.COMPLETED: 100,
            VisitStatus.FAILED: 0
        }
        
        return ProcessingStatusResponse(
            visit_id=visit_id,
            status=status,
            progress_percentage=progress_map.get(status, 0),
            current_step=status.value,
            estimated_completion_seconds=30 if status != VisitStatus.COMPLETED else 0,
            error_message=visit.get('error_message')
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get status: {str(e)}"
        )


async def process_audio_pipeline(
    visit_id: str,
    audio_s3_key: str,
    clinic_id: str,
    visit_sk: str,
    language_code: str,
    patient_age: int,
    patient_gender: str
):
    """
    Background task to process audio through the AI pipeline
    """
    start_time = datetime.utcnow()
    
    try:
        logger.info(f"Starting AI pipeline for visit {visit_id}")
        
        # Step 1: Transcribe audio
        db_client.update_visit(clinic_id, visit_sk, {'status': VisitStatus.TRANSCRIBING})
        
        # Notify WebSocket clients
        asyncio.create_task(notify_visit_update(clinic_id, visit_id, "TRANSCRIBING", {
            "step": "Transcribing audio...",
            "progress": 20
        }))
        
        audio_s3_uri = f"s3://{storage_service.bucket_name}/{audio_s3_key}"
        transcription = await speech_service.transcribe_audio(audio_s3_uri, language_code)
        transcript_text = transcription['transcript']
        
        db_client.update_visit(clinic_id, visit_sk, {'transcript': transcript_text})
        logger.info(f"Transcription completed for visit {visit_id}")
        
        # Step 2: Translate and analyze
        db_client.update_visit(clinic_id, visit_sk, {'status': VisitStatus.ANALYZING})
        
        asyncio.create_task(notify_visit_update(clinic_id, visit_id, "ANALYZING", {
            "step": "Analyzing symptoms...",
            "progress": 50
        }))
        
        # Translate to medical English
        translated_text = await rag_chain.translate_to_medical_english(
            transcript_text,
            source_language=language_code.split('-')[0]
        )
        
        # Generate SOAP note
        soap_note = await rag_chain.generate_soap_note(
            translated_text=translated_text,
            patient_age=patient_age,
            patient_gender=patient_gender
        )
        
        # Extract chief complaint for differential diagnosis
        chief_complaint = translated_text.split('.')[0][:100]
        
        # Generate differential diagnosis
        differential = await rag_chain.generate_differential_diagnosis(
            chief_complaint=chief_complaint,
            symptoms=[translated_text],
            patient_age=patient_age,
            patient_gender=patient_gender,
            soap_summary=soap_note.get('assessment', '')
        )
        
        # Detect red flags
        red_flags = await rag_chain.detect_red_flags({
            'transcript': transcript_text,
            'translated': translated_text,
            'age': patient_age,
            'gender': patient_gender
        })
        
        # Calculate processing time
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Update visit with all results
        db_client.update_visit(
            clinic_id=clinic_id,
            visit_sk=visit_sk,
            updates={
                'status': VisitStatus.COMPLETED,
                'translated_text': translated_text,
                'soap_note': soap_note,
                'differential_diagnosis': differential,
                'red_flags': red_flags,
                'risk_level': red_flags.get('severity', 'ROUTINE'),
                'processing_time_seconds': processing_time
            }
        )
        
        # Notify completion
        asyncio.create_task(notify_visit_update(clinic_id, visit_id, "COMPLETED", {
            "step": "Analysis complete!",
            "progress": 100,
            "processing_time": processing_time
        }))
        
        # Send red flag alert if detected
        if red_flags.get('has_red_flags'):
            asyncio.create_task(notify_red_flag(clinic_id, visit_id, red_flags))
        
        logger.info(f"Completed AI pipeline for visit {visit_id} in {processing_time:.2f}s")
        
    except Exception as e:
        logger.error(f"Error in AI pipeline for visit {visit_id}: {str(e)}")
        
        asyncio.create_task(notify_visit_update(clinic_id, visit_id, "FAILED", {
            "step": "Processing failed",
            "error": str(e)
        }))
        
        db_client.update_visit(
            clinic_id=clinic_id,
            visit_sk=visit_sk,
            updates={
                'status': VisitStatus.FAILED,
                'error_message': str(e)
            }
        )
