# ai_microservice/main.py
import os
from fastapi import FastAPI, HTTPException, Request, Depends, Header
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import SERVICE_INFO, INTERNAL_API_KEY
from models import (
    ChatRequest, ChatResponse,
    SummarizeRequest, SummarizeResponse,
    HealthResponse
)
from chatbot import process_chat
from summarizer import process_summarization

app = FastAPI(
    title=SERVICE_INFO["name"],
    description="Modular AI microservice for chat and summarization",
    version=SERVICE_INFO["version"],
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Request size limit (still useful) ──
MAX_REQUEST_BODY_SIZE = 1 * 1024 * 1024

class LimitRequestSizeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > MAX_REQUEST_BODY_SIZE:
                    return JSONResponse(
                        status_code=413,
                        content={"error": "Request body too large. Maximum size is 1MB."}
                    )
            except ValueError:
                return JSONResponse(status_code=400, content={"error": "Invalid Content-Length"})
        return await call_next(request)

app.add_middleware(LimitRequestSizeMiddleware)

# ── CORS ──
allowed_origins = [
    origin.strip()
    for origin in os.getenv("NODE_BACKEND_URL", "http://localhost:5000").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type", "INTERNAL_API_KEY"],
)

# ── API key verification ──
async def verify_internal_api_key(
    internal_api_key: str = Header(None, alias="INTERNAL_API_KEY")
):
    if not internal_api_key or internal_api_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return internal_api_key

# ── Health ──
@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        service="ai-microservice",
        version=SERVICE_INFO["version"],
        chat_model=SERVICE_INFO["chat_model"],
        summary_model=SERVICE_INFO["summary_model"],
    )

@app.get("/")
async def root():
    return {
        "message": "AI Microservice is running",
        "version": SERVICE_INFO["version"],
        "endpoints": {
            "chat": "/chat",
            "summarize": "/summarize",
            "health": "/health"
        }
    }

# ── Chat ──
@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest,
    _ = Depends(verify_internal_api_key)
):
    try:
        return await process_chat(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Summarization ──
@app.post("/summarize", response_model=SummarizeResponse)
async def summarize_endpoint(
    request: SummarizeRequest,
    _ = Depends(verify_internal_api_key)
):
    try:
        result = await process_summarization(request)
        return SummarizeResponse(
            summary=result["summary"],
            word_count=result["word_count"],
            model=result["model"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Error handlers ──
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={"error": "Endpoint not found", "available_endpoints": ["/chat", "/summarize", "/health"]}
    )

@app.exception_handler(422)
async def validation_error_handler(request: Request, exc):
    return JSONResponse(
        status_code=422,
        content={"error": "Validation failed", "details": str(exc)}
    )

@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "details": str(exc)}
    )