"""
Email notification service for Nidaan
Sends automated emails for appointment confirmations, reminders, etc.
"""
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, List
from datetime import datetime
import os

logger = logging.getLogger(__name__)

# Email configuration - can be set via environment variables
EMAIL_CONFIG = {
    "smtp_server": os.getenv("SMTP_SERVER", "smtp.gmail.com"),
    "smtp_port": int(os.getenv("SMTP_PORT", "587")),
    "smtp_username": os.getenv("SMTP_USERNAME", ""),
    "smtp_password": os.getenv("SMTP_PASSWORD", ""),
    "from_email": os.getenv("FROM_EMAIL", "noreply@nidaan.ai"),
    "from_name": os.getenv("FROM_NAME", "Nidaan.ai Health Assistant"),
}


class EmailService:
    """Service for sending email notifications"""
    
    def __init__(self):
        self.configured = bool(EMAIL_CONFIG["smtp_username"] and EMAIL_CONFIG["smtp_password"])
        if not self.configured:
            logger.warning("Email service not configured - SMTP credentials missing")
    
    async def send_appointment_confirmation(
        self,
        patient_email: str,
        patient_name: str,
        appointment_data: Dict
    ) -> Dict:
        """
        Send appointment confirmation email to patient
        """
        try:
            subject = f"🏥 Appointment Confirmed - Nidaan.ai"
            
            # Build HTML email body
            html_body = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }}
                    .appointment-box {{ background: white; border-radius: 10px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
                    .detail-row {{ display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }}
                    .detail-label {{ color: #64748b; font-weight: 500; }}
                    .detail-value {{ color: #1e293b; font-weight: 600; }}
                    .status-badge {{ display: inline-block; background: #10b981; color: white; padding: 5px 15px; border-radius: 20px; font-size: 14px; }}
                    .ai-badge {{ display: inline-block; background: #8b5cf6; color: white; padding: 3px 10px; border-radius: 12px; font-size: 12px; }}
                    .urgent-badge {{ display: inline-block; background: #ef4444; color: white; padding: 3px 10px; border-radius: 12px; font-size: 12px; }}
                    .symptoms-list {{ background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0; }}
                    .recommendations {{ background: #ecfdf5; padding: 15px; border-radius: 8px; margin: 15px 0; }}
                    .footer {{ text-align: center; padding: 20px; color: #64748b; font-size: 12px; }}
                    h1, h2, h3 {{ margin: 0; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🏥 Nidaan.ai</h1>
                        <p>AI Health Assistant</p>
                        <span class="status-badge">✓ Appointment Confirmed</span>
                    </div>
                    
                    <div class="content">
                        <h2>Hello {patient_name}!</h2>
                        <p>Your appointment has been confirmed. Here are your appointment details:</p>
                        
                        <div class="appointment-box">
                            <div class="detail-row">
                                <span class="detail-label">📋 Appointment ID</span>
                                <span class="detail-value">{appointment_data.get('id', 'N/A')}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">📅 Date</span>
                                <span class="detail-value">{appointment_data.get('scheduled_date', 'TBD')}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">⏰ Time</span>
                                <span class="detail-value">{appointment_data.get('scheduled_time', 'TBD')}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">👨‍⚕️ Doctor</span>
                                <span class="detail-value">{appointment_data.get('doctor_name', 'TBD')}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">🏥 Department</span>
                                <span class="detail-value">{appointment_data.get('ai_department', 'General Medicine').title()}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">⚡ Urgency</span>
                                <span class="detail-value">
                                    <span class="{'urgent-badge' if appointment_data.get('ai_urgency') == 'critical' else 'ai-badge'}">
                                        {appointment_data.get('ai_urgency', 'Normal').upper()}
                                    </span>
                                </span>
                            </div>
                        </div>
                        
                        <div class="symptoms-list">
                            <h3>📝 Recorded Symptoms</h3>
                            <ul>
                                {''.join([f'<li>{s}</li>' for s in appointment_data.get('symptoms', [])])}
                            </ul>
                            <p><strong>Details:</strong> {appointment_data.get('symptom_details', 'N/A')}</p>
                        </div>
                        
                        {self._build_recommendations_section(appointment_data)}
                        
                        <div class="appointment-box">
                            <h3>🤖 AI Processing Complete</h3>
                            <p>Your appointment was automatically processed by our AI agents:</p>
                            <ul>
                                <li>✓ Symptoms analyzed</li>
                                <li>✓ Urgency assessed: <strong>{appointment_data.get('ai_urgency', 'N/A').title()}</strong></li>
                                <li>✓ Doctor assigned automatically</li>
                                <li>✓ Care level: <strong>Level {appointment_data.get('ai_care_level', 'N/A')}</strong></li>
                            </ul>
                        </div>
                        
                        <p><strong>Important:</strong> Please arrive 15 minutes before your scheduled time. Bring any relevant medical documents or test reports.</p>
                        
                        <p>If you need to reschedule or cancel, please contact us at least 24 hours in advance.</p>
                    </div>
                    
                    <div class="footer">
                        <p>This email was sent by Nidaan.ai - Your AI Health Assistant</p>
                        <p>Powered by watsonx.ai | © 2026 Nidaan Healthcare</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Plain text version
            text_body = f"""
            Appointment Confirmed - Nidaan.ai
            
            Hello {patient_name}!
            
            Your appointment has been confirmed.
            
            APPOINTMENT DETAILS:
            - ID: {appointment_data.get('id', 'N/A')}
            - Date: {appointment_data.get('scheduled_date', 'TBD')}
            - Time: {appointment_data.get('scheduled_time', 'TBD')}
            - Doctor: {appointment_data.get('doctor_name', 'TBD')}
            - Department: {appointment_data.get('ai_department', 'General Medicine')}
            - Urgency: {appointment_data.get('ai_urgency', 'Normal').upper()}
            
            SYMPTOMS RECORDED:
            {', '.join(appointment_data.get('symptoms', []))}
            Details: {appointment_data.get('symptom_details', 'N/A')}
            
            AI PROCESSING:
            - Urgency Level: {appointment_data.get('ai_urgency', 'N/A')}
            - Care Level: {appointment_data.get('ai_care_level', 'N/A')}
            - Possible Conditions: {', '.join(appointment_data.get('ai_conditions', []))}
            
            Please arrive 15 minutes before your scheduled time.
            
            --
            Nidaan.ai - Your AI Health Assistant
            Powered by watsonx.ai
            """
            
            # Send email or simulate
            result = await self._send_email(
                to_email=patient_email,
                subject=subject,
                html_body=html_body,
                text_body=text_body
            )
            
            return {
                "status": "sent" if result else "simulated",
                "to": patient_email,
                "subject": subject,
                "appointment_id": appointment_data.get('id'),
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
            
        except Exception as e:
            logger.error(f"Error sending confirmation email: {str(e)}")
            return {
                "status": "error",
                "error": str(e),
                "to": patient_email
            }
    
    def _build_recommendations_section(self, appointment_data: Dict) -> str:
        """Build HTML for recommendations section"""
        recommendations = appointment_data.get('ai_recommendations', [])
        if not recommendations:
            return ""
        
        items = ''.join([f'<li>{r}</li>' for r in recommendations])
        return f"""
        <div class="recommendations">
            <h3>💡 AI Recommendations</h3>
            <ul>{items}</ul>
        </div>
        """
    
    async def send_doctor_notification(
        self,
        doctor_email: str,
        doctor_name: str,
        appointment_data: Dict
    ) -> Dict:
        """
        Send notification to doctor about new appointment
        """
        try:
            urgency = appointment_data.get('ai_urgency', 'normal')
            is_urgent = urgency in ['critical', 'high']
            
            subject = f"{'⚠️ URGENT: ' if is_urgent else ''}New Patient Appointment - {appointment_data.get('patient_name', 'Patient')}"
            
            html_body = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .urgent {{ background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0; }}
                    .normal {{ background: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin: 15px 0; }}
                    .detail {{ margin: 10px 0; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>{'⚠️ Urgent ' if is_urgent else ''}New Patient Appointment</h2>
                    
                    <div class="{'urgent' if is_urgent else 'normal'}">
                        <strong>Patient:</strong> {appointment_data.get('patient_name', 'N/A')}<br>
                        <strong>Urgency:</strong> {urgency.upper()}<br>
                        <strong>Care Level:</strong> {appointment_data.get('ai_care_level', 'N/A')}
                    </div>
                    
                    <div class="detail">
                        <strong>Date/Time:</strong> {appointment_data.get('scheduled_date', 'TBD')} at {appointment_data.get('scheduled_time', 'TBD')}
                    </div>
                    
                    <div class="detail">
                        <strong>Symptoms:</strong> {', '.join(appointment_data.get('symptoms', []))}
                    </div>
                    
                    <div class="detail">
                        <strong>Details:</strong> {appointment_data.get('symptom_details', 'N/A')}
                    </div>
                    
                    <div class="detail">
                        <strong>AI-Detected Conditions:</strong> {', '.join(appointment_data.get('ai_conditions', []))}
                    </div>
                    
                    <p>Please review the patient's information before the appointment.</p>
                </div>
            </body>
            </html>
            """
            
            text_body = f"""
            New Patient Appointment
            
            Patient: {appointment_data.get('patient_name', 'N/A')}
            Urgency: {urgency.upper()}
            Date/Time: {appointment_data.get('scheduled_date', 'TBD')} at {appointment_data.get('scheduled_time', 'TBD')}
            Symptoms: {', '.join(appointment_data.get('symptoms', []))}
            AI Conditions: {', '.join(appointment_data.get('ai_conditions', []))}
            """
            
            result = await self._send_email(
                to_email=doctor_email,
                subject=subject,
                html_body=html_body,
                text_body=text_body
            )
            
            return {
                "status": "sent" if result else "simulated",
                "to": doctor_email,
                "subject": subject,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
            
        except Exception as e:
            logger.error(f"Error sending doctor notification: {str(e)}")
            return {"status": "error", "error": str(e)}
    
    async def _send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: str
    ) -> bool:
        """
        Actually send the email via SMTP
        Returns True if sent, False if simulated (no SMTP configured)
        """
        if not self.configured:
            # Simulate sending - log the email details
            logger.info(f"[SIMULATED EMAIL] To: {to_email}, Subject: {subject}")
            logger.info(f"[SIMULATED EMAIL] Body preview: {text_body[:200]}...")
            return False
        
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{EMAIL_CONFIG['from_name']} <{EMAIL_CONFIG['from_email']}>"
            msg['To'] = to_email
            
            # Attach both text and HTML versions
            part1 = MIMEText(text_body, 'plain')
            part2 = MIMEText(html_body, 'html')
            msg.attach(part1)
            msg.attach(part2)
            
            # Connect and send
            with smtplib.SMTP(EMAIL_CONFIG['smtp_server'], EMAIL_CONFIG['smtp_port']) as server:
                server.starttls()
                server.login(EMAIL_CONFIG['smtp_username'], EMAIL_CONFIG['smtp_password'])
                server.sendmail(EMAIL_CONFIG['from_email'], to_email, msg.as_string())
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"SMTP error: {str(e)}")
            raise


# Singleton instance
_email_service: Optional[EmailService] = None

def get_email_service() -> EmailService:
    """Get or create email service instance"""
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service
