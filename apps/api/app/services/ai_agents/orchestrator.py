"""
Agent Orchestrator - Powered by watsonx.ai
Coordinates all AI agents for end-to-end automation
"""
import logging
from typing import Dict, List, Optional
from datetime import datetime
import asyncio

from .symptom_analyzer import SymptomAnalyzerAgent
from .appointment_scheduler import AppointmentSchedulerAgent
from .triage_agent import TriageAgent
from .followup_agent import FollowUpAgent

logger = logging.getLogger(__name__)

class AgentOrchestrator:
    """
    Master orchestrator that coordinates all AI agents
    for fully automated patient care workflow:
    
    1. Patient submits symptoms
    2. Symptom Analyzer assesses urgency
    3. Appointment Scheduler auto-schedules
    4. Triage Agent routes to appropriate care
    5. Follow-Up Agent creates care plan
    """
    
    def __init__(self, watsonx_client=None):
        self.watsonx_client = watsonx_client
        self.orchestrator_id = "ORCHESTRATOR_001"
        self.orchestrator_name = "Nidaan AI Orchestrator"
        
        # Initialize all agents
        self.symptom_analyzer = SymptomAnalyzerAgent(watsonx_client)
        self.scheduler = AppointmentSchedulerAgent(watsonx_client)
        self.triage = TriageAgent(watsonx_client)
        self.followup = FollowUpAgent(watsonx_client)
        
        # Track workflow executions
        self._workflow_history: List[Dict] = []
        
    async def process_appointment(self, appointment_data: Dict) -> Dict:
        """
        Process a new appointment through the complete AI workflow
        """
        workflow_id = f"WF_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{appointment_data.get('id', 'unknown')}"
        
        logger.info(f"[{self.orchestrator_name}] Starting workflow {workflow_id}")
        
        workflow_result = {
            "workflow_id": workflow_id,
            "orchestrator_id": self.orchestrator_id,
            "start_time": datetime.utcnow().isoformat() + "Z",
            "appointment_id": appointment_data.get('id'),
            "patient_name": appointment_data.get('patient_name'),
            "stages": [],
            "final_status": "in_progress"
        }
        
        try:
            # ========== STAGE 1: Symptom Analysis ==========
            logger.info(f"[{self.orchestrator_name}] Stage 1: Symptom Analysis")
            
            analysis_result = await self.symptom_analyzer.analyze(
                symptoms=appointment_data.get('symptoms', []),
                symptom_details=appointment_data.get('symptom_details', ''),
                severity=appointment_data.get('severity'),
                duration=appointment_data.get('duration')
            )
            
            workflow_result['stages'].append({
                "stage": 1,
                "name": "Symptom Analysis",
                "agent": self.symptom_analyzer.agent_name,
                "status": analysis_result.get('status', 'completed'),
                "result": analysis_result,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            })
            
            urgency = analysis_result.get('analysis', {}).get('urgency_level', 'medium')
            severity_score = analysis_result.get('analysis', {}).get('severity_score', 5)
            conditions = analysis_result.get('analysis', {}).get('possible_conditions', [])
            
            # ========== STAGE 2: Auto-Scheduling ==========
            logger.info(f"[{self.orchestrator_name}] Stage 2: Auto-Scheduling")
            
            schedule_result = await self.scheduler.schedule(
                appointment_id=appointment_data.get('id'),
                urgency_level=urgency,
                severity_score=severity_score,
                patient_name=appointment_data.get('patient_name'),
                preferred_date=appointment_data.get('preferred_date'),
                preferred_time=appointment_data.get('preferred_time'),
                conditions=conditions
            )
            
            workflow_result['stages'].append({
                "stage": 2,
                "name": "Auto-Scheduling",
                "agent": self.scheduler.agent_name,
                "status": schedule_result.get('status', 'completed'),
                "result": schedule_result,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            })
            
            scheduled_date = schedule_result.get('scheduling_decision', {}).get('scheduled_date')
            
            # ========== STAGE 3: Triage ==========
            logger.info(f"[{self.orchestrator_name}] Stage 3: Triage")
            
            triage_result = await self.triage.triage(
                appointment_id=appointment_data.get('id'),
                symptoms=appointment_data.get('symptoms', []),
                urgency_level=urgency,
                severity_score=severity_score,
                patient_name=appointment_data.get('patient_name'),
                conditions=conditions
            )
            
            workflow_result['stages'].append({
                "stage": 3,
                "name": "Triage",
                "agent": self.triage.agent_name,
                "status": triage_result.get('status', 'completed'),
                "result": triage_result,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            })
            
            # ========== STAGE 4: Follow-Up Plan ==========
            logger.info(f"[{self.orchestrator_name}] Stage 4: Follow-Up Plan")
            
            followup_result = await self.followup.create_followup_plan(
                appointment_id=appointment_data.get('id'),
                patient_name=appointment_data.get('patient_name'),
                urgency_level=urgency,
                conditions=conditions,
                visit_date=scheduled_date
            )
            
            workflow_result['stages'].append({
                "stage": 4,
                "name": "Follow-Up Plan",
                "agent": self.followup.agent_name,
                "status": followup_result.get('status', 'completed'),
                "result": followup_result,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            })
            
            # ========== COMPILE FINAL RESULT ==========
            workflow_result['final_status'] = "completed"
            workflow_result['end_time'] = datetime.utcnow().isoformat() + "Z"
            workflow_result['summary'] = self._generate_summary(
                analysis_result, schedule_result, triage_result, followup_result
            )
            workflow_result['appointment_updates'] = self._compile_updates(
                schedule_result, triage_result
            )
            
            # Store workflow
            self._workflow_history.append(workflow_result)
            
            logger.info(f"[{self.orchestrator_name}] Workflow {workflow_id} completed successfully")
            return workflow_result
            
        except Exception as e:
            logger.error(f"[{self.orchestrator_name}] Workflow failed: {str(e)}")
            workflow_result['final_status'] = "error"
            workflow_result['error'] = str(e)
            workflow_result['end_time'] = datetime.utcnow().isoformat() + "Z"
            return workflow_result
    
    def _generate_summary(self, analysis: Dict, schedule: Dict, 
                         triage: Dict, followup: Dict) -> Dict:
        """Generate executive summary of the workflow"""
        return {
            "urgency_assessment": analysis.get('analysis', {}).get('urgency_level', 'unknown'),
            "possible_conditions": [
                c.get('name') for c in analysis.get('analysis', {}).get('possible_conditions', [])[:3]
            ],
            "scheduled_for": f"{schedule.get('scheduling_decision', {}).get('scheduled_date')} at {schedule.get('scheduling_decision', {}).get('scheduled_time')}",
            "assigned_doctor": schedule.get('scheduling_decision', {}).get('assigned_doctor', {}).get('name'),
            "care_level": triage.get('triage_assessment', {}).get('care_level'),
            "department": triage.get('triage_assessment', {}).get('department', {}).get('name'),
            "followup_count": len(followup.get('followup_plan', {}).get('schedule', [])),
            "recommendations": analysis.get('recommendations', [])[:3],
            "notifications_queued": len(schedule.get('notifications', [])),
            "auto_actions_taken": len(analysis.get('auto_actions', []))
        }
    
    def _compile_updates(self, schedule: Dict, triage: Dict) -> Dict:
        """Compile updates to apply to the appointment"""
        return {
            "status": "confirmed",
            "scheduled_date": schedule.get('scheduling_decision', {}).get('scheduled_date'),
            "scheduled_time": schedule.get('scheduling_decision', {}).get('scheduled_time'),
            "doctor_id": schedule.get('scheduling_decision', {}).get('assigned_doctor', {}).get('id'),
            "doctor_name": schedule.get('scheduling_decision', {}).get('assigned_doctor', {}).get('name'),
            "care_level": triage.get('triage_assessment', {}).get('care_level'),
            "department": triage.get('triage_assessment', {}).get('department', {}).get('code'),
            "priority_score": schedule.get('scheduling_decision', {}).get('priority_score'),
            "ai_processed": True,
            "ai_processed_at": datetime.utcnow().isoformat() + "Z"
        }
    
    async def get_agent_status(self) -> Dict:
        """Get status of all agents"""
        return {
            "orchestrator": {
                "id": self.orchestrator_id,
                "name": self.orchestrator_name,
                "status": "active",
                "workflows_processed": len(self._workflow_history)
            },
            "agents": [
                {
                    "id": self.symptom_analyzer.agent_id,
                    "name": self.symptom_analyzer.agent_name,
                    "type": "Symptom Analyzer",
                    "status": "active"
                },
                {
                    "id": self.scheduler.agent_id,
                    "name": self.scheduler.agent_name,
                    "type": "Appointment Scheduler",
                    "status": "active"
                },
                {
                    "id": self.triage.agent_id,
                    "name": self.triage.agent_name,
                    "type": "Triage Specialist",
                    "status": "active"
                },
                {
                    "id": self.followup.agent_id,
                    "name": self.followup.agent_name,
                    "type": "Follow-Up Manager",
                    "status": "active"
                }
            ],
            "queue_status": self.triage.get_queue_status(),
            "pending_followups": len(self.followup.get_pending_followups())
        }
    
    def get_workflow_history(self, limit: int = 10) -> List[Dict]:
        """Get recent workflow history"""
        return self._workflow_history[-limit:]


# Global orchestrator instance
_orchestrator: Optional[AgentOrchestrator] = None

def get_orchestrator() -> AgentOrchestrator:
    """Get or create the global orchestrator instance"""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = AgentOrchestrator()
    return _orchestrator
