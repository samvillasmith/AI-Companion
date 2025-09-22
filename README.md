# AI Companion Platform (LLM Gateway + App)

A production‑ready, multi‑provider **LLM platform** with:

* **Unified LLM Gateway** (FastAPI) abstracting **OpenAI**, **Google Gemini**, and **AWS Bedrock** via one stable API
* **Full‑stack app** (Next.js 15 / TypeScript) with **Clerk** auth, **Stripe** subscriptions, **Prisma + Postgres**
* **RAG**: short‑term memory in **Upstash Redis** + long‑term semantic recall via **Pinecone + LangChain + OpenAI Embeddings**
* Deployable to **Vercel** (app) and **Railway** (gateway)

> Truth in advertising: this repo runs in prod today; the gateway is the platform. The app is one client of that platform.

---

## Table of Contents

* [Architecture](#architecture)
* [Monorepo Structure](#monorepo-structure)
* [Features](#features)
* [Quick Start (Local)](#quick-start-local)
* [Environment Variables](#environment-variables)
* [RAG (Memory + Retrieval)](#rag-memory--retrieval)
* [Deploy: Vercel (App)](#deploy-vercel-app)
* [Deploy: Railway (LLM Gateway)](#deploy-railway-llm-gateway)
* [Gateway API Contract](#gateway-api-contract)
* [Security & Governance](#security--governance)
* [Observability & Metrics](#observability--metrics)
* [Troubleshooting](#troubleshooting)
* [Roadmap](#roadmap)
* [License](#license)

---

## Architecture

```
+------------------+           +--------------------+            +---------------------+
| Frontend / App   |  HTTPS    |   LLM Gateway      | Providers  | OpenAI / Gemini /   |
| (Next.js)        +---------->+ (FastAPI/Uvicorn) +----------->+ Bedrock Adapters    |
| Clerk + Stripe   |  Bearer   | AuthN + Routing    |            | (SDK clients)       |
+------------------+  token    +---------+----------+            +----------+----------+
        |                          ^     |                                  |
        | REST /api/*              |     | RAG / Memory                      |
        v                          |     v                                  v
+------------------+               |  +-------------------+         +-------------------+
| Postgres (Prisma)|  read/write   |  | Redis (Upstash)   |         | Pinecone (LangChain)
| companions, msgs |<--------------+  | short‑term history|         | long‑term semantic |
| subscriptions    |                  +-------------------+         | memory/retrieval   |
+------------------+                                                   +-------------------+
```

**Flow (chat):** UI → Next API decides provider/model → calls **Gateway /v1/chat** with Bearer token → Gateway fetches Redis history + Pinecone RAG context → invokes provider → returns normalized response → app persists and streams.

---

## Monorepo Structure

```
app/                # Next.js (routes, API, UI)
llm_gateway/        # FastAPI gateway (main.py, requirements.txt, railway.json)
lib/                # env-check, llm utils, memory (Redis+Pinecone), Prisma client
prisma/             # schema.prisma, migrations
public/             # static assets
```

---

## Features

* **Unified LLM API**: one JSON contract across OpenAI, Gemini, Bedrock
* **RAG**: Redis short‑term memory + Pinecone similarity search merged into prompts
* **Subscriptions**: Stripe‑gated companion creation; webhook updates
* **Auth**: Clerk sessions; server‑side route protection
* **Routing**: category→provider/model with safe defaults (cheap/fast vs premium)
* **Rate limiting**: Upstash‑based guards for API abuse
* **Production deploys**: Vercel (app), Railway (gateway)

---

## Quick Start (Local)

### App (Next.js)

```bash
# Install
npm install

# DB (Postgres) – set DATABASE_URL first
npx prisma generate
npx prisma migrate dev

# Run
npm run dev
```

### Gateway (FastAPI)

```bash
cd llm_gateway
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Env: set at least one provider key
export OPENAI_API_KEY=...
# or
export GOOGLE_API_KEY=...
# or Bedrock:
export AWS_ACCESS_KEY_ID=...; export AWS_SECRET_ACCESS_KEY=...; export AWS_REGION=us-east-1

uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

**Point the app at your local gateway**

```
# .env.local (app)
GATEWAY_URL=http://127.0.0.1:8000
```

**Smoke test**

```bash
curl -s http://127.0.0.1:8000/v1/chat \
  -H 'content-type: application/json' \
  -d '{
        "provider":"openai",
        "model":"gpt-4o-mini",
        "messages":[{"role":"user","content":"hello"}]
      }'
```

---

## Environment Variables

### App (Next.js, Vercel)

```
# Platform
GATEWAY_URL = https://<your-gateway>.up.railway.app
NEXT_PUBLIC_APP_URL = https://<your-app>.vercel.app

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_live_...
CLERK_SECRET_KEY = sk_live_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL = /sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL = /sign-up

# Database (Postgres)
DATABASE_URL = postgres://user:pass@host/db

# Stripe
STRIPE_SECRET_KEY = sk_live_...
STRIPE_WEBHOOK_SECRET = whsec_...

# Upstash
UPSTASH_REDIS_REST_URL = ...
UPSTASH_REDIS_REST_TOKEN = ...

# RAG (if using Pinecone via app)
PINECONE_API_KEY = ...
PINECONE_INDEX = ...
```

### Gateway (Railway)

```
# Service auth
GATEWAY_TOKEN = <random-long-secret>

# Providers
OPENAI_API_KEY = ...
GOOGLE_API_KEY = ...
AWS_ACCESS_KEY_ID = ...
AWS_SECRET_ACCESS_KEY = ...
AWS_REGION = us-east-1

# (Optional) Pinecone if doing embeds here
PINECONE_API_KEY = ...
PINECONE_INDEX = ...
```

> Note: Clerk must be configured with your production domain(s) in the Clerk Dashboard → Domains & URLs.

---

## RAG (Memory & Retrieval)

* **Short‑term memory**: Upstash Redis; conversation turns stored as a sorted set per `{userId}:{companionId}`.
* **Long‑term memory**: Pinecone vector index via LangChain’s `PineconeStore`; embeddings via `OpenAIEmbeddings`.
* **At inference**: recent turns are read; we run a **similarity search** against Pinecone and inject the concatenated `pageContent` into the prompt context before provider invocation.

> Code:

* `lib/memory.ts` – MemoryManager (Redis + Pinecone)
* `app/api/chat/[chatId]/route.ts` – calls `vectorSearch(recentChatHistory, companion.name)` and merges results into the prompt

---

## Deploy: Vercel (App)

1. Connect repo → Vercel; add env vars from **App** section.
2. **Postgres**: point `DATABASE_URL` to a managed DB (Neon/Supabase/Railway Postgres).
3. Run once against prod DB:

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```
4. **Stripe Webhook**: add endpoint `https://<your-app>/api/webhook` → copy signing secret to `STRIPE_WEBHOOK_SECRET`.
5. **Images**: in `next.config.ts` use `images.remotePatterns` (the legacy `images.domains` is deprecated).

---

## Deploy: Railway (LLM Gateway)

1. **Service Root Directory**: set to `llm_gateway` (Service → Settings → Source → Add Root Directory).
2. **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`.
3. **Variables**: add provider keys + `GATEWAY_TOKEN`.
4. **Networking**: Generate public domain; Healthcheck Path `/health` (expose a simple `GET /health`).
5. **CORS**: allow only your app domains in `main.py`:

   ```py
   app.add_middleware(CORSMiddleware,
     allow_origins=["https://www.yourdomain.com","https://<app>.vercel.app"],
     allow_methods=["*"], allow_headers=["*"], allow_credentials=True)
   ```
6. **Test**:

   ```bash
   curl -s https://<gateway>.up.railway.app/v1/chat -H 'content-type: application/json' -d '{"provider":"google","model":"gemini-1.5-flash","messages":[{"role":"user","content":"hello"}]}'
   ```

**CLI fallback (always works):**

```bash
npm i -g @railway/cli
railway login
cd llm_gateway
railway init   # or railway link
railway up
```

---

## Gateway API Contract

**POST /v1/chat**

```json
{
  "provider": "openai" | "google" | "bedrock",
  "model": "gpt-4o-mini" | "gemini-1.5-flash" | "anthropic.claude-3-haiku-20240307-v1:0",
  "messages": [{"role": "system|user|assistant", "content": "..."}],
  "temperature": 0.7,
  "top_p": 1.0,
  "max_tokens": 512
}
```

**200**

```json
{ "text": "…", "provider": "openai", "model": "gpt-4o-mini", "tokens_in": 345, "tokens_out": 210, "latency_ms": 820 }
```

**4xx/5xx**

```json
{ "error": { "code": "invoke_failed", "message": "…", "provider": "openai" } }
```

---

## Security & Governance

* **Service‑to‑service auth**: App sends `Authorization: Bearer <GATEWAY_TOKEN>`; gateway validates header.
* **CORS**: restrict to known origins (Vercel domain + custom domain).
* **Quotas/rate limits**: per‑user.
* **Data isolation**: RAG namespaces per user/companion; do not cross‑tenant.
* **PII**: optional redaction hook prior to embedding/storage.

---

## Observability & Metrics

* **Structured logs**: include network traffic, costs, memory, CPU usage, and more from Railway and Vercel. 
* **(Planned) OpenTelemetry**: instrument FastAPI + Next.js API routes; export to OTLP backend.

---

## Troubleshooting

* **Cannot import module "llm\_gateway"** when running uvicorn

  * Run from repo root: `uvicorn llm_gateway.main:app ...` **or** from folder: `uvicorn main:app ...`.
* **ECONNREFUSED** from app to gateway

  * Gateway not running or wrong `GATEWAY_URL`. Use `http://127.0.0.1:8000` locally.
* **unknown scheme** calling gateway

  * `GATEWAY_URL` must include scheme: `https://<gateway>.up.railway.app` (no port).
* **502 Application failed to respond** on Railway

  * Usually missing provider creds (e.g., Bedrock) or region. Set `AWS_*` and ensure model access in that region.
* **401 Unauthorized creating/editing companions**

  * Don’t require `user.firstName` for auth. Check only `user?.id`. Use a display‑name fallback (`firstName || username || email localpart`).
* **Clerk session redirect loops**


---

## Roadmap

* SDKs (TS/Python) + Postman collection
* Config‑driven routing (DB table; can toggle models without redeploy)
* OpenTelemetry traces + dashboards (latency, errors, cost/1k tokens)
* K8s/EKS deployment manifests
* Deployment to AWS

