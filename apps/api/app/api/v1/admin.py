"""
Admin Dashboard API Endpoints
Handles appointment management, patient administration, and AI agent orchestration
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from typing import List, Dict, Optional, Any
from datetime import datetime, date, timedelta
from pydantic import BaseModel, EmailStr
import logging
import uuid

from app.core.security import get_current_user, require_role
from app.core.db import db_client
from app.services.ibm.cloudant import cloudant_service
from app.services.ibm.email_service import email_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


# ==================== Pydantic Models ====================

class AppointmentCreate(BaseModel):
    patient_id: str
    patient_name: str
    patient_email: Optional[EmailStr] = None
    patient_phone: Optional[str] = None
    doctor_id: str
    doctor_name: Optional[str] = None
    appointment_date: str  # YYYY-MM-DD
    appointment_time: str  # HH:MM
    duration_minutes: int = 30
    reason: Optional[str] = None
    notes: Optional[str] = None


class AppointmentUpdate(BaseModel):
    appointment_date: Optional[str] = None
    appointment_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class DoctorSlot(BaseModel):
    doctor_id: str
    doctor_name: str
    date: str  # YYYY-MM-DD
    start_time: str  # HH:MM
    end_time: str  # HH:MM
    slot_duration_minutes: int = 30
    is_available: bool = True


class AgentTask(BaseModel):
    task_type: str  # 'send_reminder', 'send_survey', 'schedule_followup', 'auto_triage'
    target_id: str  # appointment_id or patient_id
    scheduled_time: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None


class AgentConfig(BaseModel):
    agent_name: str
    enabled: bool = True
    auto_send_reminders: bool = True
    reminder_hours_before: List[int] = [48, 24, 2]
    auto_send_surveys: bool = True
    survey_hours_before: int = 48
    auto_followup: bool = True
    followup_days_after: int = 7


# ==================== Dashboard Stats ====================

@router.get("/dashboard/stats")
async def get_admin_dashboard_stats(
    current_user: Dict = Depends(require_role(["admin", "doctor"]))
):
    """Get comprehensive admin dashboard statistics"""
    try:
        clinic_id = current_user.get('clinic_id')
        today = date.today().isoformat()
        
        # Get all appointments
        appointments = await get_appointments_from_db(clinic_id)
        
        # Calculate stats
        today_appointments = [a for a in appointments if a.get('appointment_date') == today]
        pending_surveys = [a for a in appointments if a.get('status') == 'survey_sent']
        upcoming_week = [a for a in appointments if a.get('appointment_date', '') > today 
                        and a.get('appointment_date', '') <= (date.today() + timedelta(days=7)).isoformat()]
        
        # Get triage cases for severity breakdown
        visits = db_client.list_clinic_visits(clinic_id, limit=100)
        high_risk = len([v for v in visits if v.get('risk_level') in ['CRITICAL', 'HIGH']])
        
        return {
            "total_appointments_today": len(today_appointments),
            "upcoming_appointments_week": len(upcoming_week),
            "pending_surveys": len(pending_surveys),
            "high_risk_patients": high_risk,
            "total_patients": len(set(a.get('patient_id') for a in appointments)),
            "agent_tasks_pending": await get_pending_agent_tasks_count(clinic_id),
            "agent_tasks_completed_today": await get_completed_agent_tasks_count(clinic_id, today),
        }
    except Exception as e:
        logger.error(f"Error fetching admin stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch stats: {str(e)}"
        )


# ==================== Appointment Management ====================

@router.get("/appointments")
async def list_appointments(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    doctor_id: Optional[str] = Query(None),
    patient_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    current_user: Dict = Depends(require_role(["admin", "doctor"]))
):
    """List appointments with filters"""
    try:
        clinic_id = current_user.get('clinic_id')
        appointments = await get_appointments_from_db(clinic_id)
        
        # Apply filters
        if start_date:
            appointments = [a for a in appointments if a.get('appointment_date', '') >= start_date]
        if end_date:
            appointments = [a for a in appointments if a.get('appointment_date', '') <= end_date]
        if doctor_id:
            appointments = [a for a in appointments if a.get('doctor_id') == doctor_id]
        if patient_id:
            appointments = [a for a in appointments if a.get('patient_id') == patient_id]
        if status_filter:
            appointments = [a for a in appointments if a.get('status') == status_filter]
        
        # Sort by date and time
        appointments.sort(key=lambda x: (x.get('appointment_date', ''), x.get('appointment_time', '')))
        
        return appointments[:limit]
    except Exception as e:
        logger.error(f"Error listing appointments: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list appointments: {str(e)}"
        )


@router.post("/appointments")
async def create_appointment(
    appointment: AppointmentCreate,
    background_tasks: BackgroundTasks,
    current_user: Dict = Depends(require_role(["admin", "doctor"]))
):
    """Create a new appointment"""
    try:
        clinic_id = current_user.get('clinic_id')
        appointment_id = f"APPT_{uuid.uuid4().hex[:12].upper()}"
        
        appointment_doc = {
            "_id": appointment_id,
            "type": "appointment",
            "clinic_id": clinic_id,
            "patient_id": appointment.patient_id,
            "patient_name": appointment.patient_name,
            "patient_email": appointment.patient_email,
            "patient_phone": appointment.patient_phone,
            "doctor_id": appointment.doctor_id,
            "doctor_name": appointment.doctor_name,
            "appointment_date": appointment.appointment_date,
            "appointment_time": appointment.appointment_time,
            "duration_minutes": appointment.duration_minutes,
            "reason": appointment.reason,
            "notes": appointment.notes,
            "status": "scheduled",
            "survey_id": None,
            "triage_case_id": None,
            "created_at": datetime.utcnow().isoformat(),
            "created_by": current_user.get('user_id'),
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        # Save to database
        await save_appointment_to_db(appointment_doc)
        
        # Schedule AI agent tasks
        background_tasks.add_task(
            schedule_appointment_agents,
            appointment_id,
            appointment_doc,
            clinic_id
        )
        
        logger.info(f"Created appointment {appointment_id} for patient {appointment.patient_id}")
        
        return {
            "appointment_id": appointment_id,
            "message": "Appointment created successfully",
            "status": "scheduled",
            "agent_tasks_scheduled": True
        }
    except Exception as e:
        logger.error(f"Error creating appointment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create appointment: {str(e)}"
        )


@router.get("/appointments/{appointment_id}")
async def get_appointment(
    appointment_id: str,
    current_user: Dict = Depends(require_role(["admin", "doctor"]))
):
    """Get appointment details"""
    try:
        appointment = await get_appointment_from_db(appointment_id)
        if not appointment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Appointment not found"
            )
        return appointment
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching appointment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch appointment: {str(e)}"
        )


@router.put("/appointments/{appointment_id}")
async def update_appointment(
    appointment_id: str,
    updates: AppointmentUpdate,
    current_user: Dict = Depends(require_role(["admin", "doctor"]))
):
    """Update an appointment"""
    try:
        appointment = await get_appointment_from_db(appointment_id)
        if not appointment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Appointment not found"
            )
        
        # Apply updates
        update_data = updates.dict(exclude_none=True)
        update_data['updated_at'] = datetime.utcnow().isoformat()
        update_data['updated_by'] = current_user.get('user_id')
        
        for key, value in update_data.items():
            appointment[key] = value
        
        await save_appointment_to_db(appointment)
        
        return {"message": "Appointment updated successfully", "appointment_id": appointment_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating appointment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update appointment: {str(e)}"
        )


@router.delete("/appointments/{appointment_id}")
async def cancel_appointment(
    appointment_id: str,
    current_user: Dict = Depends(require_role(["admin", "doctor"]))
):
    """Cancel an appointment"""
    try:
        appointment = await get_appointment_from_db(appointment_id)
        if not appointment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Appointment not found"
            )
        
        appointment['status'] = 'cancelled'
        appointment['cancelled_at'] = datetime.utcnow().isoformat()
        appointment['cancelled_by'] = current_user.get('user_id')
        
        await save_appointment_to_db(appointment)
        
        # Cancel scheduled agent tasks
        await cancel_appointment_agent_tasks(appointment_id)
        
        return {"message": "Appointment cancelled successfully", "appointment_id": appointment_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling appointment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel appointment: {str(e)}"
        )


# ==================== Patient Management ====================

@router.get("/patients")
async def list_patients(
    search: Optional[str] = Query(None, description="Search by name or ID"),
    limit: int = Query(50, le=200),
    current_user: Dict = Depends(require_role(["admin", "doctor"]))
):
    """List all patients in the clinic"""
    try:
        clinic_id = current_user.get('clinic_id')
        
        # Get patients from visits and appointments
        visits = db_client.list_clinic_visits(clinic_id, limit=200)
        appointments = await get_appointments_from_db(clinic_id)
        
        # Build patient list
        patients = {}
        for v in visits:
            pid = v.get('patient_id')
            if pid and pid not in patients:
                patients[pid] = {
                    "patient_id": pid,
                    "patient_name": v.get('patient_name', 'Unknown'),
                    "patient_age": v.get('patient_age'),
                    "patient_gender": v.get('patient_gender'),
                    "last_visit": v.get('created_at'),
                    "total_visits": 1,
                    "risk_level": v.get('risk_level'),
                }
            elif pid:
                patients[pid]['total_visits'] += 1
                if v.get('created_at', '') > patients[pid].get('last_visit', ''):
                    patients[pid]['last_visit'] = v.get('created_at')
                    patients[pid]['risk_level'] = v.get('risk_level')
        
        # Add email/phone from appointments
        for a in appointments:
            pid = a.get('patient_id')
            if pid in patients:
                if a.get('patient_email'):
                    patients[pid]['patient_email'] = a.get('patient_email')
                if a.get('patient_phone'):
                    patients[pid]['patient_phone'] = a.get('patient_phone')
        
        patient_list = list(patients.values())
        
        # Apply search filter
        if search:
            search_lower = search.lower()
            patient_list = [p for p in patient_list if 
                          search_lower in p.get('patient_name', '').lower() or
                          search_lower in p.get('patient_id', '').lower()]
        
        # Sort by last visit
        patient_list.sort(key=lambda x: x.get('last_visit', ''), reverse=True)
        
        return patient_list[:limit]
    except Exception as e:
        logger.error(f"Error listing patients: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list patients: {str(e)}"
        )


@router.get("/patients/{patient_id}")
async def get_patient_details(
    patient_id: str,
    current_user: Dict = Depends(require_role(["admin", "doctor"]))
):
    """Get detailed patient information"""
    try:
        clinic_id = current_user.get('clinic_id')
        
        # Get all visits for this patient
        all_visits = db_client.list_clinic_visits(clinic_id, limit=200)
        patient_visits = [v for v in all_visits if v.get('patient_id') == patient_id]
        
        if not patient_visits:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found"
            )
        
        # Get appointments
        appointments = await get_appointments_from_db(clinic_id)
        patient_appointments = [a for a in appointments if a.get('patient_id') == patient_id]
        
        # Build comprehensive patient profile
        latest_visit = max(patient_visits, key=lambda x: x.get('created_at', ''))
        
        return {
            "patient_id": patient_id,
            "patient_name": latest_visit.get('patient_name', 'Unknown'),
            "patient_age": latest_visit.get('patient_age'),
            "patient_gender": latest_visit.get('patient_gender'),
            "current_risk_level": latest_visit.get('risk_level'),
            "total_visits": len(patient_visits),
            "visits": patient_visits[:10],  # Last 10 visits
            "appointments": patient_appointments[:10],  # Last 10 appointments
            "has_red_flags": any(v.get('has_red_flags') for v in patient_visits),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching patient: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch patient: {str(e)}"
        )


# ==================== AI Agent Management ====================

@router.get("/agents/status")
async def get_agent_status(
    current_user: Dict = Depends(require_role(["admin", "doctor"]))
):
    """Get status of all AI agents"""
    try:
        clinic_id = current_user.get('clinic_id')
        config = await get_agent_config(clinic_id)
        pending_tasks = await get_pending_agent_tasks(clinic_id)
        recent_logs = await get_agent_logs(clinic_id, limit=20)
        
        return {
            "config": config,
            "agents": [
                {
                    "name": "Reminder Agent",
                    "description": "Sends appointment reminders via email",
                    "enabled": config.get('auto_send_reminders', True),
                    "status": "active" if config.get('auto_send_reminders', True) else "paused",
                    "pending_tasks": len([t for t in pending_tasks if t.get('task_type') == 'send_reminder']),
                },
                {
                    "name": "Survey Agent",
                    "description": "Sends pre-check-in surveys before appointments",
                    "enabled": config.get('auto_send_surveys', True),
                    "status": "active" if config.get('auto_send_surveys', True) else "paused",
                    "pending_tasks": len([t for t in pending_tasks if t.get('task_type') == 'send_survey']),
                },
                {
                    "name": "Follow-up Agent",
                    "description": "Schedules and sends post-visit follow-ups",
                    "enabled": config.get('auto_followup', True),
                    "status": "active" if config.get('auto_followup', True) else "paused",
                    "pending_tasks": len([t for t in pending_tasks if t.get('task_type') == 'schedule_followup']),
                },
                {
                    "name": "Triage Agent",
                    "description": "Automatically processes survey responses and assigns severity",
                    "enabled": config.get('auto_triage', True),
                    "status": "active" if config.get('auto_triage', True) else "paused",
                    "pending_tasks": len([t for t in pending_tasks if t.get('task_type') == 'auto_triage']),
                },
            ],
            "recent_activity": recent_logs,
        }
    except Exception as e:
        logger.error(f"Error fetching agent status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch agent status: {str(e)}"
        )


@router.put("/agents/config")
async def update_agent_config(
    config: AgentConfig,
    current_user: Dict = Depends(require_role(["admin", "doctor"]))
):
    """Update AI agent configuration"""
    try:
        clinic_id = current_user.get('clinic_id')
        
        config_doc = {
            "_id": f"agent_config_{clinic_id}",
            "type": "agent_config",
            "clinic_id": clinic_id,
            "auto_send_reminders": config.auto_send_reminders,
            "reminder_hours_before": config.reminder_hours_before,
            "auto_send_surveys": config.auto_send_surveys,
            "survey_hours_before": config.survey_hours_before,
            "auto_followup": config.auto_followup,
            "followup_days_after": config.followup_days_after,
            "auto_triage": True,  # Always enabled
            "updated_at": datetime.utcnow().isoformat(),
            "updated_by": current_user.get('user_id'),
        }
        
        await save_agent_config(config_doc)
        
        return {"message": "Agent configuration updated successfully"}
    except Exception as e:
        logger.error(f"Error updating agent config: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update agent config: {str(e)}"
        )


@router.post("/agents/trigger")
async def trigger_agent_task(
    task: AgentTask,
    background_tasks: BackgroundTasks,
    current_user: Dict = Depends(require_role(["admin", "doctor"]))
):
    """Manually trigger an AI agent task"""
    try:
        clinic_id = current_user.get('clinic_id')
        
        task_id = f"TASK_{uuid.uuid4().hex[:12].upper()}"
        
        task_doc = {
            "_id": task_id,
            "type": "agent_task",
            "clinic_id": clinic_id,
            "task_type": task.task_type,
            "target_id": task.target_id,
            "parameters": task.parameters or {},
            "status": "pending",
            "triggered_by": current_user.get('user_id'),
            "triggered_at": datetime.utcnow().isoformat(),
            "scheduled_time": task.scheduled_time,
        }
        
        await save_agent_task(task_doc)
        
        # Execute task in background
        background_tasks.add_task(
            execute_agent_task,
            task_doc
        )
        
        logger.info(f"Triggered agent task {task_id}: {task.task_type}")
        
        return {
            "task_id": task_id,
            "message": f"Agent task '{task.task_type}' triggered successfully",
            "status": "pending"
        }
    except Exception as e:
        logger.error(f"Error triggering agent task: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to trigger agent task: {str(e)}"
        )


@router.get("/agents/logs")
async def get_agent_activity_logs(
    task_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    current_user: Dict = Depends(require_role(["admin", "doctor"]))
):
    """Get AI agent activity logs"""
    try:
        clinic_id = current_user.get('clinic_id')
        logs = await get_agent_logs(clinic_id, limit=limit)
        
        if task_type:
            logs = [l for l in logs if l.get('task_type') == task_type]
        if status_filter:
            logs = [l for l in logs if l.get('status') == status_filter]
        
        return logs
    except Exception as e:
        logger.error(f"Error fetching agent logs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch agent logs: {str(e)}"
        )


# ==================== Helper Functions ====================

# In-memory storage for demo (replace with Cloudant in production)
_appointments_store: Dict[str, Dict] = {}
_agent_tasks_store: Dict[str, Dict] = {}
_agent_config_store: Dict[str, Dict] = {}


async def get_appointments_from_db(clinic_id: str) -> List[Dict]:
    """Get appointments from database"""
    # Demo: use in-memory store
    return [a for a in _appointments_store.values() if a.get('clinic_id') == clinic_id]


async def get_appointment_from_db(appointment_id: str) -> Optional[Dict]:
    """Get single appointment"""
    return _appointments_store.get(appointment_id)


async def save_appointment_to_db(appointment: Dict):
    """Save appointment to database"""
    _appointments_store[appointment['_id']] = appointment


async def get_pending_agent_tasks(clinic_id: str) -> List[Dict]:
    """Get pending agent tasks"""
    return [t for t in _agent_tasks_store.values() 
            if t.get('clinic_id') == clinic_id and t.get('status') == 'pending']


async def get_pending_agent_tasks_count(clinic_id: str) -> int:
    """Get count of pending agent tasks"""
    return len(await get_pending_agent_tasks(clinic_id))


async def get_completed_agent_tasks_count(clinic_id: str, date_str: str) -> int:
    """Get count of completed agent tasks for a date"""
    tasks = [t for t in _agent_tasks_store.values() 
             if t.get('clinic_id') == clinic_id 
             and t.get('status') == 'completed'
             and t.get('completed_at', '').startswith(date_str)]
    return len(tasks)


async def save_agent_task(task: Dict):
    """Save agent task"""
    _agent_tasks_store[task['_id']] = task


async def get_agent_config(clinic_id: str) -> Dict:
    """Get agent configuration"""
    config_id = f"agent_config_{clinic_id}"
    return _agent_config_store.get(config_id, {
        "auto_send_reminders": True,
        "reminder_hours_before": [48, 24, 2],
        "auto_send_surveys": True,
        "survey_hours_before": 48,
        "auto_followup": True,
        "followup_days_after": 7,
        "auto_triage": True,
    })


async def save_agent_config(config: Dict):
    """Save agent configuration"""
    _agent_config_store[config['_id']] = config


async def get_agent_logs(clinic_id: str, limit: int = 50) -> List[Dict]:
    """Get agent activity logs"""
    logs = [t for t in _agent_tasks_store.values() if t.get('clinic_id') == clinic_id]
    logs.sort(key=lambda x: x.get('triggered_at', ''), reverse=True)
    return logs[:limit]


async def cancel_appointment_agent_tasks(appointment_id: str):
    """Cancel all pending tasks for an appointment"""
    for task_id, task in _agent_tasks_store.items():
        if task.get('target_id') == appointment_id and task.get('status') == 'pending':
            task['status'] = 'cancelled'
            task['cancelled_at'] = datetime.utcnow().isoformat()


async def schedule_appointment_agents(appointment_id: str, appointment: Dict, clinic_id: str):
    """Schedule AI agent tasks for a new appointment"""
    try:
        config = await get_agent_config(clinic_id)
        
        # Parse appointment datetime
        appt_date = datetime.strptime(appointment['appointment_date'], '%Y-%m-%d')
        appt_time = datetime.strptime(appointment['appointment_time'], '%H:%M').time()
        appt_datetime = datetime.combine(appt_date, appt_time)
        
        # Schedule survey (if enabled)
        if config.get('auto_send_surveys', True) and appointment.get('patient_email'):
            survey_time = appt_datetime - timedelta(hours=config.get('survey_hours_before', 48))
            task_id = f"TASK_{uuid.uuid4().hex[:12].upper()}"
            await save_agent_task({
                "_id": task_id,
                "type": "agent_task",
                "clinic_id": clinic_id,
                "task_type": "send_survey",
                "target_id": appointment_id,
                "parameters": {"patient_email": appointment.get('patient_email')},
                "status": "scheduled",
                "scheduled_time": survey_time.isoformat(),
                "triggered_at": datetime.utcnow().isoformat(),
            })
            logger.info(f"Scheduled survey task for appointment {appointment_id}")
        
        # Schedule reminders (if enabled)
        if config.get('auto_send_reminders', True) and appointment.get('patient_email'):
            for hours_before in config.get('reminder_hours_before', [48, 24, 2]):
                reminder_time = appt_datetime - timedelta(hours=hours_before)
                if reminder_time > datetime.utcnow():
                    task_id = f"TASK_{uuid.uuid4().hex[:12].upper()}"
                    await save_agent_task({
                        "_id": task_id,
                        "type": "agent_task",
                        "clinic_id": clinic_id,
                        "task_type": "send_reminder",
                        "target_id": appointment_id,
                        "parameters": {
                            "patient_email": appointment.get('patient_email'),
                            "hours_before": hours_before,
                        },
                        "status": "scheduled",
                        "scheduled_time": reminder_time.isoformat(),
                        "triggered_at": datetime.utcnow().isoformat(),
                    })
            logger.info(f"Scheduled reminder tasks for appointment {appointment_id}")
        
    except Exception as e:
        logger.error(f"Error scheduling agent tasks: {str(e)}")


async def execute_agent_task(task: Dict):
    """Execute an AI agent task"""
    task_id = task['_id']
    task_type = task['task_type']
    
    try:
        logger.info(f"Executing agent task {task_id}: {task_type}")
        
        task['status'] = 'running'
        task['started_at'] = datetime.utcnow().isoformat()
        await save_agent_task(task)
        
        if task_type == 'send_reminder':
            await execute_reminder_task(task)
        elif task_type == 'send_survey':
            await execute_survey_task(task)
        elif task_type == 'schedule_followup':
            await execute_followup_task(task)
        elif task_type == 'auto_triage':
            await execute_triage_task(task)
        else:
            raise ValueError(f"Unknown task type: {task_type}")
        
        task['status'] = 'completed'
        task['completed_at'] = datetime.utcnow().isoformat()
        await save_agent_task(task)
        
        logger.info(f"Completed agent task {task_id}")
        
    except Exception as e:
        logger.error(f"Agent task {task_id} failed: {str(e)}")
        task['status'] = 'failed'
        task['error'] = str(e)
        task['failed_at'] = datetime.utcnow().isoformat()
        await save_agent_task(task)


async def execute_reminder_task(task: Dict):
    """Send appointment reminder email"""
    appointment = await get_appointment_from_db(task['target_id'])
    if not appointment:
        raise ValueError("Appointment not found")
    
    patient_email = task['parameters'].get('patient_email')
    hours_before = task['parameters'].get('hours_before', 24)
    
    # Use email service to send reminder
    logger.info(f"Sending reminder to {patient_email} for appointment {appointment['_id']}")
    
    # In production, call email_service.send_reminder()
    # For demo, just log
    task['result'] = {
        "email_sent": True,
        "recipient": patient_email,
        "hours_before": hours_before,
    }


async def execute_survey_task(task: Dict):
    """Send pre-check-in survey"""
    appointment = await get_appointment_from_db(task['target_id'])
    if not appointment:
        raise ValueError("Appointment not found")
    
    patient_email = task['parameters'].get('patient_email')
    
    logger.info(f"Sending survey to {patient_email} for appointment {appointment['_id']}")
    
    # In production, call email_service.send_precheckin_survey()
    # For demo, just log and update appointment status
    appointment['status'] = 'survey_sent'
    appointment['survey_sent_at'] = datetime.utcnow().isoformat()
    await save_appointment_to_db(appointment)
    
    task['result'] = {
        "survey_sent": True,
        "recipient": patient_email,
    }


async def execute_followup_task(task: Dict):
    """Schedule and send follow-up"""
    logger.info(f"Executing follow-up task for {task['target_id']}")
    task['result'] = {"followup_scheduled": True}


async def execute_triage_task(task: Dict):
    """Automatically process and triage"""
    logger.info(f"Executing auto-triage for {task['target_id']}")
    task['result'] = {"triage_completed": True}
