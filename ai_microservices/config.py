# ai_microservice/config.py
import os
from dotenv import load_dotenv
from openai import AsyncOpenAI  # Use AsyncOpenAI for async endpoints
from google import genai        # Gemini SDK (used for summarization)

# ============================================================
# Load environment variables
# ============================================================

load_dotenv()

# ============================================================
# Hugging Face Token (still used for chat)
# ============================================================

HF_TOKEN = os.getenv("HF_TOKEN")
if not HF_TOKEN:
    raise ValueError("HF_TOKEN environment variable is required")

# ============================================================
# Gemini API Key (used for summarization)
# ============================================================

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is required")

# ============================================================
# Internal API Authentication
# ============================================================

INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")
if not INTERNAL_API_KEY:
    raise ValueError("INTERNAL_API_KEY environment variable is required")

# ============================================================
# Async OpenAI Client (Hugging Face Router) – used for /chat
# ============================================================

client = AsyncOpenAI(
    base_url="https://router.huggingface.co/v1",
    api_key=HF_TOKEN,
    timeout=60.0,
)

# ============================================================
# Gemini Client – used for /summarize
# ============================================================

gemini_client = genai.Client(api_key=GEMINI_API_KEY)

# ============================================================
# Model Configuration
# ============================================================

CHAT_MODEL = "meta-llama/Llama-3.1-8B-Instruct:preferred"
SUMMARY_MODEL = "gemini-3.1-flash-lite"   # switched from HF router to Gemini free tier

# ============================================================
# Generation Configuration
# ============================================================

MAX_CHAT_TOKENS = 256
MAX_SUMMARY_TOKENS = 512

# ============================================================
# Health Check Information
# ============================================================

SERVICE_INFO = {
    "name": "AI Microservice",
    "version": "2.0",
    "chat_model": CHAT_MODEL,
    "summary_model": SUMMARY_MODEL,
}