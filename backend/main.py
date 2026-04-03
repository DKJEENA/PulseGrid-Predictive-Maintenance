"""
================================================================================
MAIN API — Predictive Maintenance Platform FastAPI Server
================================================================================
REST API endpoints for:
  - Machine management (list, status, history)
  - Sensor data ingestion with auto-prediction
  - Alert management (list, acknowledge, resolve)
  - AI Chatbot query processing
  - Model metrics and drift monitoring
  - Dataset upload with auto-clean + retrain pipeline
  - Sensor calibration management
  - Data preview and quality statistics
================================================================================
"""

from fastapi import FastAPI, UploadFile, File, Depends, BackgroundTasks, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from pydantic import BaseModel
from typing import Optional, List
import shutil
import os
import subprocess
import json
from datetime import datetime, timedelta

# --- Local module imports ---
from database import SessionLocal, SensorData, Alert, ModelMetrics, CalibrationConfig, get_db
from ml_service import predict_machine_health, get_model_metrics, check_model_drift, reload_model
from alert_engine import evaluate_sensor_reading, get_recommendation_for_reading
from chatbot_engine import ChatbotEngine
from data_pipeline import run_full_pipeline, generate_column_stats

import pandas as pd

# ===========================================================================
# APP INITIALIZATION
# ===========================================================================
app = FastAPI(
    title="Predictive Maintenance API",
    description="IIoT Predictive Maintenance Platform with ML-powered failure prediction",
    version="2.0.0"
)

# Enable CORS for React frontend (restrict origins in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Initialize the AI Chatbot with the default dataset
# ---------------------------------------------------------------------------
DATASET_PATH = os.path.join(os.path.dirname(__file__), '../dataset/ai4i2020.csv')
chatbot = ChatbotEngine(DATASET_PATH)


# ===========================================================================
# PYDANTIC MODELS — Request/response schemas
# ===========================================================================
class ChatQuery(BaseModel):
    """Schema for chatbot requests."""
    message: str

class SimulateReading(BaseModel):
    """Schema for simulated sensor readings."""
    machine_id: str
    type: int = 1
    air_temp: float = 300.0
    process_temp: float = 310.0
    rpm: float = 1500.0
    torque: float = 40.0
    tool_wear: float = 100.0
    rnf: float = 0.0

class CalibrationUpdate(BaseModel):
    """Schema for updating calibration parameters."""
    temp_min: Optional[float] = None
    temp_max: Optional[float] = None
    temp_offset: Optional[float] = None
    rpm_min: Optional[float] = None
    rpm_max: Optional[float] = None
    torque_min: Optional[float] = None
    torque_max: Optional[float] = None
    tool_wear_limit: Optional[float] = None
    notes: Optional[str] = None


# ===========================================================================
# ROOT ENDPOINT
# ===========================================================================
@app.get("/")
def read_root():
    """Health check endpoint — confirms API is running."""
    return {
        "message": "Predictive Maintenance API v2.0 is running",
        "status": "online",
        "endpoints": [
            "/api/machines", "/api/alerts", "/api/chatbot",
            "/api/model/metrics", "/api/upload_dataset"
        ]
    }


# ===========================================================================
# MACHINE ENDPOINTS
# ===========================================================================
@app.get("/api/machines")
def get_machines(db: Session = Depends(get_db)):
    """
    Returns list of unique machines with their latest status.
    Each machine includes: id, last reading timestamp, health score, failure risk.
    """
    # Get distinct machine IDs
    machine_ids = db.query(SensorData.machine_id).distinct().all()
    machine_ids = [m[0] for m in machine_ids]
    
    machines = []
    for mid in machine_ids:
        # Get the latest reading for each machine
        latest = (db.query(SensorData)
                  .filter(SensorData.machine_id == mid)
                  .order_by(desc(SensorData.timestamp))
                  .first())
        
        if latest:
            # Count total readings for this machine
            reading_count = (db.query(func.count(SensorData.id))
                           .filter(SensorData.machine_id == mid)
                           .scalar())
            
            # Count active alerts for this machine
            alert_count = (db.query(func.count(Alert.id))
                          .filter(Alert.machine_id == mid, Alert.resolved == False)
                          .scalar())
            
            machines.append({
                'machine_id': mid,
                'health_score': latest.health_score,
                'failure_risk': latest.failure_risk,
                'air_temp': latest.air_temp,
                'process_temp': latest.process_temp,
                'rpm': latest.rpm,
                'torque': latest.torque,
                'tool_wear': latest.tool_wear,
                'recommendation': latest.recommendation or '',
                'last_updated': latest.timestamp.isoformat() if latest.timestamp else None,
                'reading_count': reading_count,
                'active_alerts': alert_count,
            })
    
    return machines


@app.get("/api/machines/{machine_id}/status")
def get_machine_status(machine_id: str, db: Session = Depends(get_db)):
    """Returns the latest sensor reading and health scores for a specific machine."""
    latest = (db.query(SensorData)
              .filter(SensorData.machine_id == machine_id)
              .order_by(desc(SensorData.timestamp))
              .first())
    
    if not latest:
        raise HTTPException(status_code=404, detail=f"Machine '{machine_id}' not found")
    
    return {
        'machine_id': latest.machine_id,
        'timestamp': latest.timestamp.isoformat() if latest.timestamp else None,
        'type': latest.type,
        'air_temp': latest.air_temp,
        'process_temp': latest.process_temp,
        'rpm': latest.rpm,
        'torque': latest.torque,
        'tool_wear': latest.tool_wear,
        'health_score': latest.health_score,
        'failure_risk': latest.failure_risk,
        'recommendation': latest.recommendation or '',
    }


@app.get("/api/machines/{machine_id}/history")
def get_machine_history(
    machine_id: str,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """
    Returns historical sensor readings for charts and trend analysis.
    Returns data in chronological order (oldest first).
    """
    history = (db.query(SensorData)
               .filter(SensorData.machine_id == machine_id)
               .order_by(desc(SensorData.timestamp))
               .limit(limit)
               .all())
    
    # Reverse to chronological order for charts
    result = []
    for h in reversed(history):
        result.append({
            'timestamp': h.timestamp.isoformat() if h.timestamp else None,
            'air_temp': h.air_temp,
            'process_temp': h.process_temp,
            'rpm': h.rpm,
            'torque': h.torque,
            'tool_wear': h.tool_wear,
            'health_score': h.health_score,
            'failure_risk': h.failure_risk,
        })
    
    return result


@app.get("/api/machines/{machine_id}/trends")
def get_machine_trends(machine_id: str, db: Session = Depends(get_db)):
    """
    Returns trend analysis for a machine — rolling averages and slope detection.
    Useful for identifying gradual degradation patterns.
    """
    history = (db.query(SensorData)
               .filter(SensorData.machine_id == machine_id)
               .order_by(SensorData.timestamp)
               .all())
    
    if len(history) < 5:
        return {'trends': [], 'message': 'Insufficient data for trend analysis (need at least 5 readings)'}
    
    # Convert to lists for analysis
    data = {
        'air_temp': [h.air_temp for h in history],
        'rpm': [h.rpm for h in history],
        'torque': [h.torque for h in history],
        'tool_wear': [h.tool_wear for h in history],
        'health_score': [h.health_score for h in history],
    }
    
    trends = {}
    for key, values in data.items():
        arr = pd.Series(values)
        
        # Compute rolling average (window=7 or whatever's available)
        window = min(7, len(values))
        rolling_avg = arr.rolling(window=window, min_periods=1).mean().tolist()
        
        # Compute trend direction (slope of last half)
        mid = len(values) // 2
        first_half_mean = sum(values[:mid]) / max(mid, 1)
        second_half_mean = sum(values[mid:]) / max(len(values) - mid, 1)
        
        if first_half_mean != 0:
            change_pct = ((second_half_mean - first_half_mean) / abs(first_half_mean)) * 100
        else:
            change_pct = 0
        
        direction = "increasing" if change_pct > 1 else ("decreasing" if change_pct < -1 else "stable")
        
        trends[key] = {
            'values': values,
            'rolling_avg': [round(v, 4) for v in rolling_avg],
            'direction': direction,
            'change_pct': round(change_pct, 2),
            'current': values[-1] if values else 0,
            'mean': round(float(arr.mean()), 4),
        }
    
    return {'trends': trends, 'data_points': len(history)}


# ===========================================================================
# SENSOR DATA INGESTION ENDPOINT
# ===========================================================================
@app.post("/api/simulate")
def simulate_reading(reading: SimulateReading, db: Session = Depends(get_db)):
    """
    Ingest a sensor reading — runs ML prediction, generates alerts,
    and stores everything in the database.
    
    Used by the simulator or real MQTT bridge to push data.
    """
    # Step 1: Prepare features for ML model
    features = {
        'Type': reading.type,
        'Air temperature [K]': reading.air_temp,
        'Process temperature [K]': reading.process_temp,
        'Rotational speed [rpm]': reading.rpm,
        'Torque [Nm]': reading.torque,
        'Tool wear [min]': reading.tool_wear,
        'RNF': reading.rnf
    }
    
    # Step 2: Run ML prediction
    health_score, failure_risk = predict_machine_health(features)
    
    # Step 3: Generate maintenance recommendation
    recommendation = get_recommendation_for_reading(
        reading.air_temp, reading.rpm, reading.torque,
        reading.tool_wear, health_score, failure_risk
    )
    
    # Step 4: Save sensor reading to database
    record = SensorData(
        machine_id=reading.machine_id,
        type=reading.type,
        air_temp=reading.air_temp,
        process_temp=reading.process_temp,
        rpm=reading.rpm,
        torque=reading.torque,
        tool_wear=reading.tool_wear,
        rnf=reading.rnf,
        health_score=health_score,
        failure_risk=failure_risk,
        recommendation=recommendation,
    )
    db.add(record)
    
    # Step 5: Evaluate alert thresholds and create alerts
    alerts_data = evaluate_sensor_reading(
        machine_id=reading.machine_id,
        air_temp=reading.air_temp,
        process_temp=reading.process_temp,
        rpm=reading.rpm,
        torque=reading.torque,
        tool_wear=reading.tool_wear,
        health_score=health_score,
        failure_risk=failure_risk,
    )
    
    # Save generated alerts (limit to avoid flooding)
    for alert_dict in alerts_data[:3]:  # Max 3 alerts per reading
        alert = Alert(
            machine_id=alert_dict['machine_id'],
            severity=alert_dict['severity'],
            title=alert_dict['title'],
            description=alert_dict['description'],
            recommended_action=alert_dict['recommended_action'],
        )
        db.add(alert)
    
    db.commit()
    db.refresh(record)
    
    return {
        "status": "success",
        "health_score": health_score,
        "failure_risk": failure_risk,
        "prediction": "FAILURE_RISK" if failure_risk else "HEALTHY",
        "recommendation": recommendation,
        "alerts_generated": len(alerts_data),
    }


# ===========================================================================
# ALERT ENDPOINTS
# ===========================================================================
@app.get("/api/alerts")
def get_alerts(
    severity: Optional[str] = None,
    resolved: Optional[bool] = None,
    machine_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """
    Returns alerts with optional filtering by severity, status, and machine.
    Ordered by most recent first.
    """
    query = db.query(Alert).order_by(desc(Alert.timestamp))
    
    if severity:
        query = query.filter(Alert.severity == severity)
    if resolved is not None:
        query = query.filter(Alert.resolved == resolved)
    if machine_id:
        query = query.filter(Alert.machine_id == machine_id)
    
    alerts = query.limit(limit).all()
    
    return [{
        'id': a.id,
        'machine_id': a.machine_id,
        'timestamp': a.timestamp.isoformat() if a.timestamp else None,
        'severity': a.severity,
        'title': a.title,
        'description': a.description,
        'recommended_action': a.recommended_action,
        'acknowledged': a.acknowledged,
        'acknowledged_at': a.acknowledged_at.isoformat() if a.acknowledged_at else None,
        'resolved': a.resolved,
    } for a in alerts]


@app.post("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int, db: Session = Depends(get_db)):
    """Mark an alert as acknowledged by the operator."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.acknowledged = True
    alert.acknowledged_at = datetime.utcnow()
    db.commit()
    
    return {"status": "acknowledged", "alert_id": alert_id}


@app.post("/api/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    """Mark an alert as resolved (issue has been fixed)."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.resolved = True
    alert.acknowledged = True
    alert.acknowledged_at = alert.acknowledged_at or datetime.utcnow()
    db.commit()
    
    return {"status": "resolved", "alert_id": alert_id}


@app.get("/api/alerts/summary")
def get_alerts_summary(db: Session = Depends(get_db)):
    """Returns alert count breakdown by severity and status."""
    total = db.query(func.count(Alert.id)).scalar()
    active = db.query(func.count(Alert.id)).filter(Alert.resolved == False).scalar()
    critical = db.query(func.count(Alert.id)).filter(Alert.severity == 'critical', Alert.resolved == False).scalar()
    warning = db.query(func.count(Alert.id)).filter(Alert.severity == 'warning', Alert.resolved == False).scalar()
    info = db.query(func.count(Alert.id)).filter(Alert.severity == 'info', Alert.resolved == False).scalar()
    
    return {
        'total': total,
        'active': active,
        'critical': critical,
        'warning': warning,
        'info': info,
        'resolved': total - active,
    }


# ===========================================================================
# AI CHATBOT ENDPOINT
# ===========================================================================
@app.post("/api/chatbot")
def chatbot_query(query: ChatQuery, db: Session = Depends(get_db)):
    """
    Process a natural language query using the offline AI chatbot.
    The chatbot analyzes the loaded dataset — no external API needed.
    """
    # Build context from database for real-time queries
    machines = db.query(SensorData.machine_id).distinct().all()
    machine_ids = [m[0] for m in machines]
    
    db_context = {'machines': []}
    for mid in machine_ids:
        latest = (db.query(SensorData)
                  .filter(SensorData.machine_id == mid)
                  .order_by(desc(SensorData.timestamp))
                  .first())
        if latest:
            db_context['machines'].append({
                'machine_id': mid,
                'health_score': latest.health_score,
                'failure_risk': latest.failure_risk,
                'air_temp': latest.air_temp,
                'rpm': latest.rpm,
                'torque': latest.torque,
                'tool_wear': latest.tool_wear,
            })
    
    # Process the query
    result = chatbot.process_query(query.message, db_context)
    
    return result


# ===========================================================================
# MODEL METRICS & MONITORING ENDPOINTS
# ===========================================================================
@app.get("/api/model/metrics")
def model_metrics():
    """Returns current ML model performance metrics (accuracy, precision, recall, F1)."""
    return get_model_metrics()


@app.get("/api/model/drift")
def model_drift(db: Session = Depends(get_db)):
    """
    Check for model drift by analyzing recent prediction patterns.
    Returns drift status and confidence level.
    """
    # Get recent health scores
    recent = (db.query(SensorData.health_score)
              .order_by(desc(SensorData.timestamp))
              .limit(50)
              .all())
    
    recent_scores = [r[0] for r in recent if r[0] is not None]
    
    return check_model_drift(recent_scores)


# ===========================================================================
# DATASET MANAGEMENT ENDPOINTS
# ===========================================================================
def run_training_task():
    """Background task to run the ML training pipeline and reload model."""
    script_path = os.path.join(os.path.dirname(__file__), '../ml/train_model.py')
    print("[RETRAIN] Starting automated retraining...")
    try:
        subprocess.run(["python", script_path], check=True, cwd=os.path.dirname(script_path))
        print("[OK] Retraining completed.")
        # Hot-reload the model so API uses the new one immediately
        reload_model()
        # Reload chatbot dataset
        chatbot.load_dataset(DATASET_PATH)
    except Exception as e:
        print(f"[ERROR] Retraining failed: {e}")


@app.post("/api/upload_dataset")
def upload_dataset(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """
    Upload a new CSV dataset. Triggers the auto-pipeline:
      1. Save file to disk
      2. Run data quality analysis
      3. Clean and prepare data
      4. Retrain the ML model in background
      5. Hot-reload model for live inference
    """
    dataset_path = os.path.join(os.path.dirname(__file__), '../dataset/ai4i2020.csv')
    
    # Save the uploaded file
    with open(dataset_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    print(f"[FILE] New dataset saved: {file.filename} -> {dataset_path}")
    
    # Run quick data quality check
    try:
        df = pd.read_csv(dataset_path)
        _, quality_report = run_full_pipeline(df.copy())
        quality_summary = {
            'rows': quality_report['final_shape'][0],
            'columns': quality_report['final_shape'][1],
            'steps_completed': len(quality_report['steps']),
        }
    except Exception as e:
        quality_summary = {'error': str(e)}
    
    # Queue background retraining
    background_tasks.add_task(run_training_task)
    
    # Reload chatbot with new dataset
    chatbot.load_dataset(dataset_path)
    
    return {
        "message": f"Dataset '{file.filename}' uploaded successfully. Auto-cleaning and retraining in progress.",
        "filename": file.filename,
        "quality": quality_summary,
    }


@app.get("/api/dataset/preview")
def dataset_preview(rows: int = Query(50, ge=1, le=200)):
    """Returns a preview of the current dataset (first N rows + column info)."""
    if not os.path.exists(DATASET_PATH):
        raise HTTPException(status_code=404, detail="No dataset file found")
    
    try:
        df = pd.read_csv(DATASET_PATH)
        preview_data = df.head(rows).to_dict(orient='records')
        
        return {
            'total_rows': len(df),
            'total_columns': len(df.columns),
            'columns': list(df.columns),
            'dtypes': {col: str(dtype) for col, dtype in df.dtypes.items()},
            'preview': preview_data,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/dataset/stats")
def dataset_stats():
    """
    Returns comprehensive dataset statistics including:
    - Per-column stats (mean, std, min, max, missing count)
    - Data quality report (duplicates, outliers, missing values)
    """
    if not os.path.exists(DATASET_PATH):
        raise HTTPException(status_code=404, detail="No dataset file found")
    
    try:
        df = pd.read_csv(DATASET_PATH)
        _, report = run_full_pipeline(df.copy())
        
        return {
            'total_rows': len(df),
            'total_columns': len(df.columns),
            'quality_report': report,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# CALIBRATION ENDPOINTS
# ===========================================================================
@app.get("/api/calibration/{machine_id}")
def get_calibration(machine_id: str, db: Session = Depends(get_db)):
    """Returns calibration configuration for a specific machine."""
    config = db.query(CalibrationConfig).filter(CalibrationConfig.machine_id == machine_id).first()
    
    if not config:
        # Return defaults if no config exists
        return {
            'machine_id': machine_id,
            'temp_min': 295.0, 'temp_max': 310.0, 'temp_offset': 0.0,
            'rpm_min': 1000.0, 'rpm_max': 3000.0,
            'torque_min': 3.0, 'torque_max': 80.0,
            'tool_wear_limit': 240.0,
            'last_calibrated': None,
            'calibration_status': 'not_configured',
            'notes': '',
        }
    
    return {
        'machine_id': config.machine_id,
        'temp_min': config.temp_min,
        'temp_max': config.temp_max,
        'temp_offset': config.temp_offset,
        'rpm_min': config.rpm_min,
        'rpm_max': config.rpm_max,
        'torque_min': config.torque_min,
        'torque_max': config.torque_max,
        'tool_wear_limit': config.tool_wear_limit,
        'last_calibrated': config.last_calibrated.isoformat() if config.last_calibrated else None,
        'calibration_status': config.calibration_status,
        'notes': config.notes or '',
    }


@app.post("/api/calibration/{machine_id}")
def update_calibration(machine_id: str, update: CalibrationUpdate, db: Session = Depends(get_db)):
    """Update calibration parameters for a machine. Creates config if it doesn't exist."""
    config = db.query(CalibrationConfig).filter(CalibrationConfig.machine_id == machine_id).first()
    
    if not config:
        config = CalibrationConfig(machine_id=machine_id)
        db.add(config)
    
    # Update only the fields that were provided
    if update.temp_min is not None: config.temp_min = update.temp_min
    if update.temp_max is not None: config.temp_max = update.temp_max
    if update.temp_offset is not None: config.temp_offset = update.temp_offset
    if update.rpm_min is not None: config.rpm_min = update.rpm_min
    if update.rpm_max is not None: config.rpm_max = update.rpm_max
    if update.torque_min is not None: config.torque_min = update.torque_min
    if update.torque_max is not None: config.torque_max = update.torque_max
    if update.tool_wear_limit is not None: config.tool_wear_limit = update.tool_wear_limit
    if update.notes is not None: config.notes = update.notes
    
    config.last_calibrated = datetime.utcnow()
    config.calibration_status = "ok"
    
    db.commit()
    
    return {"status": "updated", "machine_id": machine_id}


# ===========================================================================
# BACKWARD COMPATIBILITY — Support old endpoint
# ===========================================================================
@app.post("/api/simulate_reading")
def simulate_reading_legacy(
    machine_id: str,
    type: int = 1,
    air_temp: float = 300.0,
    process_temp: float = 310.0,
    rpm: float = 1500.0,
    torque: float = 40.0,
    tool_wear: float = 100.0,
    rnf: float = 0.0,
    db: Session = Depends(get_db)
):
    """Legacy endpoint — redirects to new /api/simulate."""
    reading = SimulateReading(
        machine_id=machine_id, type=type, air_temp=air_temp,
        process_temp=process_temp, rpm=rpm, torque=torque,
        tool_wear=tool_wear, rnf=rnf
    )
    return simulate_reading(reading, db)
