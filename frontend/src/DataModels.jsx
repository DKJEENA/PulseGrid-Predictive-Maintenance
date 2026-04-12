/**
 * ==========================================================================
 * DataModels.jsx — Dataset Management & Model Performance Dashboard
 * ==========================================================================
 * 
 * Features:
 *   - CSV dataset upload with drag-and-drop zone
 *   - Dataset preview table (first 50 rows)
 *   - Data quality report (missing values, outliers)
 *   - Model performance metrics (accuracy, precision, recall, F1)
 *   - Model drift indicator
 *   - Retrain trigger with background progress
 * ==========================================================================
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  UploadCloud, FileSpreadsheet, CheckCircle2, RefreshCw,
  Database, BarChart3, AlertTriangle, Server
} from 'lucide-react';

// --- API base URL ---
import { API } from './config';

export default function DataModels() {
  // --- State ---
  const [file, setFile] = useState(null);                // Selected file for upload
  const [uploadStatus, setUploadStatus] = useState('idle'); // 'idle' | 'uploading' | 'success' | 'error'
  const [uploadMessage, setUploadMessage] = useState('');
  const [metrics, setMetrics] = useState(null);            // Model performance metrics
  const [drift, setDrift] = useState(null);                // Model drift status
  const [preview, setPreview] = useState(null);            // Dataset preview data
  const [stats, setStats] = useState(null);                // Dataset quality stats

  /**
   * Fetch model metrics, drift status, and dataset preview on mount
   */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metricsRes, driftRes, previewRes] = await Promise.all([
          axios.get(`${API}/api/model/metrics`).catch(() => ({ data: null })),
          axios.get(`${API}/api/model/drift`).catch(() => ({ data: null })),
          axios.get(`${API}/api/dataset/preview?rows=30`).catch(() => ({ data: null })),
        ]);
        
        setMetrics(metricsRes.data);
        setDrift(driftRes.data);
        setPreview(previewRes.data);
      } catch (err) {
        console.warn('Failed to fetch data:', err.message);
      }
    };
    fetchData();
  }, []);

  /**
   * Handle file selection from the upload zone
   */
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadStatus('idle');
    }
  };

  /**
   * Upload the selected dataset file to the backend.
   * Triggers auto-clean and retrain pipeline.
   */
  const handleUpload = async () => {
    if (!file) return;

    setUploadStatus('uploading');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/api/upload_dataset`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadStatus('success');
      setUploadMessage(response.data.message);

      // Reset after 6 seconds
      setTimeout(() => {
        setUploadStatus('idle');
        setFile(null);
        setUploadMessage('');
        // Refresh metrics
        axios.get(`${API}/api/model/metrics`).then(r => setMetrics(r.data)).catch(() => {});
      }, 6000);
    } catch (err) {
      setUploadStatus('error');
      setUploadMessage('Failed to upload dataset. Ensure the backend is running.');
    }
  };

  /**
   * Fetch dataset quality stats
   */
  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/api/dataset/stats`);
      setStats(res.data);
    } catch (err) {
      console.warn('Failed to fetch stats:', err.message);
    }
  };

  return (
    <div className="slide-up">
      {/* ================================================================
          MODEL PERFORMANCE METRICS
          ================================================================ */}
      <div className="section-header">
        <h3 className="section-title">
          <BarChart3 size={18} /> Model Performance
        </h3>
        {drift?.drift_detected && (
          <span className="badge danger">Drift Detected</span>
        )}
      </div>

      <div className="metrics-cards" style={{ marginBottom: '2rem', gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {/* Accuracy */}
        <div className="metric-card">
          <div className="metric-value" style={{ color: 'var(--accent-green)' }}>
            {metrics?.accuracy ? (metrics.accuracy * 100).toFixed(1) : '--'}%
          </div>
          <div className="metric-label">Accuracy</div>
        </div>

        {/* Precision */}
        <div className="metric-card">
          <div className="metric-value" style={{ color: 'var(--accent-blue-light)' }}>
            {metrics?.precision ? (metrics.precision * 100).toFixed(1) : '--'}%
          </div>
          <div className="metric-label">Precision</div>
        </div>

        {/* Recall */}
        <div className="metric-card">
          <div className="metric-value" style={{ color: 'var(--accent-purple)' }}>
            {metrics?.recall ? (metrics.recall * 100).toFixed(1) : '--'}%
          </div>
          <div className="metric-label">Recall</div>
        </div>

        {/* F1 */}
        <div className="metric-card">
          <div className="metric-value" style={{ color: 'var(--accent-yellow)' }}>
            {metrics?.f1_score ? (metrics.f1_score * 100).toFixed(1) : '--'}%
          </div>
          <div className="metric-label">F1 Score</div>
        </div>

        {/* AUC-ROC */}
        <div className="metric-card">
          <div className="metric-value" style={{ color: 'var(--accent-cyan)' }}>
            {metrics?.auc_roc ? (metrics.auc_roc * 100).toFixed(1) : '--'}%
          </div>
          <div className="metric-label">AUC-ROC</div>
        </div>
      </div>

      {/* Cross-validation stats */}
      {metrics?.cv_f1_mean != null && (
        <div className="glass-panel" style={{ marginBottom: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>5-Fold Cross Validation</strong>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>CV F1 Mean</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: 'var(--accent-blue-light)' }}>
                {(metrics.cv_f1_mean * 100).toFixed(2)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>CV F1 Std</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: 'var(--text-secondary)' }}>
                ±{(metrics.cv_f1_std * 100).toFixed(2)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>CV Accuracy</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: 'var(--accent-green)' }}>
                {(metrics.cv_accuracy_mean * 100).toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Model info panel */}
      {metrics && (
        <div className="glass-panel" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
                Training Date
              </div>
              <div style={{ color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem' }}>
                {metrics.trained_at ? new Date(metrics.trained_at).toLocaleDateString() : 'Unknown'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
                Dataset Size
              </div>
              <div style={{ color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem' }}>
                {metrics.dataset_size?.toLocaleString() || '--'} records
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
                Model Status
              </div>
              <div style={{ color: metrics.model_loaded ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: '0.85rem', fontWeight: 600 }}>
                {metrics.model_loaded ? '✅ Loaded' : '❌ Not Loaded'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
                Drift Status
              </div>
              <div style={{ color: drift?.drift_detected ? 'var(--accent-red)' : 'var(--accent-green)', fontSize: '0.85rem', fontWeight: 600 }}>
                {drift?.drift_detected ? '⚠️ Drift Detected' : '✅ No Drift'}
              </div>
            </div>
          </div>

          {/* Confusion matrix */}
          {metrics.confusion_matrix && (
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                Confusion Matrix
              </div>
              <div style={{ display: 'inline-grid', gridTemplateColumns: 'auto auto auto', gap: '2px', fontSize: '0.8rem' }}>
                <div style={{ padding: '0.5rem 1rem' }}></div>
                <div style={{ padding: '0.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.7rem' }}>Pred: Healthy</div>
                <div style={{ padding: '0.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.7rem' }}>Pred: Failure</div>
                
                <div style={{ padding: '0.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.7rem' }}>Actual: Healthy</div>
                <div style={{ padding: '0.5rem 1rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                  {metrics.confusion_matrix[0]?.[0] || 0}
                </div>
                <div style={{ padding: '0.5rem 1rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                  {metrics.confusion_matrix[0]?.[1] || 0}
                </div>
                
                <div style={{ padding: '0.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.7rem' }}>Actual: Failure</div>
                <div style={{ padding: '0.5rem 1rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                  {metrics.confusion_matrix[1]?.[0] || 0}
                </div>
                <div style={{ padding: '0.5rem 1rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                  {metrics.confusion_matrix[1]?.[1] || 0}
                </div>
              </div>
            </div>
          )}

          {/* Feature Importance Chart */}
          {metrics.feature_importances && Object.keys(metrics.feature_importances).length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>
                Feature Importance (Random Forest)
              </div>
              <div className="importance-bar-container">
                {(() => {
                  const entries = Object.entries(metrics.feature_importances);
                  const maxVal = Math.max(...entries.map(([, v]) => v));
                  return entries.map(([feature, importance]) => (
                    <div key={feature} className="importance-row">
                      <div className="importance-label" title={feature}>{feature}</div>
                      <div className="importance-track">
                        <div
                          className="importance-fill"
                          style={{ width: `${(importance / maxVal) * 100}%` }}
                        />
                      </div>
                      <div className="importance-value">{(importance * 100).toFixed(1)}%</div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================
          DATASET UPLOAD SECTION
          ================================================================ */}
      <div className="data-models-layout">
        {/* Upload panel */}
        <div className="glass-panel">
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={16} /> Upload New Dataset
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
            Upload a CSV file to auto-clean, analyze, and retrain the ML model.
          </p>

          {uploadStatus === 'success' ? (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <CheckCircle2 size={40} style={{ color: 'var(--accent-green)', marginBottom: '1rem' }} />
              <h4 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Pipeline Triggered</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{uploadMessage}</p>
            </div>
          ) : (
            <>
              <input
                type="file"
                id="dataset-upload"
                accept=".csv"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              <label htmlFor="dataset-upload" className={`upload-zone ${file ? 'has-file' : ''}`} style={{ display: 'block' }}>
                {file ? (
                  <>
                    <FileSpreadsheet size={36} style={{ color: 'var(--accent-green)', margin: '0 auto 1rem' }} />
                    <h4 style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{file.name}</h4>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', fontSize: '0.85rem' }}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB • Ready to ingest
                    </p>
                  </>
                ) : (
                  <>
                    <UploadCloud size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
                    <h4 style={{ fontWeight: 600 }}>Select a dataset file</h4>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem', fontSize: '0.85rem' }}>
                      CSV format • Max 50MB
                    </p>
                  </>
                )}
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem', gap: '0.75rem' }}>
                <button className="btn" onClick={handleUpload} disabled={!file || uploadStatus === 'uploading'}>
                  {uploadStatus === 'uploading' ? (
                    <><RefreshCw size={16} className="spin" /> Processing...</>
                  ) : (
                    'Deploy New Context'
                  )}
                </button>
              </div>

              {uploadStatus === 'error' && (
                <p style={{ color: 'var(--accent-red)', marginTop: '0.75rem', fontSize: '0.85rem' }}>
                  {uploadMessage}
                </p>
              )}
            </>
          )}
        </div>

        {/* Dataset quality panel */}
        <div className="glass-panel">
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={16} /> Data Quality
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
            Current dataset statistics
          </p>

          {preview ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Total Records</span>
                <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{preview.total_rows?.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Columns</span>
                <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{preview.total_columns}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Format</span>
                <span style={{ fontWeight: 600 }}>CSV</span>
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Features</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {preview.columns?.slice(0, 10).map(col => (
                    <span key={col} style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      background: 'rgba(99, 102, 241, 0.08)',
                      border: '1px solid rgba(99, 102, 241, 0.12)',
                      fontSize: '0.72rem',
                      color: 'var(--text-secondary)',
                    }}>
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '2rem 0' }}>
              <Server size={32} />
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Connect to backend to view stats</p>
            </div>
          )}
        </div>

        {/* Dataset preview table */}
        {preview?.preview && (
          <div className="glass-panel full-width">
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileSpreadsheet size={16} /> Dataset Preview (first {preview.preview.length} rows)
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {preview.columns?.map(col => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.slice(0, 15).map((row, i) => (
                    <tr key={i}>
                      {preview.columns?.map(col => (
                        <td key={col}>
                          {typeof row[col] === 'number' ? row[col].toFixed(2) : String(row[col] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
