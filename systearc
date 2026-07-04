# System Architecture - AutoFlow AI Console

This document outlines the system architecture, component layout, database structures, and workflow pipelines for the AutoFlow AI support platform.

---

## 1. System Architecture Overview

```mermaid
graph TD
    %% Frontend Layer
    subgraph Frontend [Vite + React SPA Client]
        UI[Home.jsx / Dashboard.jsx]
        AX[Axios Client: authApi / api]
    end

    %% API / Orchestration Layer
    subgraph API [FastAPI Backend Server]
        FA[FastAPI App Router: app.py]
        AUTH[Auth Service: JWT / google-auth]
        TKT[Ticket Service: ticket.py]
        RAG[RAG SOP Processor: sop_service.py]
    end

    %% Third Party Integrations
    subgraph Integrations [External Integration Layer]
        GOG[Google OAuth API]
        JRA[Jira Cloud Rest API]
    end

    %% AI Model Layer
    subgraph AI [Generative AI Layer]
        GEM[Google Gemini AI API]
        EMB[Embedding Generation]
    end

    %% Persistence Layer
    subgraph DB [Supabase Database & Storage]
        S3[(Storage: sop-documents)]
        PG[(PostgreSQL + pgvector DB)]
    end

    %% Data Connections
    UI -->|User Interactions| AX
    AX -->|REST API Requests: port 8000| FA
    
    FA -->|Google Token Verification| GOG
    FA -->|User Session Validation| AUTH
    FA -->|Ingestion & Routing| TKT
    FA -->|PDF Vectorization| RAG

    TKT -->|1. Classify Category / Priority| GEM
    TKT -->|2. Escalate Tickets| JRA

    RAG -->|Generate Text Embeddings| EMB
    RAG -->|Upload SOP PDFs| S3
    RAG -->|Store Document Chunks| PG
    
    TKT -->|Query SOP Context| PG
    TKT -->|CRUD Tickets / Messages / History| PG
    
    AUTH -->|User Credentials & Profile| PG
```

---

## 2. Key Component Details

### A. Frontend Layer (React + Vite)
- **Home Component (`Home.jsx`)**: The landing page displaying interactive visualizers of RAG flows, system telemetry, and a static technology stack section highlighting React, Tailwind CSS, FastAPI, Supabase, PostgreSQL, and Gemini AI.
- **Dashboard Component (`Dashboard.jsx`)**: An administration panel providing a real-time console where users can submit tickets, chat with the AI auto-resolver, write messages/comments, view the system state audit trail, and escalations.
- **API Axios Client (`api/axios.jsx`)**: Centrally handles authorization headers containing the user's JWT bearer tokens.

### B. Backend App Server (FastAPI)
- **FastAPI Core (`app/app.py`)**: Runs on Uvicorn hosting REST endpoints. Handles route protection with JWT authentication dependencies.
- **Auth Component (`auth/auth.py`)**: Validates user registration/logins, hashes passwords via `passlib`, and decodes incoming Bearer tokens.
- **Ticket Module (`ticket/ticket.py`)**: Manages the ticket lifecycle (creation, updates, comment logging, database transactions, email notification triggers, and Jira backlog ticket synchronization).
- **RAG & SOP Processor (`rag/sop_service.py`)**: Performs text extraction from PDF files uploaded to Supabase storage, chunks texts, creates embeddings, and stores them in the DB.

### C. Database & Vector Store (Supabase PostgreSQL)
- Runs relational tables for user tracking and logs, and supports Vector matching fields (`pgvector`) for vector-based semantic retrieval.

---

## 3. Database Schema Blueprint

```mermaid
erDiagram
    USERS {
        int id PK
        string email
        string password_hash
        string role
        string employee_id
        string full_name
        string department
    }
    TICKETS {
        int id PK
        int user_id FK
        string title
        string description
        string category
        string priority
        string status
        int assigned_to FK
        timestamp created_at
        timestamp updated_at
        string department
        string ai_response
    }
    TICKET_MESSAGES {
        int id PK
        int ticket_id FK
        int sender_id FK
        string message
        timestamp created_at
    }
    TICKET_HISTORY {
        int id PK
        int ticket_id FK
        string action
        int performed_by FK
        timestamp created_at
    }
    SOP_DOCUMENTS {
        int id PK
        string title
        string department
        string file_url
        int uploaded_by FK
        timestamp created_at
    }
    ESCALATIONS {
        int id PK
        int ticket_id FK
        string reason
        int performed_by FK
        timestamp escalated_at
    }
    JIRA_TICKETS {
        int id PK
        int ticket_id FK
        string jira_issue_key
        string jira_issue_id
        string jira_status
    }

    USERS ||--o{ TICKETS : "creates"
    USERS ||--o{ TICKET_MESSAGES : "sends"
    TICKETS ||--o{ TICKET_MESSAGES : "contains"
    TICKETS ||--o{ TICKET_HISTORY : "tracks"
    TICKETS ||--o{ ESCALATIONS : "originates"
    TICKETS ||--o| JIRA_TICKETS : "synchronizes"
    USERS ||--o{ SOP_DOCUMENTS : "uploads"
```

---

## 4. End-to-End Ingestion & Processing Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Support Client
    participant FE as React FrontEnd
    participant BE as FastAPI Backend
    participant DB as Supabase DB (PostgreSQL)
    participant AI as Gemini AI API

    User->>FE: Submits support request (Problem details)
    FE->>BE: POST /insert_ticket (with JWT token)
    BE->>DB: Fetch user profile (current_user authorization)
    DB-->>BE: User profile returned
    
    Note over BE,AI: AI Pipeline Step 1: Ticket Classification
    BE->>AI: Send title/description for NLP classification
    AI-->>BE: Returns category (e.g. VPN) and priority (e.g. High)
    
    Note over BE,DB: AI Pipeline Step 2: RAG Semantic Context Match
    BE->>DB: Query similarity match on SOP chunks table
    DB-->>BE: Returns matching SOP text sections
    
    Note over BE,AI: AI Pipeline Step 3: LLM Synthesis
    BE->>AI: Combine SOP chunks + ticket details into RAG prompt
    AI-->>BE: Returns custom synthesized resolution reply
    
    BE->>DB: Save ticket record (Status, Category, AI response, etc.)
    BE->>DB: Log message log and system audit log entries
    
    BE-->>FE: Returns created ticket details + AI auto-response
    FE-->>User: Displays solution chat card or support agent escalation warning
```
