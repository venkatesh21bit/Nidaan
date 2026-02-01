"""
Follow-Up Agent - Powered by watsonx.ai
Manages patient follow-ups and reminders
"""
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class FollowUpAgent:
    """
    AI Agent that manages patient follow-ups:
    - Schedules reminders
    - Checks patient status post-visit
    - Monitors recovery
    - Sends medication reminders
    """
    
    # Follow-up rules based on conditions
    FOLLOWUP_RULES = {
        'high_urgency': {
            'initial_followup_days': 1,
            'reminder_frequency_days': 2,
            'total_followups': 5,
            'channels': ['call', 'sms']
        },
        'medium_urgency': {
            'initial_followup_days': 3,
            'reminder_frequency_days': 7,
            'total_followups': 3,
            'channels': ['sms', 'email']
        },
        'low_urgency': {
            'initial_followup_days': 7,
            'reminder_frequency_days': 14,
            'total_followups': 2,
            'channels': ['email']
        }
    }
    
    def __init__(self, watsonx_client=None):
        self.watsonx_client = watsonx_client
        self.agent_id = "FOLLOWUP_001"
        self.agent_name = "Patient Care Follow-Up Agent"
        self._scheduled_followups: List[Dict] = []
        
    async def create_followup_plan(self, appointment_id: str, patient_name: str,
                                   urgency_level: str, conditions: List[Dict] = None,
                                   visit_date: str = None) -> Dict:
        """
        Create a comprehensive follow-up plan for a patient
        """
        logger.info(f"[{self.agent_name}] Creating follow-up plan for: {patient_name}")
        
        try:
            # Get follow-up rules based on urgency
            urgency_key = f"{urgency_level}_urgency" if urgency_level in ['high', 'medium', 'low'] else 'medium_urgency'
            rules = self.FOLLOWUP_RULES.get(urgency_key, self.FOLLOWUP_RULES['medium_urgency'])
            
            # Generate follow-up schedule
            schedule = self._generate_schedule(visit_date, rules)
            
            # Create reminders
            reminders = self._create_reminders(patient_name, schedule, rules['channels'])
            
            # Generate care instructions
            care_instructions = self._generate_care_instructions(conditions, urgency_level)
            
            # Create monitoring plan
            monitoring_plan = self._create_monitoring_plan(urgency_level, conditions)
            
            followup_plan = {
                "agent_id": self.agent_id,
                "agent_name": self.agent_name,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "appointment_id": appointment_id,
                "patient_name": patient_name,
                "followup_plan": {
                    "schedule": schedule,
                    "total_followups": len(schedule),
                    "urgency_level": urgency_level,
                    "rules_applied": urgency_key
                },
                "reminders": reminders,
                "care_instructions": care_instructions,
                "monitoring_plan": monitoring_plan,
                "escalation_triggers": self._define_escalation_triggers(urgency_level),
                "status": "active"
            }
            
            # Store scheduled follow-ups
            for item in schedule:
                self._scheduled_followups.append({
                    "appointment_id": appointment_id,
                    "patient_name": patient_name,
                    **item
                })
            
            logger.info(f"[{self.agent_name}] Created {len(schedule)} follow-up appointments")
            return followup_plan
            
        except Exception as e:
            logger.error(f"[{self.agent_name}] Follow-up creation failed: {str(e)}")
            return {
                "agent_id": self.agent_id,
                "status": "error",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
    
    def _generate_schedule(self, visit_date: str, rules: Dict) -> List[Dict]:
        """Generate follow-up schedule"""
        base_date = datetime.strptime(visit_date, "%Y-%m-%d") if visit_date else datetime.utcnow()
        schedule = []
        
        current_date = base_date + timedelta(days=rules['initial_followup_days'])
        
        for i in range(rules['total_followups']):
            schedule.append({
                "followup_number": i + 1,
                "scheduled_date": current_date.strftime("%Y-%m-%d"),
                "type": "check_in" if i == 0 else "follow_up",
                "priority": "high" if i == 0 else "normal",
                "status": "scheduled"
            })
            current_date += timedelta(days=rules['reminder_frequency_days'])
        
        return schedule
    
    def _create_reminders(self, patient_name: str, schedule: List[Dict],
                         channels: List[str]) -> List[Dict]:
        """Create reminder notifications"""
        reminders = []
        
        for followup in schedule:
            for channel in channels:
                reminder_date = datetime.strptime(followup['scheduled_date'], "%Y-%m-%d")
                reminder_date -= timedelta(days=1)  # Day before
                
                if channel == 'call':
                    message = f"This is a reminder about your follow-up appointment tomorrow."
                elif channel == 'sms':
                    message = f"Hi {patient_name}, your follow-up is scheduled for {followup['scheduled_date']}. Reply YES to confirm."
                else:
                    message = f"Dear {patient_name}, this is a reminder about your scheduled follow-up appointment."
                
                reminders.append({
                    "followup_number": followup['followup_number'],
                    "channel": channel,
                    "send_date": reminder_date.strftime("%Y-%m-%d"),
                    "message": message,
                    "status": "scheduled"
                })
        
        return reminders
    
    def _generate_care_instructions(self, conditions: List[Dict] = None,
                                    urgency: str = 'medium') -> List[Dict]:
        """Generate AI care instructions"""
        instructions = []
        
        # General instructions
        instructions.append({
            "category": "general",
            "instruction": "Take all prescribed medications as directed",
            "priority": "high"
        })
        
        instructions.append({
            "category": "general",
            "instruction": "Stay hydrated - drink at least 8 glasses of water daily",
            "priority": "normal"
        })
        
        instructions.append({
            "category": "general",
            "instruction": "Get adequate rest and sleep",
            "priority": "normal"
        })
        
        # Urgency-based instructions
        if urgency in ['high', 'critical']:
            instructions.append({
                "category": "monitoring",
                "instruction": "Monitor temperature every 4 hours",
                "priority": "high"
            })
            instructions.append({
                "category": "emergency",
                "instruction": "Seek immediate care if symptoms worsen",
                "priority": "critical"
            })
        
        # Condition-specific instructions
        if conditions:
            for condition in conditions[:2]:  # Top 2 conditions
                cond_name = condition.get('name', '').lower()
                
                if 'fever' in cond_name or 'viral' in cond_name:
                    instructions.append({
                        "category": "condition_specific",
                        "instruction": "Use fever-reducing medication if temperature exceeds 101°F",
                        "priority": "high"
                    })
                elif 'respiratory' in cond_name or 'cough' in cond_name:
                    instructions.append({
                        "category": "condition_specific",
                        "instruction": "Practice deep breathing exercises 3 times daily",
                        "priority": "normal"
                    })
                elif 'gastro' in cond_name or 'stomach' in cond_name:
                    instructions.append({
                        "category": "condition_specific",
                        "instruction": "Follow BRAT diet (Bananas, Rice, Applesauce, Toast)",
                        "priority": "high"
                    })
        
        return instructions
    
    def _create_monitoring_plan(self, urgency: str, 
                               conditions: List[Dict] = None) -> Dict:
        """Create patient monitoring plan"""
        monitoring = {
            "vitals_to_track": ["temperature", "blood_pressure", "pulse"],
            "tracking_frequency": "daily",
            "log_symptoms": True,
            "photo_documentation": False,
            "alerts_enabled": True
        }
        
        if urgency in ['high', 'critical']:
            monitoring['tracking_frequency'] = "every_4_hours"
            monitoring['vitals_to_track'].extend(["oxygen_saturation", "respiratory_rate"])
            monitoring['photo_documentation'] = True
        
        # Condition-specific monitoring
        if conditions:
            condition_names = " ".join([c.get('name', '').lower() for c in conditions])
            
            if 'cardiac' in condition_names or 'heart' in condition_names:
                monitoring['vitals_to_track'].append("ecg_if_available")
            if 'respiratory' in condition_names:
                monitoring['vitals_to_track'].append("peak_flow")
            if 'diabetes' in condition_names:
                monitoring['vitals_to_track'].append("blood_sugar")
        
        return monitoring
    
    def _define_escalation_triggers(self, urgency: str) -> List[Dict]:
        """Define automatic escalation triggers"""
        triggers = []
        
        triggers.append({
            "trigger": "temperature_above_103",
            "condition": "Temperature > 103°F (39.4°C)",
            "action": "alert_doctor",
            "severity": "high"
        })
        
        triggers.append({
            "trigger": "no_improvement_48h",
            "condition": "No symptom improvement after 48 hours",
            "action": "schedule_urgent_followup",
            "severity": "medium"
        })
        
        triggers.append({
            "trigger": "missed_followup",
            "condition": "Patient misses scheduled follow-up",
            "action": "call_patient",
            "severity": "medium"
        })
        
        triggers.append({
            "trigger": "worsening_symptoms",
            "condition": "Patient reports worsening symptoms",
            "action": "alert_doctor_and_reschedule",
            "severity": "high"
        })
        
        if urgency in ['high', 'critical']:
            triggers.append({
                "trigger": "oxygen_below_94",
                "condition": "Oxygen saturation < 94%",
                "action": "emergency_alert",
                "severity": "critical"
            })
        
        return triggers
    
    async def check_status(self, appointment_id: str, patient_response: str = None) -> Dict:
        """Check patient status and update follow-up plan"""
        # Find appointment in scheduled follow-ups
        followup = next(
            (f for f in self._scheduled_followups if f['appointment_id'] == appointment_id),
            None
        )
        
        if not followup:
            return {"status": "not_found", "message": "Follow-up plan not found"}
        
        # Analyze patient response
        response_analysis = self._analyze_response(patient_response) if patient_response else None
        
        return {
            "agent_id": self.agent_id,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "appointment_id": appointment_id,
            "current_status": followup.get('status', 'active'),
            "response_analysis": response_analysis,
            "next_followup": followup.get('scheduled_date'),
            "status": "checked"
        }
    
    def _analyze_response(self, response: str) -> Dict:
        """Analyze patient response for concerning signals"""
        response_lower = response.lower() if response else ""
        
        analysis = {
            "sentiment": "neutral",
            "concerns_detected": [],
            "escalation_needed": False
        }
        
        # Check for concerning keywords
        concerning = ['worse', 'not better', 'pain increased', 'fever higher', 'difficulty']
        positive = ['better', 'improving', 'feeling good', 'recovered']
        
        if any(word in response_lower for word in concerning):
            analysis['sentiment'] = "negative"
            analysis['concerns_detected'] = [w for w in concerning if w in response_lower]
            analysis['escalation_needed'] = True
        elif any(word in response_lower for word in positive):
            analysis['sentiment'] = "positive"
        
        return analysis
    
    def get_pending_followups(self) -> List[Dict]:
        """Get all pending follow-ups"""
        today = datetime.utcnow().strftime("%Y-%m-%d")
        return [
            f for f in self._scheduled_followups
            if f.get('status') == 'scheduled' and f.get('scheduled_date', '') <= today
        ]
