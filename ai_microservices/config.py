# ai_microservice/config.py
import os
from dotenv import load_dotenv # type: ignore
from huggingface_hub import InferenceClient # type: ignore
from pathlib import Path

# Load environment variables
load_dotenv()

# HuggingFace Configuration
HF_TOKEN = os.getenv("HF_TOKEN")
# ── Add these debug prints ──
print("=== DEBUG: HF_TOKEN status ===")
if HF_TOKEN:
    print("Token is loaded")
    print(f"Token length: {len(HF_TOKEN)} characters")
else:
    print("!!! HF_TOKEN is None or empty !!!")
    print("Check your .env file or environment variables")

if not HF_TOKEN:
    raise ValueError("HF_TOKEN environment variable is required")

# Add this near your other env loads
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")
if not INTERNAL_API_KEY:
    raise ValueError("INTERNAL_API_KEY environment variable is required")


# Get the absolute path to the model folder
BASE_DIR = Path(__file__).resolve().parent
LOCAL_MODEL_PATH = os.path.join(BASE_DIR, "model","Qwen2.5-0.5B-Instruct")

# Initialize HuggingFace client
client = InferenceClient(token=HF_TOKEN, timeout=30)

# Model configurations
CHAT_MODEL = "meta-llama/Meta-Llama-3-8B-Instruct"
SUMMARY_MODEL = "Qwen2.5-0.5B-Instruct"

# Model limits
MAX_CHAT_TOKENS = 256

# Health check info
SERVICE_INFO = {
    "name": "AI Microservice",
    "version": "2.0",
    "chat_model": CHAT_MODEL,
    "summary_model": SUMMARY_MODEL
}