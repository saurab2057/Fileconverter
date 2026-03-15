# ai_microservices/summarizer.py

import re
import torch
import asyncio
from transformers import AutoModelForCausalLM, AutoTokenizer
from config import LOCAL_MODEL_PATH
from models import SummarizeRequest

# --- Singleton Model Loader ---
class SummarizerModel:
    _instance = None
    _tokenizer = None
    _lock = asyncio.Lock()

    @classmethod
    async def get_model(cls):
        if cls._instance is None:
            print(f"🚀 Loading Qwen2.5 from: {LOCAL_MODEL_PATH}...")

            device = "cuda" if torch.cuda.is_available() else "cpu"
            dtype = torch.float16 if device == "cuda" else torch.float32

            cls._tokenizer = AutoTokenizer.from_pretrained(
                LOCAL_MODEL_PATH,
                trust_remote_code=True
            )
            cls._tokenizer.pad_token = cls._tokenizer.eos_token

            # ✅ FIXED: Add low_cpu_mem_usage=False and explicitly move to device
            cls._instance = AutoModelForCausalLM.from_pretrained(
                LOCAL_MODEL_PATH,
                torch_dtype=dtype,
                device_map=None,              # ✅ Don't use device_map
                low_cpu_mem_usage=False,      # ✅ Prevent meta device loading
                trust_remote_code=True
            )
            cls._instance = cls._instance.to(device)  # ✅ Explicitly move to device
            cls._instance.eval()

            print(f"✅ Qwen Model loaded successfully on {device}!")
        return cls._instance

    @classmethod
    def get_tokenizer(cls):
        if cls._tokenizer is None:
            cls._tokenizer = AutoTokenizer.from_pretrained(
                LOCAL_MODEL_PATH,
                trust_remote_code=True
            )
            cls._tokenizer.pad_token = cls._tokenizer.eos_token
        return cls._tokenizer


def clean_text(text: str) -> str:
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


async def process_summarization(request: SummarizeRequest) -> dict:
    async with SummarizerModel._lock:
        try:
            cleaned_text = clean_text(request.text)

            word_count = len(cleaned_text.split())
            if word_count > 500:
                raise ValueError(
                    f"Input text exceeds 500 word limit (found {word_count})."
                )

            model = await SummarizerModel.get_model()
            tokenizer = SummarizerModel.get_tokenizer()

            # Strict instructions to prevent hallucination
            system_instruction = (
                "You are a precise summarization tool. "
                "Your task is to summarize the provided text using ONLY information present in the text. "
                "DO NOT invent details, names, places, or outcomes. "
                "DO NOT use outside knowledge. "
                "Keep the summary factual and concise and short and sweet."
            )

            # Create Qwen chat prompt
            messages = [
                {
                    "role": "system",
                    "content": system_instruction,
                },
                {
                    "role": "user",
                    "content": f"Summarize the following text:\n{cleaned_text}"
                }
            ]

            text_input = tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True
            )

            inputs = tokenizer(text_input, return_tensors="pt")
            
            # ✅ FIXED: Move inputs to model's device
            device = model.device
            inputs = {k: v.to(device) for k, v in inputs.items()}

            with torch.no_grad():
                outputs = model.generate(
                    **inputs,
                    max_new_tokens=256,
                    do_sample=True,
                    temperature=0.2,
                    top_p=0.85,
                    pad_token_id=tokenizer.eos_token_id
                )

            # ✅ FIXED: Ensure outputs are on CPU before decoding
            outputs = outputs.cpu()
            
            # Decode only generated tokens
            summary_text = tokenizer.decode(
                outputs[0][inputs["input_ids"].shape[1]:],
                skip_special_tokens=True
            )

            return {
                "summary": summary_text.strip(),
                "word_count": len(summary_text.split()),
                "model": "qwen2.5-0.5b-instruct-local"
            }

        except Exception as e:
            print(f"Inference Error: {e}")
            raise RuntimeError(f"Qwen model inference failed: {str(e)}")