"""
================================================================================
ML MODEL TRAINING — Predictive Maintenance Failure Classifier
================================================================================
Trains a Random Forest classifier to predict machine failure from sensor data.

Pipeline:
  1. Load CSV dataset (AI4I 2020 or custom)
  2. Automated data cleaning (drop IDs, encode categoricals)
  3. Feature engineering (temperature delta, power calculation)
  4. Handle missing values (median imputation)
  5. Train/test split with stratification
  6. Train RandomForest with class balancing
  7. Evaluate (accuracy, precision, recall, F1, confusion matrix)
  8. Save model and metrics to disk

The saved metrics.json is used by the dashboard for model monitoring.
================================================================================
"""

import pandas as pd
import numpy as np
import os
import json
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, confusion_matrix, classification_report
)
import joblib

# ---------------------------------------------------------------------------
# File paths — Change DATASET_PATH to use a different dataset
# ---------------------------------------------------------------------------
DATASET_PATH = os.path.join(os.path.dirname(__file__), '../dataset/ai4i2020.csv')
MODEL_SAVE_PATH = os.path.join(os.path.dirname(__file__), 'model.joblib')
METRICS_SAVE_PATH = os.path.join(os.path.dirname(__file__), 'metrics.json')
HISTORY_PATH = os.path.join(os.path.dirname(__file__), 'training_history.json')


def train():
    """
    Execute the full training pipeline.
    Saves both the model (.joblib) and evaluation metrics (.json).
    """
    print("=" * 60)
    print("PREDICTIVE MAINTENANCE — MODEL TRAINING")
    print("=" * 60)
    
    # ===================================================================
    # STEP 1: Load dataset
    # ===================================================================
    print(f"\n📁 Loading dataset from: {DATASET_PATH}")
    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(
            f"Dataset not found at {DATASET_PATH}. "
            "Run fetch_dataset.py or upload a new dataset."
        )
    
    df = pd.read_csv(DATASET_PATH)
    print(f"   Loaded {len(df)} rows × {len(df.columns)} columns")
    
    # ===================================================================
    # STEP 2: Automated data cleaning
    # ===================================================================
    print("\n🧹 Cleaning data...")
    
    # Drop non-informative identifier columns
    id_columns = ['UDI', 'Product ID']
    df = df.drop(columns=[col for col in id_columns if col in df.columns])
    print(f"   Dropped ID columns: {[c for c in id_columns if c in df.columns]}")
    
    # Encode categorical 'Type' column (L=Low, M=Medium, H=High quality)
    if 'Type' in df.columns:
        type_mapping = {'L': 0, 'M': 1, 'H': 2}
        df['Type'] = df['Type'].map(type_mapping)
        # Handle any unmapped values
        df['Type'] = df['Type'].fillna(1)  # Default to Medium
        print(f"   Encoded 'Type' column: {type_mapping}")
    
    # ===================================================================
    # STEP 3: Feature engineering
    # ===================================================================
    print("\n🔧 Engineering features...")
    
    # Temperature differential (process - air) — indicates heat generation
    if 'Air temperature [K]' in df.columns and 'Process temperature [K]' in df.columns:
        df['Temp_Delta'] = df['Process temperature [K]'] - df['Air temperature [K]']
        print("   Created 'Temp_Delta' = Process temp - Air temp")
    
    # Power metric (RPM × Torque) — indicates load on the machine
    if 'Rotational speed [rpm]' in df.columns and 'Torque [Nm]' in df.columns:
        df['Power'] = df['Rotational speed [rpm]'] * df['Torque [Nm]'] / 9550  # kW approximation
        print("   Created 'Power' = RPM × Torque / 9550 (kW)")
    
    # ===================================================================
    # STEP 4: Separate features and target
    # ===================================================================
    # Drop specific fault mode columns — we predict general "Machine failure"
    fault_modes = ['TWF', 'HDF', 'PWF', 'OSF', 'RNQF']
    df = df.drop(columns=[col for col in fault_modes if col in df.columns])
    
    if 'Machine failure' not in df.columns:
        print("⚠️ 'Machine failure' column not found. Looking for alternatives...")
        # Try to find a binary target column
        for col in df.columns:
            if df[col].nunique() == 2 and df[col].dtype in ['int64', 'float64']:
                print(f"   Using '{col}' as target variable")
                df = df.rename(columns={col: 'Machine failure'})
                break
        else:
            raise ValueError("No suitable target column found in dataset!")
    
    y = df['Machine failure']
    X = df.drop(columns=['Machine failure'])
    
    print(f"\n📊 Feature set: {list(X.columns)}")
    print(f"   Target balance: {y.value_counts().to_dict()}")
    
    # ===================================================================
    # STEP 5: Train/test split
    # ===================================================================
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"\n📐 Split: {len(X_train)} train / {len(X_test)} test")
    
    # ===================================================================
    # STEP 6: Build and train pipeline
    # ===================================================================
    print("\n🤖 Training RandomForest pipeline...")
    
    pipeline = Pipeline([
        # Stage 1: Fill any missing values with median (robust to outliers)
        ('imputer', SimpleImputer(strategy='median')),
        # Stage 2: Standardize features (important for comparing RPM vs temp scales)
        ('scaler', StandardScaler()),
        # Stage 3: Random Forest with balanced class weights (handles imbalanced failures)
        ('classifier', RandomForestClassifier(
            n_estimators=150,           # Number of trees
            max_depth=12,               # Prevent overfitting 
            min_samples_split=5,        # Minimum samples to split a node
            random_state=42,
            class_weight='balanced',    # Upweight the minority (failure) class
            n_jobs=-1                   # Use all CPU cores
        ))
    ])
    
    pipeline.fit(X_train, y_train)
    print("   ✅ Training complete!")
    
    # ===================================================================
    # STEP 7: Evaluate model
    # ===================================================================
    print("\n📈 Evaluating model...")
    
    y_pred = pipeline.predict(X_test)
    
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    cm = confusion_matrix(y_test, y_pred).tolist()
    
    print(f"   Accuracy:  {accuracy:.4f} ({accuracy*100:.2f}%)")
    print(f"   Precision: {precision:.4f}")
    print(f"   Recall:    {recall:.4f}")
    print(f"   F1 Score:  {f1:.4f}")
    print(f"   Confusion Matrix: {cm}")
    print(f"\n{classification_report(y_test, y_pred, target_names=['Healthy', 'Failure'])}")
    
    # ===================================================================
    # STEP 8: Save model and metrics
    # ===================================================================
    # Save trained model
    joblib.dump(pipeline, MODEL_SAVE_PATH)
    print(f"💾 Model saved to: {MODEL_SAVE_PATH}")
    
    # Save evaluation metrics for the dashboard
    metrics = {
        'accuracy': round(accuracy, 4),
        'precision': round(precision, 4),
        'recall': round(recall, 4),
        'f1_score': round(f1, 4),
        'confusion_matrix': cm,
        'dataset_size': len(df),
        'feature_names': list(X.columns),
        'trained_at': datetime.utcnow().isoformat(),
        'training_samples': len(X_train),
        'test_samples': len(X_test),
    }
    
    with open(METRICS_SAVE_PATH, 'w') as f:
        json.dump(metrics, f, indent=2)
    print(f"📊 Metrics saved to: {METRICS_SAVE_PATH}")
    
    # Append to training history for drift monitoring
    _append_training_history(metrics)
    
    print("\n" + "=" * 60)
    print("✅ TRAINING PIPELINE COMPLETE")
    print("=" * 60)
    
    return metrics


def _append_training_history(metrics: dict):
    """
    Append this training run to the history file.
    Used for tracking model performance over time (drift monitoring).
    """
    history = []
    if os.path.exists(HISTORY_PATH):
        try:
            with open(HISTORY_PATH, 'r') as f:
                history = json.load(f)
        except:
            history = []
    
    # Keep only the last 20 training runs
    history.append({
        'timestamp': metrics['trained_at'],
        'accuracy': metrics['accuracy'],
        'precision': metrics['precision'],
        'recall': metrics['recall'],
        'f1_score': metrics['f1_score'],
        'dataset_size': metrics['dataset_size'],
    })
    history = history[-20:]
    
    with open(HISTORY_PATH, 'w') as f:
        json.dump(history, f, indent=2)


if __name__ == "__main__":
    train()
