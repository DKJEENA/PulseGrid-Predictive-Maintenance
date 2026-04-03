/**
 * ==========================================================================
 * AlertCenter.jsx — Maintenance Alert Management
 * ==========================================================================
 * 
 * Features:
 *   - Active alerts list with severity badges (Critical / Warning / Info)
 *   - Filter by severity and status (active / resolved)
 *   - Alert detail with recommended maintenance action
 *   - Acknowledge + Resolve workflow buttons
 *   - Alert summary stats at the top
 * ==========================================================================
 */

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle, AlertCircle, Info, CheckCircle2,
  Bell, Shield, Clock, XCircle
} from 'lucide-react';

// --- API base URL ---
const API = 'http://localhost:8000';

export default function AlertCenter() {
  // --- State ---
  const [alerts, setAlerts] = useState([]);         // All alerts from API
  const [summary, setSummary] = useState({});        // Alert count summary
  const [filter, setFilter] = useState('all');       // Filter: 'all' | 'critical' | 'warning' | 'resolved'
  const [loading, setLoading] = useState(true);

  /**
   * Fetch alerts and summary, refresh every 5 seconds
   */
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const [alertsRes, summaryRes] = await Promise.all([
          axios.get(`${API}/api/alerts?limit=100`),
          axios.get(`${API}/api/alerts/summary`),
        ]);
        setAlerts(alertsRes.data);
        setSummary(summaryRes.data);
        setLoading(false);
      } catch (err) {
        console.warn('Failed to fetch alerts:', err.message);
        setLoading(false);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Acknowledge an alert — marks it as seen by operator
   */
  const acknowledgeAlert = async (alertId) => {
    try {
      await axios.post(`${API}/api/alerts/${alertId}/acknowledge`);
      // Refresh alerts
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, acknowledged: true } : a
      ));
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  /**
   * Resolve an alert — marks the issue as fixed
   */
  const resolveAlert = async (alertId) => {
    try {
      await axios.post(`${API}/api/alerts/${alertId}/resolve`);
      // Refresh alerts
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, resolved: true, acknowledged: true } : a
      ));
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  /**
   * Get the appropriate icon for alert severity
   */
  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return <AlertTriangle size={18} />;
      case 'warning': return <AlertCircle size={18} />;
      default: return <Info size={18} />;
    }
  };

  /**
   * Filter alerts based on selected filter
   */
  const filteredAlerts = alerts.filter(alert => {
    switch (filter) {
      case 'critical': return alert.severity === 'critical' && !alert.resolved;
      case 'warning': return alert.severity === 'warning' && !alert.resolved;
      case 'resolved': return alert.resolved;
      case 'active': return !alert.resolved;
      default: return true;
    }
  });

  return (
    <div className="slide-up">
      {/* ================================================================
          ALERT SUMMARY KPIs
          ================================================================ */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="kpi-card red" id="alert-critical">
          <div className="kpi-icon red"><AlertTriangle size={22} /></div>
          <div className="kpi-info">
            <h4>Critical</h4>
            <div className="kpi-value" style={{ color: 'var(--accent-red)' }}>
              {summary.critical || 0}
            </div>
          </div>
        </div>

        <div className="kpi-card yellow" id="alert-warning">
          <div className="kpi-icon yellow"><AlertCircle size={22} /></div>
          <div className="kpi-info">
            <h4>Warning</h4>
            <div className="kpi-value" style={{ color: 'var(--accent-yellow)' }}>
              {summary.warning || 0}
            </div>
          </div>
        </div>

        <div className="kpi-card blue" id="alert-active">
          <div className="kpi-icon blue"><Bell size={22} /></div>
          <div className="kpi-info">
            <h4>Active</h4>
            <div className="kpi-value">{summary.active || 0}</div>
          </div>
        </div>

        <div className="kpi-card green" id="alert-resolved">
          <div className="kpi-icon green"><CheckCircle2 size={22} /></div>
          <div className="kpi-info">
            <h4>Resolved</h4>
            <div className="kpi-value" style={{ color: 'var(--accent-green)' }}>
              {summary.resolved || 0}
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================
          FILTER BAR
          ================================================================ */}
      <div className="filter-bar">
        {['all', 'active', 'critical', 'warning', 'resolved'].map(f => (
          <button
            key={f}
            className={`filter-chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All Alerts' : f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'all' && ` (${alerts.length})`}
          </button>
        ))}
      </div>

      {/* ================================================================
          ALERTS LIST
          ================================================================ */}
      {filteredAlerts.length === 0 ? (
        <div className="empty-state">
          <Shield size={48} />
          <h3>{filter === 'all' ? 'No Alerts' : `No ${filter} alerts`}</h3>
          <p>
            {filter === 'all'
              ? 'Run the simulator to generate sensor data and trigger alerts.'
              : 'No alerts match the current filter.'}
          </p>
        </div>
      ) : (
        <div className="alerts-list">
          {filteredAlerts.map(alert => (
            <div
              key={alert.id}
              id={`alert-${alert.id}`}
              className={`alert-card ${alert.severity} ${alert.resolved ? 'resolved' : ''}`}
            >
              {/* Severity icon */}
              <div className={`alert-icon ${alert.severity}`}>
                {getSeverityIcon(alert.severity)}
              </div>

              {/* Alert content */}
              <div className="alert-content">
                <div className="alert-title">{alert.title}</div>
                <div className="alert-desc">{alert.description}</div>

                {/* Recommended action (expandable) */}
                {alert.recommended_action && (
                  <div className="recommendation-box" style={{ marginTop: '0.75rem', padding: '0.75rem', fontSize: '0.82rem' }}>
                    <strong>🔧 Recommended Action:</strong><br />
                    {alert.recommended_action}
                  </div>
                )}

                {/* Metadata */}
                <div className="alert-meta" style={{ marginTop: '0.75rem' }}>
                  <span><Clock size={12} /> {alert.timestamp ? new Date(alert.timestamp).toLocaleString() : '--'}</span>
                  <span>Machine: <strong style={{ color: 'var(--text-primary)' }}>{alert.machine_id}</strong></span>
                  {alert.acknowledged && (
                    <span style={{ color: 'var(--accent-green)' }}>✓ Acknowledged</span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              {!alert.resolved && (
                <div className="alert-actions">
                  {!alert.acknowledged && (
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => acknowledgeAlert(alert.id)}
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => resolveAlert(alert.id)}
                  >
                    Resolve
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
