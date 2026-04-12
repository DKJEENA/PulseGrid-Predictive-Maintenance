# PulseGrid — Predictive Maintenance Platform

An end-to-end Industrial IoT predictive maintenance platform using the AI4I 2020 dataset.  
Built with **FastAPI**, **React + Vite**, **Scikit-Learn**, and **WebSocket** real-time telemetry.

---

## 📁 Repository Structure

| Directory | Description |
|-----------|-------------|
| `/backend` | FastAPI server — ML inference, alerts, chatbot, WebSocket broadcasts, data pipeline |
| `/frontend` | React + Vite dashboard — 7-tab glassmorphism UI with real-time charts |
| `/ml` | Scikit-Learn Random Forest pipeline with cross-validation and feature importance |
| `/simulator` | IoT device simulator with fault injection, degradation modeling, and retry logic |
| `/dataset` | Raw `ai4i2020.csv` dataset and download scripts |

## ✨ Key Features (v2.1)

- **ML Pipeline**: 5-fold stratified CV, AUC-ROC, feature importance extraction
- **Real-time Monitoring**: WebSocket live telemetry, auto-refresh with countdown timer
- **AI Chatbot**: NLP queries + correlation analysis, what-if scenarios, machine comparison
- **Alert Engine**: Rule-based + ML alerts with severity levels and auto-resolution
- **Data Pipeline**: Automated cleaning, imputation, outlier detection on upload
- **Rate Limiting**: Per-machine rate limiting on ingestion endpoint
- **Health Check**: `/api/health` verifies DB, ML model, and dataset status
- **CSV Export**: Download historical sensor data from the Machine Detail view
- **Docker**: Health checks, env file support, service dependency ordering
- **CI/CD**: GitHub Actions for lint + build on push

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.10+** and **Node.js 18+**

### 1. Install & Train
```bash
pip install -r requirements.txt
python dataset/fetch_dataset.py
python ml/train_model.py
```

### 2. Start Backend (Terminal 1)
```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### 3. Start Frontend (Terminal 2)
```bash
cd frontend && npm install && npm run dev
```
→ Open `http://localhost:5173`

### 4. Start Simulator (Terminal 3)
```bash
python simulator/client.py --machines 5 --speed 1
```

## ⚙️ Configuration

Copy `.env.example` to `.env` and adjust:

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOWED_ORIGINS` | `http://localhost:5173` | CORS allowed origins |
| `DATA_RETENTION_DAYS` | `30` | Auto-cleanup threshold |
| `RATE_LIMIT_PER_SECOND` | `10` | Max ingestion requests per machine/s |
| `DATASET_PATH` | `dataset/ai4i2020.csv` | Active dataset path |
| `PULSEGRID_API_URL` | `http://localhost:8000` | Simulator target (env or `--api-url`) |

## 🔄 Dataset Hot-Swap

1. Go to the **Data & Models** tab in the dashboard
2. Upload a new CSV file
3. The backend will auto-clean → retrain → hot-reload the model

## 🛳 Docker

```bash
docker-compose up --build
```

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | System health check |
| `/api/machines` | GET | List all machines |
| `/api/simulate` | POST | Ingest sensor reading |
| `/api/alerts` | GET | Get active alerts |
| `/api/chatbot` | POST | AI assistant query |
| `/api/model/metrics` | GET | ML model performance |
| `/api/upload_dataset` | POST | Upload new dataset |
| `/api/admin/cleanup` | POST | Prune old data |
