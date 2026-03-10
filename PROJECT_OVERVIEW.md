# Predictive Maintenance Platform (PulseGrid)

## Project Summary
PulseGrid is an end-to-end predictive maintenance platform for industrial equipment. It ingests machine telemetry (vibration, temperature, current, RPM), calculates failure risk, generates maintenance alerts, and tracks model reliability.

The platform supports multiple assets, sensor calibration checks, missing-data handling, trend analysis, and monitoring for model accuracy degradation.

## Core Features
- Multi-machine asset management
- Sensor ingestion API for real/simulated telemetry
- Risk scoring and asset health score
- Trend analysis (risk/health over time)
- Alert generation and alert resolution workflow
- Recommended maintenance actions per asset
- Missing-data imputation and calibration anomaly checks
- Monitoring metrics: confusion matrix, accuracy, degradation trend

## Tech Stack Used
- Backend: Node.js, Express
- Frontend: React (CRA), Chart.js, Axios
- Database: New local JSON database (`backend/data/pdm_database.json`)
- Optional legacy module in repo: MongoDB (kept but not required for v2 APIs)
- Packaging: npm build + zip archive
- Presentation: python-pptx

## New API Endpoints (v2)
- `GET /api/v2/health`
- `GET /api/v2/dashboard`
- `GET /api/v2/assets`
- `POST /api/v2/assets`
- `GET /api/v2/readings`
- `POST /api/v2/readings`
- `POST /api/v2/readings/simulate`
- `GET /api/v2/alerts`
- `PATCH /api/v2/alerts/:alertId`

## How It Runs
1. Frontend (`localhost:3000`) requests dashboard and readings from backend.
2. Backend (`localhost:8000`) reads/writes the new database file.
3. Ingested telemetry is scored for risk and health.
4. If risk crosses thresholds (or calibration issues occur), alerts are opened.
5. Monitoring metrics update when labeled failures are provided.

## Evaluation Focus
- Prediction accuracy (current vs baseline)
- Alert lead capability and actionability
- False alarm behavior
- Reliability under noisy and partial data via simulation endpoint
