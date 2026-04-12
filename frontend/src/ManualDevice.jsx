/**
 * ==========================================================================
 * ManualDevice.jsx — Interactive Laptop Demo Device
 * ==========================================================================
 * 
 * A virtual "LAPTOP-01" IoT device with manual sliders for:
 *   - Air Temperature (K)
 *   - Rotational Speed (RPM)
 *   - Torque (Nm)
 *   - Tool Wear (min)
 * 
 * Each slider push sends a reading to the backend via /api/simulate.
 * The backend runs the ML model and returns health score + alerts.
 * Users can deliberately push values into danger zones to trigger failures.
 * ==========================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Laptop, Thermometer, Gauge, Zap, Activity,
  AlertTriangle, CheckCircle, Send, RotateCcw, Play, Pause
} from 'lucide-react';

import { API } from './config';

// Sensor ranges — min, max, default, danger threshold
const SENSORS = {
  air_temp:    { label: 'Air Temperature',  unit: 'K',   min: 290, max: 320, default: 298, dangerLow: null, dangerHigh: 305, icon: Thermometer, color: 'var(--accent-blue)' },
  rpm:         { label: 'Rotational Speed', unit: 'RPM', min: 800, max: 3000, default: 1500, dangerLow: 1000, dangerHigh: 2500, icon: Gauge, color: 'var(--accent-cyan)' },
  torque:      { label: 'Torque',           unit: 'Nm',  min: 5,   max: 80, default: 40, dangerLow: null, dangerHigh: 60, icon: Zap, color: 'var(--accent-yellow)' },
  tool_wear:   { label: 'Tool Wear',        unit: 'min', min: 0,   max: 250, default: 10, dangerLow: null, dangerHigh: 180, icon: Activity, color: 'var(--accent-purple)' },
};

// Preset scenarios for quick demo
const PRESETS = [
  { name: 'Normal Operation', values: { air_temp: 298, rpm: 1500, torque: 40, tool_wear: 10 }, badge: 'healthy' },
  { name: 'High Temperature', values: { air_temp: 312, rpm: 1500, torque: 45, tool_wear: 30 }, badge: 'warning' },
  { name: 'Overspeed + Torque', values: { air_temp: 302, rpm: 2800, torque: 70, tool_wear: 50 }, badge: 'warning' },
  { name: 'Critical Failure', values: { air_temp: 315, rpm: 2900, torque: 75, tool_wear: 220 }, badge: 'danger' },
  { name: 'Worn Tool', values: { air_temp: 300, rpm: 1600, torque: 55, tool_wear: 230 }, badge: 'danger' },
];

export default function ManualDevice() {
  // --- State ---
  const [values, setValues] = useState({
    air_temp: SENSORS.air_temp.default,
    rpm: SENSORS.rpm.default,
    torque: SENSORS.torque.default,
    tool_wear: SENSORS.tool_wear.default,
  });
  const [response, setResponse] = useState(null);     // Last backend response
  const [history, setHistory] = useState([]);           // History of all pushes
  const [sending, setSending] = useState(false);        // Loading state
  const [autoMode, setAutoMode] = useState(false);      // Auto-push every 2s
  const autoRef = useRef(null);

  /**
   * Send the current slider values to the backend as a LAPTOP-01 reading
   */
  const pushReading = async (overrideValues) => {
    const v = overrideValues || values;
    setSending(true);
    try {
      const payload = {
        machine_id: 'LAPTOP-01',
        air_temp: v.air_temp,
        process_temp: v.air_temp + 8 + (Math.random() * 2 - 1),
        rpm: v.rpm,
        torque: v.torque,
        tool_wear: v.tool_wear,
        type: 1,
      };
      const res = await axios.post(`${API}/api/simulate`, payload);
      const data = res.data;
      setResponse(data);
      setHistory(prev => [{
        ...v,
        health: data.health_score,
        risk: data.failure_risk,
        alerts: data.alerts_generated,
        time: new Date().toLocaleTimeString(),
      }, ...prev].slice(0, 30));
    } catch (err) {
      setResponse({ error: err.message });
    }
    setSending(false);
  };

  /**
   * Auto-push mode — sends readings every 2 seconds
   */
  useEffect(() => {
    if (autoMode) {
      pushReading();
      autoRef.current = setInterval(() => pushReading(), 2000);
    } else if (autoRef.current) {
      clearInterval(autoRef.current);
    }
    return () => clearInterval(autoRef.current);
  }, [autoMode, values]);

  /**
   * Reset all sliders to safe defaults
   */
  const resetToDefaults = () => {
    const defaults = {};
    Object.keys(SENSORS).forEach(k => { defaults[k] = SENSORS[k].default; });
    setValues(defaults);
    setResponse(null);
  };

  /**
   * Apply a preset scenario
   */
  const applyPreset = (preset) => {
    setValues({ ...preset.values });
    // Auto-push when applying preset
    setTimeout(() => pushReading(preset.values), 100);
  };

  /**
   * Check if a value is in the danger zone
   */
  const isDanger = (key, val) => {
    const s = SENSORS[key];
    if (s.dangerHigh && val >= s.dangerHigh) return true;
    if (s.dangerLow && val <= s.dangerLow) return true;
    return false;
  };

  const healthScore = response?.health_score;
  const healthColor = healthScore > 0.7 ? 'var(--accent-green)' : (healthScore > 0.4 ? 'var(--accent-yellow)' : 'var(--accent-red)');
  const healthLabel = healthScore > 0.7 ? 'HEALTHY' : (healthScore > 0.4 ? 'WARNING' : 'CRITICAL');

  return (
    <div className="slide-up">
      {/* Header */}
      <div className="section-header">
        <h3 className="section-title">
          <Laptop size={18} /> Manual Demo Device - LAPTOP-01
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            className={`btn ${autoMode ? 'danger' : ''}`}
            onClick={() => setAutoMode(!autoMode)}
            style={{ fontSize: '0.8rem' }}
          >
            {autoMode ? <><Pause size={14} /> Stop Auto</> : <><Play size={14} /> Auto Push</>}
          </button>
          <button className="btn btn-outline" onClick={resetToDefaults} style={{ fontSize: '0.8rem' }}>
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </div>

      {/* Preset Scenarios */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', alignSelf: 'center', marginRight: '0.5rem' }}>
          Quick Presets:
        </span>
        {PRESETS.map(p => (
          <button
            key={p.name}
            className="btn btn-sm btn-outline"
            onClick={() => applyPreset(p)}
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
          >
            <span className={`badge ${p.badge}`} style={{ marginRight: '0.4rem', fontSize: '0.6rem', padding: '0.1rem 0.4rem' }}>
              {p.badge === 'healthy' ? 'SAFE' : p.badge === 'warning' ? 'WARN' : 'FAIL'}
            </span>
            {p.name}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem', alignItems: 'start' }}>
        {/* LEFT: Sliders */}
        <div className="glass-panel">
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Sensor Controls
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
              Drag sliders into red zones to trigger failures
            </span>
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {Object.entries(SENSORS).map(([key, sensor]) => {
              const Icon = sensor.icon;
              const val = values[key];
              const danger = isDanger(key, val);
              const pct = ((val - sensor.min) / (sensor.max - sensor.min)) * 100;

              return (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <Icon size={14} style={{ color: sensor.color }} /> {sensor.label}
                    </label>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: danger ? 'var(--accent-red)' : 'var(--text-primary)',
                      transition: 'color 0.3s',
                    }}>
                      {typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(1)) : val}
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>{sensor.unit}</span>
                    </span>
                  </div>

                  {/* Slider track */}
                  <div style={{ position: 'relative' }}>
                    <input
                      type="range"
                      min={sensor.min}
                      max={sensor.max}
                      step={key === 'air_temp' ? 0.5 : 1}
                      value={val}
                      onChange={(e) => setValues(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                      style={{
                        width: '100%',
                        height: '8px',
                        appearance: 'none',
                        background: `linear-gradient(to right, ${sensor.color} ${pct}%, rgba(255,255,255,0.06) ${pct}%)`,
                        borderRadius: '4px',
                        outline: 'none',
                        cursor: 'pointer',
                        accentColor: danger ? '#ef4444' : sensor.color,
                      }}
                    />
                    {/* Danger zone marker */}
                    {sensor.dangerHigh && (
                      <div style={{
                        position: 'absolute',
                        left: `${((sensor.dangerHigh - sensor.min) / (sensor.max - sensor.min)) * 100}%`,
                        top: '-4px',
                        width: '2px',
                        height: '16px',
                        background: 'var(--accent-red)',
                        opacity: 0.6,
                        borderRadius: '1px',
                      }} />
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    <span>{sensor.min}</span>
                    {sensor.dangerHigh && <span style={{ color: 'var(--accent-red)', opacity: 0.7 }}>Danger: {sensor.dangerHigh}+</span>}
                    <span>{sensor.max}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Push button */}
          <button
            className="btn"
            onClick={() => pushReading()}
            disabled={sending}
            style={{ width: '100%', marginTop: '2rem', padding: '0.85rem', fontSize: '0.9rem' }}
          >
            {sending ? 'Sending...' : <><Send size={16} /> Push Reading to Backend</>}
          </button>
        </div>

        {/* RIGHT: Response Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Live Health Card */}
          <div className="glass-panel" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
              LAPTOP-01 Health
            </div>
            {response && !response.error ? (
              <>
                <div style={{ fontSize: '3.5rem', fontWeight: 800, color: healthColor, lineHeight: 1, marginBottom: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}>
                  {Math.round(healthScore * 100)}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/100</div>
                <div style={{ marginTop: '0.75rem' }}>
                  <span className={`badge ${healthScore > 0.7 ? 'healthy' : (healthScore > 0.4 ? 'warning' : 'danger')}`}>
                    {healthLabel}
                  </span>
                </div>
                {response.failure_risk === 1 && (
                  <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: 'var(--accent-red)', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                    <AlertTriangle size={14} /> FAILURE RISK DETECTED
                  </div>
                )}
                {response.alerts_generated > 0 && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--accent-yellow)' }}>
                    {response.alerts_generated} alert(s) generated
                  </div>
                )}
              </>
            ) : response?.error ? (
              <div style={{ color: 'var(--accent-red)', fontSize: '0.85rem' }}>
                Error: {response.error}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '2rem 0' }}>
                Push a reading to see results
              </div>
            )}
          </div>

          {/* Response Details */}
          {response && !response.error && (
            <div className="glass-panel" style={{ fontSize: '0.8rem' }}>
              <h4 style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.75rem' }}>Backend Response</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Prediction</span>
                  <span style={{ color: response.prediction === 'Failure' ? 'var(--accent-red)' : 'var(--accent-green)', fontWeight: 600 }}>
                    {response.prediction}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Health Score</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{response.health_score?.toFixed(4)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Recommendation</span>
                  <span style={{ fontSize: '0.75rem', textAlign: 'right', maxWidth: '65%' }}>{response.recommendation}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Alerts Created</span>
                  <span style={{ fontWeight: 600, color: response.alerts_generated > 0 ? 'var(--accent-yellow)' : 'var(--text-secondary)' }}>
                    {response.alerts_generated || 0}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Push History */}
          {history.length > 0 && (
            <div className="glass-panel" style={{ maxHeight: '280px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.5rem' }}>Push History</h4>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {history.map((h, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.35rem 0',
                    borderBottom: '1px solid var(--border-color)',
                    fontSize: '0.75rem',
                  }}>
                    <span style={{ color: 'var(--text-muted)' }}>{h.time}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem' }}>
                      {h.air_temp}K / {h.rpm}rpm / {h.torque}Nm
                    </span>
                    <span style={{
                      fontWeight: 700,
                      color: h.health > 0.7 ? 'var(--accent-green)' : (h.health > 0.4 ? 'var(--accent-yellow)' : 'var(--accent-red)'),
                    }}>
                      {Math.round(h.health * 100)}
                      {h.risk === 1 && <AlertTriangle size={10} style={{ marginLeft: '0.25rem', verticalAlign: 'middle' }} />}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
