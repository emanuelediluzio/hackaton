# Virtue Foundation IDP - Medical Desert Tracker

An AI-powered Intelligent Document Parsing (IDP) agent that analyzes healthcare facility data in Ghana to identify medical deserts, support resource allocation, and bridge healthcare gaps.

Built for the **Databricks "Bridging Medical Deserts"** hackathon challenge.

## Features

- **RAG Chat** - Ask questions about Ghana's healthcare in natural language (FAISS + Gemini 2.5 Flash)
- **Interactive Map** - 3,530+ facilities visualized with color-coded status markers
- **Medical Desert Detection** - Automated analysis of coverage gaps across 10 regions
- **Text2SQL** - Natural language to MongoDB queries for structured data exploration
- **Resource Planning** - AI-generated allocation plans by region/specialty
- **MLFlow Tracking** - Full experiment tracing for agent reasoning transparency
- **Multi-turn Memory** - Persistent conversation context in chat sessions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Tailwind CSS, Leaflet, Recharts |
| Backend | FastAPI, Motor (async MongoDB) |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) |
| Vector Store | FAISS |
| LLM | Gemini 2.5 Flash (via emergentintegrations) |
| Tracking | MLFlow |
| Auth | Google OAuth (Emergent) |
| Database | MongoDB |
| Dataset | 3,530 real Ghana facilities (Kaggle) |

## Quick Start (local)

```bash
# Backend
cd backend
pip install -r requirements.txt --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
cp .env.example .env  # Edit with your credentials
uvicorn server:app --host 0.0.0.0 --port 8001

# Frontend
cd frontend
yarn install
cp .env.example .env  # Set REACT_APP_BACKEND_URL=http://localhost:8001
yarn start
```

## Deployment

See [DEPLOY.md](DEPLOY.md) for full deployment guide (Vercel + Railway/Render).

## Dataset

3,530 real healthcare facilities from the [Kaggle Ghana Health Facilities](https://www.kaggle.com/datasets/datanix/ghana-health-facilities) dataset, enriched with synthetic unstructured capabilities text for RAG/IDP testing.

## License

MIT
