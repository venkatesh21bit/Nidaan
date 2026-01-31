"""
Seed Data Service
Creates initial real patient data in the database
"""
import uuid
from datetime import datetime, timedelta
import logging
import random

from app.core.db import db_client
from app.schemas.medical import VisitStatus

logger = logging.getLogger(__name__)

# Real patient data samples representing typical Indian clinic visits
REAL_PATIENTS = [
    {
        "name": "Rajesh Kumar",
        "age": 55,
        "gender": "male",
        "complaint": "Chest pain and shortness of breath since morning",
        "language": "hi-IN",
        "transcript": "मुझे सुबह से सीने में दर्द हो रहा है और सांस लेने में तकलीफ हो रही है। दर्द बाएं कंधे तक जाता है।",
        "translation": "I have been having chest pain since morning and difficulty breathing. The pain radiates to my left shoulder.",
    },
    {
        "name": "Priya Sharma",
        "age": 32,
        "gender": "female",
        "complaint": "Severe headache and blurred vision for 2 days",
        "language": "en-IN",
        "transcript": "I have had a severe headache for two days now. My vision is blurry and I feel nauseous. The headache is worse in the morning.",
        "translation": "I have had a severe headache for two days now. My vision is blurry and I feel nauseous. The headache is worse in the morning.",
    },
    {
        "name": "Mohammad Ali",
        "age": 67,
        "gender": "male",
        "complaint": "High fever with cough and body aches",
        "language": "hi-IN",
        "transcript": "मुझे तीन दिन से तेज बुखार है, 103 डिग्री तक। खांसी भी है और पूरे शरीर में दर्द है।",
        "translation": "I have had high fever for three days, up to 103 degrees. I also have cough and body aches throughout.",
    },
    {
        "name": "Lakshmi Devi",
        "age": 45,
        "gender": "female",
        "complaint": "Abdominal pain and vomiting since last night",
        "language": "ta-IN",
        "transcript": "நேற்று இரவிலிருந்து வயிற்று வலி மற்றும் வாந்தி இருக்கிறது. எதையும் சாப்பிட முடியவில்லை.",
        "translation": "I have had stomach pain and vomiting since last night. I am unable to eat anything.",
    },
    {
        "name": "Suresh Patel",
        "age": 42,
        "gender": "male",
        "complaint": "Persistent joint pain in both knees",
        "language": "en-IN",
        "transcript": "My knee joints have been paining for the last three months. It gets worse when I climb stairs or walk for long. I also notice swelling in the evening.",
        "translation": "My knee joints have been paining for the last three months. It gets worse when I climb stairs or walk for long. I also notice swelling in the evening.",
    },
    {
        "name": "Anita Reddy",
        "age": 28,
        "gender": "female",
        "complaint": "Severe fatigue and dizziness",
        "language": "te-IN",
        "transcript": "నాకు చాలా అలసట మరియు తలతిరుగుట ఉంది. రెండు నెలలుగా ఇలా ఉంది. కొన్నిసార్లు నిలబడినప్పుడు కళ్ళు చీకటి వస్తున్నాయి.",
        "translation": "I am experiencing severe fatigue and dizziness. This has been going on for two months. Sometimes I feel darkness in my eyes when I stand up.",
    },
]


def generate_soap_note(patient: dict, risk_level: str) -> dict:
    """Generate a realistic SOAP note for a patient"""
    return {
        "subjective": f"""Chief Complaint: {patient['complaint']}

History of Present Illness:
- {patient['age']}-year-old {patient['gender']} presenting with {patient['complaint'].lower()}
- Patient reports symptoms as described in transcript
- Duration: As mentioned in chief complaint

Review of Systems:
- General: As per patient's report
- Associated symptoms noted as described""",
        
        "objective": f"""Vital Signs: To be recorded during physical examination

Physical Examination:
- General Appearance: Awaiting examination
- Relevant system examination: To be performed based on chief complaint

Initial Assessment Status: Pending clinical evaluation""",
        
        "assessment": f"""Clinical Impression: {patient['complaint']}

Risk Assessment: {risk_level}
- AI-assisted triage has classified this case based on symptom analysis
- Clinical correlation and examination required

Differential Considerations:
- Primary diagnosis pending clinical evaluation
- Rule out serious conditions based on red flags""",
        
        "plan": """1. Complete physical examination
2. Order relevant investigations based on clinical findings
3. Review results and establish definitive diagnosis
4. Initiate appropriate treatment
5. Schedule follow-up as needed"""
    }


def generate_differential_diagnosis(complaint: str, risk_level: str) -> list:
    """Generate differential diagnosis based on complaint"""
    differentials = {
        "chest pain": [
            {"diagnosis": "Acute Coronary Syndrome", "probability": "HIGH" if risk_level == "CRITICAL" else "MODERATE"},
            {"diagnosis": "Musculoskeletal pain", "probability": "MODERATE"},
            {"diagnosis": "Gastroesophageal reflux disease", "probability": "LOW"},
        ],
        "headache": [
            {"diagnosis": "Migraine", "probability": "HIGH"},
            {"diagnosis": "Tension headache", "probability": "MODERATE"},
            {"diagnosis": "Intracranial pathology", "probability": "LOW"},
        ],
        "fever": [
            {"diagnosis": "Viral infection", "probability": "HIGH"},
            {"diagnosis": "Bacterial infection", "probability": "MODERATE"},
            {"diagnosis": "Inflammatory condition", "probability": "LOW"},
        ],
        "abdominal pain": [
            {"diagnosis": "Acute gastritis", "probability": "HIGH"},
            {"diagnosis": "Gastroenteritis", "probability": "MODERATE"},
            {"diagnosis": "Appendicitis", "probability": "LOW"},
        ],
        "joint pain": [
            {"diagnosis": "Osteoarthritis", "probability": "HIGH"},
            {"diagnosis": "Rheumatoid arthritis", "probability": "MODERATE"},
            {"diagnosis": "Gout", "probability": "LOW"},
        ],
        "fatigue": [
            {"diagnosis": "Anemia", "probability": "HIGH"},
            {"diagnosis": "Thyroid dysfunction", "probability": "MODERATE"},
            {"diagnosis": "Vitamin deficiency", "probability": "MODERATE"},
        ],
    }
    
    # Find matching differential
    for key, diffs in differentials.items():
        if key in complaint.lower():
            for diff in diffs:
                diff["supporting_factors"] = ["Patient symptoms align with diagnosis"]
                diff["against"] = ["Requires clinical confirmation"]
                diff["next_steps"] = ["Order confirmatory tests", "Clinical examination"]
            return diffs
    
    return [
        {
            "diagnosis": "To be determined after clinical evaluation",
            "probability": "MODERATE",
            "supporting_factors": ["Symptoms require further investigation"],
            "against": ["Insufficient data for definitive diagnosis"],
            "next_steps": ["Complete history and physical", "Basic investigations"]
        }
    ]


def generate_red_flags(complaint: str, risk_level: str) -> dict:
    """Generate red flags based on complaint and risk"""
    has_red_flags = risk_level in ["CRITICAL", "HIGH"]
    
    red_flags_data = {
        "has_red_flags": has_red_flags,
        "severity": risk_level,
        "red_flags_detected": [],
        "triage_recommendation": "Immediate evaluation" if has_red_flags else "Routine appointment"
    }
    
    if has_red_flags:
        if "chest" in complaint.lower():
            red_flags_data["red_flags_detected"] = [
                {
                    "category": "Cardiovascular",
                    "finding": "Chest pain with radiation to shoulder",
                    "urgency": "CRITICAL" if risk_level == "CRITICAL" else "URGENT",
                    "action": "ECG, cardiac enzymes, immediate evaluation"
                }
            ]
        elif "headache" in complaint.lower() and "vision" in complaint.lower():
            red_flags_data["red_flags_detected"] = [
                {
                    "category": "Neurological",
                    "finding": "Headache with visual disturbance",
                    "urgency": "URGENT",
                    "action": "Neurological examination, consider imaging"
                }
            ]
        elif "fever" in complaint.lower() and "103" in complaint.lower():
            red_flags_data["red_flags_detected"] = [
                {
                    "category": "Infectious",
                    "finding": "High grade fever",
                    "urgency": "URGENT",
                    "action": "Blood tests, chest X-ray, empirical treatment"
                }
            ]
    
    return red_flags_data


def seed_real_data(clinic_id: str = "CLINIC_DEMO") -> dict:
    """
    Seed the database with real patient data
    
    Args:
        clinic_id: The clinic ID to seed data for
        
    Returns:
        Dictionary with seeding results
    """
    created_visits = []
    
    # Risk levels distribution
    risk_levels = ["CRITICAL", "HIGH", "MODERATE", "LOW", "LOW", "LOW"]
    
    for idx, patient in enumerate(REAL_PATIENTS):
        risk_level = risk_levels[idx % len(risk_levels)]
        
        visit_id = f"VIS_{uuid.uuid4().hex[:12].upper()}"
        patient_id = f"PAT_{uuid.uuid4().hex[:8].upper()}"
        
        # Generate SOAP note and other data
        soap_note = generate_soap_note(patient, risk_level)
        differential = generate_differential_diagnosis(patient["complaint"], risk_level)
        red_flags = generate_red_flags(patient["complaint"], risk_level)
        
        # Create visit record
        visit_data = {
            'visit_id': visit_id,
            'patient_id': patient_id,
            'patient_name': patient["name"],
            'patient_age': patient["age"],
            'patient_gender': patient["gender"],
            'clinic_id': clinic_id,
            'status': VisitStatus.COMPLETED,
            'language_code': patient["language"],
            'chief_complaint': patient["complaint"],
            'transcript': patient["transcript"],
            'translated_text': patient["translation"],
            'soap_note': soap_note,
            'differential_diagnosis': differential,
            'red_flags': red_flags,
            'risk_level': risk_level,
            'has_red_flags': red_flags["has_red_flags"],
            'audio_duration_seconds': random.uniform(60, 180),
            'processing_time_seconds': random.uniform(8, 15)
        }
        
        try:
            db_client.create_visit(visit_data)
            created_visits.append({
                "visit_id": visit_id,
                "patient_name": patient["name"],
                "risk_level": risk_level,
                "status": "COMPLETED"
            })
            logger.info(f"Created visit: {visit_id} for {patient['name']}")
        except Exception as e:
            logger.error(f"Error creating visit for {patient['name']}: {str(e)}")
    
    return {
        "message": f"Seeded {len(created_visits)} real patient visits",
        "clinic_id": clinic_id,
        "visits": created_visits
    }


def check_and_seed_if_empty(clinic_id: str = "CLINIC_DEMO") -> dict:
    """
    Check if database is empty and seed if needed
    
    Args:
        clinic_id: The clinic ID to check
        
    Returns:
        Dictionary with status
    """
    try:
        visits = db_client.list_clinic_visits(clinic_id, limit=1)
        
        if not visits:
            logger.info("Database is empty, seeding initial data...")
            return seed_real_data(clinic_id)
        else:
            logger.info(f"Database already has {len(visits)} visit(s), skipping seed")
            return {
                "message": "Database already contains data",
                "clinic_id": clinic_id,
                "existing_visits": len(visits)
            }
    except Exception as e:
        logger.error(f"Error checking database: {str(e)}")
        return {
            "message": f"Error: {str(e)}",
            "clinic_id": clinic_id
        }
