/**
 * ==========================================================================
 * TrendAnalysis.jsx — Multi-Sensor Trend Charts
 * ==========================================================================
 * 
 * Provides:
 *   - Machine selector dropdown to pick which machine to analyze
 *   - Multi-line overlay chart showing all sensor types together
 *   - Individual sensor trend direction indicators
 *   - Trend summary with percentage change
 * ==========================================================================
 */

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

// --- API base URL ---
const API = 'http://localhost:8000';

// --- Sensor display configuration ---
const SENSORS = [
  { key: 'air_temp', label: 'Air Temperature', unit: 'K', color: '#6366f1' },
  { key: 'rpm', label: 'Rotational Speed', unit: 'RPM', color: '#22d3ee' },
  { key: 'torque', label: 'Torque', unit: 'Nm', color: '#f59e0b' },
  { key: 'tool_wear', label: 'Tool Wear', unit: 'min', color: '#ef4444' },
  { key: 'health_score', label: 'Health Score', unit: '%', color: '#10b981' },
];

export default function TrendAnalysis() {
  // --- State ---
  const [machines, setMachines] = useState([]);              // Available machine list
  const [selectedMachine, setSelectedMachine] = useState(''); // Currently selected machine
  const [trends, setTrends] = useState(null);                 // Trend analysis data
  const [history, setHistory] = useState([]);                  // Raw history for charts
  const [activeSensors, setActiveSensors] = useState(['air_temp', 'health_score']); // Which lines to show
  const [loading, setLoading] = useState(false);

  /**
   * Fetch available machines on mount
   */
  useEffect(() => {
    const fetchMachines = async () => {
      try {
        const res = await axios.get(`${API}/api/machines`);
        setMachines(res.data);
        // Auto-select first machine
        if (res.data.length > 0) {
          setSelectedMachine(res.data[0].machine_id);
        }
      } catch (err) {
        console.warn('Failed to fetch machines:', err.message);
      }
    };
    fetchMachines();
  }, []);

  /**
   * Fetch trend data whenever selected machine changes
   */
  useEffect(() => {
    if (!selectedMachine) return;

    const fetchTrends = async () => {
      setLoading(true);
      try {
        // Get trend analysis
        const trendRes = await axios.get(`${API}/api/machines/${selectedMachine}/trends`);
        setTrends(trendRes.data);

        // Get full history for chart
        const histRes = await axios.get(`${API}/api/machines/${selectedMachine}/history?limit=200`);
        setHistory(histRes.data);
      } catch (err) {
        console.warn('Failed to fetch trends:', err.message);
      }
      setLoading(false);
    };

    fetchTrends();
  }, [selectedMachine]);

  /**
   * Toggle a sensor line on/off in the chart
   */
  const toggleSensor = (sensorKey) => {
    setActiveSensors(prev =>
      prev.includes(sensorKey)
        ? prev.filter(s => s !== sensorKey)
        : [...prev, sensorKey]
    );
  };

  /**
   * Get trend direction icon and styling
   */
  const getTrendIcon = (direction) => {
    switch (direction) {
      case 'increasing':
        return { icon: <TrendingUp size={14} />, color: 'var(--accent-yellow)', text: '↑ Increasing' };
      case 'decreasing':
        return { icon: <TrendingDown size={14} />, color: 'var(--accent-blue)', text: '↓ Decreasing' };
      default:
        return { icon: <Minus size={14} />, color: 'var(--accent-green)', text: '→ Stable' };
    }
  };

  /**
   * Custom tooltip for the trend chart
   */
  const CustomTooltip = ({ active, payload }) => {
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
          CONTROLS — Machine selector + sensor toggles
          ================================================================ */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Machine selector */}
          <div className="input-group" style={{ marginBottom: 0, minWidth: '200px' }}>
            <label>Select Machine</label>
            <select
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value)}
            >
              {machines.map(m => (
                <option key={m.machine_id} value={m.machine_id}>{m.machine_id}</option>
              ))}
            </select>
          </div>

          {/* Sensor toggle buttons */}
          <div className="trend-controls">
            {SENSORS.map(sensor => (
              <button
                key={sensor.key}
                className={`trend-btn ${activeSensors.includes(sensor.key) ? 'active' : ''}`}
                onClick={() => toggleSensor(sensor.key)}
                style={activeSensors.includes(sensor.key) ? { borderColor: sensor.color, color: sensor.color } : {}}
              >
                {sensor.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ================================================================
          MAIN CHART — Multi-sensor overlay
          ================================================================ */}
      <div className="trend-chart-container">
        <div className="trend-header">
          <h3 className="section-title">
            <TrendingUp size={18} /> Sensor Trends — {selectedMachine || 'Select a machine'}
          </h3>
          {loading && <RefreshCw size={16} className="spin" style={{ color: 'var(--text-muted)' }} />}
        </div>

        {history.length > 0 ? (
          <div style={{ height: '350px' }}>
            <ResponsiveContainer>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="timestamp" hide />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                {SENSORS.filter(s => activeSensors.includes(s.key)).map(sensor => (
                  <Line
                    key={sensor.key}
                    type="monotone"
                    dataKey={sensor.key}
                    name={sensor.label}
                    stroke={sensor.color}
                    strokeWidth={2}
                    dot={false}
                    animationDuration={800}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="empty-state">
            <TrendingUp size={48} />
            <h3>No Trend Data</h3>
            <p>Run the simulator to generate sensor readings for trend analysis.</p>
          </div>
        )}
      </div>

      {/* ================================================================
          TREND SUMMARY CARDS
          ================================================================ */}
      {trends?.trends && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
          {Object.entries(trends.trends).map(([key, data]) => {
            const sensor = SENSORS.find(s => s.key === key);
            const trendInfo = getTrendIcon(data.direction);
            
            return sensor ? (
              <div key={key} className="glass-panel" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {sensor.label}
                  </span>
                  <span style={{ color: trendInfo.color, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {trendInfo.icon} {data.change_pct > 0 ? '+' : ''}{data.change_pct}%
                  </span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginBottom: '0.25rem' }}>
                  {data.current?.toFixed(2)}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>{sensor.unit}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Mean: {data.mean?.toFixed(2)} {sensor.unit}
                </div>
              </div>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
