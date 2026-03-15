# ai_microservice/chatbot.py
import re
from pathlib import Path
from huggingface_hub import InferenceClient # type: ignore
from config import client, CHAT_MODEL, MAX_CHAT_TOKENS
from models import ChatRequest, ChatResponse

# Load website context ONCE at startup
CONTEXT_FILE = Path(__file__).parent / "data" / "website_context.txt"

try:
    # Try to open and read the context file normally
    with open(CONTEXT_FILE, "r", encoding="utf-8") as f:
        WEBSITE_CONTEXT = f.read()
    print(f"✅ Website context loaded ({len(WEBSITE_CONTEXT)} chars)")

except FileNotFoundError:
    # If the file doesn't exist — don't crash the whole server
    # Just start with empty context and warn the developer
    print(f"⚠️ WARNING: website_context.txt not found at {CONTEXT_FILE}. Chatbot will have no context.")
    WEBSITE_CONTEXT = "Website information is currently unavailable. Please contact support for assistance."

except Exception as e:
    # If file exists but has some other problem (wrong encoding, permissions etc.)
    # Again — don't crash, just warn and continue with empty context
    print(f"⚠️ WARNING: Could not load website context: {e}. Chatbot will have no context.")
    WEBSITE_CONTEXT = "Website information is currently unavailable. Please contact support for assistance."

# System prompt to restrict AI to website info only
SYSTEM_PROMPT = f"""
You are a helpful customer support assistant for FileConverter Pro website.

IMPORTANT RULES:
1. ONLY answer questions using the website information provided below
2. If the question is NOT related to the website information, say: 
   "I'm sorry, I can only answer questions about FileConverter Pro services. For other questions, please contact support."
3. Do NOT make up information or guess
4. Be friendly but professional
5. Keep answers concise (2-3 sentences max)

=== WEBSITE INFORMATION ===
{WEBSITE_CONTEXT}
=== END OF WEBSITE INFORMATION ===

Remember: If the user asks about anything NOT in the website information above, politely decline to answer.
"""

def clean_response(text: str) -> str:
    """Clean up chat response formatting"""
    # Remove extra newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Remove leading/trailing whitespace
    text = text.strip()
    return text

async def process_chat(request: ChatRequest) -> ChatResponse:
    """
    Process chat request using HuggingFace model
    
    Args:
        request: ChatRequest containing user message
        
    Returns:
        ChatResponse with AI reply
        
    Raises:
        Exception: If chat completion fails
    """
    try:
        # Call HuggingFace chat completion WITH system prompt
        response = client.chat_completion(
            model=CHAT_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": request.message}
            ],
            max_tokens=MAX_CHAT_TOKENS,
            temperature=0.3  # Lower = more focused, less hallucination
        )
        
        # Extract reply
        reply = response.choices[0].message.content
        
        # Clean response
        cleaned_reply = clean_response(reply)
        
        # Count tokens (approximate)
        tokens_used = len(cleaned_reply.split())
        
        return ChatResponse(
            reply=cleaned_reply,
            model=CHAT_MODEL,
            tokens_used=tokens_used
        )
        
    except Exception as e:
            error_msg = str(e)
            print("=== CHAT ERROR DEBUG ===")          # helpful for seeing the real issue
            print("Error:", error_msg)
            print("=======================")
            
            if "rate limit" in error_msg.lower():
                raise Exception("API rate limit reached. Try again later.")
            elif "401" in error_msg or "unauthorized" in error_msg.lower():
                raise Exception("Authentication failed - check token or provider access")
            elif "timeout" in error_msg.lower():
                raise Exception("Request timeout.")
            else:
                raise Exception(f"Chat failed: {error_msg[:300]}")