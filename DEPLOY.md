# Virtue Foundation IDP - Medical Desert Tracker

## Deployment Guide

### Architecture
- **Frontend** → Vercel (React static build)
- **Backend** → Railway / Render / Fly.io (FastAPI + FAISS + sentence-transformers)
- **Database** → MongoDB Atlas (free tier)

---

## Step 1: Setup MongoDB Atlas (gratuito)

1. Vai su [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Crea un cluster gratuito (M0)
3. Crea un utente database e ottieni la connection string:
   ```
   mongodb+srv://username:password@cluster.xxxxx.mongodb.net/virtue_foundation_idp
   ```
4. Aggiungi `0.0.0.0/0` agli IP whitelist

---

## Step 2: Deploy Backend (Railway - consigliato)

### Opzione A: Railway (gratis per hobby)
1. Vai su [railway.app](https://railway.app)
2. Crea nuovo progetto → "Deploy from GitHub"
3. Punta alla cartella `backend/`
4. Imposta le variabili d'ambiente:
   ```
   MONGO_URL=mongodb+srv://username:password@cluster.xxxxx.mongodb.net/virtue_foundation_idp
   DB_NAME=virtue_foundation_idp
   EMERGENT_LLM_KEY=sk-emergent-YOUR_KEY
   PORT=8001
   PIP_EXTRA_INDEX_URL=https://d33sy5i8bnduwe.cloudfront.net/simple/
   ```
5. **Build Command**: `bash build.sh` (installa deps con extra index per emergentintegrations)
6. **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
7. Nota il URL del backend (es: `https://your-app.railway.app`)

### Opzione B: Render
1. Vai su [render.com](https://render.com)
2. Crea "New Web Service" → Connect GitHub
3. Root Directory: `backend`
4. Build Command: `bash build.sh`
5. Start Command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
6. Stesse variabili d'ambiente di sopra (incluso `PIP_EXTRA_INDEX_URL`)

---

## Step 3: Deploy Frontend su Vercel

1. Vai su [vercel.com](https://vercel.com)
2. "Import Project" → Connect GitHub repo
3. **Framework Preset**: Other
4. **Root Directory**: `.` (root)
5. **Build Command**: `cd frontend && yarn build`
6. **Output Directory**: `frontend/build`
7. Aggiungi variabile d'ambiente:
   ```
   REACT_APP_BACKEND_URL=https://your-backend.railway.app
   ```
   (usa il URL del backend da Step 2)

8. **IMPORTANTE**: In `vercel.json`, sostituisci `YOUR_BACKEND_URL` con il URL reale del backend

---

## Step 4: Seed il Database

Dopo il primo deploy del backend, il database viene popolato automaticamente al primo avvio (3530 strutture Ghana dal file `data/ghana_facilities.json`).

---

## Variabili d'ambiente richieste

### Backend (.env)
| Variabile | Descrizione |
|-----------|-------------|
| `MONGO_URL` | MongoDB Atlas connection string |
| `DB_NAME` | `virtue_foundation_idp` |
| `EMERGENT_LLM_KEY` | Chiave Emergent per Gemini |

### Frontend (.env)
| Variabile | Descrizione |
|-----------|-------------|
| `REACT_APP_BACKEND_URL` | URL completo del backend |

---

## Note importanti
- Il backend richiede ~90s al primo avvio per caricare il modello sentence-transformers e costruire l'indice FAISS
- Il modello `all-MiniLM-L6-v2` viene scaricato automaticamente (~90MB)
- Railway/Render free tier hanno limiti di RAM - il backend usa ~1.5GB con FAISS + embeddings
- Per l'autenticazione Google OAuth, l'URL di redirect viene gestito automaticamente
