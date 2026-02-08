import os
import json
import uuid
import asyncio
import time
import re
from datetime import datetime, timezone, timedelta
from typing import Optional
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import motor.motor_asyncio
import httpx
import numpy as np

# FAISS + sentence-transformers
import faiss
from sentence_transformers import SentenceTransformer

# MLFlow experiment tracking
import mlflow

# Emergent LLM integration
from emergentintegrations.llm.chat import LlmChat, UserMessage

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

app = FastAPI(title="Virtue Foundation IDP - Medical Desert Tracker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ── Globals ──
faiss_index = None
facility_texts = []
facility_ids = []
embed_model = None
EMBED_DIM = 384

# ── Data path ──
DATA_DIR = Path(__file__).parent / "data"

# ── MLFlow setup ──
MLFLOW_TRACKING_DIR = Path(__file__).parent / "mlruns"
MLFLOW_TRACKING_DIR.mkdir(exist_ok=True)
mlflow.set_tracking_uri(f"file://{MLFLOW_TRACKING_DIR}")
mlflow.set_experiment("VirtueFoundation_IDP_Agent")

# ── Pydantic Models ──
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    citations: list
    reasoning_steps: list
    session_id: str
    mlflow_run_id: Optional[str] = None

class PlanRequest(BaseModel):
    region: Optional[str] = None
    specialty: Optional[str] = None
    description: Optional[str] = None

class Text2SQLRequest(BaseModel):
    query: str

class Text2SQLResponse(BaseModel):
    natural_query: str
    mongo_query: dict
    results: list
    result_count: int
    explanation: str


# ══════════════════════════════════════════════
# 1. SENTENCE-TRANSFORMERS EMBEDDINGS
# ══════════════════════════════════════════════

def get_embed_model():
    global embed_model
    if embed_model is None:
        print("Loading sentence-transformers model (all-MiniLM-L6-v2)...")
        embed_model = SentenceTransformer("all-MiniLM-L6-v2")
        print("Sentence-transformers model loaded.")
    return embed_model


def encode_texts(texts: list) -> np.ndarray:
    model = get_embed_model()
    embeddings = model.encode(texts, show_progress_bar=False, normalize_embeddings=True)
    return np.array(embeddings, dtype=np.float32)


def encode_query(text: str) -> np.ndarray:
    model = get_embed_model()
    embedding = model.encode([text], normalize_embeddings=True)
    return np.array(embedding, dtype=np.float32)


async def build_faiss_index():
    """Build FAISS index from facility data using sentence-transformers."""
    global faiss_index, facility_texts, facility_ids, EMBED_DIM

    facilities_path = DATA_DIR / "ghana_facilities.json"
    with open(facilities_path) as f:
        facilities = json.load(f)

    # Store in MongoDB
    existing = await db.facilities.count_documents({})
    if existing == 0:
        await db.facilities.insert_many(facilities)

    # Build text chunks
    texts = []
    ids = []
    for fac in facilities:
        text = (
            f"Facility: {fac['name']} (ID: {fac['facility_id']})\n"
            f"Region: {fac['region']}, District: {fac['district']}\n"
            f"Type: {fac['type']}\n"
            f"Beds: {fac['beds']}, Staff: {fac['staff_count']}\n"
            f"Specialties: {', '.join(fac['specialties']) if fac['specialties'] else 'None'}\n"
            f"Equipment: {', '.join(fac['equipment']) if fac['equipment'] else 'None'}\n"
            f"Services: {', '.join(fac['services']) if fac['services'] else 'None'}\n"
            f"Status: {fac['operational_status']}\n"
            f"Capabilities: {fac['capabilities_text']}\n"
            f"Notes: {fac['notes']}"
        )
        texts.append(text)
        ids.append(fac["facility_id"])

    # Encode with sentence-transformers (batched)
    print(f"Encoding {len(texts)} facility documents with sentence-transformers...")
    t0 = time.time()
    embeddings_array = encode_texts(texts)
    elapsed = time.time() - t0
    print(f"Encoding complete in {elapsed:.1f}s. Shape: {embeddings_array.shape}")

    EMBED_DIM = embeddings_array.shape[1]
    faiss_index = faiss.IndexFlatIP(EMBED_DIM)
    faiss_index.add(embeddings_array)

    facility_texts = texts
    facility_ids = ids

    print(f"FAISS index built with {len(texts)} docs, dim={EMBED_DIM}")


async def search_similar(query: str, top_k: int = 5) -> list:
    if faiss_index is None:
        return []

    query_vec = encode_query(query)
    scores, indices = faiss_index.search(query_vec, top_k)

    results = []
    for i, idx in enumerate(indices[0]):
        if 0 <= idx < len(facility_texts) and scores[0][i] > 0:
            results.append({
                "facility_id": facility_ids[idx],
                "text": facility_texts[idx],
                "score": float(scores[0][i]),
            })
    return results


# ══════════════════════════════════════════════
# 2. MLFLOW EXPERIMENT TRACKING
# ══════════════════════════════════════════════

def start_mlflow_run(run_name: str, tags: dict = None):
    """Start an MLFlow run for tracking agent reasoning."""
    run = mlflow.start_run(run_name=run_name, tags=tags or {})
    return run


def log_agent_step(step_num: int, action: str, detail: str, data_used: str, latency_ms: float = 0):
    """Log a single agent reasoning step to MLFlow."""
    mlflow.log_params({
        f"step_{step_num}_action": action[:250],
    })
    mlflow.log_metrics({
        f"step_{step_num}_latency_ms": latency_ms,
    })
    # Log as artifact text
    step_text = f"Step {step_num}: {action}\nDetail: {detail}\nData: {data_used}\nLatency: {latency_ms:.0f}ms"
    step_path = MLFLOW_TRACKING_DIR / f"step_{step_num}.txt"
    step_path.write_text(step_text)
    mlflow.log_artifact(str(step_path))


# ══════════════════════════════════════════════
# 3. TEXT2SQL (Natural Language → MongoDB Query)
# ══════════════════════════════════════════════

async def text_to_mongo_query(natural_query: str) -> dict:
    """Use LLM to convert natural language to a MongoDB query on the facilities collection."""
    schema_info = """
MongoDB Collection: facilities
Fields:
- facility_id: string (e.g. "GH-0001")
- name: string (facility name)
- region: string (e.g. "Greater Accra", "Northern", "Upper West", "Ashanti", "Western", "Eastern", "Central", "Volta", "Brong Ahafo", "Upper East")
- district: string
- town: string
- type: string (e.g. "Teaching Hospital", "Regional Hospital", "District Hospital", "Health Centre", "Clinic", "CHPS", "Polyclinic", "Hospital", "Maternity Home", "RCH", "Psychiatric Hospital")
- ownership: string (e.g. "Government", "Private", "CHAG", "Quasi-Government")
- latitude: float
- longitude: float
- beds: int
- staff_count: int
- specialties: array of strings (e.g. ["Surgery", "Internal Medicine", "Pediatrics", "Obstetrics", "Cardiology", "Neurology"])
- equipment: array of strings (e.g. ["MRI", "CT Scanner", "X-Ray", "Ultrasound", "Ventilators"])
- services: array of strings (e.g. ["Emergency", "ICU", "Surgery", "Laboratory", "Pharmacy", "Blood Bank"])
- operational_status: string (e.g. "Fully Operational", "Operational", "Operational - Resource Constrained", "Operational - Minimal Capacity")
- capabilities_text: string (free-text description)
- notes: string (contains "MEDICAL DESERT" for desert facilities)
- last_inspection: string (date)
"""

    prompt = f"""Convert this natural language query into a MongoDB find() query (JSON format).

SCHEMA:
{schema_info}

QUERY: "{natural_query}"

Return ONLY a valid JSON object with two keys:
- "filter": the MongoDB filter query
- "projection": fields to return (always exclude _id)
- "sort": optional sort criteria
- "limit": optional limit (default 20)
- "explanation": brief explanation of what the query does

Example output:
{{"filter": {{"region": "Northern", "beds": {{"$gt": 100}}}}, "projection": {{"_id": 0, "name": 1, "region": 1, "beds": 1}}, "sort": {{"beds": -1}}, "limit": 20, "explanation": "Finds facilities in the Northern region with more than 100 beds, sorted by bed count"}}

Return ONLY the JSON, no markdown or extra text."""

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"t2sql_{uuid.uuid4().hex[:6]}",
        system_message="You are a MongoDB query generator. Convert natural language to MongoDB queries. Return ONLY valid JSON."
    )
    chat.with_model("gemini", "gemini-2.5-flash")

    user_msg = UserMessage(text=prompt)
    response_text = await chat.send_message(user_msg)

    # Parse JSON from response
    response_text = response_text.strip()
    if response_text.startswith("```"):
        response_text = response_text.split("```")[1]
        if response_text.startswith("json"):
            response_text = response_text[4:]
    response_text = response_text.strip()

    return json.loads(response_text)


# ══════════════════════════════════════════════
# AUTH HELPERS
# ══════════════════════════════════════════════

async def get_current_user(request: Request) -> dict:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]

    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one(
        {"session_token": session_token}, {"_id": 0}
    )
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one(
        {"user_id": session["user_id"]}, {"_id": 0}
    )
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


# ══════════════════════════════════════════════
# AUTH ENDPOINTS
# ══════════════════════════════════════════════

@app.post("/api/auth/session")
async def create_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    async with httpx.AsyncClient() as http_client:
        resp = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        user_data = resp.json()

    email = user_data["email"]
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})

    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one(
            {"email": email},
            {"$set": {"name": user_data["name"], "picture": user_data.get("picture", "")}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": user_data["name"],
            "picture": user_data.get("picture", ""),
            "created_at": datetime.now(timezone.utc),
        })

    session_token = user_data.get("session_token", f"st_{uuid.uuid4().hex}")
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })

    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none",
        path="/", max_age=7 * 24 * 3600,
    )

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return user


@app.get("/api/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user


@app.post("/api/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out"}


# ══════════════════════════════════════════════
# FACILITY ENDPOINTS
# ══════════════════════════════════════════════

@app.get("/api/facilities")
async def get_facilities(
    region: Optional[str] = None,
    type: Optional[str] = None,
    specialty: Optional[str] = None,
    search: Optional[str] = None,
):
    query = {}
    if region:
        query["region"] = {"$regex": region, "$options": "i"}
    if type:
        query["type"] = {"$regex": type, "$options": "i"}
    if specialty:
        query["specialties"] = {"$regex": specialty, "$options": "i"}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"capabilities_text": {"$regex": search, "$options": "i"}},
            {"notes": {"$regex": search, "$options": "i"}},
        ]

    facilities = await db.facilities.find(query, {"_id": 0}).to_list(5000)
    return facilities


@app.get("/api/facilities/{facility_id}")
async def get_facility(facility_id: str):
    facility = await db.facilities.find_one({"facility_id": facility_id}, {"_id": 0})
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")
    return facility


# ══════════════════════════════════════════════
# ANALYSIS ENDPOINTS
# ══════════════════════════════════════════════

@app.get("/api/analysis/medical-deserts")
async def get_medical_deserts():
    facilities = await db.facilities.find({}, {"_id": 0}).to_list(5000)

    regions = {}
    for fac in facilities:
        region = fac["region"]
        if region not in regions:
            regions[region] = {
                "region": region, "facilities": [], "total_beds": 0,
                "total_staff": 0, "specialties": set(),
                "has_surgery": False, "has_icu": False,
                "has_ct_mri": False, "has_blood_bank": False, "desert_score": 0,
            }
        r = regions[region]
        r["facilities"].append(fac["name"])
        r["total_beds"] += fac.get("beds", 0)
        r["total_staff"] += fac.get("staff_count", 0)
        for s in fac.get("specialties", []):
            r["specialties"].add(s)
        if "Surgery" in fac.get("services", []):
            r["has_surgery"] = True
        if "ICU" in fac.get("services", []):
            r["has_icu"] = True
        if any(e in fac.get("equipment", []) for e in ["CT Scanner", "MRI"]):
            r["has_ct_mri"] = True
        if "Blood Bank" in fac.get("services", []):
            r["has_blood_bank"] = True

    deserts = []
    for region, data in regions.items():
        score = 0
        if data["total_beds"] < 100: score += 30
        elif data["total_beds"] < 200: score += 15
        if data["total_staff"] < 200: score += 20
        elif data["total_staff"] < 500: score += 10
        if not data["has_surgery"]: score += 20
        if not data["has_icu"]: score += 15
        if not data["has_ct_mri"]: score += 10
        if not data["has_blood_bank"]: score += 5
        if len(data["specialties"]) < 3: score += 10

        data["desert_score"] = min(score, 100)
        data["specialties"] = list(data["specialties"])
        data["is_desert"] = score >= 40
        data["severity"] = "Critical" if score >= 60 else "Moderate" if score >= 40 else "Adequate"
        deserts.append(data)

    deserts.sort(key=lambda x: x["desert_score"], reverse=True)
    return deserts


@app.get("/api/analysis/stats")
async def get_stats():
    facilities = await db.facilities.find({}, {"_id": 0}).to_list(5000)

    total_beds = sum(f.get("beds", 0) for f in facilities)
    total_staff = sum(f.get("staff_count", 0) for f in facilities)
    all_regions = set(f["region"] for f in facilities)
    all_specialties = set()
    for f in facilities:
        for s in f.get("specialties", []):
            all_specialties.add(s)

    desert_count = sum(1 for f in facilities if "MEDICAL DESERT" in f.get("notes", ""))

    return {
        "total_facilities": len(facilities),
        "total_beds": total_beds,
        "total_staff": total_staff,
        "total_regions": len(all_regions),
        "total_specialties": len(all_specialties),
        "medical_deserts": desert_count,
        "facility_types": {
            "Teaching Hospital": sum(1 for f in facilities if f["type"] == "Teaching Hospital"),
            "Regional Hospital": sum(1 for f in facilities if f["type"] == "Regional Hospital"),
            "District Hospital": sum(1 for f in facilities if f["type"] == "District Hospital"),
            "Health Centre": sum(1 for f in facilities if f["type"] == "Health Centre"),
        },
    }


# ══════════════════════════════════════════════
# 4. RAG CHAT WITH MULTI-TURN MEMORY + MLFLOW
# ══════════════════════════════════════════════

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    """RAG-powered chat with multi-turn memory, citations, reasoning steps, and MLFlow tracking."""
    session_id = req.session_id or f"chat_{uuid.uuid4().hex[:8]}"
    run_id = None

    reasoning_steps = []
    citations = []

    try:
        # Start MLFlow run
        run = start_mlflow_run(
            run_name=f"chat_{session_id[:12]}",
            tags={"type": "rag_chat", "session_id": session_id},
        )
        run_id = run.info.run_id
        mlflow.log_param("user_query", req.message[:250])
        mlflow.log_param("session_id", session_id)
    except Exception:
        pass  # MLFlow is best-effort

    # Step 1: Query analysis
    t0 = time.time()
    reasoning_steps.append({
        "step": 1, "action": "Query Analysis",
        "detail": f"Analyzing user query: '{req.message}'",
        "data_used": "User input",
    })
    try:
        log_agent_step(1, "Query Analysis", f"Query: {req.message}", "User input", 0)
    except Exception:
        pass

    # Step 2: Retrieve conversation history (multi-turn memory)
    history_docs = await db.chat_history.find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(5)
    history_docs.reverse()

    conversation_context = ""
    if history_docs:
        for hdoc in history_docs:
            conversation_context += f"User: {hdoc['message']}\nAssistant: {hdoc['response'][:300]}...\n\n"
        reasoning_steps.append({
            "step": 2, "action": "Memory Retrieval",
            "detail": f"Loaded {len(history_docs)} previous conversation turns for context",
            "data_used": f"{len(history_docs)} chat history messages",
        })
        try:
            log_agent_step(2, "Memory Retrieval", f"{len(history_docs)} turns loaded", f"session={session_id}", (time.time() - t0) * 1000)
        except Exception:
            pass
    else:
        reasoning_steps.append({
            "step": 2, "action": "Memory Retrieval",
            "detail": "No previous conversation history (new session)",
            "data_used": "None",
        })

    # Step 3: FAISS semantic search
    t1 = time.time()
    search_results = await search_similar(req.message, top_k=5)
    search_ms = (time.time() - t1) * 1000

    reasoning_steps.append({
        "step": 3, "action": "Semantic Search (FAISS + sentence-transformers)",
        "detail": f"Retrieved {len(search_results)} documents in {search_ms:.0f}ms using sentence-transformers embeddings",
        "data_used": [r["facility_id"] for r in search_results],
    })
    try:
        log_agent_step(3, "Semantic Search", f"{len(search_results)} docs, {search_ms:.0f}ms", str([r["facility_id"] for r in search_results]), search_ms)
        mlflow.log_metric("faiss_search_ms", search_ms)
        mlflow.log_metric("docs_retrieved", len(search_results))
    except Exception:
        pass

    # Build context + citations
    context_parts = []
    for i, result in enumerate(search_results):
        context_parts.append(f"[Source {i + 1}: {result['facility_id']}]\n{result['text']}")
        citations.append({
            "source_id": result["facility_id"],
            "text_excerpt": result["text"][:200] + "...",
            "relevance_score": result["score"],
        })

    context = "\n\n---\n\n".join(context_parts)

    # Step 4: Context assembly
    all_facilities = await db.facilities.find({}, {"_id": 0, "name": 1, "region": 1}).to_list(5000)
    facility_summary = f"Total: {len(all_facilities)} facilities across {len(set(f['region'] for f in all_facilities))} regions."

    reasoning_steps.append({
        "step": 4, "action": "Context Assembly",
        "detail": f"Combined {len(search_results)} retrieved docs + {len(history_docs)} conversation turns + DB summary",
        "data_used": f"FAISS results + memory + summary",
    })

    # Build system prompt with memory
    memory_section = ""
    if conversation_context:
        memory_section = f"\n\nPREVIOUS CONVERSATION:\n{conversation_context}\nContinue the conversation naturally, referring to earlier points when relevant."

    system_prompt = f"""You are the Virtue Foundation's Intelligent Document Parsing (IDP) Agent, specialized in analyzing healthcare facility data in Ghana.

RETRIEVED FACILITY DATA:
{context}

DATABASE SUMMARY: {facility_summary}
{memory_section}

INSTRUCTIONS:
1. Answer questions about healthcare facilities, medical deserts, and healthcare gaps in Ghana.
2. Cite specific facility IDs (e.g., [GH-0001]) and names.
3. Identify medical deserts and infrastructure gaps.
4. Provide actionable recommendations for NGO planners.
5. Be specific with data (beds, staff, equipment, services).
6. If something isn't in the data, say so clearly.
7. Reference previous conversation context when relevant.
"""

    # Step 5: LLM generation
    t2 = time.time()
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"rag_{session_id}_{uuid.uuid4().hex[:6]}",
            system_message=system_prompt,
        )
        chat.with_model("gemini", "gemini-2.5-flash")

        user_msg = UserMessage(text=req.message)
        response_text = await chat.send_message(user_msg)
        llm_ms = (time.time() - t2) * 1000

        reasoning_steps.append({
            "step": 5, "action": "LLM Generation (Gemini 2.5 Flash)",
            "detail": f"Generated response in {llm_ms:.0f}ms using {len(context_parts)} context documents + conversation memory",
            "data_used": f"System prompt + {len(context_parts)} docs + {len(history_docs)} memory turns",
        })
        try:
            log_agent_step(5, "LLM Generation", f"Generated in {llm_ms:.0f}ms", f"{len(context_parts)} docs", llm_ms)
            mlflow.log_metric("llm_latency_ms", llm_ms)
            mlflow.log_metric("response_length", len(response_text))
        except Exception:
            pass

    except Exception as e:
        response_text = f"Error processing query: {str(e)}. Found {len(search_results)} relevant records."
        reasoning_steps.append({
            "step": 5, "action": "LLM Generation - Error",
            "detail": f"Error: {str(e)}", "data_used": "Fallback response",
        })

    # Store in chat history (multi-turn memory)
    await db.chat_history.insert_one({
        "session_id": session_id,
        "message": req.message,
        "response": response_text,
        "citations": citations,
        "reasoning_steps": reasoning_steps,
        "mlflow_run_id": run_id,
        "created_at": datetime.now(timezone.utc),
    })

    # End MLFlow run
    try:
        total_ms = (time.time() - t0) * 1000
        mlflow.log_metric("total_latency_ms", total_ms)
        mlflow.log_metric("citation_count", len(citations))
        mlflow.log_metric("reasoning_steps_count", len(reasoning_steps))
        mlflow.end_run()
    except Exception:
        try:
            mlflow.end_run()
        except Exception:
            pass

    return ChatResponse(
        response=response_text,
        citations=citations,
        reasoning_steps=reasoning_steps,
        session_id=session_id,
        mlflow_run_id=run_id,
    )


@app.get("/api/chat/history/{session_id}")
async def get_chat_history(session_id: str):
    history = await db.chat_history.find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    return history


# ══════════════════════════════════════════════
# TEXT2SQL ENDPOINT
# ══════════════════════════════════════════════

@app.post("/api/text2sql", response_model=Text2SQLResponse)
async def text2sql_endpoint(req: Text2SQLRequest):
    """Convert natural language to MongoDB query and execute it."""
    try:
        # Start MLFlow run for tracking
        try:
            run = start_mlflow_run(
                run_name=f"text2sql_{uuid.uuid4().hex[:8]}",
                tags={"type": "text2sql"},
            )
            mlflow.log_param("natural_query", req.query[:250])
        except Exception:
            pass

        t0 = time.time()
        query_spec = await text_to_mongo_query(req.query)
        llm_ms = (time.time() - t0) * 1000

        mongo_filter = query_spec.get("filter", {})
        projection = query_spec.get("projection", {"_id": 0})
        if "_id" not in projection:
            projection["_id"] = 0
        sort_spec = query_spec.get("sort", None)
        limit = min(query_spec.get("limit", 20), 50)
        explanation = query_spec.get("explanation", "")

        cursor = db.facilities.find(mongo_filter, projection)
        if sort_spec:
            cursor = cursor.sort(list(sort_spec.items()))
        results = await cursor.to_list(limit)

        try:
            mlflow.log_metric("text2sql_latency_ms", llm_ms)
            mlflow.log_metric("result_count", len(results))
            mlflow.log_param("mongo_filter", json.dumps(mongo_filter)[:250])
            mlflow.end_run()
        except Exception:
            try:
                mlflow.end_run()
            except Exception:
                pass

        return Text2SQLResponse(
            natural_query=req.query,
            mongo_query=mongo_filter,
            results=results,
            result_count=len(results),
            explanation=explanation,
        )

    except json.JSONDecodeError:
        try:
            mlflow.end_run()
        except Exception:
            pass
        raise HTTPException(status_code=422, detail="Failed to parse LLM response into MongoDB query. Try rephrasing.")
    except Exception as e:
        try:
            mlflow.end_run()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Text2SQL error: {str(e)}")


# ══════════════════════════════════════════════
# MLFLOW TRACKING ENDPOINT
# ══════════════════════════════════════════════

@app.get("/api/mlflow/runs")
async def get_mlflow_runs(limit: int = 20):
    """Get recent MLFlow experiment runs for the agent transparency dashboard."""
    try:
        experiment = mlflow.get_experiment_by_name("VirtueFoundation_IDP_Agent")
        if not experiment:
            return []

        runs = mlflow.search_runs(
            experiment_ids=[experiment.experiment_id],
            max_results=limit,
            order_by=["start_time DESC"],
        )

        result = []
        for _, row in runs.iterrows():
            run_data = {
                "run_id": row.get("run_id", ""),
                "run_name": row.get("tags.mlflow.runName", ""),
                "status": row.get("status", ""),
                "start_time": str(row.get("start_time", "")),
                "type": row.get("tags.type", ""),
                "metrics": {},
                "params": {},
            }
            for col in runs.columns:
                if col.startswith("metrics."):
                    val = row[col]
                    if not (isinstance(val, float) and np.isnan(val)):
                        run_data["metrics"][col.replace("metrics.", "")] = val
                elif col.startswith("params."):
                    val = row[col]
                    if isinstance(val, str):
                        run_data["params"][col.replace("params.", "")] = val
            result.append(run_data)

        return result
    except Exception as e:
        return {"error": str(e), "runs": []}


# ══════════════════════════════════════════════
# PLANNING SYSTEM
# ══════════════════════════════════════════════

@app.post("/api/planning/generate")
async def generate_plan(req: PlanRequest):
    query = {}
    if req.region:
        query["region"] = {"$regex": req.region, "$options": "i"}

    facilities = await db.facilities.find(query, {"_id": 0}).to_list(5000)

    region_summaries = {}
    for fac in facilities:
        region = fac["region"]
        if region not in region_summaries:
            region_summaries[region] = {
                "count": 0, "total_beds": 0, "total_staff": 0,
                "types": {}, "deserts": 0, "key_facilities": [],
            }
        rs = region_summaries[region]
        rs["count"] += 1
        rs["total_beds"] += fac.get("beds", 0)
        rs["total_staff"] += fac.get("staff_count", 0)
        t = fac["type"]
        rs["types"][t] = rs["types"].get(t, 0) + 1
        if "MEDICAL DESERT" in fac.get("notes", ""):
            rs["deserts"] += 1
        if fac.get("beds", 0) > 100 or "Critical" in fac.get("operational_status", "") or fac["type"] in ("Teaching Hospital", "Regional Hospital"):
            rs["key_facilities"].append(
                f"{fac['name']} ({fac['type']}, {fac['beds']} beds, {fac['staff_count']} staff, {fac['operational_status']})"
            )

    facility_context = ""
    for region, rs in region_summaries.items():
        facility_context += f"\n{region}: {rs['count']} facilities, {rs['total_beds']} beds, {rs['total_staff']} staff, {rs['deserts']} deserts\n"
        facility_context += f"  Types: {rs['types']}\n"
        if rs["key_facilities"]:
            facility_context += f"  Key facilities: {'; '.join(rs['key_facilities'][:10])}\n"

    prompt = f"""Based on Ghana healthcare data, generate a resource allocation plan.

REGIONAL SUMMARY:
{facility_context}

USER REQUEST:
Region focus: {req.region or 'All regions'}
Specialty focus: {req.specialty or 'General'}
Additional context: {req.description or 'None provided'}

Generate a concise plan that:
1. Identifies the most critical gaps
2. Prioritizes actions by urgency (P0, P1, P2)
3. Suggests specific resource deployments
4. Estimates impact
5. Recommends partnerships

Format clearly with sections and bullet points."""

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"plan_{uuid.uuid4().hex[:8]}",
            system_message="You are a healthcare resource planning expert for the Virtue Foundation, focused on Ghana. Generate concise, actionable plans.",
        )
        chat.with_model("gemini", "gemini-2.5-flash")

        user_msg = UserMessage(text=prompt)
        plan_text = await chat.send_message(user_msg)

        plan_id = f"plan_{uuid.uuid4().hex[:8]}"
        plan_doc = {
            "plan_id": plan_id,
            "region": req.region,
            "specialty": req.specialty,
            "description": req.description,
            "plan_text": plan_text,
            "created_at": datetime.now(timezone.utc),
        }
        await db.plans.insert_one(plan_doc)
        del plan_doc["_id"]

        return plan_doc
    except Exception as e:
        error_msg = str(e)
        if "budget" in error_msg.lower():
            raise HTTPException(status_code=429, detail="LLM budget limit reached.")
        raise HTTPException(status_code=500, detail=f"Plan generation error: {error_msg}")


@app.get("/api/planning/history")
async def get_plan_history():
    plans = await db.plans.find({}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return plans


# ══════════════════════════════════════════════
# STARTUP & HEALTH
# ══════════════════════════════════════════════

@app.on_event("startup")
async def startup():
    await build_faiss_index()
    print("Application started. FAISS index ready with sentence-transformers embeddings.")


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "faiss_index_size": faiss_index.ntotal if faiss_index else 0,
        "embed_model": "all-MiniLM-L6-v2",
        "embed_dim": EMBED_DIM,
        "features": ["sentence-transformers", "mlflow", "text2sql", "multi-turn-memory"],
    }
