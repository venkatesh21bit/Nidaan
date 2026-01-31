"""
IBM Watson Speech to Text Service
Converts patient audio recordings to text for processing
"""
import logging
import io
from typing import Optional, Dict, Any, List
from ibm_watson import SpeechToTextV1
from ibm_watson.speech_to_text_v1 import RecognitionJob
from ibm_cloud_sdk_core.authenticators import IAMAuthenticator
from ibm_cloud_sdk_core import ApiException

from app.core.config import settings

logger = logging.getLogger(__name__)


class IBMSpeechToText:
    """
    IBM Watson Speech to Text Service for Nidaan Voice Triage
    
    Converts patient audio recordings to text for NLU processing.
    Supports multiple languages including Indian languages.
    """
    
    # Supported language models
    LANGUAGE_MODELS = {
        "en-IN": "en-IN_Telephony",        # Indian English
        "en-US": "en-US_Multimedia",        # US English
        "hi-IN": "hi-IN_Telephony",         # Hindi
        "ta-IN": "ta-IN_Telephony",         # Tamil (if available)
        "auto": "en-IN_Telephony"           # Default to Indian English
    }
    
    def __init__(self):
        self.client: Optional[SpeechToTextV1] = None
        self._initialized = False
        
    async def initialize(self):
        """Initialize IBM Watson Speech to Text client"""
        if self._initialized:
            return
            
        try:
            authenticator = IAMAuthenticator(settings.IBM_STT_API_KEY)
            
            self.client = SpeechToTextV1(authenticator=authenticator)
            self.client.set_service_url(settings.IBM_STT_URL)
            
            self._initialized = True
            logger.info("IBM Watson Speech to Text initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Speech to Text: {e}")
            raise
    
    async def transcribe_audio(
        self,
        audio_data: bytes,
        content_type: str = "audio/webm",
        language: str = "en-IN",
        include_timestamps: bool = False,
        include_word_confidence: bool = False,
        smart_formatting: bool = True,
        profanity_filter: bool = True
    ) -> Dict[str, Any]:
        """
        Transcribe audio data to text
        
        Args:
            audio_data: Raw audio bytes
            content_type: MIME type of audio (audio/webm, audio/wav, audio/mp3, etc.)
            language: Language code (en-IN, hi-IN, etc.)
            include_timestamps: Include word-level timestamps
            include_word_confidence: Include confidence scores per word
            smart_formatting: Apply smart formatting (numbers, dates, etc.)
            profanity_filter: Filter profanity
            
        Returns:
            Dictionary with transcript and metadata
        """
        if not self._initialized:
            await self.initialize()
        
        try:
            # Get appropriate language model
            model = self.LANGUAGE_MODELS.get(language, self.LANGUAGE_MODELS["auto"])
            
            # Create audio stream
            audio_stream = io.BytesIO(audio_data)
            
            # Call Watson STT
            response = self.client.recognize(
                audio=audio_stream,
                content_type=content_type,
                model=model,
                timestamps=include_timestamps,
                word_confidence=include_word_confidence,
                smart_formatting=smart_formatting,
                profanity_filter=profanity_filter,
                speaker_labels=False,
                inactivity_timeout=30,
                interim_results=False
            ).get_result()
            
            # Process results
            transcripts = []
            full_transcript = ""
            confidence_scores = []
            timestamps = []
            
            for result in response.get("results", []):
                for alternative in result.get("alternatives", []):
                    transcript = alternative.get("transcript", "")
                    confidence = alternative.get("confidence", 0)
                    
                    transcripts.append(transcript)
                    confidence_scores.append(confidence)
                    full_transcript += transcript + " "
                    
                    # Collect timestamps if requested
                    if include_timestamps and "timestamps" in alternative:
                        timestamps.extend(alternative["timestamps"])
                    
                    # Collect word confidence if requested
                    if include_word_confidence and "word_confidence" in alternative:
                        for word_conf in alternative["word_confidence"]:
                            timestamps.append({
                                "word": word_conf[0],
                                "confidence": word_conf[1]
                            })
            
            # Calculate average confidence
            avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0
            
            logger.info(f"Transcription complete. Length: {len(full_transcript)} chars, Confidence: {avg_confidence:.2f}")
            
            return {
                "success": True,
                "transcript": full_transcript.strip(),
                "segments": transcripts,
                "confidence": avg_confidence,
                "language": language,
                "model_used": model,
                "timestamps": timestamps if include_timestamps else None,
                "audio_metrics": {
                    "duration_seconds": response.get("processing_metrics", {}).get("processed_audio", {}).get("received", 0)
                }
            }
            
        except ApiException as e:
            logger.error(f"Speech to Text API error: {e}")
            return {
                "success": False,
                "error": str(e),
                "error_code": e.code
            }
        except Exception as e:
            logger.error(f"Unexpected error in transcription: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def transcribe_from_url(
        self,
        audio_url: str,
        language: str = "en-IN"
    ) -> Dict[str, Any]:
        """
        Transcribe audio from a URL (e.g., S3 presigned URL)
        
        Args:
            audio_url: URL to the audio file
            language: Language code
            
        Returns:
            Dictionary with transcript and metadata
        """
        import httpx
        
        try:
            # Download audio from URL
            async with httpx.AsyncClient() as client:
                response = await client.get(audio_url)
                response.raise_for_status()
                audio_data = response.content
                content_type = response.headers.get("content-type", "audio/webm")
            
            return await self.transcribe_audio(
                audio_data=audio_data,
                content_type=content_type,
                language=language
            )
            
        except httpx.HTTPError as e:
            logger.error(f"Failed to download audio: {e}")
            return {
                "success": False,
                "error": f"Failed to download audio: {str(e)}"
            }
    
    async def create_async_recognition_job(
        self,
        audio_data: bytes,
        content_type: str = "audio/webm",
        language: str = "en-IN",
        callback_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create an asynchronous recognition job for longer audio
        
        Args:
            audio_data: Raw audio bytes
            content_type: MIME type
            language: Language code
            callback_url: Optional URL to receive results
            
        Returns:
            Job information including job ID
        """
        if not self._initialized:
            await self.initialize()
        
        try:
            model = self.LANGUAGE_MODELS.get(language, self.LANGUAGE_MODELS["auto"])
            audio_stream = io.BytesIO(audio_data)
            
            response = self.client.create_job(
                audio=audio_stream,
                content_type=content_type,
                model=model,
                callback_url=callback_url,
                events="recognitions.started,recognitions.completed,recognitions.failed"
            ).get_result()
            
            return {
                "success": True,
                "job_id": response.get("id"),
                "status": response.get("status"),
                "created": response.get("created")
            }
            
        except ApiException as e:
            logger.error(f"Failed to create async job: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """Check status of an async recognition job"""
        if not self._initialized:
            await self.initialize()
        
        try:
            response = self.client.check_job(id=job_id).get_result()
            
            result = {
                "job_id": job_id,
                "status": response.get("status"),
                "created": response.get("created"),
                "updated": response.get("updated")
            }
            
            # Include results if job is completed
            if response.get("status") == "completed":
                results = response.get("results", [])
                if results:
                    transcripts = []
                    for r in results:
                        for res in r.get("results", []):
                            for alt in res.get("alternatives", []):
                                transcripts.append(alt.get("transcript", ""))
                    result["transcript"] = " ".join(transcripts)
            
            return result
            
        except ApiException as e:
            logger.error(f"Failed to check job status: {e}")
            return {
                "job_id": job_id,
                "status": "error",
                "error": str(e)
            }
    
    def get_supported_languages(self) -> List[Dict[str, str]]:
        """Get list of supported languages"""
        return [
            {"code": "en-IN", "name": "English (India)", "model": "en-IN_Telephony"},
            {"code": "en-US", "name": "English (US)", "model": "en-US_Multimedia"},
            {"code": "hi-IN", "name": "Hindi", "model": "hi-IN_Telephony"},
        ]


# Singleton instance
ibm_speech_to_text = IBMSpeechToText()
