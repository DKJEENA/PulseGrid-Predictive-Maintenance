"""
================================================================================
DATABASE MODELS — Predictive Maintenance Platform
================================================================================
Defines all SQLAlchemy ORM models for:
  - SensorData: Live sensor readings + ML predictions
  - Alert: Maintenance alerts with severity/recommendations
  - ModelMetrics: ML model performance tracking over time
  - CalibrationConfig: Per-machine sensor calibration parameters
================================================================================
"""

from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime, Boolean, Text
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime
import os

# ---------------------------------------------------------------------------
# Database connection — SQLite locally, swap to PostgreSQL in production
# by changing SQLALCHEMY_DATABASE_URL to 'postgresql://user:pass@host/db'
# ---------------------------------------------------------------------------
DB_PATH = os.path.join(os.path.dirname(__file__), 'iot_data.db')
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}  # Required for SQLite
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ===========================================================================
# MODEL: SensorData — Stores every sensor reading + ML prediction
# ===========================================================================
class SensorData(Base):
    """
    Each row represents one sensor snapshot from a machine.
    The ML model runs on ingestion and stores health_score + failure_risk.
    """
    __tablename__ = "sensor_data"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String, index=True)                    # e.g. "CNC-M1"
    timestamp = Column(DateTime, default=datetime.utcnow)      # When the reading was taken

    # --- Sensor feature columns (matching AI4I 2020 dataset) ---
    type = Column(Integer)              # Product quality type: L=0, M=1, H=2
    air_temp = Column(Float)            # Air temperature [K]
    process_temp = Column(Float)        # Process temperature [K]
    rpm = Column(Float)                 # Rotational speed [rpm]
    torque = Column(Float)              # Torque [Nm]
    tool_wear = Column(Float)           # Tool wear time [min]
    rnf = Column(Float, default=0.0)    # Random noise factor

    # --- ML prediction outputs ---
    health_score = Column(Float)        # 1.0 (healthy) → 0.0 (critical)
    failure_risk = Column(Integer)      # 0 = safe, 1 = failure predicted
    recommendation = Column(Text, default="")  # Maintenance recommendation text


# ===========================================================================
# MODEL: Alert — Maintenance alerts generated from sensor anomalies
# ===========================================================================
class Alert(Base):
    """
    Alerts are auto-generated when sensor readings exceed thresholds
    or ML model predicts imminent failure.
    Severity: 'info', 'warning', 'critical'
    """
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String, index=True)                    # Which machine triggered it
    timestamp = Column(DateTime, default=datetime.utcnow)      # When alert was created
    severity = Column(String, default="warning")               # 'info' | 'warning' | 'critical'
    title = Column(String)                                     # Short alert title
    description = Column(Text)                                 # Detailed explanation
    recommended_action = Column(Text)                          # What maintenance to perform
    acknowledged = Column(Boolean, default=False)              # Has operator seen it?
    acknowledged_at = Column(DateTime, nullable=True)          # When it was acknowledged
    resolved = Column(Boolean, default=False)                  # Has it been resolved?


# ===========================================================================
# MODEL: ModelMetrics — Tracks ML model accuracy over time for drift detection
# ===========================================================================
class ModelMetrics(Base):
    """
    Every time the model is trained or evaluated, a row is saved here.
    Used for model monitoring and accuracy degradation tracking.
    """
    __tablename__ = "model_metrics"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)      # When metrics were recorded
    accuracy = Column(Float)                                    # Overall accuracy (0-1)
    precision = Column(Float)                                   # Precision score
    recall = Column(Float)                                      # Recall score
    f1_score = Column(Float)                                    # F1 score
    dataset_size = Column(Integer)                              # Number of training samples
    confusion_matrix = Column(Text)                             # JSON string of confusion matrix
    notes = Column(Text, default="")                            # Any training notes


# ===========================================================================
# MODEL: CalibrationConfig — Per-machine sensor calibration settings
# ===========================================================================
class CalibrationConfig(Base):
    """
    Stores calibration parameters and thresholds for each machine's sensors.
    Used to validate incoming readings and flag calibration drift.
    """
    __tablename__ = "calibration_config"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String, unique=True, index=True)       # One config per machine

    # --- Temperature calibration ---
    temp_min = Column(Float, default=295.0)                    # Min expected air temp [K]
    temp_max = Column(Float, default=310.0)                    # Max expected air temp [K]
    temp_offset = Column(Float, default=0.0)                   # Calibration offset

    # --- RPM calibration ---
    rpm_min = Column(Float, default=1000.0)                    # Min expected RPM
    rpm_max = Column(Float, default=3000.0)                    # Max expected RPM

    # --- Torque calibration ---
    torque_min = Column(Float, default=3.0)                    # Min expected torque [Nm]
    torque_max = Column(Float, default=80.0)                   # Max expected torque [Nm]

    # --- Tool wear threshold ---
    tool_wear_limit = Column(Float, default=240.0)             # Max wear before mandatory replace

    # --- Calibration metadata ---
    last_calibrated = Column(DateTime, default=datetime.utcnow)
    calibration_status = Column(String, default="ok")          # 'ok' | 'drift_detected' | 'overdue'
    notes = Column(Text, default="")


# ---------------------------------------------------------------------------
# Create all tables on import (safe — only creates if not exists)
# ---------------------------------------------------------------------------
Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency — yields a database session and auto-closes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
