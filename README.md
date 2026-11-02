# Tripzyy — AI-Powered Travel Engine & Operator Platform
> **HackCelestial 3.0 | Mandatory Technology Integration: Nugen Intelligence**

Tripzyy is an end-to-end travel concierge and tour operator platform designed for Indian destinations. It combines dynamic itinerary building, real-time routing optimization, vendor management, and domain-aligned artificial intelligence powered by **Nugen Intelligence**, **Groq**, and **Google Gemini**.

---

## 🏗️ System Architecture Diagram

```mermaid
graph TD
    subgraph Client Layer
        A[Traveler Web App - Next.js 14]
        B[Operator Console - /ops]
    end

    subgraph API & Core Service Layer - Go Backend
        C[Chi Router & Middleware]
        D[AI Service Manager - internal/ai]
        E[Trip Planning Engine - internal/engine]
        F[Store & Data Layer - internal/store]
    end

    subgraph Intelligence & Microservices
        G[Nugen Intelligence Platform]
        H[Groq Fast LLM Inference]
        I[Google Gemini Model]
        J[OR-Tools Routing Optimizer]
    end

    subgraph Persistence Layer
        K[(PostgreSQL - Neon DB)]
    end

    A -->|HTTPS / REST| C
    B -->|HTTPS / JWT Auth| C
    C --> D
    C --> E
    C --> F
    
    D -->|Chat Completion & Vector Embeddings| G
    D -->|High-Speed Structured JSON| H
    D -->|Multimodal Fallback| I
    E -->|Travel & Window Constraints| J
    F -->|Queries / Mutations| K
```

---

## 🔄 Data Flow Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User as Traveler / Operator
    participant FE as Next.js Frontend
    participant BE as Go Backend API
    participant Nugen as Nugen Intelligence
    participant Groq as Groq LLM
    participant DB as PostgreSQL DB

    User->>FE: Ask question or request trip itinerary
    FE->>BE: POST /ops/ai/model/ask (JWT authenticated)
    BE->>Nugen: POST /api/v3/inference/embeddings (qwen3-embedding-8b)
    Nugen-->>BE: Return high-dimensional vector embeddings
    BE->>BE: Semantic catalog ranking & constraint check
    alt Nugen Aligned Model Inference
        BE->>Nugen: POST /api/v3/inference/chat/completions (trizpyy-aligned-travel-v1)
        Nugen-->>BE: Domain-grounded travel response
    else Fallback Provider (Resilience Path)
        BE->>Groq: POST /openai/v1/chat/completions (Nugen Domain Prompt)
        Groq-->>BE: Dynamic question response
    end
    BE->>DB: Log decision & store analytics
    BE-->>FE: Return formatted response JSON
    FE-->>User: Render formatted chat card UI
```

---

## 🧬 Nugen Intelligence Integration (Mandatory Requirement)

As mandated for **HackCelestial 3.0**, Tripzyy incorporates Nugen Intelligence's domain alignment and inference capabilities across the application.

```
Base AI Model (qwen-v2p5-0p5b-instruct)
       │
       ▼
Nugen Alignment/Customization (22 Corpus Documents: Destinations, Experiences, Stays, Policies)
       │
       ▼
Domain-Specific Model (trizpyy-aligned-travel-v1)
       │
       ▼
Integration into Tripzyy (Go AI Engine, Vector Search & Operator UI)
```

### 1. Domain Corpus Compilation (`services/nugen/corpus`)
We compiled a dataset of 22 text files (`document_01m3fve5...`) containing:
- Destination guides for 20 Indian cities (Gokarna, Manali, Goa, Ahmedabad, etc.).
- 130 local activities and experiences.
- 68 stay properties and local transport rules.
- Monsoon trip policies, cancellation terms, and traveler Q&A.

### 2. Alignment & Fine-Tuning Pipeline (`services/nugen/align.py`)
- **API Key:** `nugen-7f47a84a030cd42a`
- **Base Model:** `qwen-v2p5-0p5b-instruct`
- **Alignment Project:** `Trizpyy Travel Concierge` (`alignment_01m3g3h3t1b3vdz7`)
- **Deployed Model ID:** `trizpyy-aligned-travel-v1`

### 3. Backend AI Integration (`backend/internal/ai`)
- **Chat Completions:** Calls `https://api.nugen.in/api/v3/inference/chat/completions` using the aligned model `trizpyy-aligned-travel-v1`.
- **Semantic Vector Search:** Calls Nugen Embeddings (`qwen3-embedding-8b`) on `https://api.nugen.in/api/v3/inference/embeddings` for search-by-feeling queries (*"quiet beaches with local food"*).
- **Operator Dashboard Card:** Displays the live 4-step pipeline status on `/ops` with an interactive test input console.

---

## 🛠️ Key Technical Components

| Component | Technology | Technical Purpose |
|---|---|---|
| **Frontend UI** | Next.js 14, React, TailwindCSS, TypeScript | Responsive web interface for Travelers and Tour Operators. |
| **Backend API** | Go (Golang), Chi Router | High-throughput REST API backend with rate limiting and JWT security. |
| **AI Manager** | Go AI Package (`internal/ai`) | Provider management, circuit breakers, fallback handling, and caching. |
| **Domain AI** | Nugen Intelligence Platform | Fine-tuned travel model and vector embedding provider. |
| **Fast LLM** | Groq API | Ultra-low latency JSON generation for itinerary node calculations. |
| **Multimodal LLM**| Google Gemini | Multimodal backup provider for visual and voice transcription tasks. |
| **Routing Engine**| OR-Tools Microservice | Day itinerary sequence optimization with window and pace constraints. |
| **Database** | PostgreSQL (Neon Cloud DB) | Relational storage for users, trips, bookings, vendors, and audit logs. |

---

## ⚙️ Environment Configuration (`backend/.env`)

```env
DATABASE_URL=postgresql://user:pass@ep-holy-silence-b3z3wobc-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=your_jwt_secret_key

# Nugen Intelligence Configuration
NUGEN_API_KEY=nugen-7f47a84a030cd42a
NUGEN_MODEL_ID=trizpyy-aligned-travel-v1
NUGEN_ALIGNMENT_ID=alignment_01m3g3h3t1b3vdz7

GROQ_API_KEY_1=gsk_...
GEMINI_API_KEY_1=AQ...

PORT=8080
PUBLIC_API_URL=http://localhost:8080
PUBLIC_WEB_URL=http://localhost:3000
```

---

## 🚀 Running the Project Locally

### Prerequisites
- Node.js v18+ & npm
- Go v1.21+
- Python 3.9+ (for Nugen scripts)

### Step 1: Start the Go Backend API Server
```bash
cd backend
go run ./cmd/api
```
*The backend API will start listening on `http://localhost:8080`.*

### Step 2: Start the Next.js Frontend Server
```bash
cd frontend
npm install
npm run dev
```
*The web app will start on `http://localhost:3000`.*

### Step 3: Test Nugen AI Integration Endpoints
```bash
python scratch/test_dynamic_questions.py
```

---

## 🔍 How to Demo During Hackathon Judging

1. **Access Operator Dashboard:**  
   Open **`http://localhost:3000/ops`** in your browser.  
   *(Login: `ops@saffrontrails.demo` | Password: `demo1234`)*

2. **Inspect the Nugen Model Card:**  
   Locate the **Trizpyy travel model** panel. All 4 pipeline steps display green active status:
   - 🟢 **Base model:** `qwen-v2p5-0p5b-instruct`
   - 🟢 **Aligned on Trizpyy data:** `22 documents`
   - 🟢 **Travel model deployed:** `trizpyy-aligned-travel-v1`
   - 🟢 **Answering travelers:** `Active`

3. **Execute Live Prompts:**  
   Type questions such as:
   - *"What are top 3 budget spots in Gokarna?"*
   - *"It's raining in Manali today. What can we do?"*  
   Click **Ask**. The system executes live inference and renders a formatted chat card response.

4. **Access Traveler AI Concierge:**  
   Open **`http://localhost:3000`** and click the **Ask Guru AI** floating widget on the bottom-right to interact with the traveler concierge interface.
