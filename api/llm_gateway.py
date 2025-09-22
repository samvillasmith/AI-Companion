# api/llm_gateway.py
#
# FastAPI gateway that fans out to OpenAI, xAI, Google Gemini, and Bedrock.
# Adds hard stop sequences so models don't start "User:" lines.
#
# Requirements (tested):
#   fastapi, uvicorn[standard], pydantic, boto3, google-generativeai, python-dotenv
#   openai==1.51.2  (pin avoids older httpx/proxy kwarg issues)
#
# Run:
#   ./multichatvenv/Scripts/python -m uvicorn api.llm_gateway:app --host 127.0.0.1 --port 8000 --reload

from typing import List, Optional, Literal, Dict, Any
import os, json

from dotenv import load_dotenv
load_dotenv()  # so your .env at repo root is picked up for Python too

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# --- Stop markers to prevent roleplay echoing
# OpenAI has a limit of 4 stop sequences, so we define two sets
STOP_MARKERS_FULL = ["\nUser:", "User:", "\nHuman:", "Human:", "\nAssistant:", "Assistant:", "\nASSISTANT:"]
STOP_MARKERS_LIMITED = ["\nUser:", "\nHuman:", "\nAssistant:", "Human:"]  # Max 4 for OpenAI

# --- Provider env
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
BEDROCK_REGION = os.getenv("BEDROCK_REGION", AWS_REGION)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
XAI_API_KEY = os.getenv("XAI_API_KEY", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_GENERATIVE_AI_API_KEY", "")

# Bedrock defaults / aliases
BEDROCK_MODEL_DEFAULT = os.getenv("BEDROCK_MODEL_DEFAULT", "anthropic.claude-3-5-sonnet-20240620-v1:0")

# --- FastAPI
app = FastAPI(title="polyglot-gateway")

# --- Models
Role = Literal["system", "user", "assistant"]

class Msg(BaseModel):
    role: Role
    content: str

class ChatBody(BaseModel):
    provider: Literal["openai", "xai", "google", "bedrock"]
    model: str
    messages: List[Msg]
    temperature: Optional[float] = 0.6
    top_p: Optional[float] = 0.95
    max_output_tokens: Optional[int] = Field(512, alias="max_output_tokens")


# ------------------- Provider call helpers -------------------

# OpenAI-compatible (OpenAI & xAI share client)
from openai import OpenAI as OpenAIClient
import httpx

def _openai_client(base_url: Optional[str], api_key: str) -> OpenAIClient:
    # Don't pass 'proxies' param; older httpx versions complain
    return OpenAIClient(base_url=base_url, api_key=api_key, default_headers={"X-Title": "polyglot-gateway"})

def call_openai_like(base_url: Optional[str], api_key: str, model: str, messages: List[Msg],
                     temperature: float, top_p: float, max_tokens: int, use_limited_stops: bool = False) -> str:
    client = _openai_client(base_url=base_url, api_key=api_key)
    # massage messages
    msgs = [{"role": m.role, "content": m.content} for m in messages]
    
    # Use limited stop sequences for OpenAI (max 4)
    stop_sequences = STOP_MARKERS_LIMITED if use_limited_stops else STOP_MARKERS_FULL
    
    resp = client.chat.completions.create(
        model=model,
        messages=msgs,
        temperature=temperature,
        top_p=top_p,
        max_tokens=max_tokens,
        stop=stop_sequences,
    )
    text = (resp.choices[0].message.content or "").strip()
    return text

# Google Gemini
def call_gemini(model: str, messages: List[Msg], temperature: float, top_p: float, max_tokens: int) -> str:
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=400, detail="GOOGLE_GENERATIVE_AI_API_KEY is not set")
    import google.generativeai as genai
    
    genai.configure(api_key=GOOGLE_API_KEY)
    
    # Flatten to a single user prompt with a system header
    system_parts = [m.content for m in messages if m.role == "system"]
    user_parts: List[str] = []
    for m in messages:
        if m.role in ("user", "assistant"):
            prefix = "User: " if m.role == "user" else "Assistant: "
            user_parts.append(prefix + m.content)
    
    prompt = ("\n".join(system_parts) + "\n\n" if system_parts else "") + "\n".join(user_parts)
    
    model_ = genai.GenerativeModel(model)
    
    # Use proper enum values from the library
    try:
        resp = model_.generate_content(
            prompt,
            generation_config={
                "temperature": temperature,
                "top_p": top_p,
                "max_output_tokens": max_tokens,
            },
            safety_settings=[
                {
                    "category": genai.types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    "threshold": genai.types.HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    "category": genai.types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                    "threshold": genai.types.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                },
                {
                    "category": genai.types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    "threshold": genai.types.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                },
                {
                    "category": genai.types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    "threshold": genai.types.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                },
            ],
        )
        
        # Handle response
        if hasattr(resp, 'text'):
            text = resp.text
        else:
            # Fallback to parsing parts
            try:
                if resp.candidates and len(resp.candidates) > 0:
                    cand = resp.candidates[0]
                    if hasattr(cand, 'content') and hasattr(cand.content, 'parts'):
                        text = "".join([p.text for p in cand.content.parts if hasattr(p, 'text')])
                    else:
                        text = "I'm here to help! What would you like to know?"
                else:
                    text = "I'm here to help! What would you like to know?"
            except Exception as e:
                print(f"Error parsing Gemini response: {e}")
                text = "I'm here to help! What would you like to know?"
                
    except Exception as e:
        print(f"Gemini generation error: {e}")
        # Fallback response if Gemini blocks the content
        text = "I'm here to help! What would you like to know?"
    
    return (text or "").strip()

# Bedrock (Anthropic Claude via Bedrock Runtime)
def call_bedrock(model_or_profile: str, messages: List[Msg],
                 temperature: float, top_p: float, max_tokens: int) -> str:
    import boto3
    runtime = boto3.client("bedrock-runtime", region_name=BEDROCK_REGION)
    # Map OpenAI-style messages to Anthropic messages
    anthro_msgs: List[Dict[str, Any]] = []
    for m in messages:
        if m.role == "system":
            # Anthropic supports a top-level system string; we fold it into the first user turn
            anthro_msgs.append({"role": "user", "content": [{"type": "text", "text": m.content}]})
        else:
            anthro_msgs.append({"role": m.role, "content": [{"type": "text", "text": m.content}]})

    payload = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "temperature": temperature,
        "top_p": top_p,
        "stop_sequences": STOP_MARKERS_FULL,  # Bedrock can handle all stop sequences
        "messages": anthro_msgs,
    }

    # Support either classic modelId or an Inference Profile ARN (needed for v2 serverless restrictions)
    if ":inference-profile/" in model_or_profile:
        resp = runtime.invoke_model(
            inferenceProfileArn=model_or_profile,
            body=json.dumps(payload).encode("utf-8"),
        )
    else:
        resp = runtime.invoke_model(
            modelId=model_or_profile,
            body=json.dumps(payload).encode("utf-8"),
        )

    body = json.loads(resp["body"].read().decode("utf-8"))
    # Anthropic returns {content:[{type:'text', text:'...'}], ...}
    parts = body.get("content", [])
    text = ""
    for p in parts:
        if p.get("type") == "text":
            text += p.get("text", "")
    return text.strip()


# ------------------- Routes -------------------

@app.get("/v1/healthz")
def healthz():
    return {"ok": True}

@app.get("/v1/diag/providers")
def diag():
    return {
        "openai": {"key_set": bool(OPENAI_API_KEY)},
        "xai": {"key_set": bool(XAI_API_KEY)},
        "google": {"key_set": bool(GOOGLE_API_KEY)},
        "bedrock": {
            "region": BEDROCK_REGION,
            "default_model": BEDROCK_MODEL_DEFAULT,
        },
        "masks": {
            "OPENAI_API_KEY": (OPENAI_API_KEY[:4] + "..." + OPENAI_API_KEY[-4:]) if OPENAI_API_KEY else "",
            "XAI_API_KEY": (XAI_API_KEY[:4] + "..." + XAI_API_KEY[-4:]) if XAI_API_KEY else "",
            "GOOGLE_GENERATIVE_AI_API_KEY": (GOOGLE_API_KEY[:4] + "..." + GOOGLE_API_KEY[-4:]) if GOOGLE_API_KEY else "",
        },
    }

@app.post("/v1/chat")
def chat(body: ChatBody):
    try:
        provider = body.provider
        model = body.model or BEDROCK_MODEL_DEFAULT
        temperature = float(body.temperature or 0.6)
        top_p = float(body.top_p or 0.95)
        max_tokens = int(body.max_output_tokens or 512)
        messages = body.messages

        if provider == "openai":
            if not OPENAI_API_KEY:
                raise HTTPException(status_code=400, detail="OPENAI_API_KEY is not set")
            # OpenAI needs limited stop sequences (max 4)
            text = call_openai_like(
                base_url=None,
                api_key=OPENAI_API_KEY,
                model=model,
                messages=messages,
                temperature=temperature,
                top_p=top_p,
                max_tokens=max_tokens,
                use_limited_stops=True,  # Use only 4 stop sequences
            )
            return {"text": text, "provider": "openai", "model": model}

        if provider == "xai":
            if not XAI_API_KEY:
                raise HTTPException(status_code=400, detail="XAI_API_KEY is not set")
            # xAI can handle all stop sequences
            text = call_openai_like(
                base_url="https://api.x.ai/v1",
                api_key=XAI_API_KEY,
                model=model,
                messages=messages,
                temperature=temperature,
                top_p=top_p,
                max_tokens=max_tokens,
                use_limited_stops=False,  # xAI can handle all stop sequences
            )
            return {"text": text, "provider": "xai", "model": model}

        if provider == "google":
            text = call_gemini(
                model=model,
                messages=messages,
                temperature=temperature,
                top_p=top_p,
                max_tokens=max_tokens,
            )
            return {"text": text, "provider": "google", "model": model}

        if provider == "bedrock":
            text = call_bedrock(
                model_or_profile=model,
                messages=messages,
                temperature=temperature,
                top_p=top_p,
                max_tokens=max_tokens,
            )
            return {"text": text, "provider": "bedrock", "model": model}

        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")
    except HTTPException:
        raise
    except Exception as e:
        # Surface upstream errors cleanly to your Next handler
        raise HTTPException(status_code=500, detail=str(e))