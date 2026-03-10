# Run Guide

## 1) Start Backend
```powershell
cd backend
node index.js
```
Backend URL: `http://localhost:8000`

## 2) Start Frontend
```powershell
cd frontend
npm start
```
Frontend URL: `http://localhost:3000`

## 3) Verify Service
Open:
- `http://localhost:8000/api/v2/health`
- `http://localhost:8000/api/v2/dashboard`

## 4) Build Frontend (Compile)
```powershell
cd frontend
npm run build
```
Compiled output: `frontend/build`

## 5) Use Simulation
```http
POST /api/v2/readings/simulate
```
Sample body:
```json
{
  "pointsPerAsset": 12,
  "noise": 0.2,
  "missingRate": 0.06
}
```

## 6) New Database File
- Path: `backend/data/pdm_database.json`
- It stores assets, readings, alerts, and monitoring metrics.
