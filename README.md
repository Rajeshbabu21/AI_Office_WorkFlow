# AI Office WorkFlow

AI-powered office workflow automation platform that classifies support tickets, retrieves SOP solutions using RAG, and automates ticket escalation, assignment, email notifications, and enterprise support workflows. Powered by a local **Ollama (`llama3.2`)** model.

---

## Architecture Overview

- **Local LLM**: [Ollama](https://ollama.com/) running locally with model `llama3.2` on `http://localhost:11434`
  - Ticket Classification via `/api/chat` with structured JSON constraint
  - Solution Synthesis via `/api/chat` using retrieved SOP context and strict zero-trust prompt rules
- **Embeddings & Vector Search**: 384-dimensional dense vectors stored in Supabase pgvector (`sop_chunks.embedding`), compatible with `sentence-transformers` (`all-MiniLM-L6-v2`) and local deterministic embedding generator.
- **Backend**: FastAPI with Python, Supabase client, JWT authentication, and background automated routing.
- **Frontend**: React + Vite + Tailwind CSS dashboard with live workflow stage visualizations.

---

## Prerequisites

1. **Ollama**:
   - Install Ollama from [ollama.com](https://ollama.com)
   - Pull and verify `llama3.2`:
     ```bash
     ollama pull llama3.2
     ollama run llama3.2 "Hello"
     ```
   - Ensure Ollama is running at `http://localhost:11434` (`ollama serve` if not started as a background service).

2. **Python 3.10+** and **Node.js 18+**

---

## Configuration (`.env`)

Create `backend/.env` (or copy from `backend/.env.example`):

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-service-role-key

# Ollama Local LLM Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
OLLAMA_TIMEOUT=90

# Authentication & Security
secret_key=your-jwt-secret-key
access_token_expire_minutes=30
algorithm=HS256
```

---

## Running the Application

### 1. Start Ollama
```bash
ollama serve
```

### 2. Start Backend (FastAPI)
```bash
# Navigate to backend directory
cd backend

# Activate your virtual environment
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server
python main.py
# or: uvicorn app.app:app --host 127.0.0.1 --port 8000 --reload
```

Backend will be accessible at `http://127.0.0.1:8000`.
- Health check: `http://127.0.0.1:8000/ping`
- Ollama status: `http://127.0.0.1:8000/ollama/status`
- Swagger UI docs: `http://127.0.0.1:8000/docs`

### 3. Start Frontend (React + Vite)
```bash
# In a new terminal, navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will be accessible at `http://localhost:5173`.

---

## Testing Local Ollama AI Workflows

To verify Ollama ticket classification and solution generation:

```bash
# From backend directory with venv activated:
python -c "from ticket.ticketaiservice import classify_ticket, generate_ticket_response, check_ollama_status; print('Status:', check_ollama_status()); print('Classify:', classify_ticket('VPN Disconnected', 'Cannot reach internal gateway')); print('Response:', generate_ticket_response('VPN Issue', 'VPN Disconnected', 'Cannot reach gateway', 'High', 'IT Support', 'SOP: Restart AnyConnect and verify credentials.'))"
```
