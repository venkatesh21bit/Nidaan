"""
Speech Transcription Service
Handles AWS Transcribe operations for audio-to-text conversion
"""
import asyncio
import boto3
import time
import logging
from typing import Dict, Optional
from app.core.config import settings
from app.core.exceptions import TranscriptionException

logger = logging.getLogger(__name__)


class SpeechService:
    """Service for transcribing audio using AWS Transcribe"""
    
    def __init__(self):
        """Initialize AWS Transcribe client"""
        client_config = {
            'region_name': settings.AWS_REGION
        }
        
        # Use mock mode if in development OR if AWS credentials are not configured
        # This allows demo mode in production without real S3/Transcribe
        if settings.ENV == 'development' or not settings.AWS_ACCESS_KEY_ID:
            self.mock_mode = True
            logger.info("SpeechService initialized in mock mode (demo)")
        else:
            self.mock_mode = False
            self.transcribe_client = boto3.client('transcribe', **client_config)
            logger.info("SpeechService initialized with AWS Transcribe")
    
    async def transcribe_audio(
        self,
        audio_s3_uri: str,
        language_code: str = "hi-IN",
        job_name: Optional[str] = None
    ) -> Dict[str, any]:
        """
        Transcribe audio file from S3
        
        Args:
            audio_s3_uri: S3 URI of the audio file (s3://bucket/key)
            language_code: Language code (hi-IN for Hindi, ta-IN for Tamil, etc.)
            job_name: Optional custom job name
            
        Returns:
            Dictionary containing transcript and metadata
        """
        if self.mock_mode:
            return await self._mock_transcription(audio_s3_uri, language_code)
        
        try:
            # Generate unique job name if not provided
            if not job_name:
                job_name = f"transcribe_{int(time.time())}"
            
            # Start transcription job
            self.transcribe_client.start_transcription_job(
                TranscriptionJobName=job_name,
                Media={'MediaFileUri': audio_s3_uri},
                MediaFormat='webm',  # or 'wav', 'mp3', 'opus'
                LanguageCode=language_code,
                Settings={
                    'ShowSpeakerLabels': False,
                    'ChannelIdentification': False
                }
            )
            
            logger.info(f"Started transcription job: {job_name}")
            
            # Wait for job to complete
            max_tries = 60  # 5 minutes max
            while max_tries > 0:
                max_tries -= 1
                
                job = self.transcribe_client.get_transcription_job(
                    TranscriptionJobName=job_name
                )
                
                status = job['TranscriptionJob']['TranscriptionJobStatus']
                
                if status == 'COMPLETED':
                    transcript_uri = job['TranscriptionJob']['Transcript']['TranscriptFileUri']
                    
                    # Download and parse transcript
                    import httpx
                    async with httpx.AsyncClient() as client:
                        response = await client.get(transcript_uri)
                        transcript_data = response.json()
                    
                    transcript_text = transcript_data['results']['transcripts'][0]['transcript']
                    
                    # Clean up job
                    self.transcribe_client.delete_transcription_job(
                        TranscriptionJobName=job_name
                    )
                    
                    return {
                        'transcript': transcript_text,
                        'language_code': language_code,
                        'confidence': self._extract_confidence(transcript_data),
                        'duration': transcript_data.get('results', {}).get('audio_segments', [{}])[0].get('end_time', 0)
                    }
                
                elif status == 'FAILED':
                    failure_reason = job['TranscriptionJob'].get('FailureReason', 'Unknown')
                    raise TranscriptionException(
                        message=f"Transcription failed: {failure_reason}",
                        details={"job_name": job_name}
                    )
                
                # Wait before checking again
                await asyncio.sleep(5)
            
            raise TranscriptionException(
                message="Transcription timeout",
                details={"job_name": job_name}
            )
            
        except Exception as e:
            logger.error(f"Transcription error: {str(e)}")
            raise TranscriptionException(
                message=f"Transcription failed: {str(e)}",
                details={"audio_uri": audio_s3_uri}
            )
    
    def _extract_confidence(self, transcript_data: Dict) -> float:
        """Extract average confidence score from transcript"""
        items = transcript_data.get('results', {}).get('items', [])
        if not items:
            return 0.0
        
        confidences = [
            float(item.get('alternatives', [{}])[0].get('confidence', 0))
            for item in items
            if 'confidence' in item.get('alternatives', [{}])[0]
        ]
        
        return sum(confidences) / len(confidences) if confidences else 0.0
    
    async def _mock_transcription(self, audio_uri: str, language_code: str) -> Dict:
        """Mock transcription for development"""
        # Simulate processing time
        await asyncio.sleep(2)
        
        mock_transcripts = {
            "hi-IN": "मुझे सीने में दर्द हो रहा है जो बाएं हाथ में फैल रहा है। यह सुबह से शुरू हुआ और सांस लेने में भी तकलीफ हो रही है।",
            "ta-IN": "எனக்கு மார்பில் வலி இருக்கிறது, அது இடது கையில் பரவுகிறது। இது காலையில் தொடங்கியது மற்றும் மூச்சு விடுவதில் சிரமம் உள்ளது.",
            "en-IN": "I have chest pain radiating to my left arm. It started this morning and I'm having difficulty breathing."
        }
        
        return {
            'transcript': mock_transcripts.get(language_code, mock_transcripts["hi-IN"]),
            'language_code': language_code,
            'confidence': 0.95,
            'duration': 15.5
        }
    
    def detect_language(self, audio_s3_uri: str) -> str:
        """
        Detect the language of audio (placeholder for AWS Transcribe language identification)
        
        Args:
            audio_s3_uri: S3 URI of audio file
            
        Returns:
            Detected language code
        """
        # In production, use AWS Transcribe's automatic language identification
        # For now, return default
        return "hi-IN"


# Global instance
speech_service = SpeechService()
