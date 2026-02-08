# Virtue Foundation IDP - Medical Desert Tracker
## Product Requirements Document

### Original Problem Statement
Bridging Medical Deserts - Building Intelligent Document Parsing Agents for the Virtue Foundation (Databricks Sponsored Track).

### Architecture
- **Frontend**: React 18 + Tailwind CSS + Leaflet Maps + Recharts
- **Backend**: FastAPI + Motor (async MongoDB) + FAISS + sentence-transformers
- **LLM**: Gemini 2.5 Flash via emergentintegrations
- **Embeddings**: all-MiniLM-L6-v2 (384-dim) via sentence-transformers
- **Experiment Tracking**: MLFlow
- **Auth**: Emergent Google OAuth
- **Database**: MongoDB (virtue_foundation_idp)
- **Dataset**: 3,530 real Ghana facilities from Kaggle + synthetic unstructured text

### What's Been Implemented (Jan 2026)
- [x] 3,530 real Ghana healthcare facilities from Kaggle, enriched with capabilities text
- [x] **Sentence-transformers embeddings** (all-MiniLM-L6-v2) for semantic FAISS search
- [x] **MLFlow experiment tracking** for all chat/text2sql agent runs (latency, docs, citations)
- [x] **Text2SQL**: Natural language to MongoDB query via Gemini (with result table)
- [x] **Multi-turn chat memory**: Conversation history persisted per session
- [x] RAG chat with Gemini 2.5 Flash + citations + 5-step reasoning transparency
- [x] Interactive Leaflet map with 3,530+ markers, color-coded by status
- [x] Medical desert analysis (10 regions, 543 deserts flagged)
- [x] Facility Explorer with search, filter, sort, pagination
- [x] Resource Planning AI (generates plans by region/specialty)
- [x] Dashboard with stats, charts, regional analysis
- [x] Agent Tracking page (MLFlow runs, metrics, params)
- [x] Google OAuth via Emergent Auth

### Pages (7 total)
1. Dashboard - Overview stats, charts, desert scores
2. Map - Interactive Ghana map with all facilities
3. AI Chat - RAG-powered Q&A with citations/reasoning
4. Facilities - Searchable/filterable facility table
5. Planning - AI resource allocation plans
6. Query (Text2SQL) - Natural language database queries
7. Tracking - MLFlow experiment runs dashboard

### Backlog
- P1: Add real-time ambulance routing / distance calculations
- P2: Export plans/reports as PDF
- P2: Facility comparison tool
- P2: Add more countries beyond Ghana
