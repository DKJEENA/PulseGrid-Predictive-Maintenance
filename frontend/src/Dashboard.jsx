/**
 * ==========================================================================
 * Dashboard.jsx — Fleet Overview Page
 * ==========================================================================
 * 
 * Shows all machines at a glance with:
 *   - KPI summary cards (Total, Healthy, Warning, Critical)
 *   - Machine cards with health scores, sparklines, and sensor stats
 *   - Click any machine card to navigate to detail view
 * 
 * Data auto-refreshes every 3 seconds from the backend API.
 * ==========================================================================
 */

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Activity, Thermometer, Gauge, Zap, AlertTriangle,
  CheckCircle2, AlertCircle, XCircle, Server
} from 'lucide-react';
import {
  LineChart, Line, YAxis, ResponsiveContainer
} from 'recharts';

// --- API base URL ---
const API = 'http://localhost:8000';

export default function Dashboard({ onMachineSelect }) {
  // --- State ---
  const [machines, setMachines] = useState([]);       // List of machines with status
  const [historyMap, setHistoryMap] = useState({});    // Sparkline data per machine
  const [loading, setLoading] = useState(true);        // Initial loading state
  const [alertSummary, setAlertSummary] = useState({}); // Alert count breakdown

  /**
   * Fetch all machine data and alert summary from the API.
   * Runs on mount and every 3 seconds.
   */
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch machine list with latest status
        const machinesRes = await axios.get(`${API}/api/machines`);
        setMachines(machinesRes.data);

        // Fetch sparkline history for each machine (last 20 points)
        const historyData = {};
        for (const m of machinesRes.data) {
          try {
            const histRes = await axios.get(
              `${API}/api/machines/${m.machine_id}/history?limit=20`
            );
            historyData[m.machine_id] = histRes.data;
          } catch {
            // Skip if individual machine history fails
          }
        }
        setHistoryMap(historyData);

        // Fetch alert summary for KPI cards
        const alertRes = await axios.get(`${API}/api/alerts/summary`);
        setAlertSummary(alertRes.data);

        setLoading(false);
      } catch (err) {
        console.warn('API not reachable:', err.message);
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Determine the visual health status of a machine.
   * Returns style class, label text, and badge class.
   */
  const getHealthInfo = (machine) => {
    if (!machine) return { style: 'good', label: 'OPTIMAL', badge: 'healthy', cardClass: '' };

    const score = machine.health_score;
    const risk = machine.failure_risk;

    if (risk === 1 || score < 0.4) {
      return { style: 'bad', label: 'CRITICAL', badge: 'danger', cardClass: 'critical' };
    }
    if (score < 0.7) {
      return { style: 'warn', label: 'WARNING', badge: 'warning', cardClass: 'warning' };
    }
    return { style: 'good', label: 'OPTIMAL', badge: 'healthy', cardClass: '' };
  };

  /**
   * Count machines by health status for KPI cards
   */
  const getKPICounts = () => {
    const total = machines.length;
    const healthy = machines.filter(m => m.health_score >= 0.7 && m.failure_risk !== 1).length;
    const warning = machines.filter(m => m.health_score >= 0.4 && m.health_score < 0.7 && m.failure_risk !== 1).length;
    const critical = machines.filter(m => m.health_score < 0.4 || m.failure_risk === 1).length;
    return { total, healthy, warning, critical };
  };

  const kpi = getKPICounts();

  return (
    <div className="slide-up">
      {/* ================================================================
          KPI SUMMARY CARDS
          ================================================================ */}
      <div className="kpi-grid">
        {/* Total machines */}
        <div className="kpi-card blue" id="kpi-total">
          <div className="kpi-icon blue"><Server size={22} /></div>
          <div className="kpi-info">
            <h4>Total Machines</h4>
            <div className="kpi-value">{kpi.total || '--'}</div>
          </div>
        </div>

        {/* Healthy */}
        <div className="kpi-card green" id="kpi-healthy">
          <div className="kpi-icon green"><CheckCircle2 size={22} /></div>
          <div className="kpi-info">
            <h4>Healthy</h4>
            <div className="kpi-value" style={{ color: 'var(--accent-green)' }}>
              {kpi.healthy}
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="kpi-card yellow" id="kpi-warning">
          <div className="kpi-icon yellow"><AlertCircle size={22} /></div>
          <div className="kpi-info">
            <h4>Warning</h4>
            <div className="kpi-value" style={{ color: 'var(--accent-yellow)' }}>
              {kpi.warning}
            </div>
          </div>
        </div>

        {/* Critical */}
        <div className="kpi-card red" id="kpi-critical">
          <div className="kpi-icon red"><XCircle size={22} /></div>
          <div className="kpi-info">
            <h4>Critical</h4>
            <div className="kpi-value" style={{ color: 'var(--accent-red)' }}>
              {kpi.critical}
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================
          SECTION HEADER
          ================================================================ */}
      <div className="section-header">
        <h3 className="section-title">
          <Activity size={18} /> Machine Fleet
        </h3>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {alertSummary.active || 0} active alerts
        </span>
      </div>

      {/* ================================================================
          MACHINE CARDS GRID
          ================================================================ */}
      {loading && machines.length === 0 ? (
        <div className="empty-state">
          <Server size={48} />
          <h3>Connecting to Backend...</h3>
          <p>
            Start the FastAPI backend and run the simulator to see machine data here.
          </p>
        </div>
      ) : machines.length === 0 ? (
        <div className="empty-state">
          <Server size={48} />
          <h3>No Machines Found</h3>
          <p>
            Run the simulator (<code>python simulator/client.py</code>) to generate sensor data.
          </p>
        </div>
      ) : (
        <div className="machines-grid">
          {machines.map((machine) => {
            const healthInfo = getHealthInfo(machine);
            const healthScore = Math.round(machine.health_score * 100);
            const history = historyMap[machine.machine_id] || [];

            return (
              <div
                key={machine.machine_id}
                id={`machine-card-${machine.machine_id}`}
                className={`machine-card ${healthInfo.cardClass}`}
                onClick={() => onMachineSelect(machine.machine_id)}
              >
                {/* Machine header — name + badge */}
                <div className="machine-header">
                  <div>
                    <h3 className="machine-title">{machine.machine_id}</h3>
                    <span className="machine-subtitle">
                      {machine.reading_count || 0} readings • {machine.active_alerts || 0} alerts
                    </span>
                  </div>
                  <span className={`badge ${healthInfo.badge}`}>
                    {healthInfo.label}
                  </span>
                </div>

                {/* Health score — large animated number */}
                <div className="health-score-container">
                  <span className={`health-score ${healthInfo.style}`}>{healthScore}</span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}> / 100</span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.15rem', marginBottom: '1rem' }}>
                  Asset Health Score
                </div>

                {/* Sparkline chart — shows recent temperature trend */}
                {history.length > 3 && (
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={history}>
                        <Line
                          type="monotone"
                          dataKey="health_score"
                          stroke={healthInfo.style === 'bad' ? 'var(--accent-red)' : (healthInfo.style === 'warn' ? 'var(--accent-yellow)' : 'var(--accent-blue)')}
                          strokeWidth={2}
                          dot={false}
                        />
                        <YAxis domain={[0, 1]} hide />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Sensor stats grid */}
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label"><Thermometer size={12} /> Temp (K)</span>
                    <span className="stat-value">{machine.air_temp?.toFixed(1) || '--'}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label"><Gauge size={12} /> RPM</span>
                    <span className="stat-value">{machine.rpm ? Math.round(machine.rpm) : '--'}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label"><Zap size={12} /> Torque (Nm)</span>
                    <span className="stat-value">{machine.torque?.toFixed(1) || '--'}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label"><Activity size={12} /> Wear (min)</span>
                    <span className="stat-value">{machine.tool_wear ? Math.round(machine.tool_wear) : '--'}</span>
                  </div>
                </div>

                {/* Critical alert inline */}
                {machine.failure_risk === 1 && (
                  <div className="alert-inline">
                    <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                    <div>
                      <strong>Failure Predicted</strong><br />
                      {machine.recommendation || 'Schedule immediate maintenance inspection.'}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
