"""
IBM Watson Natural Language Understanding (NLU) Processor
Extracts medical entities, symptoms, and medications from unstructured text
"""
import logging
from typing import List, Dict, Any, Optional, Tuple
from ibm_watson import NaturalLanguageUnderstandingV1
from ibm_watson.natural_language_understanding_v1 import (
    Features,
    EntitiesOptions,
    KeywordsOptions,
    ConceptsOptions,
    SentimentOptions,
    EmotionOptions
)
from ibm_cloud_sdk_core.authenticators import IAMAuthenticator
from ibm_cloud_sdk_core import ApiException

from app.core.config import settings

logger = logging.getLogger(__name__)


class NLUProcessor:
    """
    IBM Watson NLU Processor for medical text analysis
    
    Extracts symptoms, medications, conditions, and other medical entities
    from patient survey responses and voice transcripts.
    """
    
    # Medical entity patterns for additional extraction
    SYMPTOM_KEYWORDS = [
        "pain", "ache", "fever", "cough", "headache", "nausea", "vomiting",
        "dizziness", "fatigue", "weakness", "breathing", "chest", "shortness",
        "swelling", "rash", "itching", "bleeding", "numbness", "tingling",
        "cramping", "diarrhea", "constipation", "insomnia", "anxiety",
        "palpitations", "sweating", "chills", "sore throat", "congestion"
    ]
    
    MEDICATION_KEYWORDS = [
        "aspirin", "ibuprofen", "paracetamol", "acetaminophen", "metformin",
        "lisinopril", "amlodipine", "omeprazole", "insulin", "levothyroxine",
        "atorvastatin", "simvastatin", "losartan", "gabapentin", "sertraline",
        "mg", "tablet", "capsule", "medication", "medicine", "prescription",
        "antibiotic", "inhaler", "drops", "syrup", "injection"
    ]
    
    BODY_PARTS = [
        "head", "chest", "abdomen", "stomach", "back", "neck", "shoulder",
        "arm", "hand", "leg", "foot", "knee", "hip", "throat", "eye",
        "ear", "nose", "heart", "lung", "liver", "kidney"
    ]
    
    def __init__(self):
        self.client: Optional[NaturalLanguageUnderstandingV1] = None
        self._initialized = False
        
    async def initialize(self):
        """Initialize IBM Watson NLU client"""
        if self._initialized:
            return
            
        try:
            authenticator = IAMAuthenticator(settings.IBM_NLU_API_KEY)
            
            self.client = NaturalLanguageUnderstandingV1(
                version='2022-04-07',
                authenticator=authenticator
            )
            self.client.set_service_url(settings.IBM_NLU_URL)
            
            self._initialized = True
            logger.info("IBM Watson NLU initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize NLU: {e}")
            raise
    
    async def analyze_text(self, text: str) -> Dict[str, Any]:
        """
        Perform comprehensive NLU analysis on text
        
        Args:
            text: Input text to analyze
            
        Returns:
            Dictionary containing all extracted entities and analysis
        """
        if not self._initialized:
            await self.initialize()
        
        try:
            # Call Watson NLU with multiple features
            response = self.client.analyze(
                text=text,
                features=Features(
                    entities=EntitiesOptions(
                        emotion=True,
                        sentiment=True,
                        mentions=True,
                        limit=50
                    ),
                    keywords=KeywordsOptions(
                        emotion=True,
                        sentiment=True,
                        limit=30
                    ),
                    concepts=ConceptsOptions(
                        limit=20
                    ),
                    sentiment=SentimentOptions(),
                    emotion=EmotionOptions()
                ),
                language='en'
            ).get_result()
            
            return response
            
        except ApiException as e:
            logger.error(f"NLU API error: {e}")
            # Fall back to regex-based extraction
            return self._fallback_extraction(text)
    
    def _fallback_extraction(self, text: str) -> Dict[str, Any]:
        """Fallback extraction using keyword matching when API fails"""
        text_lower = text.lower()
        
        entities = []
        keywords = []
        
        # Extract symptoms
        for symptom in self.SYMPTOM_KEYWORDS:
            if symptom in text_lower:
                entities.append({
                    "type": "Symptom",
                    "text": symptom,
                    "confidence": 0.7
                })
                keywords.append({
                    "text": symptom,
                    "relevance": 0.7
                })
        
        # Extract medications
        for med in self.MEDICATION_KEYWORDS:
            if med in text_lower:
                entities.append({
                    "type": "Medication",
                    "text": med,
                    "confidence": 0.7
                })
        
        # Extract body parts
        for part in self.BODY_PARTS:
            if part in text_lower:
                entities.append({
                    "type": "BodyPart",
                    "text": part,
                    "confidence": 0.7
                })
        
        return {
            "entities": entities,
            "keywords": keywords,
            "concepts": [],
            "sentiment": {"document": {"score": 0, "label": "neutral"}},
            "fallback_mode": True
        }
    
    async def extract_medical_entities(self, text: str) -> Dict[str, List[str]]:
        """
        Extract specifically medical entities from text
        
        Args:
            text: Patient's response or transcript
            
        Returns:
            Dictionary with categorized medical entities
        """
        analysis = await self.analyze_text(text)
        
        result = {
            "symptoms": [],
            "medications": [],
            "conditions": [],
            "body_parts": [],
            "durations": [],
            "allergies": [],
            "procedures": [],
            "vital_signs": [],
            "other_entities": []
        }
        
        # Process Watson NLU entities
        for entity in analysis.get("entities", []):
            entity_text = entity.get("text", "").lower()
            entity_type = entity.get("type", "").lower()
            
            # Categorize based on type
            if entity_type in ["healthcondition", "disease", "symptom"]:
                if self._is_symptom(entity_text):
                    result["symptoms"].append(entity_text)
                else:
                    result["conditions"].append(entity_text)
                    
            elif entity_type in ["drug", "medication", "medicine"]:
                result["medications"].append(entity_text)
                
            elif entity_type in ["anatomical_structure", "body_part"]:
                result["body_parts"].append(entity_text)
                
            elif entity_type in ["duration", "time"]:
                result["durations"].append(entity_text)
                
            else:
                result["other_entities"].append({
                    "text": entity_text,
                    "type": entity_type
                })
        
        # Process keywords for additional context
        for keyword in analysis.get("keywords", []):
            keyword_text = keyword.get("text", "").lower()
            
            if self._is_symptom(keyword_text) and keyword_text not in result["symptoms"]:
                result["symptoms"].append(keyword_text)
            elif self._is_medication(keyword_text) and keyword_text not in result["medications"]:
                result["medications"].append(keyword_text)
        
        # Additional pattern-based extraction
        result = self._enhance_extraction(text, result)
        
        # Remove duplicates
        for key in result:
            if isinstance(result[key], list) and all(isinstance(x, str) for x in result[key]):
                result[key] = list(set(result[key]))
        
        return result
    
    def _is_symptom(self, text: str) -> bool:
        """Check if text represents a symptom"""
        text_lower = text.lower()
        return any(symptom in text_lower for symptom in self.SYMPTOM_KEYWORDS)
    
    def _is_medication(self, text: str) -> bool:
        """Check if text represents a medication"""
        text_lower = text.lower()
        return any(med in text_lower for med in self.MEDICATION_KEYWORDS)
    
    def _enhance_extraction(self, text: str, result: Dict[str, List]) -> Dict[str, List]:
        """Enhance extraction with pattern matching"""
        import re
        text_lower = text.lower()
        
        # Extract pain levels (1-10 scale)
        pain_pattern = r'pain\s*(?:level|scale|rating)?[:\s]*(\d+)(?:\s*(?:out of|\/)\s*10)?'
        pain_matches = re.findall(pain_pattern, text_lower)
        if pain_matches:
            result["vital_signs"].append(f"pain_level:{pain_matches[0]}")
        
        # Extract temperatures
        temp_pattern = r'(\d{2,3}(?:\.\d)?)\s*(?:°|degrees?)?\s*(?:f|fahrenheit|c|celsius)?'
        temp_matches = re.findall(temp_pattern, text_lower)
        for temp in temp_matches:
            if 95 <= float(temp) <= 108:  # Reasonable body temperature range (F)
                result["vital_signs"].append(f"temperature:{temp}F")
            elif 35 <= float(temp) <= 42:  # Celsius range
                result["vital_signs"].append(f"temperature:{temp}C")
        
        # Extract durations
        duration_patterns = [
            r'(\d+)\s*(day|days|week|weeks|month|months|hour|hours|year|years)',
            r'(past|last|for)\s+(\d+)\s*(day|days|week|weeks|month|months)',
            r'since\s+(yesterday|last week|last month)'
        ]
        for pattern in duration_patterns:
            matches = re.findall(pattern, text_lower)
            for match in matches:
                if isinstance(match, tuple):
                    result["durations"].append(" ".join(match))
                else:
                    result["durations"].append(match)
        
        # Extract allergies
        allergy_patterns = [
            r'allergic\s+to\s+([^,\.]+)',
            r'allergy\s+to\s+([^,\.]+)',
            r'allergies?[:\s]+([^,\.]+)'
        ]
        for pattern in allergy_patterns:
            matches = re.findall(pattern, text_lower)
            result["allergies"].extend(matches)
        
        return result
    
    async def process_survey_response(
        self,
        response_text: str,
        questions_answered: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Process a complete survey response from a patient
        
        Args:
            response_text: Raw text from patient's survey response
            questions_answered: Optional mapping of question IDs to answers
            
        Returns:
            Structured extraction with all medical information
        """
        # Extract entities from the main text
        entities = await self.extract_medical_entities(response_text)
        
        # Get sentiment analysis
        analysis = await self.analyze_text(response_text)
        sentiment = analysis.get("sentiment", {}).get("document", {})
        emotion = analysis.get("emotion", {}).get("document", {}).get("emotion", {})
        
        # Determine urgency indicators from emotion/sentiment
        urgency_indicators = []
        if emotion.get("fear", 0) > 0.5:
            urgency_indicators.append("high_fear_detected")
        if emotion.get("sadness", 0) > 0.5:
            urgency_indicators.append("distress_indicated")
        if sentiment.get("label") == "negative" and sentiment.get("score", 0) < -0.5:
            urgency_indicators.append("negative_sentiment")
        
        # Process individual question responses if provided
        structured_answers = {}
        if questions_answered:
            for q_id, answer in questions_answered.items():
                q_entities = await self.extract_medical_entities(answer)
                structured_answers[q_id] = {
                    "raw_answer": answer,
                    "extracted_entities": q_entities
                }
        
        return {
            "raw_text": response_text,
            "extracted_entities": entities,
            "sentiment": sentiment,
            "emotion": emotion,
            "urgency_indicators": urgency_indicators,
            "structured_answers": structured_answers,
            "processing_timestamp": __import__('datetime').datetime.utcnow().isoformat()
        }
    
    async def extract_from_transcript(self, transcript: str) -> Tuple[List[str], List[str], Dict[str, Any]]:
        """
        Extract symptoms and medications specifically for triage from voice transcript
        
        Args:
            transcript: Voice-to-text transcript
            
        Returns:
            Tuple of (symptoms, medications, full_extraction)
        """
        full_extraction = await self.extract_medical_entities(transcript)
        
        symptoms = full_extraction.get("symptoms", [])
        medications = full_extraction.get("medications", [])
        
        # Add conditions as potential symptoms
        symptoms.extend(full_extraction.get("conditions", []))
        
        # Deduplicate
        symptoms = list(set(symptoms))
        medications = list(set(medications))
        
        return symptoms, medications, full_extraction


# Singleton instance
nlu_processor = NLUProcessor()
