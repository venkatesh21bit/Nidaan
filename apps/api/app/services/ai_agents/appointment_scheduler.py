"""
Appointment Scheduler Agent - Powered by watsonx.ai
Automatically schedules appointments based on urgency and availability
"""
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import random

logger = logging.getLogger(__name__)

class AppointmentSchedulerAgent:
    """
    AI Agent that automatically schedules appointments based on:
    - Patient urgency level
    - Doctor availability  
    - Optimal time slots
    - Patient preferences
    - Department specialization
    """
    
    # Available time slots (simulated)
    TIME_SLOTS = [
        "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
        "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM"
    ]
    
    # Available doctors by department (simulated)
    DOCTORS = [
        {"id": "USR_DEMO_DOC", "name": "Dr. Ram Kumar", "specialty": "General Medicine", "department": "general", "available": True},
        {"id": "USR_DOC_CARDIO", "name": "Dr. Priya Sharma", "specialty": "Cardiology", "department": "cardiac", "available": True},
        {"id": "USR_DOC_GASTRO", "name": "Dr. Amit Patel", "specialty": "Gastroenterology", "department": "gastro", "available": True},
        {"id": "USR_DOC_RESP", "name": "Dr. Sunita Reddy", "specialty": "Pulmonology", "department": "respiratory", "available": True},
        {"id": "USR_DOC_NEURO", "name": "Dr. Vikram Singh", "specialty": "Neurology", "department": "neuro", "available": True},
        {"id": "USR_DOC_ORTHO", "name": "Dr. Ravi Menon", "specialty": "Orthopedics", "department": "ortho", "available": True},
        {"id": "USR_DOC_DERM", "name": "Dr. Meera Nair", "specialty": "Dermatology", "department": "derma", "available": True},
        {"id": "USR_DOC_ENT", "name": "Dr. Kiran Desai", "specialty": "ENT", "department": "ent", "available": True},
    ]
    
    # Department to keyword mapping
    DEPARTMENT_KEYWORDS = {
        "cardiac": ["chest", "heart", "cardiac", "angina", "palpitation", "blood pressure", "hypertension"],
        "gastro": ["stomach", "abdomen", "gastric", "nausea", "vomiting", "digestion", "acidity", "liver"],
        "respiratory": ["breathing", "cough", "lungs", "respiratory", "asthma", "bronchitis", "pneumonia"],
        "neuro": ["headache", "migraine", "brain", "nerve", "dizziness", "seizure", "numbness", "memory"],
        "ortho": ["joint", "bone", "knee", "back pain", "fracture", "arthritis", "spine", "muscle"],
        "derma": ["skin", "rash", "allergy", "eczema", "acne", "fungal", "itching"],
        "ent": ["ear", "nose", "throat", "hearing", "sinus", "tonsil", "voice"],
    }
    
    def __init__(self, watsonx_client=None):
        self.watsonx_client = watsonx_client
        self.agent_id = "SCHEDULER_001"
        self.agent_name = "Smart Scheduler Agent"
        self._scheduled_slots: Dict[str, List[str]] = {}  # date -> list of taken slots
        
    async def schedule(self, appointment_id: str, urgency_level: str,
                      severity_score: int, patient_name: str,
                      preferred_date: str = None, preferred_time: str = None,
                      conditions: List[Dict] = None, symptoms: List[str] = None,
                      department: str = None) -> Dict:
        """
        Automatically schedule an appointment based on urgency
        """
        logger.info(f"[{self.agent_name}] Scheduling appointment {appointment_id} with urgency: {urgency_level}")
        
        try:
            # Determine scheduling parameters based on urgency
            schedule_window = self._get_schedule_window(urgency_level)
            
            # Find optimal date
            scheduled_date = self._find_optimal_date(
                urgency_level, schedule_window, preferred_date
            )
            
            # Find optimal time slot
            scheduled_time = self._find_optimal_slot(
                scheduled_date, urgency_level, preferred_time
            )
            
            # Determine department from symptoms if not provided
            if not department and symptoms:
                department = self._determine_department(symptoms)
            
            # Assign doctor based on department and specialty needed
            assigned_doctor = self._assign_doctor(conditions, department)
            
            # Calculate priority score
            priority_score = self._calculate_priority(urgency_level, severity_score)
            
            schedule_result = {
                "agent_id": self.agent_id,
                "agent_name": self.agent_name,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "appointment_id": appointment_id,
                "scheduling_decision": {
                    "scheduled_date": scheduled_date,
                    "scheduled_time": scheduled_time,
                    "assigned_doctor": assigned_doctor,
                    "priority_score": priority_score,
                    "urgency_level": urgency_level,
                    "department": department or "general",
                    "wait_time_hours": self._calculate_wait_time(scheduled_date, scheduled_time)
                },
                "reasoning": self._generate_reasoning(
                    urgency_level, scheduled_date, scheduled_time, assigned_doctor
                ),
                "notifications": self._generate_notifications(
                    patient_name, scheduled_date, scheduled_time, 
                    assigned_doctor, urgency_level
                ),
                "status": "scheduled"
            }
            
            # Mark slot as taken
            if scheduled_date not in self._scheduled_slots:
                self._scheduled_slots[scheduled_date] = []
            self._scheduled_slots[scheduled_date].append(scheduled_time)
            
            logger.info(f"[{self.agent_name}] Scheduled: {scheduled_date} at {scheduled_time}")
            return schedule_result
            
        except Exception as e:
            logger.error(f"[{self.agent_name}] Scheduling failed: {str(e)}")
            return {
                "agent_id": self.agent_id,
                "status": "error",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
    
    def _get_schedule_window(self, urgency: str) -> int:
        """Get scheduling window in days based on urgency"""
        windows = {
            'critical': 0,  # Same day
            'high': 1,      # Within 24 hours
            'medium': 3,    # Within 3 days
            'low': 7        # Within a week
        }
        return windows.get(urgency, 3)
    
    def _find_optimal_date(self, urgency: str, window: int, 
                          preferred_date: str = None) -> str:
        """Find optimal appointment date"""
        today = datetime.utcnow()
        
        if urgency == 'critical':
            return today.strftime("%Y-%m-%d")
        
        if urgency == 'high':
            # Tomorrow or today if available
            target = today + timedelta(days=1)
            return target.strftime("%Y-%m-%d")
        
        # For medium/low, try to honor preference within window
        if preferred_date:
            try:
                pref = datetime.strptime(preferred_date, "%Y-%m-%d")
                if pref >= today and (pref - today).days <= window:
                    return preferred_date
            except:
                pass
        
        # Default to optimal day within window
        target = today + timedelta(days=min(window, 2))
        return target.strftime("%Y-%m-%d")
    
    def _find_optimal_slot(self, date: str, urgency: str, 
                          preferred_time: str = None) -> str:
        """Find optimal time slot"""
        taken_slots = self._scheduled_slots.get(date, [])
        available_slots = [s for s in self.TIME_SLOTS if s not in taken_slots]
        
        if not available_slots:
            # All slots taken, create emergency slot
            if urgency in ['critical', 'high']:
                return "EMERGENCY SLOT"
            available_slots = self.TIME_SLOTS
        
        # Try to honor preference
        if preferred_time and preferred_time in available_slots:
            return preferred_time
        
        # For urgent cases, pick earliest available
        if urgency in ['critical', 'high']:
            return available_slots[0]
        
        # For others, pick mid-morning slot (usually less crowded)
        preferred_slots = ["10:00 AM", "10:30 AM", "02:30 PM", "03:00 PM"]
        for slot in preferred_slots:
            if slot in available_slots:
                return slot
        
        return available_slots[0]
    
    def _assign_doctor(self, conditions: List[Dict] = None, department: str = None) -> Dict:
        """Assign appropriate doctor based on conditions and department"""
        available_doctors = [d for d in self.DOCTORS if d['available']]
        
        if not available_doctors:
            return self.DOCTORS[0]  # Default to first doctor
        
        # First try to match by department
        if department:
            dept_doctors = [d for d in available_doctors if d.get('department') == department]
            if dept_doctors:
                return dept_doctors[0]
        
        # If no department match, try to match by condition/specialty
        if conditions:
            for condition in conditions:
                condition_name = condition.get('name', '').lower()
                # Match conditions to specialties
                if any(word in condition_name for word in ['heart', 'cardiac', 'chest']):
                    cardiac_docs = [d for d in available_doctors if d.get('department') == 'cardiac']
                    if cardiac_docs:
                        return cardiac_docs[0]
                elif any(word in condition_name for word in ['gastric', 'stomach', 'liver']):
                    gastro_docs = [d for d in available_doctors if d.get('department') == 'gastro']
                    if gastro_docs:
                        return gastro_docs[0]
                elif any(word in condition_name for word in ['respiratory', 'breathing', 'lung']):
                    resp_docs = [d for d in available_doctors if d.get('department') == 'respiratory']
                    if resp_docs:
                        return resp_docs[0]
                elif any(word in condition_name for word in ['neuro', 'headache', 'brain']):
                    neuro_docs = [d for d in available_doctors if d.get('department') == 'neuro']
                    if neuro_docs:
                        return neuro_docs[0]
                elif any(word in condition_name for word in ['bone', 'joint', 'orthop']):
                    ortho_docs = [d for d in available_doctors if d.get('department') == 'ortho']
                    if ortho_docs:
                        return ortho_docs[0]
        
        # Default to general medicine doctor
        general_docs = [d for d in available_doctors if d.get('department') == 'general']
        if general_docs:
            return general_docs[0]
        
        return available_doctors[0]
    
    def _determine_department(self, symptoms: List[str]) -> str:
        """Determine the department based on symptoms"""
        if not symptoms:
            return "general"
        
        symptoms_text = " ".join(symptoms).lower()
        
        # Check each department's keywords
        for dept, keywords in self.DEPARTMENT_KEYWORDS.items():
            for keyword in keywords:
                if keyword in symptoms_text:
                    logger.info(f"[{self.agent_name}] Matched department '{dept}' for symptom keyword '{keyword}'")
                    return dept
        
        return "general"
    
    def _calculate_priority(self, urgency: str, severity: int) -> int:
        """Calculate overall priority score (1-100)"""
        urgency_scores = {'critical': 40, 'high': 30, 'medium': 20, 'low': 10}
        base = urgency_scores.get(urgency, 20)
        severity_component = severity * 6  # 0-60 based on 0-10 severity
        return min(base + severity_component, 100)
    
    def _calculate_wait_time(self, date: str, time: str) -> float:
        """Calculate expected wait time in hours"""
        try:
            scheduled = datetime.strptime(f"{date} {time}", "%Y-%m-%d %I:%M %p")
            now = datetime.utcnow()
            diff = scheduled - now
            return max(diff.total_seconds() / 3600, 0)
        except:
            return 24  # Default 24 hours
    
    def _generate_reasoning(self, urgency: str, date: str, time: str, 
                           doctor: Dict) -> str:
        """Generate AI reasoning for the scheduling decision"""
        reasons = []
        
        if urgency == 'critical':
            reasons.append("Patient requires immediate attention based on critical symptoms")
            reasons.append(f"Scheduled emergency appointment for today")
        elif urgency == 'high':
            reasons.append("High urgency symptoms detected - scheduling within 24 hours")
        elif urgency == 'medium':
            reasons.append("Moderate symptoms require attention within 2-3 days")
        else:
            reasons.append("Routine appointment scheduled based on availability")
        
        reasons.append(f"Assigned to {doctor['name']} ({doctor['specialty']})")
        reasons.append(f"Selected {time} slot for optimal care delivery")
        
        return " | ".join(reasons)
    
    def _generate_notifications(self, patient_name: str, date: str, time: str,
                               doctor: Dict, urgency: str) -> List[Dict]:
        """Generate notifications to be sent"""
        notifications = []
        
        # Patient notification
        notifications.append({
            "type": "patient_notification",
            "channel": "sms",
            "recipient": patient_name,
            "message": f"Your appointment is confirmed for {date} at {time} with {doctor['name']}",
            "status": "pending"
        })
        
        notifications.append({
            "type": "patient_notification", 
            "channel": "email",
            "recipient": patient_name,
            "message": f"Appointment Confirmation - {date} at {time}",
            "status": "pending"
        })
        
        # Doctor notification for urgent cases
        if urgency in ['critical', 'high']:
            notifications.append({
                "type": "doctor_alert",
                "channel": "push",
                "recipient": doctor['name'],
                "message": f"⚠️ Urgent patient: {patient_name} scheduled for {date} at {time}",
                "priority": "high",
                "status": "pending"
            })
        
        # Reminder notification
        notifications.append({
            "type": "reminder",
            "channel": "sms",
            "recipient": patient_name,
            "message": f"Reminder: Appointment tomorrow at {time}",
            "send_at": f"{date} -1 day 18:00",
            "status": "scheduled"
        })
        
        return notifications
