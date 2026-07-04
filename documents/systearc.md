# System Architecture - AutoFlow AI Console

This md file  outlines the system architecture for the AutoFlow AI support platform.

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



