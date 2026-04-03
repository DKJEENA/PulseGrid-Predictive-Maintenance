"""
================================================================================
DATA PIPELINE — Automated Raw Data Processing
================================================================================
Handles the complete lifecycle of raw CSV data:
  1. Auto-detect column types and map to sensor schema
  2. Handle missing values (median for numeric, mode for categorical)
  3. Detect and remove duplicates
  4. Outlier detection using IQR method
  5. Generate comprehensive data quality report
  6. Normalize column names for consistency
================================================================================
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple, List
import json


def normalize_column_names(df: pd.DataFrame) -> pd.DataFrame:
    """
    Standardize column names to lowercase with underscores.
    Handles common sensor dataset naming conventions.
    
    Example: 'Air temperature [K]' -> 'air_temperature_k'
    """
    rename_map = {}
    for col in df.columns:
        # Convert to lowercase, replace spaces/brackets with underscores
        new_name = col.lower().strip()
        new_name = new_name.replace(' ', '_')
        new_name = new_name.replace('[', '').replace(']', '')
        new_name = new_name.replace('(', '').replace(')', '')
        new_name = new_name.replace('/', '_per_')
        new_name = new_name.replace('-', '_')
        # Remove consecutive underscores
        while '__' in new_name:
            new_name = new_name.replace('__', '_')
        new_name = new_name.strip('_')
        rename_map[col] = new_name
    
    return df.rename(columns=rename_map)


def detect_column_types(df: pd.DataFrame) -> Dict[str, str]:
    """
    Auto-detect each column's role in the sensor data schema.
    Returns a mapping of column_name -> detected_type.
    
    Types: 'numeric_sensor', 'categorical', 'identifier', 'target', 'timestamp'
    """
    type_map = {}
    for col in df.columns:
        dtype = df[col].dtype
        nunique = df[col].nunique()
        
        # Check if it's a timestamp column
        if 'time' in col.lower() or 'date' in col.lower():
            type_map[col] = 'timestamp'
        # Check if it's an identifier (many unique string values)
        elif dtype == 'object' and nunique > 10:
            type_map[col] = 'identifier'
        # Check if it's a binary target variable
        elif nunique == 2 and ('failure' in col.lower() or 'target' in col.lower() or 'fault' in col.lower()):
            type_map[col] = 'target'
        # Check if it's categorical (few unique values)
        elif dtype == 'object' or nunique <= 5:
            type_map[col] = 'categorical'
        # Default: numeric sensor data
        else:
            type_map[col] = 'numeric_sensor'
    
    return type_map


def handle_missing_values(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Fill missing values using appropriate strategies:
      - Numeric columns: median imputation (robust to outliers)
      - Categorical columns: mode imputation (most frequent value)
      - If a column has >50% missing, it gets flagged but still imputed
    
    Returns: (cleaned_df, missing_report)
    """
    missing_report = {}
    total_rows = len(df)
    
    for col in df.columns:
        missing_count = df[col].isnull().sum()
        if missing_count > 0:
            missing_pct = (missing_count / total_rows) * 100
            
            if df[col].dtype in ['float64', 'int64', 'float32', 'int32']:
                # Numeric: use median (more robust than mean for skewed/outlier data)
                fill_value = df[col].median()
                df[col] = df[col].fillna(fill_value)
                strategy = 'median'
            else:
                # Categorical/string: use mode (most frequent value)
                fill_value = df[col].mode()[0] if not df[col].mode().empty else 'unknown'
                df[col] = df[col].fillna(fill_value)
                strategy = 'mode'
            
            missing_report[col] = {
                'missing_count': int(missing_count),
                'missing_pct': round(missing_pct, 2),
                'strategy': strategy,
                'fill_value': str(fill_value),
                'flagged': missing_pct > 50  # Flag if majority missing
            }
    
    return df, missing_report


def detect_outliers_iqr(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Detect outliers in numeric columns using the IQR (Interquartile Range) method.
    A value is an outlier if it's more than 1.5 * IQR below Q1 or above Q3.
    
    Does NOT remove outliers — just flags them for review.
    In industrial settings, outliers might be genuine fault indicators!
    
    Returns: outlier_report {column: {count, pct, lower_bound, upper_bound}}
    """
    outlier_report = {}
    numeric_cols = df.select_dtypes(include=['float64', 'int64', 'float32', 'int32']).columns
    
    for col in numeric_cols:
        Q1 = df[col].quantile(0.25)
        Q3 = df[col].quantile(0.75)
        IQR = Q3 - Q1
        
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        
        outlier_mask = (df[col] < lower_bound) | (df[col] > upper_bound)
        outlier_count = outlier_mask.sum()
        
        if outlier_count > 0:
            outlier_report[col] = {
                'count': int(outlier_count),
                'pct': round((outlier_count / len(df)) * 100, 2),
                'lower_bound': round(float(lower_bound), 4),
                'upper_bound': round(float(upper_bound), 4),
                'min_value': round(float(df[col].min()), 4),
                'max_value': round(float(df[col].max()), 4),
            }
    
    return outlier_report


def remove_duplicates(df: pd.DataFrame) -> Tuple[pd.DataFrame, int]:
    """
    Remove duplicate rows from the dataset.
    Returns: (cleaned_df, number_of_duplicates_removed)
    """
    initial_count = len(df)
    df = df.drop_duplicates()
    removed = initial_count - len(df)
    return df, removed


def generate_column_stats(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Generate comprehensive statistics for each column in the dataset.
    Used by the frontend to display data quality information.
    """
    stats = []
    for col in df.columns:
        col_stat = {
            'name': col,
            'dtype': str(df[col].dtype),
            'non_null': int(df[col].count()),
            'null_count': int(df[col].isnull().sum()),
            'unique': int(df[col].nunique()),
        }
        
        # Add numeric stats if applicable
        if df[col].dtype in ['float64', 'int64', 'float32', 'int32']:
            col_stat.update({
                'mean': round(float(df[col].mean()), 4),
                'std': round(float(df[col].std()), 4),
                'min': round(float(df[col].min()), 4),
                'max': round(float(df[col].max()), 4),
                'median': round(float(df[col].median()), 4),
                'q25': round(float(df[col].quantile(0.25)), 4),
                'q75': round(float(df[col].quantile(0.75)), 4),
            })
        else:
            # Categorical stats
            top_value = df[col].mode()[0] if not df[col].mode().empty else None
            col_stat.update({
                'top_value': str(top_value) if top_value else None,
                'top_freq': int(df[col].value_counts().iloc[0]) if len(df[col].value_counts()) > 0 else 0,
            })
        
        stats.append(col_stat)
    
    return stats


def run_full_pipeline(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Execute the complete data processing pipeline:
      1. Normalize column names
      2. Detect column types
      3. Remove duplicates
      4. Handle missing values
      5. Detect outliers
      6. Generate statistics
    
    Returns: (processed_df, full_quality_report)
    """
    report = {
        'original_shape': list(df.shape),
        'steps': []
    }
    
    # Step 1: Normalize column names
    # (Skipped to preserve original column names for the ML model compatibility)
    report['steps'].append({
        'step': 'Column Detection',
        'column_types': detect_column_types(df)
    })
    
    # Step 2: Remove duplicates
    df, dup_count = remove_duplicates(df)
    report['steps'].append({
        'step': 'Duplicate Removal',
        'duplicates_found': dup_count,
        'rows_after': len(df)
    })
    
    # Step 3: Handle missing values
    df, missing_report = handle_missing_values(df)
    report['steps'].append({
        'step': 'Missing Value Imputation',
        'affected_columns': missing_report
    })
    
    # Step 4: Detect outliers (flag only, don't remove)
    outlier_report = detect_outliers_iqr(df)
    report['steps'].append({
        'step': 'Outlier Detection (IQR)',
        'outliers': outlier_report
    })
    
    # Step 5: Generate column statistics
    col_stats = generate_column_stats(df)
    report['column_stats'] = col_stats
    report['final_shape'] = list(df.shape)
    
    return df, report
