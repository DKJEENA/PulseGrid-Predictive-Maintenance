/**
 * ==========================================================================
 * MachineDetail.jsx — Deep Dive into a Single Machine
 * ==========================================================================
 * 
 * Shows comprehensive data for one machine:
 *   - Large health gauge with animated ring
 *   - Multi-sensor line charts (temperature, RPM, torque, tool wear)
 *   - Historical data table with all readings
 *   - Maintenance recommendation panel
 *   - Back button to return to fleet overview
 * ==========================================================================
 */

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  ArrowLeft, Thermometer, Gauge, Zap, Activity,
  Clock, AlertTriangle, CheckCircle, Download
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

// --- API base URL ---
const API = 'http://localhost:8000';

export default function MachineDetail({ machineId, onBack }) {
  // --- State ---
  const [status, setStatus] = useState(null);           // Latest sensor reading
  const [history, setHistory] = useState([]);            // Historical readings for charts
  const [loading, setLoading] = useState(true);          // Loading indicator
  const [timeRange, setTimeRange] = useState(100);       // Number of readings to fetch

  const TIME_RANGES = [
    { label: '50', value: 50 },
    { label: '100', value: 100 },
    { label: '200', value: 200 },
    { label: '500', value: 500 },
    { label: '1000', value: 1000 },
  ];

  /**
   * Fetch machine status and history from the API.
   * Refreshes every 3 seconds for real-time updates.
   */
  useEffect(() => {
    if (!machineId) return;

    const fetchData = async () => {
      try {
        // Get latest status
        const statusRes = await axios.get(`${API}/api/machines/${machineId}/status`);
        setStatus(statusRes.data);

        // Get historical data for charts
        const histRes = await axios.get(`${API}/api/machines/${machineId}/history?limit=${timeRange}`);
        setHistory(histRes.data);

        setLoading(false);
      } catch (err) {
        console.warn('Failed to fetch machine data:', err.message);
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [machineId, timeRange]);

  /**
   * Export history data as CSV file download
   */
  const exportCSV = () => {
    if (!history.length) return;
    const headers = ['timestamp', 'air_temp', 'process_temp', 'rpm', 'torque', 'tool_wear', 'health_score', 'failure_risk'];
    const csvRows = [
      headers.join(','),
      ...history.map(row =>
        headers.map(h => {
          const val = row[h];
          return typeof val === 'number' ? val.toFixed(4) : (val || '');
        }).join(',')
      )
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${machineId}_history_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Determine health status styling
   */
  const getHealthStyle = (score) => {
    if (score >= 0.7) return { color: 'var(--accent-green)', label: 'OPTIMAL', class: 'good' };
    if (score >= 0.4) return { color: 'var(--accent-yellow)', label: 'WARNING', class: 'warn' };
    return { color: 'var(--accent-red)', label: 'CRITICAL', class: 'bad' };
  };

  // --- No machine selected state ---
  if (!machineId) {
    return (
      <div className="empty-state">
        <Gauge size={48} />
        <h3>No Machine Selected</h3>
        <p>Select a machine from the Fleet Overview to see detailed analytics.</p>
        <button className="btn" onClick={onBack} style={{ marginTop: '1rem' }}>
          <ArrowLeft size={16} /> Go to Fleet Overview
        </button>
      </div>
    );
  }

  // --- Loading state ---
  if (loading) {
    return (
      <div className="empty-state">
        <div className="spin"><Gauge size={48} /></div>
        <h3>Loading Machine Data...</h3>
      </div>
    );
  }

  const healthScore = status ? Math.round(status.health_score * 100) : 0;
  const healthStyle = status ? getHealthStyle(status.health_score) : getHealthStyle(1);

  /**
   * Custom tooltip for charts — shows formatted values
   */
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: 'var(--bg-panel-solid)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '0.75rem 1rem',
        fontSize: '0.8rem',
      }}>
        {payload.map((entry, i) => (
          <div key={i} style={{ color: entry.color, marginBottom: '0.15rem' }}>
            {entry.name}: <strong>{typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}</strong>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="slide-up">
      {/* ================================================================
          HEADER — Back button + machine name
          ================================================================ */}
      <div className="detail-header">
        <div className="detail-back" onClick={onBack}>
          <ArrowLeft size={20} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{machineId}</h2>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Last updated: {status?.timestamp ? new Date(status.timestamp).toLocaleString() : 'N/A'}
          </span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Time range selector */}
          <div className="trend-controls">
            {TIME_RANGES.map(r => (
              <button
                key={r.value}
                className={`trend-btn ${timeRange === r.value ? 'active' : ''}`}
                onClick={() => setTimeRange(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
          {/* Export CSV button */}
          <button className="btn btn-sm btn-outline" onClick={exportCSV} disabled={!history.length} title="Export history as CSV">
            <Download size={14} /> CSV
          </button>
          <span className={`badge ${healthStyle.class === 'good' ? 'healthy' : (healthStyle.class === 'bad' ? 'danger' : 'warning')}`}>
            {healthStyle.label}
          </span>
        </div>
      </div>

      {/* ================================================================
          TOP ROW — Health score + current readings
          ================================================================ */}
      <div className="detail-grid">
        {/* Health score card */}
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Health Score
          </div>
          <div className="health-score-container" style={{ justifyContent: 'center' }}>
            <span className={`health-score ${healthStyle.class}`} style={{ fontSize: '4.5rem' }}>
              {healthScore}
            </span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '1.5rem' }}>/100</span>
          </div>
          <div style={{ marginTop: '1rem', color: healthStyle.color, fontSize: '0.85rem', fontWeight: 600 }}>
            {status?.failure_risk === 1 ? '⚠️ Failure Risk Detected' : '✅ Operating Normally'}
          </div>
        </div>

        {/* Current sensor readings */}
        <div className="glass-panel">
          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={16} /> Current Readings
          </h4>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label"><Thermometer size={12} /> Air Temp</span>
              <span className="stat-value">{status?.air_temp?.toFixed(1) || '--'} K</span>
            </div>
            <div className="stat-item">
              <span className="stat-label"><Thermometer size={12} /> Process Temp</span>
              <span className="stat-value">{status?.process_temp?.toFixed(1) || '--'} K</span>
            </div>
            <div className="stat-item">
              <span className="stat-label"><Gauge size={12} /> RPM</span>
              <span className="stat-value">{status?.rpm ? Math.round(status.rpm) : '--'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label"><Zap size={12} /> Torque</span>
              <span className="stat-value">{status?.torque?.toFixed(1) || '--'} Nm</span>
            </div>
            <div className="stat-item">
              <span className="stat-label"><Activity size={12} /> Tool Wear</span>
              <span className="stat-value">{status?.tool_wear ? Math.round(status.tool_wear) : '--'} min</span>
            </div>
            <div className="stat-item">
              <span className="stat-label"><Activity size={12} /> Type</span>
              <span className="stat-value">{status?.type === 0 ? 'Low' : (status?.type === 1 ? 'Med' : 'High')}</span>
            </div>
          </div>
        </div>

        {/* Recommendation panel */}
        <div className="full-width">
          <div className={`recommendation-box ${status?.failure_risk === 1 ? 'danger' : (status?.health_score < 0.7 ? 'warning' : '')}`}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              {status?.failure_risk === 1 ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
              Maintenance Recommendation
            </strong>
            {status?.recommendation || 'No maintenance action required at this time.'}
          </div>
        </div>

        {/* ================================================================
            SENSOR CHARTS — Temperature, RPM, Torque, Health Score
            ================================================================ */}
        {/* Temperature chart */}
        <div className="glass-panel full-width">
          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem' }}>
            🌡️ Temperature Trend
          </h4>
          <div style={{ height: '200px' }}>
            <ResponsiveContainer>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="timestamp" hide />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={v => `${v}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                <Line type="monotone" dataKey="air_temp" name="Air Temp" stroke="var(--accent-blue)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="process_temp" name="Process Temp" stroke="var(--accent-purple)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RPM + Torque chart */}
        <div className="glass-panel">
          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem' }}>
            ⚙️ RPM History
          </h4>
          <div style={{ height: '180px' }}>
            <ResponsiveContainer>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="rpm" name="RPM" stroke="var(--accent-cyan)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Torque chart */}
        <div className="glass-panel">
          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem' }}>
            ⚡ Torque History
          </h4>
          <div style={{ height: '180px' }}>
            <ResponsiveContainer>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={v => `${v}Nm`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="torque" name="Torque" stroke="var(--accent-yellow)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Health Score trend */}
        <div className="glass-panel full-width">
          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem' }}>
            💚 Health Score Trend
          </h4>
          <div style={{ height: '180px' }}>
            <ResponsiveContainer>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="timestamp" hide />
                <YAxis stroke="var(--text-muted)" fontSize={11} domain={[0, 1]} tickFormatter={v => `${(v*100).toFixed(0)}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="health_score" name="Health" stroke="var(--accent-green)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ================================================================
          HISTORY TABLE — Last 20 readings
          ================================================================ */}
      <div className="glass-panel" style={{ marginTop: '1.5rem' }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem' }}>
          📋 Recent Readings
        </h4>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Temp (K)</th>
                <th>RPM</th>
                <th>Torque (Nm)</th>
                <th>Wear (min)</th>
                <th>Health</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(-20).reverse().map((row, i) => (
                <tr key={i}>
                  <td>{row.timestamp ? new Date(row.timestamp).toLocaleTimeString() : '--'}</td>
                  <td>{row.air_temp?.toFixed(1)}</td>
                  <td>{Math.round(row.rpm)}</td>
                  <td>{row.torque?.toFixed(1)}</td>
                  <td>{Math.round(row.tool_wear)}</td>
                  <td style={{ color: row.health_score >= 0.7 ? 'var(--accent-green)' : (row.health_score >= 0.4 ? 'var(--accent-yellow)' : 'var(--accent-red)') }}>
                    {(row.health_score * 100).toFixed(0)}%
                  </td>
                  <td>
                    <span className={`badge ${row.failure_risk === 1 ? 'danger' : 'healthy'}`}>
                      {row.failure_risk === 1 ? 'RISK' : 'OK'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
