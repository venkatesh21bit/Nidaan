"""
Symptom Analyzer Agent - Powered by watsonx.ai
Analyzes patient symptoms and determines urgency level
"""
import logging
from typing import Dict, List, Optional
from datetime import datetime
import json
import re

logger = logging.getLogger(__name__)

class SymptomAnalyzerAgent:
    """
    AI Agent that analyzes patient symptoms using watsonx.ai
    and determines urgency, possible conditions, and recommended actions.
    """
    
    # Symptom severity mappings
    HIGH_URGENCY_SYMPTOMS = [
        'chest pain', 'difficulty breathing', 'shortness of breath',
        'severe bleeding', 'unconscious', 'seizure', 'stroke symptoms',
        'severe allergic reaction', 'anaphylaxis', 'heart attack',
        'severe head injury', 'poisoning', 'overdose'
    ]
    
    MEDIUM_URGENCY_SYMPTOMS = [
        'high fever', 'persistent vomiting', 'severe pain',
        'dehydration', 'moderate bleeding', 'broken bone',
        'severe infection', 'diabetic emergency', 'asthma attack'
    ]
    
    # Symptom to condition mappings for intelligent analysis
    SYMPTOM_CONDITION_MAP = {
        ('fever', 'headache', 'body ache'): {
            'conditions': ['Viral Fever', 'Flu', 'Dengue'],
            'urgency': 'medium',
            'recommended_tests': ['CBC', 'Dengue NS1']
        },
        ('cough', 'fever', 'breathing'): {
            'conditions': ['Respiratory Infection', 'Pneumonia', 'COVID-19'],
            'urgency': 'high',
            'recommended_tests': ['Chest X-ray', 'RT-PCR', 'SpO2']
        },
        ('stomach', 'nausea', 'vomiting'): {
            'conditions': ['Gastritis', 'Food Poisoning', 'Gastroenteritis'],
            'urgency': 'medium',
            'recommended_tests': ['Stool Test', 'Liver Function Test']
        },
        ('headache', 'dizziness', 'nausea'): {
            'conditions': ['Migraine', 'Vertigo', 'Hypertension'],
            'urgency': 'medium',
            'recommended_tests': ['BP Monitoring', 'CT Scan if severe']
        },
        ('chest', 'pain', 'breathless'): {
            'conditions': ['Cardiac Issue', 'Angina', 'Anxiety'],
            'urgency': 'critical',
            'recommended_tests': ['ECG', 'Troponin', 'Echo']
        }
    }
    
    def __init__(self, watsonx_client=None):
        self.watsonx_client = watsonx_client
        self.agent_id = "SYMPTOM_ANALYZER_001"
        self.agent_name = "Dr. Watson Symptom Analyzer"
        
    async def analyze(self, symptoms: List[str], symptom_details: str = "", 
                     severity: str = None, duration: str = None) -> Dict:
        """
        Analyze patient symptoms and return comprehensive assessment
        """
        logger.info(f"[{self.agent_name}] Analyzing symptoms: {symptoms}")
        
        try:
            # Normalize symptoms
            normalized_symptoms = [s.lower().strip() for s in symptoms]
            details_lower = symptom_details.lower() if symptom_details else ""
            
            # Check for critical symptoms
            urgency_level = self._determine_urgency(normalized_symptoms, details_lower)
            
            # Identify possible conditions
            conditions = self._identify_conditions(normalized_symptoms, details_lower)
            
            # Extract severity score
            severity_score = self._extract_severity_score(severity, urgency_level)
            
            # Generate recommendations
            recommendations = self._generate_recommendations(
                urgency_level, conditions, severity_score
            )
            
            # Determine auto-actions
            auto_actions = self._determine_auto_actions(urgency_level, severity_score)
            
            analysis_result = {
                "agent_id": self.agent_id,
                "agent_name": self.agent_name,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "input": {
                    "symptoms": symptoms,
                    "details": symptom_details,
                    "reported_severity": severity,
                    "duration": duration
                },
                "analysis": {
                    "urgency_level": urgency_level,  # critical, high, medium, low
                    "urgency_score": self._urgency_to_score(urgency_level),
                    "severity_score": severity_score,
                    "possible_conditions": conditions,
                    "confidence": self._calculate_confidence(conditions),
                    "requires_immediate_attention": urgency_level in ['critical', 'high']
                },
                "recommendations": recommendations,
                "auto_actions": auto_actions,
                "status": "completed"
            }
            
            logger.info(f"[{self.agent_name}] Analysis complete: urgency={urgency_level}")
            return analysis_result
            
        except Exception as e:
            logger.error(f"[{self.agent_name}] Analysis failed: {str(e)}")
            return {
                "agent_id": self.agent_id,
                "status": "error",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
    
    def _determine_urgency(self, symptoms: List[str], details: str) -> str:
        """Determine urgency level based on symptoms"""
        all_text = " ".join(symptoms) + " " + details
        
        # Check for critical symptoms
        for critical in self.HIGH_URGENCY_SYMPTOMS:
            if critical in all_text:
                return "critical"
        
        # Check for high urgency
        for high in self.MEDIUM_URGENCY_SYMPTOMS:
            if high in all_text:
                return "high"
        
        # Check severity indicators in text
        if any(word in all_text for word in ['severe', 'extreme', 'unbearable', 'worst']):
            return "high"
        
        if any(word in all_text for word in ['moderate', 'significant', 'persistent']):
            return "medium"
        
        return "low"
    
    def _identify_conditions(self, symptoms: List[str], details: str) -> List[Dict]:
        """Identify possible medical conditions"""
        all_text = " ".join(symptoms) + " " + details
        matched_conditions = []
        
        for symptom_tuple, condition_info in self.SYMPTOM_CONDITION_MAP.items():
            match_count = sum(1 for s in symptom_tuple if s in all_text)
            if match_count >= 2:  # At least 2 matching symptoms
                for condition in condition_info['conditions']:
                    matched_conditions.append({
                        "name": condition,
                        "match_score": match_count / len(symptom_tuple),
                        "urgency": condition_info['urgency'],
                        "recommended_tests": condition_info['recommended_tests']
                    })
        
        # Sort by match score
        matched_conditions.sort(key=lambda x: x['match_score'], reverse=True)
        
        # If no specific conditions matched, add general assessment
        if not matched_conditions:
            matched_conditions.append({
                "name": "General Medical Consultation Required",
                "match_score": 0.5,
                "urgency": "low",
                "recommended_tests": ["General Health Checkup"]
            })
        
        return matched_conditions[:5]  # Return top 5
    
    def _extract_severity_score(self, severity: str, urgency: str) -> int:
        """Extract numerical severity score"""
        if severity:
            # Try to extract number from severity string
            match = re.search(r'(\d+)', severity)
            if match:
                return min(int(match.group(1)), 10)
        
        # Default based on urgency
        urgency_defaults = {
            'critical': 10,
            'high': 8,
            'medium': 5,
            'low': 3
        }
        return urgency_defaults.get(urgency, 5)
    
    def _urgency_to_score(self, urgency: str) -> int:
        """Convert urgency level to numerical score"""
        scores = {'critical': 10, 'high': 8, 'medium': 5, 'low': 2}
        return scores.get(urgency, 5)
    
    def _calculate_confidence(self, conditions: List[Dict]) -> float:
        """Calculate confidence score for analysis"""
        if not conditions:
            return 0.3
        return min(conditions[0].get('match_score', 0.5) + 0.3, 0.95)
    
    def _generate_recommendations(self, urgency: str, conditions: List[Dict], 
                                  severity: int) -> List[str]:
        """Generate AI recommendations"""
        recommendations = []
        
        if urgency == 'critical':
            recommendations.append("🚨 URGENT: Seek immediate medical attention")
            recommendations.append("Call emergency services or visit nearest ER")
        elif urgency == 'high':
            recommendations.append("⚠️ Schedule appointment within 24 hours")
            recommendations.append("Monitor symptoms closely")
        elif urgency == 'medium':
            recommendations.append("📅 Schedule appointment within 2-3 days")
        else:
            recommendations.append("📋 Schedule routine appointment at convenience")
        
        # Add condition-specific recommendations
        if conditions:
            tests = conditions[0].get('recommended_tests', [])
            if tests:
                recommendations.append(f"Recommended tests: {', '.join(tests)}")
        
        # Severity-based advice
        if severity >= 7:
            recommendations.append("Rest and stay hydrated")
            recommendations.append("Avoid strenuous activity")
        
        return recommendations
    
    def _determine_auto_actions(self, urgency: str, severity: int) -> List[Dict]:
        """Determine automated actions to take"""
        actions = []
        
        if urgency == 'critical':
            actions.append({
                "action": "ALERT_DOCTOR",
                "priority": "immediate",
                "description": "Alert on-call doctor immediately"
            })
            actions.append({
                "action": "PRIORITY_SCHEDULE",
                "priority": "immediate", 
                "description": "Auto-schedule emergency slot"
            })
        elif urgency == 'high':
            actions.append({
                "action": "PRIORITY_SCHEDULE",
                "priority": "high",
                "description": "Auto-schedule within 24 hours"
            })
            actions.append({
                "action": "NOTIFY_DOCTOR",
                "priority": "high",
                "description": "Notify assigned doctor"
            })
        elif urgency == 'medium':
            actions.append({
                "action": "AUTO_SCHEDULE",
                "priority": "normal",
                "description": "Auto-schedule appointment"
            })
        else:
            actions.append({
                "action": "QUEUE_APPOINTMENT",
                "priority": "low",
                "description": "Add to appointment queue"
            })
        
        # Always add follow-up action
        actions.append({
            "action": "SCHEDULE_FOLLOWUP",
            "priority": "normal",
            "description": "Schedule follow-up reminder"
        })
        
        return actions
