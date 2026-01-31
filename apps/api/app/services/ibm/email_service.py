"""
Email Service for Patient Outreach
Sends personalized pre-consultation surveys to patients via SMTP
"""
import logging
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict, Any, Optional
from datetime import datetime
from jinja2 import Template

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """
    Email service for automated patient outreach
    
    Handles sending personalized pre-consultation surveys
    when a patient books an appointment.
    """
    
    def __init__(self):
        self.smtp_server = settings.SMTP_SERVER
        self.smtp_port = settings.SMTP_PORT
        self.sender_email = settings.SMTP_EMAIL
        self.sender_password = settings.SMTP_PASSWORD
        self.sender_name = "Nidaan AI Medical Assistant"
        
    def _create_ssl_context(self) -> ssl.SSLContext:
        """Create SSL context for secure email sending"""
        context = ssl.create_default_context()
        return context
    
    def _generate_survey_questions(
        self,
        patient_history: Optional[Dict[str, Any]] = None,
        appointment_reason: Optional[str] = None
    ) -> List[Dict[str, str]]:
        """
        Generate personalized survey questions based on patient history
        
        Args:
            patient_history: Previous medical records/visits
            appointment_reason: Reason for current appointment
            
        Returns:
            List of personalized questions
        """
        # Base questions for all patients
        questions = [
            {
                "id": "symptoms",
                "question": "What symptoms are you currently experiencing? Please describe in detail.",
                "type": "text",
                "required": True
            },
            {
                "id": "symptom_duration",
                "question": "How long have you been experiencing these symptoms?",
                "type": "choice",
                "options": ["Less than 24 hours", "1-3 days", "4-7 days", "1-2 weeks", "More than 2 weeks"],
                "required": True
            },
            {
                "id": "pain_level",
                "question": "On a scale of 1-10, how would you rate your pain or discomfort?",
                "type": "scale",
                "min": 1,
                "max": 10,
                "required": True
            },
            {
                "id": "current_medications",
                "question": "Please list all medications you are currently taking (including over-the-counter drugs and supplements).",
                "type": "text",
                "required": True
            },
            {
                "id": "allergies",
                "question": "Do you have any known allergies to medications, foods, or other substances?",
                "type": "text",
                "required": True
            }
        ]
        
        # Add history-based questions
        if patient_history:
            # Check for chronic conditions
            chronic_conditions = patient_history.get("chronic_conditions", [])
            if chronic_conditions:
                conditions_str = ", ".join(chronic_conditions)
                questions.append({
                    "id": "chronic_update",
                    "question": f"We see you have {conditions_str}. Have there been any changes in these conditions recently?",
                    "type": "text",
                    "required": False
                })
            
            # Check previous medications
            prev_medications = patient_history.get("medications", [])
            if prev_medications:
                questions.append({
                    "id": "medication_changes",
                    "question": "Have you started or stopped any medications since your last visit?",
                    "type": "text",
                    "required": False
                })
        
        # Add reason-specific questions
        if appointment_reason:
            reason_lower = appointment_reason.lower()
            
            if any(word in reason_lower for word in ["chest", "heart", "breathing"]):
                questions.extend([
                    {
                        "id": "cardiac_symptoms",
                        "question": "Are you experiencing any chest pain, shortness of breath, or palpitations right now?",
                        "type": "choice",
                        "options": ["Yes - Chest pain", "Yes - Shortness of breath", "Yes - Palpitations", "No"],
                        "required": True,
                        "urgent": True
                    },
                    {
                        "id": "cardiac_history",
                        "question": "Do you have any history of heart disease in your family?",
                        "type": "choice",
                        "options": ["Yes", "No", "Not sure"],
                        "required": False
                    }
                ])
            
            if any(word in reason_lower for word in ["fever", "cold", "flu", "cough"]):
                questions.extend([
                    {
                        "id": "temperature",
                        "question": "What was your last recorded temperature? (if measured)",
                        "type": "text",
                        "required": False
                    },
                    {
                        "id": "covid_contact",
                        "question": "Have you been in contact with anyone diagnosed with COVID-19 or flu in the last 14 days?",
                        "type": "choice",
                        "options": ["Yes", "No", "Not sure"],
                        "required": True
                    }
                ])
            
            if any(word in reason_lower for word in ["stomach", "abdomen", "digest", "nausea", "vomit"]):
                questions.extend([
                    {
                        "id": "gi_symptoms",
                        "question": "Are you experiencing nausea, vomiting, or changes in bowel movements?",
                        "type": "text",
                        "required": True
                    },
                    {
                        "id": "food_recent",
                        "question": "What was the last thing you ate, and when?",
                        "type": "text",
                        "required": False
                    }
                ])
        
        # Emergency question - always last
        questions.append({
            "id": "emergency_check",
            "question": "Are you experiencing any of the following RIGHT NOW: severe chest pain, difficulty breathing, sudden numbness, severe bleeding, or loss of consciousness?",
            "type": "choice",
            "options": ["Yes - CALL EMERGENCY SERVICES", "No"],
            "required": True,
            "urgent": True
        })
        
        return questions
    
    def _create_survey_email_html(
        self,
        patient_name: str,
        doctor_name: str,
        appointment_date: str,
        appointment_time: str,
        survey_link: str,
        questions: List[Dict[str, str]]
    ) -> str:
        """Generate HTML email template for the survey"""
        
        template = Template("""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #1a73e8, #0d47a1);
            color: white;
            padding: 30px;
            border-radius: 10px 10px 0 0;
            text-align: center;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .content {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 0 0 10px 10px;
        }
        .appointment-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #1a73e8;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .appointment-card h3 {
            margin: 0 0 10px 0;
            color: #1a73e8;
        }
        .cta-button {
            display: inline-block;
            background: #1a73e8;
            color: white !important;
            padding: 15px 40px;
            text-decoration: none;
            border-radius: 25px;
            font-weight: bold;
            margin: 20px 0;
            text-align: center;
        }
        .cta-button:hover {
            background: #0d47a1;
        }
        .questions-preview {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .question-item {
            padding: 10px 0;
            border-bottom: 1px solid #eee;
        }
        .question-item:last-child {
            border-bottom: none;
        }
        .urgent-notice {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">🏥 Nidaan AI</div>
        <p>Intelligent Healthcare Assistant</p>
    </div>
    
    <div class="content">
        <h2>Hello {{ patient_name }}! 👋</h2>
        
        <p>Thank you for booking your appointment. To ensure you receive the best possible care, 
        please complete this short pre-consultation survey before your visit.</p>
        
        <div class="appointment-card">
            <h3>📅 Your Appointment Details</h3>
            <p><strong>Doctor:</strong> {{ doctor_name }}</p>
            <p><strong>Date:</strong> {{ appointment_date }}</p>
            <p><strong>Time:</strong> {{ appointment_time }}</p>
        </div>
        
        <div class="urgent-notice">
            <strong>⚠️ Important:</strong> If you are experiencing a medical emergency, 
            please call emergency services immediately or go to the nearest emergency room.
        </div>
        
        <center>
            <a href="{{ survey_link }}" class="cta-button">
                Complete Pre-Visit Survey →
            </a>
        </center>
        
        <div class="questions-preview">
            <h3>📋 What We'll Ask</h3>
            <p>The survey takes about 3-5 minutes and includes:</p>
            {% for q in questions[:5] %}
            <div class="question-item">
                • {{ q.question[:60] }}{% if q.question|length > 60 %}...{% endif %}
            </div>
            {% endfor %}
            {% if questions|length > 5 %}
            <p><em>...and {{ questions|length - 5 }} more questions</em></p>
            {% endif %}
        </div>
        
        <p>Your responses help us:</p>
        <ul>
            <li>✅ Prepare your medical records before the visit</li>
            <li>✅ Identify any urgent concerns early</li>
            <li>✅ Make your consultation more efficient</li>
        </ul>
        
        <p>Thank you for helping us provide you with the best care!</p>
        
        <p>Warm regards,<br>
        <strong>The Nidaan AI Team</strong></p>
    </div>
    
    <div class="footer">
        <p>This email was sent by Nidaan AI Medical Assistant.</p>
        <p>If you did not book this appointment, please contact us immediately.</p>
        <p>© 2024 Nidaan AI Healthcare. All rights reserved.</p>
    </div>
</body>
</html>
        """)
        
        return template.render(
            patient_name=patient_name,
            doctor_name=doctor_name,
            appointment_date=appointment_date,
            appointment_time=appointment_time,
            survey_link=survey_link,
            questions=questions
        )
    
    def _create_survey_email_text(
        self,
        patient_name: str,
        doctor_name: str,
        appointment_date: str,
        appointment_time: str,
        survey_link: str
    ) -> str:
        """Generate plain text version of the survey email"""
        return f"""
Hello {patient_name}!

Thank you for booking your appointment with Nidaan AI Healthcare.

APPOINTMENT DETAILS:
- Doctor: {doctor_name}
- Date: {appointment_date}
- Time: {appointment_time}

Please complete your pre-consultation survey before your visit:
{survey_link}

This survey helps us:
- Prepare your medical records before the visit
- Identify any urgent concerns early
- Make your consultation more efficient

IMPORTANT: If you are experiencing a medical emergency, please call emergency 
services immediately or go to the nearest emergency room.

Thank you for helping us provide you with the best care!

Warm regards,
The Nidaan AI Team

---
This email was sent by Nidaan AI Medical Assistant.
If you did not book this appointment, please contact us immediately.
        """
    
    async def send_pre_consultation_survey(
        self,
        patient_email: str,
        patient_name: str,
        doctor_name: str,
        appointment_date: str,
        appointment_time: str,
        survey_id: str,
        patient_history: Optional[Dict[str, Any]] = None,
        appointment_reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send a personalized pre-consultation survey email to a patient
        
        Args:
            patient_email: Patient's email address
            patient_name: Patient's full name
            doctor_name: Assigned doctor's name
            appointment_date: Date of appointment
            appointment_time: Time of appointment
            survey_id: Unique survey identifier
            patient_history: Previous medical history for personalization
            appointment_reason: Reason for the appointment
            
        Returns:
            Dictionary with send status and details
        """
        try:
            # Generate personalized questions
            questions = self._generate_survey_questions(
                patient_history=patient_history,
                appointment_reason=appointment_reason
            )
            
            # Create survey link
            survey_link = f"{settings.APP_BASE_URL}/patient/survey/{survey_id}"
            
            # Create email message
            message = MIMEMultipart("alternative")
            message["Subject"] = f"📋 Pre-Visit Survey for Your Appointment on {appointment_date} - Nidaan AI"
            message["From"] = f"{self.sender_name} <{self.sender_email}>"
            message["To"] = patient_email
            
            # Create email content
            text_content = self._create_survey_email_text(
                patient_name=patient_name,
                doctor_name=doctor_name,
                appointment_date=appointment_date,
                appointment_time=appointment_time,
                survey_link=survey_link
            )
            
            html_content = self._create_survey_email_html(
                patient_name=patient_name,
                doctor_name=doctor_name,
                appointment_date=appointment_date,
                appointment_time=appointment_time,
                survey_link=survey_link,
                questions=questions
            )
            
            # Attach both versions
            part1 = MIMEText(text_content, "plain")
            part2 = MIMEText(html_content, "html")
            message.attach(part1)
            message.attach(part2)
            
            # Send email
            context = self._create_ssl_context()
            
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.ehlo()
                server.starttls(context=context)
                server.ehlo()
                server.login(self.sender_email, self.sender_password)
                server.sendmail(
                    self.sender_email,
                    patient_email,
                    message.as_string()
                )
            
            logger.info(f"Survey email sent successfully to {patient_email}")
            
            return {
                "success": True,
                "survey_id": survey_id,
                "recipient": patient_email,
                "sent_at": datetime.utcnow().isoformat(),
                "questions": questions,
                "survey_link": survey_link
            }
            
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP Authentication failed: {e}")
            return {
                "success": False,
                "error": "Email authentication failed",
                "details": str(e)
            }
        except smtplib.SMTPException as e:
            logger.error(f"SMTP error: {e}")
            return {
                "success": False,
                "error": "Failed to send email",
                "details": str(e)
            }
        except Exception as e:
            logger.error(f"Unexpected error sending email: {e}")
            return {
                "success": False,
                "error": "Unexpected error",
                "details": str(e)
            }
    
    async def send_nurse_alert(
        self,
        nurse_email: str,
        patient_name: str,
        patient_id: str,
        red_flags: List[str],
        severity_score: str,
        triage_case_id: str
    ) -> Dict[str, Any]:
        """
        Send urgent alert to nurse station for red flag cases
        
        Args:
            nurse_email: Nurse station email
            patient_name: Patient's name
            patient_id: Patient identifier
            red_flags: List of detected red flag symptoms
            severity_score: Calculated severity (HIGH/MEDIUM/LOW)
            triage_case_id: Reference to the triage case
        """
        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = f"🚨 URGENT: Red Flag Alert - Patient {patient_name}"
            message["From"] = f"{self.sender_name} <{self.sender_email}>"
            message["To"] = nurse_email
            message["X-Priority"] = "1"  # High priority
            
            red_flags_html = "".join([f"<li style='color: #d32f2f;'>{flag}</li>" for flag in red_flags])
            
            html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        .alert-box {{
            background: #ffebee;
            border: 2px solid #d32f2f;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
        }}
        .severity-high {{
            background: #d32f2f;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
        }}
    </style>
</head>
<body>
    <div class="alert-box">
        <h1 style="color: #d32f2f;">🚨 URGENT PATIENT ALERT</h1>
        
        <p><strong>Patient:</strong> {patient_name}</p>
        <p><strong>Patient ID:</strong> {patient_id}</p>
        <p><strong>Severity:</strong> <span class="severity-high">{severity_score}</span></p>
        <p><strong>Case ID:</strong> {triage_case_id}</p>
        
        <h3>🔴 Red Flag Symptoms Detected:</h3>
        <ul>
            {red_flags_html}
        </ul>
        
        <p style="font-size: 18px; font-weight: bold; color: #d32f2f;">
            IMMEDIATE ATTENTION REQUIRED
        </p>
        
        <p>Please review this case immediately in the Nidaan dashboard or contact the patient.</p>
        
        <a href="{settings.APP_BASE_URL}/nurse/case/{triage_case_id}" 
           style="background: #d32f2f; color: white; padding: 15px 30px; 
                  text-decoration: none; border-radius: 5px; display: inline-block;">
            View Case Details →
        </a>
    </div>
    
    <p style="color: #666; font-size: 12px;">
        This is an automated alert from Nidaan AI Triage System.
        Generated at: {datetime.utcnow().isoformat()}
    </p>
</body>
</html>
            """
            
            text_content = f"""
🚨 URGENT PATIENT ALERT

Patient: {patient_name}
Patient ID: {patient_id}
Severity: {severity_score}
Case ID: {triage_case_id}

RED FLAG SYMPTOMS DETECTED:
{chr(10).join(['- ' + flag for flag in red_flags])}

IMMEDIATE ATTENTION REQUIRED

Please review this case immediately in the Nidaan dashboard.
View case: {settings.APP_BASE_URL}/nurse/case/{triage_case_id}

---
Automated alert from Nidaan AI Triage System
Generated at: {datetime.utcnow().isoformat()}
            """
            
            message.attach(MIMEText(text_content, "plain"))
            message.attach(MIMEText(html_content, "html"))
            
            context = self._create_ssl_context()
            
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.ehlo()
                server.starttls(context=context)
                server.ehlo()
                server.login(self.sender_email, self.sender_password)
                server.sendmail(
                    self.sender_email,
                    nurse_email,
                    message.as_string()
                )
            
            logger.warning(f"NURSE ALERT sent for patient {patient_id} - Red flags: {red_flags}")
            
            return {
                "success": True,
                "alert_type": "nurse_red_flag",
                "patient_id": patient_id,
                "sent_to": nurse_email,
                "sent_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to send nurse alert: {e}")
            return {
                "success": False,
                "error": str(e)
            }


# Singleton instance
email_service = EmailService()
