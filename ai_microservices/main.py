# ai_microservice/main.py

# ==================== ⚠️ CRITICAL: ENV & WARNINGS FIRST ====================
import os
import warnings

# Suppress TensorFlow/oneDNN warnings
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

# Suppress Transformer/Tokenizer warnings BEFORE importing them
warnings.filterwarnings('ignore', category=UserWarning, message='.*forced_bos_token_id.*')
warnings.filterwarnings('ignore', category=DeprecationWarning)
warnings.filterwarnings('ignore', message='.*tf_keras.*')
warnings.filterwarnings('ignore', message='.*sparse_softmax_cross_entropy.*')
warnings.filterwarnings('ignore', message='.*truncate.*')
# ============================================================================

from fastapi import FastAPI, HTTPException, Request, Depends, Header   # type: ignore
from starlette.middleware.base import BaseHTTPMiddleware               # type: ignore
from fastapi.middleware.cors import CORSMiddleware                     # type: ignore
from fastapi.responses import JSONResponse                             # type: ignore
from config import SERVICE_INFO, INTERNAL_API_KEY
from models import (
    ChatRequest, ChatResponse,
    SummarizeRequest, SummarizeResponse,
    HealthResponse
)
from chatbot import process_chat
from contextlib import asynccontextmanager
from summarizer import process_summarization,SummarizerModel

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up model at startup (not on first request)
    print("🚀 Warming up Qwen model at startup...")
    await SummarizerModel.get_model()
    print("✅ Model ready!")
    yield
    # Cleanup on shutdown (optional)
    print("🛑 Shutting down AI microservice...")

app = FastAPI(
    title=SERVICE_INFO["name"],
    description="Modular AI microservice for chat and summarization",
    version=SERVICE_INFO["version"],
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# 🔒 Limit request body size to 1MB — prevents large payload attacks on port 8000
MAX_REQUEST_BODY_SIZE = 1 * 1024 * 1024  # 1MB

class LimitRequestSizeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.headers.get("content-length"):
            content_length = int(request.headers["content-length"])
            if content_length > MAX_REQUEST_BODY_SIZE:
                return JSONResponse(
                    status_code=413,
                    content={"error": "Request body too large. Maximum size is 1MB."}
                )
        return await call_next(request)

app.add_middleware(LimitRequestSizeMiddleware)

# 🔒 Load allowed origins from env — supports comma-separated multiple origins
allowed_origins = [
    origin.strip() 
    for origin in os.getenv("NODE_BACKEND_URL", "http://localhost:5000").split(",")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type", "INTERNAL_API_KEY"],
)

# ==================== 🔐 API Key Verification ====================

async def verify_internal_api_key(
    internal_api_key: str = Header(None, alias="INTERNAL_API_KEY")
):
    """Verify the internal API key for protected endpoints"""
    if not internal_api_key or internal_api_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return internal_api_key

# ==================== Health Endpoints ====================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint (public - no API key required)"""
    return HealthResponse(
        status="healthy",
        service="ai-microservice",
        version=SERVICE_INFO["version"],
        chat_model=SERVICE_INFO["chat_model"],
        summary_model=SERVICE_INFO["summary_model"],
    )

@app.get("/")
async def root():
    """Root endpoint with service info (public - no API key required)"""
    return {
        "message": "AI Microservice is running",
        "version": SERVICE_INFO["version"],
        "endpoints": {
            "chat": "/chat",
            "summarize": "/summarize",
            "health": "/health"
        }
    }

# ==================== Chat Endpoint ====================

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest, 
    _ = Depends(verify_internal_api_key)  # 🔐 API Key Required
):
    """
    Chat with AI model
    
    - **message**: Your message to the AI
    - **X-Internal-API-Key**: Required header for authentication
    """
    try:
        response = await process_chat(request)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Summarization Endpoint ====================

@app.post("/summarize", response_model=SummarizeResponse)
async def summarize_endpoint(
    request: SummarizeRequest,
    _ = Depends(verify_internal_api_key)  # 🔐 API Key Required
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

# ==================== Error Handlers ====================

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