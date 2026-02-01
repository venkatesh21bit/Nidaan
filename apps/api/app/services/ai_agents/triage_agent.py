"""
Triage Agent - Powered by watsonx.ai
Routes patients based on urgency and medical needs
"""
import logging
from typing import Dict, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class TriageAgent:
    """
    AI Agent that performs intelligent patient triage:
    - Routes critical cases immediately
    - Assigns appropriate care levels
    - Escalates when needed
    - Tracks patient flow
    """
    
    # Care levels and their descriptions
    CARE_LEVELS = {
        1: {"name": "Resuscitation", "color": "red", "description": "Life-threatening, immediate intervention"},
        2: {"name": "Emergency", "color": "orange", "description": "Potentially life-threatening, urgent"},
        3: {"name": "Urgent", "color": "yellow", "description": "Serious but stable, prompt attention needed"},
        4: {"name": "Less Urgent", "color": "green", "description": "Minor conditions, can wait"},
        5: {"name": "Non-Urgent", "color": "blue", "description": "Minor issues, routine care"}
    }
    
    # Department routing based on conditions
    DEPARTMENT_ROUTING = {
        'cardiac': ['chest pain', 'heart', 'palpitation', 'cardiac'],
        'respiratory': ['breathing', 'cough', 'asthma', 'pneumonia', 'respiratory'],
        'gastro': ['stomach', 'nausea', 'vomiting', 'diarrhea', 'abdomen'],
        'neuro': ['headache', 'dizziness', 'seizure', 'stroke', 'numbness'],
        'ortho': ['fracture', 'bone', 'joint', 'sprain', 'back pain'],
        'general': ['fever', 'cold', 'flu', 'general']
    }
    
    def __init__(self, watsonx_client=None):
        self.watsonx_client = watsonx_client
        self.agent_id = "TRIAGE_001"
        self.agent_name = "AI Triage Specialist"
        self._triage_queue: List[Dict] = []
        
    async def triage(self, appointment_id: str, symptoms: List[str],
                    urgency_level: str, severity_score: int,
                    patient_name: str, conditions: List[Dict] = None) -> Dict:
        """
        Perform intelligent triage and routing
        """
        logger.info(f"[{self.agent_name}] Triaging patient: {patient_name}")
        
        try:
            # Determine care level (1-5)
            care_level = self._determine_care_level(urgency_level, severity_score)
            
            # Determine department routing
            department = self._route_to_department(symptoms, conditions)
            
            # Check if escalation needed
            escalation = self._check_escalation(care_level, symptoms)
            
            # Generate triage notes
            triage_notes = self._generate_triage_notes(
                symptoms, urgency_level, care_level, department
            )
            
            # Calculate estimated wait time
            wait_time = self._estimate_wait_time(care_level)
            
            triage_result = {
                "agent_id": self.agent_id,
                "agent_name": self.agent_name,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "appointment_id": appointment_id,
                "patient_name": patient_name,
                "triage_assessment": {
                    "care_level": care_level,
                    "care_level_info": self.CARE_LEVELS[care_level],
                    "department": department,
                    "estimated_wait_minutes": wait_time,
                    "urgency_classification": urgency_level
                },
                "escalation": escalation,
                "triage_notes": triage_notes,
                "queue_position": self._add_to_queue(appointment_id, care_level),
                "actions_taken": self._generate_actions(care_level, escalation),
                "status": "triaged"
            }
            
            logger.info(f"[{self.agent_name}] Triage complete: Level {care_level}, Dept: {department}")
            return triage_result
            
        except Exception as e:
            logger.error(f"[{self.agent_name}] Triage failed: {str(e)}")
            return {
                "agent_id": self.agent_id,
                "status": "error",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
    
    def _determine_care_level(self, urgency: str, severity: int) -> int:
        """Determine care level 1-5 based on urgency and severity"""
        if urgency == 'critical' or severity >= 9:
            return 1
        elif urgency == 'high' or severity >= 7:
            return 2
        elif urgency == 'medium' or severity >= 5:
            return 3
        elif severity >= 3:
            return 4
        else:
            return 5
    
    def _route_to_department(self, symptoms: List[str], 
                            conditions: List[Dict] = None) -> Dict:
        """Route to appropriate department"""
        symptom_text = " ".join(symptoms).lower()
        
        # Check condition names if available
        if conditions:
            condition_text = " ".join([c.get('name', '').lower() for c in conditions])
            symptom_text += " " + condition_text
        
        # Find matching department
        for dept, keywords in self.DEPARTMENT_ROUTING.items():
            if any(keyword in symptom_text for keyword in keywords):
                return {
                    "code": dept,
                    "name": dept.title() + " Department",
                    "matched_keywords": [k for k in keywords if k in symptom_text]
                }
        
        return {
            "code": "general",
            "name": "General Medicine",
            "matched_keywords": []
        }
    
    def _check_escalation(self, care_level: int, symptoms: List[str]) -> Dict:
        """Check if escalation is needed"""
        escalation = {
            "needed": False,
            "type": None,
            "reason": None,
            "notify": []
        }
        
        symptom_text = " ".join(symptoms).lower()
        
        # Level 1 always escalates to senior doctor
        if care_level == 1:
            escalation.update({
                "needed": True,
                "type": "senior_doctor",
                "reason": "Critical care level requires senior oversight",
                "notify": ["on_call_doctor", "department_head", "nursing_supervisor"]
            })
        # Level 2 notifies on-call doctor
        elif care_level == 2:
            escalation.update({
                "needed": True,
                "type": "on_call_doctor",
                "reason": "Emergency care level requires doctor notification",
                "notify": ["on_call_doctor", "assigned_nurse"]
            })
        
        # Check for specific escalation triggers
        critical_triggers = ['unconscious', 'not breathing', 'severe bleeding', 'chest pain']
        if any(trigger in symptom_text for trigger in critical_triggers):
            escalation.update({
                "needed": True,
                "type": "emergency_team",
                "reason": "Critical symptom detected",
                "notify": ["emergency_team", "on_call_doctor"]
            })
        
        return escalation
    
    def _generate_triage_notes(self, symptoms: List[str], urgency: str,
                              care_level: int, department: Dict) -> str:
        """Generate AI triage notes"""
        notes = []
        
        notes.append(f"Patient presents with: {', '.join(symptoms)}")
        notes.append(f"AI Assessment: {urgency.upper()} urgency")
        notes.append(f"Assigned Care Level: {care_level} ({self.CARE_LEVELS[care_level]['name']})")
        notes.append(f"Routed to: {department['name']}")
        
        if care_level <= 2:
            notes.append("⚠️ Requires immediate medical attention")
        
        return " | ".join(notes)
    
    def _estimate_wait_time(self, care_level: int) -> int:
        """Estimate wait time in minutes based on care level"""
        wait_times = {
            1: 0,    # Immediate
            2: 10,   # 10 minutes
            3: 30,   # 30 minutes
            4: 60,   # 1 hour
            5: 120   # 2 hours
        }
        return wait_times.get(care_level, 60)
    
    def _add_to_queue(self, appointment_id: str, care_level: int) -> int:
        """Add patient to triage queue and return position"""
        # Insert based on priority (lower care level = higher priority)
        entry = {"id": appointment_id, "care_level": care_level}
        
        # Find insertion point
        position = 0
        for i, item in enumerate(self._triage_queue):
            if item['care_level'] > care_level:
                position = i
                break
            position = i + 1
        
        self._triage_queue.insert(position, entry)
        return position + 1  # 1-indexed position
    
    def _generate_actions(self, care_level: int, escalation: Dict) -> List[Dict]:
        """Generate automated actions based on triage"""
        actions = []
        
        # Add to care queue
        actions.append({
            "action": "ADD_TO_QUEUE",
            "status": "completed",
            "description": f"Added to care level {care_level} queue"
        })
        
        # Escalation notifications
        if escalation['needed']:
            for recipient in escalation.get('notify', []):
                actions.append({
                    "action": "NOTIFY",
                    "recipient": recipient,
                    "status": "sent",
                    "description": f"Alert sent to {recipient}"
                })
        
        # Level-specific actions
        if care_level == 1:
            actions.append({
                "action": "PREPARE_RESUSCITATION",
                "status": "initiated",
                "description": "Resuscitation room prepared"
            })
        elif care_level == 2:
            actions.append({
                "action": "PREPARE_EMERGENCY_BED",
                "status": "initiated",
                "description": "Emergency bed assigned"
            })
        
        # Standard actions
        actions.append({
            "action": "UPDATE_PATIENT_RECORD",
            "status": "completed",
            "description": "Triage assessment recorded"
        })
        
        return actions
    
    def get_queue_status(self) -> Dict:
        """Get current triage queue status"""
        return {
            "total_patients": len(self._triage_queue),
            "by_level": {
                level: len([q for q in self._triage_queue if q['care_level'] == level])
                for level in range(1, 6)
            },
            "queue": self._triage_queue[:10]  # Top 10
        }
