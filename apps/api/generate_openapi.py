"""
Generate OpenAPI Specification for IBM watsonx Orchestrate

This script generates an openapi.json file that can be uploaded to
watsonx Orchestrate to enable the AI agent to interact with the
Nidaan Voice Triage API.

Usage:
    python generate_openapi.py
    
Output:
    openapi.json - Upload this file to watsonx Orchestrate
"""
import json
from fastapi.openapi.utils import get_openapi
from app.main import app


def generate_openapi_spec():
    """Generate OpenAPI specification for Orchestrate"""
    
    # Get the full OpenAPI schema
    openapi_schema = get_openapi(
        title="Nidaan Voice Triage API",
        version="1.0.0",
        description="""
# Nidaan Voice Triage API for IBM watsonx Orchestrate

This API enables AI agents to manage patient triage cases.

## Key Endpoints for Orchestrate:

### 1. Get Urgent Cases
`GET /api/v1/triage/api/urgent-cases`

Returns all HIGH severity triage cases that need immediate attention.
Use when doctor asks: "Do we have any urgent patients waiting?"

### 2. Mark Case as Seen
`POST /api/v1/triage/api/cases/{case_id}/seen`

Marks a triage case as seen by the doctor.
Use when doctor says: "Mark patient as seen"

### 3. Get Case Details
`GET /api/v1/triage/api/cases/{case_id}`

Get detailed information about a specific case.
Use when doctor asks: "Tell me more about this patient"

## Example Agent Conversation:

**Doctor:** "Do we have any urgent patients waiting?"

**Agent:** *Calls GET /api/urgent-cases*

**Agent:** "Yes, there are 2 urgent cases:
1. Patient John Doe has breathing trouble
2. Patient Jane Smith has chest pain
Should I mark any of them as seen?"

**Doctor:** "Mark John Doe as seen"

**Agent:** *Calls POST /api/cases/{case_id}/seen*

**Agent:** "Done! John Doe has been marked as seen."
        """,
        routes=app.routes,
        tags=[
            {
                "name": "Voice Triage & Orchestrate",
                "description": "Voice triage processing and Orchestrate API endpoints"
            }
        ]
    )
    
    # Filter to only include triage endpoints for cleaner Orchestrate import
    filtered_paths = {}
    for path, methods in openapi_schema.get("paths", {}).items():
        if "/triage/" in path:
            filtered_paths[path] = methods
    
    # Create a minimal spec for Orchestrate
    orchestrate_spec = {
        "openapi": "3.1.0",
        "info": {
            "title": "Nidaan Voice Triage API",
            "description": "AI-powered patient triage system for IBM watsonx Orchestrate integration",
            "version": "1.0.0",
            "contact": {
                "name": "Nidaan AI Team",
                "email": "support@nidaan.ai"
            }
        },
        "servers": [
            {
                "url": "http://localhost:8000",
                "description": "Development server"
            },
            {
                "url": "https://api.nidaan.ai",
                "description": "Production server"
            }
        ],
        "paths": filtered_paths,
        "components": openapi_schema.get("components", {})
    }
    
    return orchestrate_spec


def main():
    """Generate and save the OpenAPI spec"""
    spec = generate_openapi_spec()
    
    # Save full spec
    with open("openapi.json", "w") as f:
        json.dump(spec, f, indent=2)
    print("✅ Generated: openapi.json")
    
    # Create a minimal spec with just the key Orchestrate endpoints
    minimal_spec = {
        "openapi": "3.1.0",
        "info": {
            "title": "Nidaan Triage API for Orchestrate",
            "description": "Check and manage urgent patient triage cases",
            "version": "1.0.0"
        },
        "servers": [
            {"url": "http://localhost:8000", "description": "Local"},
            {"url": "https://api.nidaan.ai", "description": "Production"}
        ],
        "paths": {
            "/api/v1/triage/api/urgent-cases": {
                "get": {
                    "operationId": "getUrgentCases",
                    "summary": "Get Urgent Cases",
                    "description": "Returns all HIGH severity triage cases. Use when doctor asks about urgent patients.",
                    "responses": {
                        "200": {
                            "description": "List of urgent cases",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "count": {"type": "integer", "description": "Number of urgent cases"},
                                            "cases": {
                                                "type": "array",
                                                "items": {
                                                    "type": "object",
                                                    "properties": {
                                                        "case_id": {"type": "string"},
                                                        "patient_name": {"type": "string"},
                                                        "severity": {"type": "string"},
                                                        "red_flags": {"type": "array", "items": {"type": "string"}},
                                                        "summary": {"type": "string"}
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/v1/triage/api/cases/{case_id}/seen": {
                "post": {
                    "operationId": "markCaseAsSeen",
                    "summary": "Mark Case as Seen",
                    "description": "Marks a triage case as seen by the doctor.",
                    "parameters": [
                        {
                            "name": "case_id",
                            "in": "path",
                            "required": True,
                            "schema": {"type": "string"},
                            "description": "The triage case ID to mark as seen"
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": "Case marked as seen",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "success": {"type": "boolean"},
                                            "message": {"type": "string"}
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    with open("openapi_orchestrate.json", "w") as f:
        json.dump(minimal_spec, f, indent=2)
    print("✅ Generated: openapi_orchestrate.json (minimal spec for Orchestrate)")
    
    print("\n📋 Next Steps:")
    print("1. Go to IBM watsonx Orchestrate")
    print("2. Click 'Add a Tool'")
    print("3. Upload openapi_orchestrate.json")
    print("4. Test by asking: 'Do we have any urgent patients waiting?'")


if __name__ == "__main__":
    main()
