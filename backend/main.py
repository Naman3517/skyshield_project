import os
from enum import Enum
from typing import Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import Client, create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_KEY in .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="SkyShield Aviation Safety API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SeverityLevel(str, Enum):
    low = "Low"
    medium = "Medium"
    high = "High"
    critical = "Critical"


class StatusLevel(str, Enum):
    open = "open"
    under_investigation = "under_investigation"
    closed = "closed"


class IncidentCreate(BaseModel):
    tail_number: str = Field(..., min_length=2, max_length=30)
    incident_date: Optional[str] = None
    location: str = Field(..., min_length=2)
    severity: SeverityLevel = Field(default=SeverityLevel.medium)
    description: str = Field(..., min_length=5)
    root_cause: Optional[str] = None
    regulatory_body: Optional[str] = None
    is_compliant: Optional[bool] = True


class IncidentUpdate(BaseModel):
    severity: Optional[SeverityLevel] = None
    description: Optional[str] = None
    root_cause: Optional[str] = None
    regulatory_body: Optional[str] = None
    is_compliant: Optional[bool] = None
    status: Optional[StatusLevel] = None


@app.get("/")
def root():
    return {"status": "ok", "service": "SkyShield API"}


@app.get("/health/db")
def db_health():
    try:
        response = supabase.table("incident_reports").select("id").limit(1).execute()
        return {"database": "connected", "sample_count": len(response.data)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database check failed: {exc}")


@app.post("/incidents", status_code=201)
def create_incident(payload: IncidentCreate):
    try:
        data = payload.model_dump(exclude_none=True, mode="json")
        res = supabase.table("incident_reports").insert(data).execute()
        return {"message": "Incident report created", "data": res.data}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to create incident: {exc}")


@app.get("/incidents")
def list_incidents(
    severity: Optional[SeverityLevel] = None,
    status: Optional[StatusLevel] = None,
    tail_number: Optional[str] = None,
    is_compliant: Optional[bool] = None,
):
    try:
        query = supabase.table("incident_reports").select("*").order("created_at", desc=True)

        if severity:
            query = query.eq("severity", severity.value)
        if status:
            query = query.eq("status", status.value)
        if is_compliant is not None:
            query = query.eq("is_compliant", is_compliant)
        if tail_number:
            query = query.ilike("tail_number", f"%{tail_number.strip()}%")

        res = query.execute()
        return {"count": len(res.data), "data": res.data}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch incidents: {exc}")


@app.patch("/incidents/{incident_id}")
def update_incident(incident_id: str, payload: IncidentUpdate):
    try:
        updates = payload.model_dump(exclude_none=True, mode="json")
        if not updates:
            raise HTTPException(status_code=400, detail="No fields provided for update")

        res = (
            supabase.table("incident_reports")
            .update(updates)
            .eq("id", incident_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="Incident not found")

        return {"message": "Incident updated", "data": res.data}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to update incident: {exc}")


@app.delete("/incidents/{incident_id}")
def delete_incident(incident_id: str):
    try:
        res = (
            supabase.table("incident_reports")
            .delete()
            .eq("id", incident_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="Incident not found")

        return {"message": "Incident deleted", "data": res.data}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to delete incident: {exc}")