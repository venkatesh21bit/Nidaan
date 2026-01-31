"""
IBM Cloudant Database Service
Handles all database operations for the Nidaan Triage Module
"""
import logging
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from ibmcloudant.cloudant_v1 import CloudantV1, Document
from ibm_cloud_sdk_core.authenticators import IAMAuthenticator
from ibm_cloud_sdk_core import ApiException

from app.core.config import settings

logger = logging.getLogger(__name__)


class CloudantService:
    """
    IBM Cloudant Database Service for Nidaan Triage Module
    
    Manages patient triage data, appointments, and urgent case tracking.
    """
    
    def __init__(self):
        self.client: Optional[CloudantV1] = None
        self.database_name = settings.CLOUDANT_DATABASE_NAME
        self._initialized = False
        
    async def initialize(self):
        """Initialize Cloudant connection and ensure database exists"""
        if self._initialized:
            return
            
        try:
            # Create authenticator
            authenticator = IAMAuthenticator(settings.CLOUDANT_API_KEY)
            
            # Create Cloudant client
            self.client = CloudantV1(authenticator=authenticator)
            self.client.set_service_url(settings.CLOUDANT_URL)
            
            # Ensure database exists
            await self._ensure_database_exists()
            
            # Create design documents for views
            await self._create_design_documents()
            
            self._initialized = True
            logger.info(f"Cloudant service initialized with database: {self.database_name}")
            
        except ApiException as e:
            logger.error(f"Failed to initialize Cloudant: {e}")
            raise
    
    async def _ensure_database_exists(self):
        """Create database if it doesn't exist"""
        try:
            self.client.get_database_information(db=self.database_name)
            logger.info(f"Database '{self.database_name}' exists")
        except ApiException as e:
            if e.code == 404:
                logger.info(f"Creating database '{self.database_name}'")
                self.client.put_database(db=self.database_name)
            else:
                raise
    
    async def _create_design_documents(self):
        """Create design documents for database views"""
        design_doc_id = "_design/triage"
        
        design_doc = {
            "_id": design_doc_id,
            "views": {
                "by_severity": {
                    "map": """function(doc) {
                        if (doc.type === 'triage_case' && doc.severity_score) {
                            emit(doc.severity_score, doc);
                        }
                    }"""
                },
                "urgent_cases": {
                    "map": """function(doc) {
                        if (doc.type === 'triage_case' && doc.severity_score === 'HIGH' && doc.status !== 'seen') {
                            emit(doc.created_at, doc);
                        }
                    }"""
                },
                "by_patient": {
                    "map": """function(doc) {
                        if (doc.type === 'triage_case' && doc.patient_id) {
                            emit(doc.patient_id, doc);
                        }
                    }"""
                },
                "pending_surveys": {
                    "map": """function(doc) {
                        if (doc.type === 'survey' && doc.status === 'pending') {
                            emit(doc.sent_at, doc);
                        }
                    }"""
                },
                "appointments_by_date": {
                    "map": """function(doc) {
                        if (doc.type === 'appointment') {
                            emit(doc.appointment_date, doc);
                        }
                    }"""
                }
            },
            "language": "javascript"
        }
        
        try:
            # Check if design doc exists
            existing = self.client.get_document(
                db=self.database_name,
                doc_id=design_doc_id
            ).get_result()
            design_doc["_rev"] = existing["_rev"]
        except ApiException as e:
            if e.code != 404:
                raise
        
        try:
            self.client.put_document(
                db=self.database_name,
                doc_id=design_doc_id,
                document=design_doc
            )
            logger.info("Design documents created/updated successfully")
        except ApiException as e:
            logger.warning(f"Could not update design doc: {e}")
    
    # ==================== TRIAGE CASE OPERATIONS ====================
    
    async def create_triage_case(
        self,
        patient_id: str,
        patient_name: str,
        symptoms: List[str],
        medications: List[str],
        transcript: str,
        severity_score: str,
        red_flags: List[str],
        extracted_entities: Dict[str, Any],
        appointment_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new triage case from patient intake
        
        Args:
            patient_id: Unique patient identifier
            patient_name: Patient's full name
            symptoms: List of extracted symptoms
            medications: List of current medications
            transcript: Raw transcript from voice/text input
            severity_score: HIGH, MEDIUM, or LOW
            red_flags: List of detected red flag symptoms
            extracted_entities: NLU extracted entities
            appointment_id: Optional linked appointment
            
        Returns:
            Created triage case document
        """
        case_id = f"triage_{uuid.uuid4().hex[:12]}"
        
        document = {
            "_id": case_id,
            "type": "triage_case",
            "patient_id": patient_id,
            "patient_name": patient_name,
            "symptoms": symptoms,
            "medications": medications,
            "transcript": transcript,
            "severity_score": severity_score,
            "red_flags": red_flags,
            "extracted_entities": extracted_entities,
            "appointment_id": appointment_id,
            "status": "pending",  # pending, reviewed, seen
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "nurse_alerted": severity_score == "HIGH",
            "doctor_notes": None
        }
        
        response = self.client.post_document(
            db=self.database_name,
            document=document
        ).get_result()
        
        document["_rev"] = response["rev"]
        logger.info(f"Created triage case: {case_id} with severity: {severity_score}")
        
        return document
    
    async def get_triage_case(self, case_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific triage case by ID"""
        try:
            result = self.client.get_document(
                db=self.database_name,
                doc_id=case_id
            ).get_result()
            return result
        except ApiException as e:
            if e.code == 404:
                return None
            raise
    
    async def get_urgent_cases(self) -> List[Dict[str, Any]]:
        """
        Get all urgent (HIGH severity) cases that haven't been seen
        This is the endpoint for watsonx Orchestrate
        """
        try:
            # Use find query instead of view for more reliability
            selector = {
                "type": "triage_case",
                "severity_score": "HIGH",
                "status": {"$ne": "seen"}
            }
            
            response = self.client.post_find(
                db=self.database_name,
                selector=selector,
                sort=[{"created_at": "desc"}],
                limit=50
            ).get_result()
            
            cases = response.get("docs", [])
            logger.info(f"Found {len(cases)} urgent cases")
            return cases
            
        except ApiException as e:
            logger.error(f"Error fetching urgent cases: {e}")
            # Fallback: try to get all documents and filter
            try:
                response = self.client.post_all_docs(
                    db=self.database_name,
                    include_docs=True
                ).get_result()
                
                cases = []
                for row in response.get("rows", []):
                    doc = row.get("doc", {})
                    if (doc.get("type") == "triage_case" and 
                        doc.get("severity_score") == "HIGH" and 
                        doc.get("status") != "seen"):
                        cases.append(doc)
                
                logger.info(f"Fallback: Found {len(cases)} urgent cases")
                return cases
            except Exception as e2:
                logger.error(f"Fallback also failed: {e2}")
                return []
    
    async def get_cases_by_severity(self, severity: str) -> List[Dict[str, Any]]:
        """Get all cases with a specific severity level"""
        try:
            response = self.client.post_view(
                db=self.database_name,
                ddoc="triage",
                view="by_severity",
                key=severity,
                include_docs=True
            ).get_result()
            
            return [row["doc"] for row in response.get("rows", [])]
        except ApiException as e:
            logger.error(f"Error fetching cases by severity: {e}")
            return []
    
    async def update_case_status(
        self,
        case_id: str,
        status: str,
        doctor_notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update the status of a triage case"""
        case = await self.get_triage_case(case_id)
        if not case:
            raise ValueError(f"Case {case_id} not found")
        
        case["status"] = status
        case["updated_at"] = datetime.utcnow().isoformat()
        if doctor_notes:
            case["doctor_notes"] = doctor_notes
        
        response = self.client.put_document(
            db=self.database_name,
            doc_id=case_id,
            document=case
        ).get_result()
        
        case["_rev"] = response["rev"]
        logger.info(f"Updated case {case_id} status to: {status}")
        return case
    
    async def mark_case_as_seen(self, case_id: str) -> Dict[str, Any]:
        """Mark a triage case as seen by the doctor"""
        return await self.update_case_status(case_id, "seen")
    
    # ==================== SURVEY OPERATIONS ====================
    
    async def create_survey(
        self,
        patient_id: str,
        patient_email: str,
        appointment_id: str,
        survey_questions: List[Dict[str, str]],
        patient_history: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a pre-consultation survey record
        
        Args:
            patient_id: Patient identifier
            patient_email: Email to send survey to
            appointment_id: Linked appointment
            survey_questions: List of personalized questions
            patient_history: Patient's medical history for personalization
        """
        survey_id = f"survey_{uuid.uuid4().hex[:12]}"
        
        document = {
            "_id": survey_id,
            "type": "survey",
            "patient_id": patient_id,
            "patient_email": patient_email,
            "appointment_id": appointment_id,
            "survey_questions": survey_questions,
            "patient_history": patient_history,
            "status": "pending",  # pending, sent, completed, expired
            "sent_at": datetime.utcnow().isoformat(),
            "response": None,
            "response_received_at": None,
            "processed": False
        }
        
        response = self.client.post_document(
            db=self.database_name,
            document=document
        ).get_result()
        
        document["_rev"] = response["rev"]
        logger.info(f"Created survey: {survey_id} for patient: {patient_id}")
        return document
    
    async def update_survey_response(
        self,
        survey_id: str,
        response_text: str,
        extracted_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update survey with patient's response"""
        survey = await self.get_survey(survey_id)
        if not survey:
            raise ValueError(f"Survey {survey_id} not found")
        
        survey["response"] = response_text
        survey["extracted_data"] = extracted_data
        survey["response_received_at"] = datetime.utcnow().isoformat()
        survey["status"] = "completed"
        survey["processed"] = True
        
        response = self.client.put_document(
            db=self.database_name,
            doc_id=survey_id,
            document=survey
        ).get_result()
        
        survey["_rev"] = response["rev"]
        return survey
    
    async def get_survey(self, survey_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific survey by ID"""
        try:
            return self.client.get_document(
                db=self.database_name,
                doc_id=survey_id
            ).get_result()
        except ApiException as e:
            if e.code == 404:
                return None
            raise
    
    async def get_pending_surveys(self) -> List[Dict[str, Any]]:
        """Get all pending surveys"""
        try:
            response = self.client.post_view(
                db=self.database_name,
                ddoc="triage",
                view="pending_surveys",
                include_docs=True
            ).get_result()
            
            return [row["doc"] for row in response.get("rows", [])]
        except ApiException as e:
            logger.error(f"Error fetching pending surveys: {e}")
            return []
    
    # ==================== APPOINTMENT OPERATIONS ====================
    
    async def create_appointment(
        self,
        patient_id: str,
        patient_name: str,
        patient_email: str,
        doctor_id: str,
        appointment_date: str,
        appointment_time: str,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new appointment (triggers the triage workflow)"""
        appointment_id = f"appt_{uuid.uuid4().hex[:12]}"
        
        document = {
            "_id": appointment_id,
            "type": "appointment",
            "patient_id": patient_id,
            "patient_name": patient_name,
            "patient_email": patient_email,
            "doctor_id": doctor_id,
            "appointment_date": appointment_date,
            "appointment_time": appointment_time,
            "reason": reason,
            "status": "scheduled",  # scheduled, survey_sent, checked_in, completed, cancelled
            "created_at": datetime.utcnow().isoformat(),
            "survey_id": None,
            "triage_case_id": None
        }
        
        response = self.client.post_document(
            db=self.database_name,
            document=document
        ).get_result()
        
        document["_rev"] = response["rev"]
        logger.info(f"Created appointment: {appointment_id}")
        return document
    
    async def get_appointment(self, appointment_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific appointment"""
        try:
            return self.client.get_document(
                db=self.database_name,
                doc_id=appointment_id
            ).get_result()
        except ApiException as e:
            if e.code == 404:
                return None
            raise
    
    async def link_survey_to_appointment(
        self,
        appointment_id: str,
        survey_id: str
    ) -> Dict[str, Any]:
        """Link a survey to an appointment"""
        appointment = await self.get_appointment(appointment_id)
        if not appointment:
            raise ValueError(f"Appointment {appointment_id} not found")
        
        appointment["survey_id"] = survey_id
        appointment["status"] = "survey_sent"
        
        response = self.client.put_document(
            db=self.database_name,
            doc_id=appointment_id,
            document=appointment
        ).get_result()
        
        appointment["_rev"] = response["rev"]
        return appointment
    
    async def link_triage_to_appointment(
        self,
        appointment_id: str,
        triage_case_id: str
    ) -> Dict[str, Any]:
        """Link a triage case to an appointment"""
        appointment = await self.get_appointment(appointment_id)
        if not appointment:
            raise ValueError(f"Appointment {appointment_id} not found")
        
        appointment["triage_case_id"] = triage_case_id
        
        response = self.client.put_document(
            db=self.database_name,
            doc_id=appointment_id,
            document=appointment
        ).get_result()
        
        appointment["_rev"] = response["rev"]
        return appointment
    
    # ==================== EHR INTEGRATION ====================
    
    async def update_patient_ehr(
        self,
        patient_id: str,
        triage_summary: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update patient's Electronic Health Record with triage data
        Creates a structured summary from the intake process
        """
        ehr_update_id = f"ehr_update_{uuid.uuid4().hex[:12]}"
        
        document = {
            "_id": ehr_update_id,
            "type": "ehr_update",
            "patient_id": patient_id,
            "summary": {
                "chief_complaint": triage_summary.get("symptoms", []),
                "current_medications": triage_summary.get("medications", []),
                "allergies": triage_summary.get("allergies", []),
                "vital_signs_reported": triage_summary.get("vital_signs", {}),
                "pain_level": triage_summary.get("pain_level"),
                "symptom_duration": triage_summary.get("duration"),
                "pre_visit_notes": triage_summary.get("notes", "")
            },
            "severity_assessment": triage_summary.get("severity_score"),
            "red_flags_detected": triage_summary.get("red_flags", []),
            "created_at": datetime.utcnow().isoformat(),
            "source": "automated_triage"
        }
        
        response = self.client.post_document(
            db=self.database_name,
            document=document
        ).get_result()
        
        document["_rev"] = response["rev"]
        logger.info(f"Updated EHR for patient: {patient_id}")
        return document
    
    async def get_patient_history(self, patient_id: str) -> List[Dict[str, Any]]:
        """Get patient's history for survey personalization"""
        try:
            response = self.client.post_view(
                db=self.database_name,
                ddoc="triage",
                view="by_patient",
                key=patient_id,
                include_docs=True
            ).get_result()
            
            return [row["doc"] for row in response.get("rows", [])]
        except ApiException as e:
            logger.error(f"Error fetching patient history: {e}")
            return []


# Singleton instance
cloudant_service = CloudantService()
