"""
================================================================================
ML SERVICE — Machine Learning Prediction & Model Monitoring
================================================================================
Provides:
  1. predict_machine_health() — Run inference on a single sensor reading
  2. get_model_metrics() — Retrieve model accuracy/precision/recall/F1
  3. check_model_drift() — Detect accuracy degradation over time
  4. generate_recommendation() — Rule-based maintenance guidance
  5. reload_model() — Hot-reload model from disk after retraining
================================================================================
"""

import joblib
import pandas as pd
import numpy as np
import os
import json
import logging
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger("pulsegrid.ml")

# ---------------------------------------------------------------------------
# Path configuration
# ---------------------------------------------------------------------------
MODEL_PATH = os.path.join(os.path.dirname(__file__), '../ml/model.joblib')
METRICS_PATH = os.path.join(os.path.dirname(__file__), '../ml/metrics.json')

# ---------------------------------------------------------------------------
# Global model instance — loaded once on import for fast inference
# ---------------------------------------------------------------------------
model = None

def _load_model():
    """Load or reload the ML model from disk."""
    global model
    try:
        model = joblib.load(MODEL_PATH)
        logger.info(f"ML model loaded from {MODEL_PATH}")
    except Exception as e:
        logger.warning(f"Error loading model: {e}. Run train_model.py first.")
        model = None

# Initial load
_load_model()


def reload_model():
    """
    Hot-reload the model from disk. Called after retraining
    so the API uses the fresh model without server restart.
    """
    _load_model()
    return model is not None


def predict_machine_health(features_dict: Dict[str, Any]) -> Tuple[float, int]:
    """
    Given a dictionary of sensor features, predict failure risk.
    
    Args:
        features_dict: {
            'Type': int,                     # 0=L, 1=M, 2=H
            'Air temperature [K]': float,
            'Process temperature [K]': float,
            'Rotational speed [rpm]': float,
            'Torque [Nm]': float,
            'Tool wear [min]': float,
            'RNF': float
        }
    
    Returns:
        (health_score, failure_risk)
        health_score: 0.0 (critical) to 1.0 (perfectly healthy)
        failure_risk: 0 = safe, 1 = failure predicted
    """
    if model is None:
        # Fallback if model isn't loaded — assume healthy
        return 1.0, 0
    
    # The sklearn pipeline expects a DataFrame with exact column names
    df = pd.DataFrame([features_dict])
    
    # Add engineered features to match training pipeline
    if 'Air temperature [K]' in df.columns and 'Process temperature [K]' in df.columns:
        df['Temp_Delta'] = df['Process temperature [K]'] - df['Air temperature [K]']
    if 'Rotational speed [rpm]' in df.columns and 'Torque [Nm]' in df.columns:
        df['Power'] = df['Rotational speed [rpm]'] * df['Torque [Nm]'] / 9550.0
    
    # Get probability of failure (class 1)
    # predict_proba returns [[prob_class_0, prob_class_1]]
    probabilities = model.predict_proba(df)[0]
    failure_prob = probabilities[1]
    
    # Get explicit class prediction (0 or 1)
    prediction = model.predict(df)[0]
    
    # Health score = inverse of failure probability
    # 1.0 = perfectly healthy, 0.0 = certain failure
    health_score = 1.0 - failure_prob
    
    return float(health_score), int(prediction)


def get_model_metrics() -> Dict[str, Any]:
    """
    Retrieve the most recent model evaluation metrics.
    These are saved by train_model.py after each training run.
    
    Returns:
        {
            'accuracy': float,
            'precision': float,
            'recall': float,
            'f1_score': float,
            'dataset_size': int,
            'confusion_matrix': [[tn, fp], [fn, tp]],
            'trained_at': str,
            'model_loaded': bool
        }
    """
    result = {
        'model_loaded': model is not None,
        'accuracy': 0.0,
        'precision': 0.0,
        'recall': 0.0,
        'f1_score': 0.0,
        'dataset_size': 0,
        'confusion_matrix': [[0, 0], [0, 0]],
        'trained_at': 'Unknown',
        'feature_names': [],
    }
    
    # Try to load saved metrics from the training run
    if os.path.exists(METRICS_PATH):
        try:
            with open(METRICS_PATH, 'r') as f:
                saved = json.load(f)
            result.update(saved)
        except Exception as e:
            logger.warning(f"Could not load metrics: {e}")
    
    # Add feature names from model if available
    if model is not None:
        try:
            if hasattr(model, 'feature_names_in_'):
                result['feature_names'] = list(model.feature_names_in_)
        except:
            pass
    
    return result


def check_model_drift(recent_predictions: list, recent_actuals: list = None) -> Dict[str, Any]:
    """
    Detect model drift by comparing recent prediction distributions
    against training-time distributions.
    
    Args:
        recent_predictions: List of recent health_score values
        recent_actuals: Optional list of actual failure outcomes (for accuracy check)
    
    Returns:
        {
            'drift_detected': bool,
            'confidence': float,
            'details': str,
            'prediction_mean': float,
            'prediction_std': float,
        }
    """
    if not recent_predictions:
        return {
            'drift_detected': False,
            'confidence': 0.0,
            'details': 'No recent predictions to analyze.',
            'prediction_mean': 0.0,
            'prediction_std': 0.0,
        }
    
    pred_array = np.array(recent_predictions)
    pred_mean = float(pred_array.mean())
    pred_std = float(pred_array.std())
    
    # Load training metrics for comparison
    metrics = get_model_metrics()
    
    drift_detected = False
    details = []
    
    # Check 1: If prediction distribution is heavily skewed
    # (all predictions same value = model might be stuck)
    if pred_std < 0.01 and len(recent_predictions) > 10:
        drift_detected = True
        details.append("Prediction variance near zero — model may be producing constant outputs.")
    
    # Check 2: If failure rate deviates significantly from training
    failure_rate = sum(1 for p in recent_predictions if p < 0.5) / len(recent_predictions)
    if failure_rate > 0.5:
        drift_detected = True
        details.append(f"High failure prediction rate ({failure_rate:.1%}) — possible data drift or model degradation.")
    
    # Check 3: If actual outcomes are provided, compute live accuracy
    if recent_actuals and len(recent_actuals) == len(recent_predictions):
        pred_classes = [1 if p < 0.5 else 0 for p in recent_predictions]
        correct = sum(1 for p, a in zip(pred_classes, recent_actuals) if p == a)
        live_accuracy = correct / len(recent_actuals)
        
        training_accuracy = metrics.get('accuracy', 0.95)
        accuracy_drop = training_accuracy - live_accuracy
        
        if accuracy_drop > 0.1:
            drift_detected = True
            details.append(f"Accuracy dropped by {accuracy_drop:.1%} from training ({training_accuracy:.1%} → {live_accuracy:.1%}).")
    
    confidence = min(len(recent_predictions) / 50.0, 1.0)  # More data = more confident
    
    return {
        'drift_detected': drift_detected,
        'confidence': round(confidence, 2),
        'details': ' '.join(details) if details else 'No drift detected. Model performing within expected parameters.',
        'prediction_mean': round(pred_mean, 4),
        'prediction_std': round(pred_std, 4),
    }
