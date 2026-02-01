"""
Storage Service
Handles S3 operations for audio file storage
"""
import boto3
from botocore.exceptions import ClientError
from typing import Optional, Dict
import logging
from app.core.config import settings
from app.core.exceptions import StorageException

logger = logging.getLogger(__name__)


class S3StorageService:
    """Service for managing audio files in S3"""
    
    def __init__(self):
        """Initialize S3 client"""
        client_config = {
            'region_name': settings.AWS_REGION
        }
        
        # For local development with LocalStack
        if settings.S3_ENDPOINT_URL:
            client_config['endpoint_url'] = settings.S3_ENDPOINT_URL
            client_config['aws_access_key_id'] = 'test'
            client_config['aws_secret_access_key'] = 'test'
        
        self.s3_client = boto3.client('s3', **client_config)
        self.bucket_name = settings.S3_BUCKET_NAME
        
        # Ensure bucket exists
        self._ensure_bucket_exists()
    
    def _ensure_bucket_exists(self):
        """Create bucket if it doesn't exist"""
        try:
            self.s3_client.head_bucket(Bucket=self.bucket_name)
            logger.info(f"Bucket {self.bucket_name} exists")
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == '404':
                try:
                    if settings.AWS_REGION == 'us-east-1':
                        self.s3_client.create_bucket(Bucket=self.bucket_name)
                    else:
                        self.s3_client.create_bucket(
                            Bucket=self.bucket_name,
                            CreateBucketConfiguration={'LocationConstraint': settings.AWS_REGION}
                        )
                    logger.info(f"Created bucket {self.bucket_name}")
                except Exception as create_error:
                    logger.error(f"Error creating bucket: {str(create_error)}")
    
    def generate_presigned_url(
        self,
        object_key: str,
        expiration: int = None,
        operation: str = 'put_object'
    ) -> str:
        """
        Generate a presigned URL for uploading or downloading audio files
        
        Args:
            object_key: S3 object key (path)
            expiration: URL expiration time in seconds
            operation: 'put_object' for upload, 'get_object' for download
            
        Returns:
            Presigned URL string
        """
        try:
            expiration = expiration or settings.S3_PRESIGNED_URL_EXPIRATION
            
            url = self.s3_client.generate_presigned_url(
                ClientMethod=operation,
                Params={
                    'Bucket': self.bucket_name,
                    'Key': object_key
                },
                ExpiresIn=expiration
            )
            
            logger.info(f"Generated presigned URL for {object_key}")
            return url
            
        except ClientError as e:
            logger.error(f"Error generating presigned URL: {str(e)}")
            raise StorageException(
                message="Failed to generate upload URL",
                details={"object_key": object_key, "error": str(e)}
            )
    
    def upload_file(self, file_obj, object_key: str, content_type: str = 'audio/webm') -> str:
        """
        Upload a file to S3
        
        Args:
            file_obj: File object to upload
            object_key: S3 object key
            content_type: MIME type of the file
            
        Returns:
            S3 object key
        """
        try:
            self.s3_client.upload_fileobj(
                file_obj,
                self.bucket_name,
                object_key,
                ExtraArgs={
                    'ContentType': content_type,
                    'ServerSideEncryption': 'AES256'
                }
            )
            
            logger.info(f"Uploaded file to {object_key}")
            return object_key
            
        except ClientError as e:
            logger.error(f"Error uploading file: {str(e)}")
            raise StorageException(
                message="Failed to upload audio file",
                details={"object_key": object_key, "error": str(e)}
            )
    
    def download_file(self, object_key: str) -> bytes:
        """
        Download a file from S3
        
        Args:
            object_key: S3 object key
            
        Returns:
            File contents as bytes
        """
        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=object_key
            )
            
            return response['Body'].read()
            
        except ClientError as e:
            logger.error(f"Error downloading file: {str(e)}")
            raise StorageException(
                message="Failed to download audio file",
                details={"object_key": object_key, "error": str(e)}
            )
    
    def delete_file(self, object_key: str) -> bool:
        """
        Delete a file from S3
        
        Args:
            object_key: S3 object key
            
        Returns:
            True if successful
        """
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=object_key
            )
            
            logger.info(f"Deleted file {object_key}")
            return True
            
        except ClientError as e:
            logger.error(f"Error deleting file: {str(e)}")
            raise StorageException(
                message="Failed to delete audio file",
                details={"object_key": object_key, "error": str(e)}
            )
    
    def get_file_url(self, object_key: str) -> str:
        """Get permanent S3 URL (for internal use)"""
        return f"https://{self.bucket_name}.s3.{settings.AWS_REGION}.amazonaws.com/{object_key}"


class InMemoryStorageService:
    """In-memory storage service for development without S3/LocalStack"""
    
    def __init__(self):
        self._files: Dict[str, bytes] = {}
        logger.info("Using in-memory storage (no S3 connection)")
    
    async def upload_audio(self, file_data: bytes, patient_id: str, visit_id: str, 
                          file_extension: str = "webm") -> str:
        """Store audio file in memory"""
        import uuid
        object_key = f"audio/{patient_id}/{visit_id}/{uuid.uuid4()}.{file_extension}"
        self._files[object_key] = file_data
        logger.info(f"Stored file in memory: {object_key} ({len(file_data)} bytes)")
        return object_key
    
    async def download_audio(self, object_key: str) -> bytes:
        """Retrieve audio file from memory"""
        if object_key in self._files:
            return self._files[object_key]
        raise StorageException(message="File not found", details={"object_key": object_key})
    
    def generate_presigned_upload_url(self, patient_id: str, visit_id: str, 
                                      file_extension: str = "webm") -> Dict[str, str]:
        """Generate mock upload URL for demo mode"""
        import uuid
        object_key = f"audio/{patient_id}/{visit_id}/{uuid.uuid4()}.{file_extension}"
        return {
            "upload_url": f"MOCK_UPLOAD:{object_key}",
            "object_key": object_key
        }
    
    def generate_presigned_url(self, object_key: str, expiration: int = None, operation: str = 'put_object') -> str:
        """Generate mock presigned URL for development - compatible with S3StorageService interface"""
        # For deployed environments, we'll skip the actual upload and just simulate it
        # The URL will be to our own mock endpoint
        # We use a special marker that the frontend will detect
        return f"MOCK_UPLOAD:{object_key}"
    
    def generate_presigned_download_url(self, object_key: str, expiration: int = None) -> str:
        """Generate mock download URL"""
        return f"MOCK_DOWNLOAD:{object_key}"
    
    async def delete_audio(self, object_key: str) -> bool:
        """Delete file from memory"""
        if object_key in self._files:
            del self._files[object_key]
            return True
        return False
    
    def get_file_url(self, object_key: str) -> str:
        """Get mock file URL - returns marker for demo mode"""
        return f"MOCK_FILE:{object_key}"


# Union type for both storage services
StorageService = S3StorageService | InMemoryStorageService

# Lazy-initialized global instance
_storage_service: Optional[StorageService] = None

def get_storage_service() -> StorageService:
    """Get or create the storage service (lazy initialization)"""
    global _storage_service
    if _storage_service is None:
        try:
            _storage_service = S3StorageService()
        except Exception as e:
            logger.warning(f"Could not connect to S3: {e}. Using in-memory storage.")
            _storage_service = InMemoryStorageService()
    return _storage_service

# Lazy wrapper for backwards compatibility
class LazyStorageService:
    """Lazy wrapper that defers service creation until first use"""
    _instance: Optional[StorageService] = None
    
    def __getattr__(self, name):
        if LazyStorageService._instance is None:
            try:
                LazyStorageService._instance = S3StorageService()
            except Exception as e:
                logger.warning(f"Could not connect to S3: {e}. Using in-memory storage.")
                LazyStorageService._instance = InMemoryStorageService()
        return getattr(LazyStorageService._instance, name)

storage_service = LazyStorageService()
