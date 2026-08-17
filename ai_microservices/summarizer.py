# ai_microservice/summarizer.py
import re
from google.genai import types
from config import gemini_client, SUMMARY_MODEL, MAX_SUMMARY_TOKENS
from models import SummarizeRequest

# ============================================================
# System Prompt
# ============================================================

SUMMARY_SYSTEM_PROMPT = """
You are a professional document summarization assistant.

Your task is to summarize the user's document clearly and accurately.

Rules:
1. Only use information present in the provided document.
2. Do not invent facts or add information that is not present.
3. Preserve important names, dates, numbers, decisions, and key facts.
4. Remove unnecessary repetition.
5. Make the summary significantly shorter than the original text.
6. Use clear and natural language.
7. Return only the summary.
8. Do not say "Here is the summary".
9. Do not explain your summarization process.
"""

# ============================================================
# Text Cleaning
# ============================================================

def clean_summary(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text.strip()

    prefixes = [
        "Summary:", "summary:",
        "Here is the summary:", "Here is a summary:",
    ]
    for prefix in prefixes:
        if text.startswith(prefix):
            text = text[len(prefix):].strip()
    return text

def count_words(text: str) -> int:
    return len(text.split())

# ============================================================
# Summarization
# ============================================================

async def process_summarization(request: SummarizeRequest) -> dict:
    """
    Summarize document text using the Gemini API (google-genai SDK)
    """
    try:
        response = await gemini_client.aio.models.generate_content(
            model=SUMMARY_MODEL,
            contents=f"Summarize the following document:\n\n{request.text}",
            config=types.GenerateContentConfig(
                system_instruction=SUMMARY_SYSTEM_PROMPT,
                max_output_tokens=MAX_SUMMARY_TOKENS,
                temperature=0.2,
            ),
        )

        summary = response.text

        if not summary:
            raise Exception("Gemini returned an empty summary")

        cleaned_summary = clean_summary(summary)
        if not cleaned_summary:
            raise Exception("Generated summary was empty after cleaning")

        word_count = count_words(cleaned_summary)

        return {
            "summary": cleaned_summary,
            "word_count": word_count,
            "model": SUMMARY_MODEL,
        }

    except Exception as e:
        error_msg = str(e)
        print("=== SUMMARIZATION ERROR DEBUG ===")
        print("Error:", error_msg)
        print("=================================")

        if "401" in error_msg or "403" in error_msg or "unauthorized" in error_msg.lower() or "permission" in error_msg.lower():
            raise Exception("Gemini authentication failed. Check GEMINI_API_KEY.")
        elif "429" in error_msg or "rate limit" in error_msg.lower() or "quota" in error_msg.lower():
            raise Exception("Gemini rate limit or free-tier quota reached. Please try again later.")
        elif "timeout" in error_msg.lower() or "deadline" in error_msg.lower():
            raise Exception("Gemini request timed out.")
        elif "503" in error_msg or "unavailable" in error_msg.lower() or "model" in error_msg.lower():
            raise Exception("Gemini model is currently unavailable.")
        else:
            raise Exception(f"Summarization failed: {error_msg[:300]}")