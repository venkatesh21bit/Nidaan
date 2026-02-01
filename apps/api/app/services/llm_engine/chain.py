"""
LLM Chain - RAG Pipeline for Clinical Documentation
Integrates AWS Bedrock (Claude) with medical knowledge retrieval
"""
import json
import logging
from typing import Dict, List, Optional
import boto3
from app.core.config import settings
from app.core.exceptions import LLMException
from app.services.llm_engine.prompts import (
    CLINICAL_TRANSLATION_PROMPT,
    SOAP_NOTE_GENERATION_PROMPT,
    DIFFERENTIAL_DIAGNOSIS_PROMPT,
    RED_FLAG_DETECTION_PROMPT
)

logger = logging.getLogger(__name__)


class MedicalRAGChain:
    """RAG (Retrieval Augmented Generation) pipeline for medical documentation"""
    
    def __init__(self):
        """Initialize Bedrock client and vector store"""
        client_config = {'region_name': settings.AWS_REGION}
        
        # Use mock mode if in development OR if AWS credentials are not configured
        # This allows demo mode in production without real AWS Bedrock
        if settings.ENV == 'development' or not settings.AWS_ACCESS_KEY_ID:
            self.mock_mode = True
            logger.info("MedicalRAGChain initialized in mock mode (demo)")
        else:
            self.mock_mode = False
            self.bedrock_client = boto3.client('bedrock-runtime', **client_config)
            logger.info("MedicalRAGChain initialized with AWS Bedrock")
        
        self.model_id = settings.BEDROCK_MODEL_ID
    
    async def translate_to_medical_english(
        self,
        transcript: str,
        source_language: str = "Hindi"
    ) -> str:
        """
        Translate vernacular transcript to medical English
        
        Args:
            transcript: Original patient description
            source_language: Source language name
            
        Returns:
            Translated and medicalized English text
        """
        if self.mock_mode:
            return await self._mock_translation(transcript)
        
        prompt = CLINICAL_TRANSLATION_PROMPT.format(
            source_language=source_language,
            transcript=transcript
        )
        
        response = await self._invoke_bedrock(prompt)
        return response.strip()
    
    async def generate_soap_note(
        self,
        translated_text: str,
        patient_age: int,
        patient_gender: str,
        medical_context: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Generate structured SOAP note
        
        Args:
            translated_text: Translated patient description
            patient_age: Patient age
            patient_gender: Patient gender
            medical_context: Retrieved medical knowledge
            
        Returns:
            Dictionary with SOAP sections
        """
        if self.mock_mode:
            return await self._mock_soap_note()
        
        # Retrieve relevant medical knowledge
        if not medical_context:
            medical_context = await self._retrieve_medical_context(translated_text)
        
        prompt = SOAP_NOTE_GENERATION_PROMPT.format(
            translated_text=translated_text,
            age=patient_age,
            gender=patient_gender,
            medical_context=medical_context
        )
        
        response = await self._invoke_bedrock(prompt, max_tokens=2000)
        
        # Parse the SOAP note sections
        soap_note = self._parse_soap_note(response)
        return soap_note
    
    async def generate_differential_diagnosis(
        self,
        chief_complaint: str,
        symptoms: List[str],
        patient_age: int,
        patient_gender: str,
        soap_summary: str
    ) -> List[Dict]:
        """
        Generate differential diagnosis list
        
        Args:
            chief_complaint: Main complaint
            symptoms: List of symptoms
            patient_age: Patient age
            patient_gender: Patient gender
            soap_summary: Summary from SOAP note
            
        Returns:
            List of differential diagnoses
        """
        if self.mock_mode:
            return await self._mock_differential_diagnosis()
        
        # Retrieve relevant medical knowledge
        medical_context = await self._retrieve_medical_context(
            f"{chief_complaint} {' '.join(symptoms)}"
        )
        
        prompt = DIFFERENTIAL_DIAGNOSIS_PROMPT.format(
            chief_complaint=chief_complaint,
            symptoms=', '.join(symptoms),
            age=patient_age,
            gender=patient_gender,
            soap_summary=soap_summary,
            medical_context=medical_context
        )
        
        response = await self._invoke_bedrock(prompt, max_tokens=1500)
        
        # Parse differential diagnosis
        dd_list = self._parse_differential_diagnosis(response)
        return dd_list
    
    async def detect_red_flags(self, patient_data: Dict) -> Dict:
        """
        Detect red flag symptoms requiring immediate attention
        
        Args:
            patient_data: Patient information and symptoms
            
        Returns:
            Red flag analysis
        """
        if self.mock_mode:
            return await self._mock_red_flags(patient_data)
        
        prompt = RED_FLAG_DETECTION_PROMPT.format(
            patient_data=json.dumps(patient_data, indent=2)
        )
        
        response = await self._invoke_bedrock(prompt, max_tokens=800)
        
        # Parse JSON response
        try:
            red_flags = json.loads(response)
        except json.JSONDecodeError:
            # Fallback if response isn't valid JSON
            red_flags = {
                "has_red_flags": False,
                "severity": "ROUTINE",
                "red_flags_detected": [],
                "triage_recommendation": "Routine appointment"
            }
        
        return red_flags
    
    async def _invoke_bedrock(self, prompt: str, max_tokens: int = 1024) -> str:
        """
        Invoke AWS Bedrock (Claude model)
        
        Args:
            prompt: Prompt text
            max_tokens: Maximum response tokens
            
        Returns:
            Model response text
        """
        try:
            request_body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": max_tokens,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.3,  # Lower temperature for medical accuracy
                "top_p": 0.9
            }
            
            response = self.bedrock_client.invoke_model(
                modelId=self.model_id,
                body=json.dumps(request_body)
            )
            
            response_body = json.loads(response['body'].read())
            text = response_body['content'][0]['text']
            
            return text
            
        except Exception as e:
            logger.error(f"Bedrock invocation error: {str(e)}")
            raise LLMException(
                message=f"LLM processing failed: {str(e)}",
                details={"model": self.model_id}
            )
    
    async def _retrieve_medical_context(self, query: str) -> str:
        """
        Retrieve relevant medical knowledge from vector store
        
        Args:
            query: Search query
            
        Returns:
            Retrieved medical context
        """
        # In production, implement OpenSearch vector similarity search
        # For now, return placeholder context
        return """
        Relevant Medical Knowledge:
        - Chest pain with left arm radiation is a classic presentation of acute coronary syndrome
        - STEMI (ST-Elevation Myocardial Infarction) requires immediate intervention
        - Risk factors: Age >40, male gender, diabetes, hypertension, smoking
        - Immediate ECG and troponin levels are critical
        """
    
    def _parse_soap_note(self, response: str) -> Dict[str, str]:
        """Parse SOAP note from LLM response"""
        sections = {
            'subjective': '',
            'objective': '',
            'assessment': '',
            'plan': ''
        }
        
        # Simple parsing - in production, use more robust parsing
        current_section = None
        for line in response.split('\n'):
            line = line.strip()
            if '**SUBJECTIVE:**' in line or 'SUBJECTIVE:' in line:
                current_section = 'subjective'
            elif '**OBJECTIVE:**' in line or 'OBJECTIVE:' in line:
                current_section = 'objective'
            elif '**ASSESSMENT:**' in line or 'ASSESSMENT:' in line:
                current_section = 'assessment'
            elif '**PLAN:**' in line or 'PLAN:' in line:
                current_section = 'plan'
            elif current_section and line:
                sections[current_section] += line + '\n'
        
        return sections
    
    def _parse_differential_diagnosis(self, response: str) -> List[Dict]:
        """Parse differential diagnosis list"""
        # Simple parsing - extract numbered items
        dd_list = []
        # In production, implement proper parsing
        # For now, return structured mock data
        return dd_list
    
    # Mock methods for development
    async def _mock_translation(self, transcript: str) -> str:
        """Mock translation for development"""
        return "Patient reports chest pain radiating to the left arm, which started this morning. Associated with shortness of breath and diaphoresis. Pain is described as crushing and substernal. No relief with rest."
    
    async def _mock_soap_note(self) -> Dict[str, str]:
        """Mock SOAP note for development"""
        return {
            'subjective': """Chief Complaint: Chest pain with left arm radiation

History of Present Illness: 
- 55-year-old male presenting with acute onset chest pain
- Pain started at 8 AM today (4 hours ago)
- Described as crushing, substernal, 8/10 severity
- Radiating to left arm and jaw
- Associated symptoms: Shortness of breath, diaphoresis, nausea
- No relief with rest
- No prior episodes

Review of Systems:
- Cardiovascular: Chest pain, palpitations
- Respiratory: Dyspnea on exertion
- Gastrointestinal: Nausea (no vomiting)
- Negative for: Fever, cough, recent trauma""",
            
            'objective': """Vital Signs: To be recorded upon arrival
Physical Examination: Pending

Patient appears: Anxious, diaphoretic""",
            
            'assessment': """Clinical Impression: 
ACUTE CORONARY SYNDROME - Suspected STEMI (ST-Elevation Myocardial Infarction)

Risk Stratification: **HIGH RISK**
Justification:
- Classic presentation of cardiac chest pain
- Radiation pattern consistent with cardiac origin
- Associated autonomic symptoms (diaphoresis, nausea)
- Age and gender are risk factors
- Duration >20 minutes without relief

RED FLAGS PRESENT:
- CHEST PAIN WITH RADIATION
- ASSOCIATED DYSPNEA
- TIME-SENSITIVE EMERGENCY""",
            
            'plan': """Immediate Actions:
- ACTIVATE CARDIAC EMERGENCY PROTOCOL
- Call cardiology immediately
- Prepare for possible emergency catheterization
- Administer aspirin 300mg stat (if not allergic)
- Oxygen if SpO2 <94%
- Establish IV access
- Continuous cardiac monitoring

Investigations (URGENT):
1. 12-lead ECG - STAT
2. Cardiac troponin I/T - STAT and serial
3. Complete blood count
4. Comprehensive metabolic panel
5. Chest X-ray (portable)
6. Coagulation profile

Treatment Considerations:
- Antiplatelet therapy (Aspirin + P2Y12 inhibitor)
- Anticoagulation (Heparin/LMWH)
- Nitrates for pain relief (if BP stable)
- Beta-blockers (if no contraindications)
- Consider fibrinolysis if PCI not available within 120 minutes
- Transfer to cardiac catheterization lab if STEMI confirmed"""
        }
    
    async def _mock_differential_diagnosis(self) -> List[Dict]:
        """Mock differential diagnosis"""
        return [
            {
                "diagnosis": "Acute Coronary Syndrome (STEMI)",
                "probability": "HIGH",
                "supporting_factors": [
                    "Classic chest pain with left arm radiation",
                    "Associated diaphoresis and dyspnea",
                    "Age >50, male gender",
                    "Crushing substernal pain"
                ],
                "against": [
                    "No prior cardiac history mentioned"
                ],
                "next_steps": [
                    "Immediate ECG",
                    "Troponin levels",
                    "Activate cath lab"
                ]
            },
            {
                "diagnosis": "Unstable Angina",
                "probability": "MEDIUM",
                "supporting_factors": [
                    "Chest pain pattern",
                    "No relief with rest"
                ],
                "against": [
                    "Severity suggests STEMI more likely"
                ],
                "next_steps": [
                    "Same workup as ACS",
                    "Risk stratification"
                ]
            },
            {
                "diagnosis": "Aortic Dissection",
                "probability": "MEDIUM",
                "supporting_factors": [
                    "Severe chest pain",
                    "Age group at risk"
                ],
                "against": [
                    "No mention of tearing pain",
                    "No blood pressure differential"
                ],
                "next_steps": [
                    "Check blood pressure in both arms",
                    "Consider CT angiography if suspected"
                ]
            },
            {
                "diagnosis": "Pulmonary Embolism",
                "probability": "LOW",
                "supporting_factors": [
                    "Dyspnea",
                    "Chest pain"
                ],
                "against": [
                    "Pain pattern not typical",
                    "No risk factors mentioned"
                ],
                "next_steps": [
                    "D-dimer if Wells score indicates",
                    "Consider CTPA if high suspicion"
                ]
            }
        ]
    
    async def _mock_red_flags(self, patient_data: Dict) -> Dict:
        """Mock red flags detection"""
        return {
            "has_red_flags": True,
            "severity": "CRITICAL",
            "red_flags_detected": [
                {
                    "category": "Cardiovascular",
                    "finding": "Chest pain radiating to left arm",
                    "urgency": "CRITICAL",
                    "action": "Immediate ECG and troponin, activate cardiac protocol"
                },
                {
                    "category": "Respiratory",
                    "finding": "Associated dyspnea",
                    "urgency": "URGENT",
                    "action": "Monitor oxygen saturation, provide supplemental O2 if needed"
                }
            ],
            "triage_recommendation": "Emergency room immediately - possible STEMI"
        }


# Global instance
rag_chain = MedicalRAGChain()
