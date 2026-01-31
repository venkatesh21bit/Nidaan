"""
Database Module
Handles connections to DynamoDB and other data stores
"""
import boto3
from typing import Optional, Dict, Any, List
from datetime import datetime
from app.core.config import settings
from botocore.exceptions import ClientError
import logging

logger = logging.getLogger(__name__)


class DynamoDBClient:
    """DynamoDB Client for managing visits and patient data"""
    
    def __init__(self):
        """Initialize DynamoDB client"""
        client_config = {
            'region_name': settings.AWS_REGION
        }
        
        # For local development
        if settings.DYNAMODB_ENDPOINT_URL:
            client_config['endpoint_url'] = settings.DYNAMODB_ENDPOINT_URL
            client_config['aws_access_key_id'] = 'test'
            client_config['aws_secret_access_key'] = 'test'
        
        self.client = boto3.client('dynamodb', **client_config)
        self.resource = boto3.resource('dynamodb', **client_config)
        self.table_name = settings.DYNAMODB_TABLE_NAME
        
        # Initialize table if it doesn't exist
        self._ensure_table_exists()
    
    def _ensure_table_exists(self):
        """Create table if it doesn't exist (for local development)"""
        try:
            self.client.describe_table(TableName=self.table_name)
            logger.info(f"Table {self.table_name} exists")
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                logger.info(f"Creating table {self.table_name}")
                self._create_table()
    
    def _create_table(self):
        """Create DynamoDB table with the proper schema"""
        try:
            table = self.resource.create_table(
                TableName=self.table_name,
                KeySchema=[
                    {'AttributeName': 'PK', 'KeyType': 'HASH'},  # Partition key
                    {'AttributeName': 'SK', 'KeyType': 'RANGE'}  # Sort key
                ],
                AttributeDefinitions=[
                    {'AttributeName': 'PK', 'AttributeType': 'S'},
                    {'AttributeName': 'SK', 'AttributeType': 'S'},
                    {'AttributeName': 'GSI1PK', 'AttributeType': 'S'},
                    {'AttributeName': 'GSI1SK', 'AttributeType': 'S'},
                ],
                GlobalSecondaryIndexes=[
                    {
                        'IndexName': 'GSI1',
                        'KeySchema': [
                            {'AttributeName': 'GSI1PK', 'KeyType': 'HASH'},
                            {'AttributeName': 'GSI1SK', 'KeyType': 'RANGE'}
                        ],
                        'Projection': {'ProjectionType': 'ALL'},
                        'ProvisionedThroughput': {
                            'ReadCapacityUnits': 5,
                            'WriteCapacityUnits': 5
                        }
                    }
                ],
                BillingMode='PROVISIONED',
                ProvisionedThroughput={
                    'ReadCapacityUnits': 5,
                    'WriteCapacityUnits': 5
                },
                StreamSpecification={
                    'StreamEnabled': True,
                    'StreamViewType': 'NEW_AND_OLD_IMAGES'
                }
            )
            
            # Wait for table to be created
            table.meta.client.get_waiter('table_exists').wait(TableName=self.table_name)
            logger.info(f"Table {self.table_name} created successfully")
            
        except Exception as e:
            logger.error(f"Error creating table: {str(e)}")
            raise
    
    def create_visit(self, visit_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new visit record
        
        Args:
            visit_data: Dictionary containing visit information
            
        Returns:
            Created visit record
        """
        table = self.resource.Table(self.table_name)
        
        timestamp = datetime.utcnow().isoformat()
        visit_id = visit_data.get('visit_id')
        clinic_id = visit_data.get('clinic_id')
        patient_id = visit_data.get('patient_id')
        
        item = {
            'PK': f"CLINIC#{clinic_id}",
            'SK': f"VISIT#{timestamp}#{patient_id}",
            'GSI1PK': f"PATIENT#{patient_id}",
            'GSI1SK': f"VISIT#{timestamp}",
            'visit_id': visit_id,
            'clinic_id': clinic_id,
            'patient_id': patient_id,
            'status': visit_data.get('status', 'PENDING'),
            'audio_s3_key': visit_data.get('audio_s3_key', ''),
            'created_at': timestamp,
            'updated_at': timestamp,
            **{k: v for k, v in visit_data.items() if k not in ['visit_id', 'clinic_id', 'patient_id', 'status', 'audio_s3_key']}
        }
        
        table.put_item(Item=item)
        return item
    
    def get_visit(self, clinic_id: str, visit_sk: str) -> Optional[Dict[str, Any]]:
        """Get a visit by PK and SK"""
        table = self.resource.Table(self.table_name)
        
        response = table.get_item(
            Key={
                'PK': f"CLINIC#{clinic_id}",
                'SK': visit_sk
            }
        )
        
        return response.get('Item')
    
    def update_visit(self, clinic_id: str, visit_sk: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update a visit record"""
        table = self.resource.Table(self.table_name)
        
        # Build update expression
        update_expr = "SET updated_at = :updated_at"
        expr_values = {':updated_at': datetime.utcnow().isoformat()}
        
        for key, value in updates.items():
            update_expr += f", {key} = :{key}"
            expr_values[f":{key}"] = value
        
        response = table.update_item(
            Key={
                'PK': f"CLINIC#{clinic_id}",
                'SK': visit_sk
            },
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values,
            ReturnValues='ALL_NEW'
        )
        
        return response.get('Attributes', {})
    
    def list_clinic_visits(self, clinic_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """List all visits for a clinic"""
        table = self.resource.Table(self.table_name)
        
        response = table.query(
            KeyConditionExpression='PK = :pk AND begins_with(SK, :sk_prefix)',
            ExpressionAttributeValues={
                ':pk': f"CLINIC#{clinic_id}",
                ':sk_prefix': 'VISIT#'
            },
            Limit=limit,
            ScanIndexForward=False  # Most recent first
        )
        
        return response.get('Items', [])
    
    def list_patient_visits(self, patient_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """List all visits for a patient using GSI"""
        table = self.resource.Table(self.table_name)
        
        response = table.query(
            IndexName='GSI1',
            KeyConditionExpression='GSI1PK = :pk',
            ExpressionAttributeValues={
                ':pk': f"PATIENT#{patient_id}"
            },
            Limit=limit,
            ScanIndexForward=False
        )
        
        return response.get('Items', [])


class InMemoryDBClient:
    """In-memory database client for development without Docker"""
    
    def __init__(self):
        self._data: Dict[str, Dict[str, Any]] = {}
        self._gsi1_index: Dict[str, List[str]] = {}
        logger.info("Using in-memory database (no DynamoDB connection)")
    
    def create_visit(self, visit_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new visit record in memory"""
        from datetime import datetime
        timestamp = datetime.utcnow().isoformat()
        visit_id = visit_data.get('visit_id')
        clinic_id = visit_data.get('clinic_id')
        patient_id = visit_data.get('patient_id')
        
        pk = f"CLINIC#{clinic_id}"
        sk = f"VISIT#{timestamp}#{patient_id}"
        
        item = {
            'PK': pk,
            'SK': sk,
            'GSI1PK': f"PATIENT#{patient_id}",
            'GSI1SK': f"VISIT#{timestamp}",
            'visit_id': visit_id,
            'clinic_id': clinic_id,
            'patient_id': patient_id,
            'status': visit_data.get('status', 'PENDING'),
            'audio_s3_key': visit_data.get('audio_s3_key', ''),
            'created_at': timestamp,
            'updated_at': timestamp,
            **{k: v for k, v in visit_data.items() if k not in ['visit_id', 'clinic_id', 'patient_id', 'status', 'audio_s3_key']}
        }
        
        key = f"{pk}|{sk}"
        self._data[key] = item
        
        # Update GSI1 index
        gsi1pk = item['GSI1PK']
        if gsi1pk not in self._gsi1_index:
            self._gsi1_index[gsi1pk] = []
        self._gsi1_index[gsi1pk].append(key)
        
        return item
    
    def get_visit(self, clinic_id: str, visit_sk: str) -> Optional[Dict[str, Any]]:
        """Get a visit by PK and SK"""
        key = f"CLINIC#{clinic_id}|{visit_sk}"
        return self._data.get(key)
    
    def update_visit(self, clinic_id: str, visit_sk: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update a visit record"""
        from datetime import datetime
        key = f"CLINIC#{clinic_id}|{visit_sk}"
        if key in self._data:
            self._data[key].update(updates)
            self._data[key]['updated_at'] = datetime.utcnow().isoformat()
        return self._data.get(key, {})
    
    def list_clinic_visits(self, clinic_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """List all visits for a clinic"""
        pk_prefix = f"CLINIC#{clinic_id}|VISIT#"
        items = [v for k, v in self._data.items() if k.startswith(pk_prefix)]
        items.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        return items[:limit]
    
    def list_patient_visits(self, patient_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """List all visits for a patient using GSI"""
        gsi1pk = f"PATIENT#{patient_id}"
        keys = self._gsi1_index.get(gsi1pk, [])
        items = [self._data[k] for k in keys if k in self._data]
        items.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        return items[:limit]


# Union type for both DB clients
DBClient = DynamoDBClient | InMemoryDBClient

# Lazy-initialized global instance
_db_client: Optional[DBClient] = None

def get_db_client() -> DBClient:
    """Get or create the database client (lazy initialization)"""
    global _db_client
    if _db_client is None:
        try:
            _db_client = DynamoDBClient()
        except Exception as e:
            logger.warning(f"Could not connect to DynamoDB: {e}. Using in-memory database.")
            _db_client = InMemoryDBClient()
    return _db_client

# For backwards compatibility - lazy wrapper that tries DynamoDB first
class LazyDBClient:
    """Lazy wrapper that defers DB client creation until first use"""
    _instance: Optional[DBClient] = None
    
    def __getattr__(self, name):
        if LazyDBClient._instance is None:
            try:
                LazyDBClient._instance = DynamoDBClient()
            except Exception as e:
                logger.warning(f"Could not connect to DynamoDB: {e}. Using in-memory database.")
                LazyDBClient._instance = InMemoryDBClient()
        return getattr(LazyDBClient._instance, name)

db_client = LazyDBClient()
