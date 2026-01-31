"""
Triage Engine - Core Logic for Patient Triage
Handles severity scoring, red flag detection, and automated workflow
"""
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from enum import Enum

from app.services.ibm.cloudant import cloudant_service
from app.services.ibm.email_service import email_service
from app.services.ibm.nlu_processor import nlu_processor
from app.services.ibm.speech_to_text import ibm_speech_to_text
from app.core.config import settings

logger = logging.getLogger(__name__)


class SeverityLevel(str, Enum):
    """Severity classification for triage cases"""
    HIGH = "HIGH"       # Immediate attention required
    MEDIUM = "MEDIUM"   # Urgent but not critical
    LOW = "LOW"         # Routine consultation


class TriageEngine:
    """
    Core Triage Engine for Nidaan AI
    
    Orchestrates the complete patient intake workflow:
    1. Processes voice/text input
    2. Extracts medical entities using NLU
    3. Evaluates severity and red flags
    4. Updates EHR database
    5. Alerts appropriate personnel
    """
    
    # RED FLAG symptoms that require immediate attention
    RED_FLAG_SYMPTOMS = {
        # Cardiac
        "chest pain": SeverityLevel.HIGH,
        "chest tightness": SeverityLevel.HIGH,
        "palpitations": SeverityLevel.MEDIUM,
        "irregular heartbeat": SeverityLevel.HIGH,
        
        # Respiratory
        "difficulty breathing": SeverityLevel.HIGH,
        "shortness of breath": SeverityLevel.HIGH,
        "breathing trouble": SeverityLevel.HIGH,
        "can't breathe": SeverityLevel.HIGH,
        "wheezing": SeverityLevel.MEDIUM,
        "coughing blood": SeverityLevel.HIGH,
        
        # Neurological
        "stroke": SeverityLevel.HIGH,
        "sudden numbness": SeverityLevel.HIGH,
        "facial drooping": SeverityLevel.HIGH,
        "slurred speech": SeverityLevel.HIGH,
        "severe headache": SeverityLevel.HIGH,
        "worst headache": SeverityLevel.HIGH,
        "confusion": SeverityLevel.HIGH,
        "loss of consciousness": SeverityLevel.HIGH,
        "fainting": SeverityLevel.MEDIUM,
        "seizure": SeverityLevel.HIGH,
        
        # Bleeding
        "severe bleeding": SeverityLevel.HIGH,
        "uncontrolled bleeding": SeverityLevel.HIGH,
        "blood in stool": SeverityLevel.MEDIUM,
        "blood in urine": SeverityLevel.MEDIUM,
        "vomiting blood": SeverityLevel.HIGH,
        
        # Allergic
        "anaphylaxis": SeverityLevel.HIGH,
        "throat swelling": SeverityLevel.HIGH,
        "difficulty swallowing": SeverityLevel.HIGH,
        "allergic reaction": SeverityLevel.MEDIUM,
        
        # Abdominal
        "severe abdominal pain": SeverityLevel.HIGH,
        "abdominal pain": SeverityLevel.MEDIUM,
        
        # Fever
        "high fever": SeverityLevel.MEDIUM,
        "fever above 103": SeverityLevel.HIGH,
        "fever 104": SeverityLevel.HIGH,
        "fever 105": SeverityLevel.HIGH,
        
        # General emergency
        "suicidal": SeverityLevel.HIGH,
        "self harm": SeverityLevel.HIGH,
        "overdose": SeverityLevel.HIGH,
        "poisoning": SeverityLevel.HIGH,
    }
    
    # Keywords that indicate urgency
    URGENCY_KEYWORDS = [
        "severe", "extreme", "unbearable", "worst", "sudden", 
        "can't", "cannot", "unable", "emergency", "immediately",
        "worsening", "spreading", "escalating"
    ]
    
    # Keywords that indicate chronic/routine
    ROUTINE_KEYWORDS = [
        "mild", "slight", "minor", "little", "occasional",
        "sometimes", "check-up", "follow-up", "routine", "regular"
    ]
    
    def __init__(self):
        self.cloudant = cloudant_service
        self.email = email_service
        self.nlu = nlu_processor
        self.stt = ibm_speech_to_text
        
    async def initialize(self):
        """Initialize all dependent services"""
        await self.cloudant.initialize()
        await self.nlu.initialize()
        await self.stt.initialize()
        logger.info("Triage Engine initialized")
    
    # ==================== MAIN WORKFLOW ====================
    
    async def process_appointment_booking(
        self,
        patient_id: str,
        patient_name: str,
        patient_email: str,
        doctor_id: str,
        doctor_name: str,
        appointment_date: str,
        appointment_time: str,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        ACTION 1: Triggered when patient books appointment
        Creates appointment and sends personalized survey
        
        This is the entry point for the autonomous triage workflow.
        """
        logger.info(f"Processing appointment booking for patient: {patient_id}")
        
        try:
            # Get patient history for personalization
            patient_history = await self.cloudant.get_patient_history(patient_id)
            history_summary = self._summarize_patient_history(patient_history)
            
            # Create appointment record
            appointment = await self.cloudant.create_appointment(
                patient_id=patient_id,
                patient_name=patient_name,
                patient_email=patient_email,
                doctor_id=doctor_id,
                appointment_date=appointment_date,
                appointment_time=appointment_time,
                reason=reason
            )
            
            # Create survey record
            survey = await self.cloudant.create_survey(
                patient_id=patient_id,
                patient_email=patient_email,
                appointment_id=appointment["_id"],
                survey_questions=[],  # Will be generated by email service
                patient_history=history_summary
            )
            
            # Link survey to appointment
            await self.cloudant.link_survey_to_appointment(
                appointment_id=appointment["_id"],
                survey_id=survey["_id"]
            )
            
            # Send personalized survey email
            email_result = await self.email.send_pre_consultation_survey(
                patient_email=patient_email,
                patient_name=patient_name,
                doctor_name=doctor_name,
                appointment_date=appointment_date,
                appointment_time=appointment_time,
                survey_id=survey["_id"],
                patient_history=history_summary,
                appointment_reason=reason
            )
            
            return {
                "success": True,
                "appointment_id": appointment["_id"],
                "survey_id": survey["_id"],
                "email_sent": email_result["success"],
                "workflow_status": "survey_sent",
                "next_step": "await_patient_response"
            }
            
        except Exception as e:
            logger.error(f"Error processing appointment booking: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def process_survey_response(
        self,
        survey_id: str,
        response_text: str,
        answers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        ACTION 2: Process patient's survey response
        Extracts medical entities and triggers triage
        """
        logger.info(f"Processing survey response: {survey_id}")
        
        try:
            # Get survey details
            survey = await self.cloudant.get_survey(survey_id)
            if not survey:
                return {"success": False, "error": "Survey not found"}
            
            # Extract medical entities using NLU
            extraction = await self.nlu.process_survey_response(
                response_text=response_text,
                questions_answered=answers
            )
            
            # Update survey with extracted data
            await self.cloudant.update_survey_response(
                survey_id=survey_id,
                response_text=response_text,
                extracted_data=extraction
            )
            
            # Create triage case from extracted data
            triage_result = await self.create_triage_case(
                patient_id=survey["patient_id"],
                patient_name=survey.get("patient_name", "Unknown"),
                transcript=response_text,
                extracted_entities=extraction["extracted_entities"],
                appointment_id=survey.get("appointment_id")
            )
            
            # Link triage to appointment
            if survey.get("appointment_id") and triage_result.get("case_id"):
                await self.cloudant.link_triage_to_appointment(
                    appointment_id=survey["appointment_id"],
                    triage_case_id=triage_result["case_id"]
                )
            
            return {
                "success": True,
                "survey_id": survey_id,
                "triage_case_id": triage_result.get("case_id"),
                "severity": triage_result.get("severity_score"),
                "red_flags": triage_result.get("red_flags"),
                "ehr_updated": triage_result.get("ehr_updated"),
                "nurse_alerted": triage_result.get("nurse_alerted")
            }
            
        except Exception as e:
            logger.error(f"Error processing survey response: {e}")
            return {"success": False, "error": str(e)}
    
    async def process_voice_input(
        self,
        patient_id: str,
        patient_name: str,
        audio_data: bytes,
        content_type: str = "audio/webm",
        language: str = "en-IN",
        appointment_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process voice input from patient triage frontend
        Complete flow: Audio → Transcript → NLU → Triage → EHR → Alert
        """
        logger.info(f"Processing voice input for patient: {patient_id}")
        
        try:
            # Step 1: Speech to Text
            stt_result = await self.stt.transcribe_audio(
                audio_data=audio_data,
                content_type=content_type,
                language=language
            )
            
            if not stt_result.get("success"):
                return {
                    "success": False,
                    "error": "Speech transcription failed",
                    "details": stt_result.get("error")
                }
            
            transcript = stt_result["transcript"]
            logger.info(f"Transcript: {transcript[:100]}...")
            
            # Step 2: NLU Processing
            symptoms, medications, full_extraction = await self.nlu.extract_from_transcript(transcript)
            
            # Step 3: Create Triage Case
            triage_result = await self.create_triage_case(
                patient_id=patient_id,
                patient_name=patient_name,
                transcript=transcript,
                extracted_entities=full_extraction,
                appointment_id=appointment_id
            )
            
            return {
                "success": True,
                "transcript": transcript,
                "transcription_confidence": stt_result.get("confidence"),
                "symptoms": symptoms,
                "medications": medications,
                "severity_score": triage_result.get("severity_score"),
                "red_flags": triage_result.get("red_flags"),
                "case_id": triage_result.get("case_id"),
                "nurse_alerted": triage_result.get("nurse_alerted"),
                "ehr_updated": triage_result.get("ehr_updated")
            }
            
        except Exception as e:
            logger.error(f"Error processing voice input: {e}")
            return {"success": False, "error": str(e)}
    
    async def create_triage_case(
        self,
        patient_id: str,
        patient_name: str,
        transcript: str,
        extracted_entities: Dict[str, Any],
        appointment_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a triage case with severity assessment
        Includes EHR update and nurse alerting
        """
        # Get symptoms and medications from extraction
        symptoms = extracted_entities.get("symptoms", [])
        medications = extracted_entities.get("medications", [])
        
        # Calculate severity and detect red flags
        severity_score, red_flags = self._calculate_severity(
            symptoms=symptoms,
            transcript=transcript
        )
        
        # ACTION 3: Update EHR Database
        triage_summary = {
            "symptoms": symptoms,
            "medications": medications,
            "allergies": extracted_entities.get("allergies", []),
            "vital_signs": extracted_entities.get("vital_signs", {}),
            "duration": extracted_entities.get("durations", []),
            "severity_score": severity_score,
            "red_flags": red_flags,
            "notes": transcript[:500]  # First 500 chars as notes
        }
        
        ehr_update = await self.cloudant.update_patient_ehr(
            patient_id=patient_id,
            triage_summary=triage_summary
        )
        
        # Create triage case in database
        case = await self.cloudant.create_triage_case(
            patient_id=patient_id,
            patient_name=patient_name,
            symptoms=symptoms,
            medications=medications,
            transcript=transcript,
            severity_score=severity_score.value if hasattr(severity_score, 'value') else severity_score,
            red_flags=red_flags,
            extracted_entities=extracted_entities,
            appointment_id=appointment_id
        )
        
        # ACTION 4: Alert nurse if red flags detected
        nurse_alerted = False
        if severity_score == SeverityLevel.HIGH and red_flags:
            alert_result = await self.email.send_nurse_alert(
                nurse_email=settings.NURSE_STATION_EMAIL,
                patient_name=patient_name,
                patient_id=patient_id,
                red_flags=red_flags,
                severity_score=severity_score,
                triage_case_id=case["_id"]
            )
            nurse_alerted = alert_result.get("success", False)
        
        logger.info(f"Triage case created: {case['_id']} | Severity: {severity_score} | Red flags: {red_flags}")
        
        return {
            "case_id": case["_id"],
            "severity_score": severity_score,
            "red_flags": red_flags,
            "ehr_updated": True,
            "ehr_update_id": ehr_update["_id"],
            "nurse_alerted": nurse_alerted
        }
    
    def _calculate_severity(
        self,
        symptoms: List[str],
        transcript: str
    ) -> Tuple[str, List[str]]:
        """
        Calculate severity score and identify red flags
        
        Returns:
            Tuple of (severity_level, list_of_red_flags)
        """
        red_flags = []
        max_severity = SeverityLevel.LOW
        transcript_lower = transcript.lower()
        
        # Check for red flag symptoms
        for symptom_pattern, severity in self.RED_FLAG_SYMPTOMS.items():
            if symptom_pattern in transcript_lower:
                red_flags.append(symptom_pattern)
                if severity == SeverityLevel.HIGH:
                    max_severity = SeverityLevel.HIGH
                elif severity == SeverityLevel.MEDIUM and max_severity != SeverityLevel.HIGH:
                    max_severity = SeverityLevel.MEDIUM
        
        # Also check extracted symptoms against red flags
        for symptom in symptoms:
            symptom_lower = symptom.lower()
            for pattern, severity in self.RED_FLAG_SYMPTOMS.items():
                if pattern in symptom_lower or symptom_lower in pattern:
                    if pattern not in red_flags:
                        red_flags.append(pattern)
                    if severity == SeverityLevel.HIGH:
                        max_severity = SeverityLevel.HIGH
                    elif severity == SeverityLevel.MEDIUM and max_severity != SeverityLevel.HIGH:
                        max_severity = SeverityLevel.MEDIUM
        
        # Check urgency keywords
        urgency_count = sum(1 for word in self.URGENCY_KEYWORDS if word in transcript_lower)
        routine_count = sum(1 for word in self.ROUTINE_KEYWORDS if word in transcript_lower)
        
        # Adjust severity based on keywords
        if urgency_count >= 2 and max_severity == SeverityLevel.LOW:
            max_severity = SeverityLevel.MEDIUM
        if routine_count >= 2 and max_severity == SeverityLevel.MEDIUM and not red_flags:
            max_severity = SeverityLevel.LOW
        
        # Breathing difficulty is always HIGH priority
        breathing_keywords = ["breathing", "breathe", "breath", "respiratory"]
        if any(kw in transcript_lower for kw in breathing_keywords):
            if "difficulty" in transcript_lower or "trouble" in transcript_lower or "can't" in transcript_lower:
                max_severity = SeverityLevel.HIGH
                if "breathing difficulty" not in red_flags:
                    red_flags.append("breathing difficulty")
        
        return max_severity, list(set(red_flags))
    
    def _summarize_patient_history(self, history: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Summarize patient's medical history for personalization"""
        if not history:
            return None
        
        summary = {
            "previous_visits": len(history),
            "chronic_conditions": [],
            "medications": [],
            "allergies": [],
            "last_visit": None
        }
        
        for record in history:
            if record.get("type") == "triage_case":
                # Collect symptoms as potential chronic conditions if recurring
                symptoms = record.get("symptoms", [])
                summary["chronic_conditions"].extend(symptoms)
                
                # Collect medications
                meds = record.get("medications", [])
                summary["medications"].extend(meds)
                
                # Track last visit
                created = record.get("created_at")
                if created and (not summary["last_visit"] or created > summary["last_visit"]):
                    summary["last_visit"] = created
            
            elif record.get("type") == "ehr_update":
                allergies = record.get("summary", {}).get("allergies", [])
                summary["allergies"].extend(allergies)
        
        # Deduplicate
        summary["chronic_conditions"] = list(set(summary["chronic_conditions"]))[:5]
        summary["medications"] = list(set(summary["medications"]))[:10]
        summary["allergies"] = list(set(summary["allergies"]))
        
        return summary
    
    # ==================== ORCHESTRATE API METHODS ====================
    
    async def get_urgent_cases(self) -> List[Dict[str, Any]]:
        """
        API endpoint for watsonx Orchestrate
        Returns all urgent (HIGH severity) cases
        """
        cases = await self.cloudant.get_urgent_cases()
        
        # Format for Orchestrate consumption
        formatted_cases = []
        for case in cases:
            formatted_cases.append({
                "case_id": case.get("_id"),
                "patient_id": case.get("patient_id"),
                "patient_name": case.get("patient_name"),
                "severity": case.get("severity_score"),
                "red_flags": case.get("red_flags", []),
                "symptoms": case.get("symptoms", []),
                "created_at": case.get("created_at"),
                "status": case.get("status"),
                "summary": f"Patient {case.get('patient_name')} has {', '.join(case.get('red_flags', ['urgent symptoms']))}."
            })
        
        return formatted_cases
    
    async def mark_case_seen(self, case_id: str, doctor_notes: Optional[str] = None) -> Dict[str, Any]:
        """
        Mark a triage case as seen by the doctor
        Called by watsonx Orchestrate
        """
        case = await self.cloudant.mark_case_as_seen(case_id)
        
        if doctor_notes:
            case = await self.cloudant.update_case_status(
                case_id=case_id,
                status="seen",
                doctor_notes=doctor_notes
            )
        
        return {
            "success": True,
            "case_id": case_id,
            "status": "seen",
            "updated_at": case.get("updated_at")
        }
    
    async def get_case_details(self, case_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific triage case"""
        return await self.cloudant.get_triage_case(case_id)
    
    async def get_cases_by_severity(self, severity: str) -> List[Dict[str, Any]]:
        """Get all cases with a specific severity level"""
        return await self.cloudant.get_cases_by_severity(severity)


# Singleton instance
triage_engine = TriageEngine()
