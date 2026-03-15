# ai_microservice/models.py
from pydantic import BaseModel, Field, validator

# ==================== Chat Models ====================

class ChatRequest(BaseModel):
    """Request model for chat endpoint"""
    message: str = Field(..., min_length=1, max_length=1000, description="User message")
    
    @validator('message')
    def validate_message(cls, v):
        if not v.strip():
            raise ValueError("Message cannot be empty")
        return v.strip()

class ChatResponse(BaseModel):
    """Response model for chat endpoint"""
    reply: str
    model: str
    tokens_used: int

# ==================== Summarization Models ====================

class SummarizeRequest(BaseModel):
    """Request model for summarization endpoint"""
    text: str = Field(..., min_length=50, description="Text to summarize")
    
    @validator('text')
    def validate_text(cls, v):
        cleaned = v.strip()
        if len(cleaned) < 50:
            raise ValueError("Text too short for summarization (min 50 chars)")
        return cleaned

class SummarizeResponse(BaseModel):
    """Response model for summarization endpoint"""
    summary: str
    word_count: int
    model: str

# ==================== Health Models ====================

class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    service: str
    version: str
    chat_model: str
    summary_model: str