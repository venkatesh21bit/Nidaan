"""
Patient endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Optional
from datetime import datetime
from pydantic import BaseModel
import uuid
import logging

from app.core.security import get_current_user
from app.core.db import db_client
from app.schemas.patient import PatientCreate, PatientResponse, PatientUpdate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/patients", tags=["patients"])

# ==================== Chat Models ====================

class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str

class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[ChatMessage]] = []
    language: str = "en-IN"

class ChatResponse(BaseModel):
    response: str
    follow_up_questions: Optional[List[str]] = None
    collected_symptoms: Optional[List[str]] = None
    severity_assessment: Optional[str] = None

class ResetRequest(BaseModel):
    confirm: bool = True

# In-memory conversation storage for demo
_conversations: Dict[str, List[Dict]] = {}
_collected_data: Dict[str, Dict] = {}


@router.post("/chat/reset")
async def reset_patient_chat(
    current_user: Dict = Depends(get_current_user)
):
    """
    Reset patient conversation data to start fresh.
    Clears all collected symptoms and conversation history.
    """
    try:
        user_id = current_user.get('user_id', 'anonymous')
        
        # Clear conversation history
        if user_id in _conversations:
            del _conversations[user_id]
        
        # Clear collected data
        if user_id in _collected_data:
            del _collected_data[user_id]
        
        logger.info(f"Reset conversation for user: {user_id}")
        
        return {"message": "Conversation reset successfully", "user_id": user_id}
        
    except Exception as e:
        logger.error(f"Reset error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reset failed: {str(e)}"
        )


@router.post("/chat", response_model=ChatResponse)
async def patient_chat(
    chat_request: ChatRequest,
    current_user: Dict = Depends(get_current_user)
):
    """
    AI-powered patient symptom collection chat.
    Uses context-aware responses to gather medical information.
    """
    try:
        user_id = current_user.get('user_id', 'anonymous')
        message = chat_request.message.lower()
        history = chat_request.conversation_history or []
        
        # If conversation history is empty or very short, start fresh
        if len(history) <= 1:
            # Clear previous data for fresh conversation
            if user_id in _collected_data:
                del _collected_data[user_id]
            if user_id in _conversations:
                del _conversations[user_id]
        
        # Initialize or get conversation data
        if user_id not in _collected_data:
            _collected_data[user_id] = {
                'symptoms': [],
                'duration': None,
                'severity': None,
                'location': None,
                'associated_symptoms': [],
                'triggers': [],
                'medical_history': [],
            }
        
        collected = _collected_data[user_id]
        
        # Analyze message and extract information
        response, follow_ups, severity = await _process_patient_message(
            message, history, collected
        )
        
        # Store conversation
        if user_id not in _conversations:
            _conversations[user_id] = []
        _conversations[user_id].append({'role': 'user', 'content': chat_request.message})
        _conversations[user_id].append({'role': 'assistant', 'content': response})
        
        return ChatResponse(
            response=response,
            follow_up_questions=follow_ups,
            collected_symptoms=collected['symptoms'],
            severity_assessment=severity
        )
        
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat failed: {str(e)}"
        )


async def _process_patient_message(
    message: str,
    history: List[ChatMessage],
    collected: Dict
) -> tuple[str, List[str], Optional[str]]:
    """Process patient message and generate contextual response"""
    
    # Extract symptoms from message
    symptom_keywords = {
        'headache': 'Headache',
        'head pain': 'Headache',
        'migraine': 'Migraine headache',
        'fever': 'Fever',
        'feverish': 'Fever',
        'temperature': 'Fever',
        'hot': 'Fever',
        'cough': 'Cough',
        'coughing': 'Cough',
        'chest pain': 'Chest pain',
        'chest': 'Chest discomfort',
        'stomach': 'Abdominal pain',
        'abdominal': 'Abdominal pain',
        'vomit': 'Vomiting',
        'vomiting': 'Vomiting',
        'nausea': 'Nausea',
        'nauseous': 'Nausea',
        'dizzy': 'Dizziness',
        'dizziness': 'Dizziness',
        'tired': 'Fatigue',
        'fatigue': 'Fatigue',
        'weak': 'Weakness',
        'weakness': 'Weakness',
        'pain': 'Pain',
        'ache': 'Body ache',
        'aching': 'Body ache',
        'sore throat': 'Sore throat',
        'throat': 'Sore throat',
        'breathing': 'Breathing difficulty',
        'breathless': 'Dyspnea',
        'shortness of breath': 'Dyspnea',
        'cold': 'Common cold',
        'runny nose': 'Rhinorrhea',
        'sneezing': 'Sneezing',
        'chills': 'Chills',
        'sweating': 'Sweating',
    }
    
    # Extract mentioned symptoms
    for keyword, symptom in symptom_keywords.items():
        if keyword in message and symptom not in collected['symptoms']:
            collected['symptoms'].append(symptom)
    
    # Extract duration
    duration_patterns = ['day', 'days', 'week', 'weeks', 'hour', 'hours', 'month']
    for pattern in duration_patterns:
        if pattern in message:
            # Try to extract the number
            words = message.split()
            for i, word in enumerate(words):
                if word.isdigit() and i + 1 < len(words) and pattern in words[i + 1]:
                    collected['duration'] = f"{word} {words[i + 1]}"
                    break
    
    # Extract severity (1-10 scale) - improved pattern matching
    import re
    severity_patterns = [
        r'(\d+)\s*(?:out of|/)\s*10',  # "8 out of 10" or "8/10"
        r'pain\s*(?:is|level)?\s*(\d+)',  # "pain is 8" or "pain level 8"
        r'severity\s*(?:is|:)?\s*(\d+)',  # "severity is 8" or "severity: 8"
        r'(\d+)\s*(?:on a scale|scale)',  # "8 on a scale"
        r'it\s*(?:is|\'s)?\s*(\d+)',  # "it is 7" or "it's 7"
        r'(?:^|\s)(\d+)(?:\s|$|\.)',  # standalone number like "7" or "7."
        r'discomfort\s*(?:is|:)?\s*(\d+)',  # "discomfort is 7"
    ]
    
    for pattern in severity_patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            sev = int(match.group(1))
            if 1 <= sev <= 10:
                collected['severity'] = str(sev)
                logger.info(f"Extracted severity {sev} from message: {message}")
                break
    
    # Fallback: look for any standalone number 1-10 in short messages about rating/severity
    if not collected['severity']:
        # Check if recent conversation asked about severity/rating
        recent_history = ' '.join([h.content for h in history[-2:]]) if history else ''
        is_severity_context = any(word in recent_history.lower() for word in ['scale', 'severe', 'rate', '1-10', 'discomfort'])
        
        if is_severity_context or len(message.strip()) <= 15:
            # Short response likely answering severity question
            numbers = re.findall(r'\d+', message)
            for num_str in numbers:
                num = int(num_str)
                if 1 <= num <= 10:
                    collected['severity'] = str(num)
                    logger.info(f"Extracted severity {num} from short message: {message}")
                    break
    
    # Extract location
    location_keywords = ['both sides', 'one side', 'left', 'right', 'front', 'back', 'all over']
    for loc in location_keywords:
        if loc in message:
            collected['location'] = loc
            break
    
    # Extract associated symptoms
    associated = ['sensitive to light', 'light sensitivity', 'nausea', 'vomiting', 
                  'blurred vision', 'stiff neck', 'fever with', 'chills']
    for assoc in associated:
        if assoc in message and assoc not in collected['associated_symptoms']:
            collected['associated_symptoms'].append(assoc)
    
    # Determine what information is still needed
    missing_info = []
    if not collected['duration']:
        missing_info.append('duration')
    if not collected['severity']:
        missing_info.append('severity')
    if not collected['location'] and 'Headache' in collected['symptoms']:
        missing_info.append('location')
    if not collected['associated_symptoms']:
        missing_info.append('associated_symptoms')
    
    # Generate contextual response based on conversation state
    history_text = ' '.join([h.content for h in history[-4:]]) if history else ''
    
    # Check if we're in follow-up mode (patient already described symptoms)
    if collected['symptoms'] and len(history) > 0:
        # We have symptoms and previous conversation
        return _generate_followup_response(collected, missing_info)
    elif collected['symptoms']:
        # First detailed description received
        return _generate_initial_followup(collected, missing_info)
    else:
        # Generic greeting or unclear message
        return _generate_clarification_response(message)


def _generate_followup_response(collected: Dict, missing_info: List[str]) -> tuple[str, List[str], Optional[str]]:
    """Generate follow-up response when we have some data"""
    
    severity = None
    if collected['severity']:
        sev_num = int(collected['severity'])
        if sev_num >= 8:
            severity = "HIGH"
        elif sev_num >= 5:
            severity = "MODERATE"
        else:
            severity = "LOW"
    
    # Build response summarizing what we collected
    summary_parts = []
    if collected['symptoms']:
        summary_parts.append(f"symptoms: {', '.join(collected['symptoms'])}")
    if collected['duration']:
        summary_parts.append(f"duration: {collected['duration']}")
    if collected['severity']:
        summary_parts.append(f"severity: {collected['severity']}/10")
    if collected['location']:
        summary_parts.append(f"location: {collected['location']}")
    if collected['associated_symptoms']:
        summary_parts.append(f"associated: {', '.join(collected['associated_symptoms'])}")
    
    response = f"Thank you for providing those details. I've recorded:\n\n"
    response += "• " + "\n• ".join(summary_parts) + "\n\n"
    
    follow_ups = []
    
    if not missing_info or len(missing_info) <= 1:
        # We have enough info
        response += "I have gathered enough information to prepare a summary for your doctor. "
        
        if severity == "HIGH":
            response += "\n\n⚠️ **Important**: Based on the severity you described, I recommend seeking medical attention soon. "
            if 'sensitive to light' in collected['associated_symptoms'] or 'stiff neck' in ' '.join(collected['associated_symptoms']):
                response += "Light sensitivity and severe headache can sometimes indicate conditions requiring urgent evaluation."
        
        response += "\n\nIs there anything else you'd like to add before I prepare the summary?"
        follow_ups = ["Add more symptoms", "Ready for summary", "I have a question"]
    else:
        # Need more info
        if 'duration' in missing_info:
            response += "Could you tell me how long you've been experiencing these symptoms?"
            follow_ups.append("How long have you had this?")
        elif 'severity' in missing_info:
            response += "On a scale of 1-10, how severe is your discomfort?"
            follow_ups.append("Rate your pain 1-10")
        elif 'associated_symptoms' in missing_info:
            response += "Are you experiencing any other symptoms along with this? (e.g., nausea, vision changes, fever)"
            follow_ups.append("Any other symptoms?")
    
    return response, follow_ups, severity


def _generate_initial_followup(collected: Dict, missing_info: List[str]) -> tuple[str, List[str], Optional[str]]:
    """Generate first follow-up after symptoms identified"""
    
    symptom_list = collected['symptoms']
    primary_symptom = symptom_list[0] if symptom_list else "symptoms"
    
    response = f"I understand you're experiencing {primary_symptom.lower()}. "
    
    if 'Headache' in symptom_list or 'Migraine' in primary_symptom:
        if not collected['duration']:
            response += "To help your doctor better understand your condition, could you tell me:\n\n"
            response += "• How long have you had this headache?\n"
            response += "• Is the pain on one side or both sides?\n"
            response += "• On a scale of 1-10, how severe is the pain?\n"
            response += "• Do you have any other symptoms like nausea or sensitivity to light?"
            follow_ups = ["Less than a day", "A few days", "More than a week"]
        else:
            response += f"You mentioned it's been {collected['duration']}. "
            response += "Can you describe where exactly the pain is located and if you notice any other symptoms?"
            follow_ups = ["One side of head", "Both sides", "Behind my eyes"]
    elif 'Fever' in symptom_list:
        response += "Let me ask a few questions:\n\n"
        response += "• What is your current temperature if you've measured it?\n"
        response += "• When did the fever start?\n"
        response += "• Do you have any other symptoms like cough, body aches, or chills?"
        follow_ups = ["I measured my temperature", "Started today", "Have other symptoms"]
    elif 'Chest' in primary_symptom:
        response += "⚠️ Chest symptoms need careful attention. Please describe:\n\n"
        response += "• Is it a pain, pressure, or tightness?\n"
        response += "• Does it spread to your arm, jaw, or back?\n"
        response += "• Do you have shortness of breath?\n\n"
        response += "**If you're experiencing severe chest pain, please seek immediate medical attention.**"
        follow_ups = ["It's a sharp pain", "Feels like pressure", "Having trouble breathing"]
    else:
        response += "To help document your condition:\n\n"
        response += "• When did these symptoms start?\n"
        response += "• How severe are they (mild, moderate, severe)?\n"
        response += "• Is there anything that makes them better or worse?"
        follow_ups = ["Started recently", "It's getting worse", "Mild symptoms"]
    
    return response, follow_ups, None


def _generate_clarification_response(message: str) -> tuple[str, List[str], Optional[str]]:
    """Generate response when we need more clarity"""
    
    if any(greeting in message for greeting in ['hello', 'hi', 'hey', 'good']):
        response = "Hello! I'm your AI health assistant. I'm here to help gather information about your symptoms before your consultation. What brings you in today? Please describe how you're feeling."
        follow_ups = ["I have a headache", "I'm feeling sick", "I have pain"]
    else:
        response = "I'm here to help document your symptoms. Could you please describe what you're experiencing? For example:\n\n"
        response += "• What symptoms are you having?\n"
        response += "• When did they start?\n"
        response += "• How severe are they?"
        follow_ups = ["I have a headache", "Stomach problems", "Feeling unwell"]
    
    return response, follow_ups, None


@router.post("/", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    patient_data: PatientCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Create a new patient"""
    try:
        patient_id = f"PAT_{uuid.uuid4().hex[:12].upper()}"
        
        # In production, store in a separate patients table
        # For MVP, we'll keep it simple
        
        logger.info(f"Created patient {patient_id}")
        
        return PatientResponse(
            patient_id=patient_id,
            **patient_data.dict(),
            created_at=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error(f"Error creating patient: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create patient: {str(e)}"
        )


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get patient details"""
    # Mock response for MVP
    return PatientResponse(
        patient_id=patient_id,
        name="Mock Patient",
        age=45,
        gender="male",
        phone="+919876543210",
        language_preference="hi-IN",
        clinic_id=current_user.get("clinic_id"),
        created_at=datetime.utcnow()
    )


@router.get("/{patient_id}/visits")
async def get_patient_visits(
    patient_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get all visits for a patient"""
    try:
        visits = db_client.list_patient_visits(patient_id, limit=50)
        return {"visits": visits}
        
    except Exception as e:
        logger.error(f"Error fetching patient visits: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch visits: {str(e)}"
        )
