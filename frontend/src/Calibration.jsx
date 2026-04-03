/**
 * ==========================================================================
 * Calibration.jsx — Sensor Calibration & Configuration
 * ==========================================================================
 * 
 * Features:
 *   - Per-machine sensor calibration status
 *   - Threshold configuration for alert triggers
 *   - Calibration health indicators
 *   - Missing data report per sensor
 *   - Save calibration updates to backend
 * ==========================================================================
 */

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Settings, Thermometer, Gauge, Zap, Activity,
  RefreshCw, CheckCircle2, AlertTriangle, Save
} from 'lucide-react';

// --- API base URL ---
const API = 'http://localhost:8000';

export default function Calibration() {
  // --- State ---
  const [machines, setMachines] = useState([]);              // Available machines
  const [selectedMachine, setSelectedMachine] = useState(''); // Currently selected
  const [config, setConfig] = useState(null);                 // Calibration configuration
  const [saving, setSaving] = useState(false);                // Save in progress
  const [saved, setSaved] = useState(false);                  // Save success indicator

  /**
   * Fetch available machines on mount
   */
  useEffect(() => {
    const fetchMachines = async () => {
      try {
        const res = await axios.get(`${API}/api/machines`);
        setMachines(res.data);
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
   * Fetch calibration config when machine selection changes
   */
  useEffect(() => {
    if (!selectedMachine) return;

    const fetchConfig = async () => {
      try {
        const res = await axios.get(`${API}/api/calibration/${selectedMachine}`);
        setConfig(res.data);
      } catch (err) {
        console.warn('Failed to fetch calibration:', err.message);
        // Use defaults if API not reachable
        setConfig({
          machine_id: selectedMachine,
          temp_min: 295.0, temp_max: 310.0, temp_offset: 0.0,
          rpm_min: 1000.0, rpm_max: 3000.0,
          torque_min: 3.0, torque_max: 80.0,
          tool_wear_limit: 240.0,
          last_calibrated: null,
          calibration_status: 'not_configured',
          notes: '',
        });
      }
    };
    fetchConfig();
    setSaved(false);
  }, [selectedMachine]);

  /**
   * Update a config field locally
   */
  const updateField = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
    setSaved(false);
  };

  /**
   * Save calibration config to the backend
   */
  const saveConfig = async () => {
    if (!config || !selectedMachine) return;

    setSaving(true);
    try {
      await axios.post(`${API}/api/calibration/${selectedMachine}`, {
        temp_min: config.temp_min,
        temp_max: config.temp_max,
        temp_offset: config.temp_offset,
        rpm_min: config.rpm_min,
        rpm_max: config.rpm_max,
        torque_min: config.torque_min,
        torque_max: config.torque_max,
        tool_wear_limit: config.tool_wear_limit,
        notes: config.notes || '',
      });
      setSaved(true);

      // Refresh config
      const res = await axios.get(`${API}/api/calibration/${selectedMachine}`);
      setConfig(res.data);
    } catch (err) {
      console.error('Failed to save calibration:', err);
      alert('Failed to save calibration. Ensure the backend is running.');
    }
    setSaving(false);
  };

  /**
   * Get calibration status display
   */
  const getStatusDisplay = (status) => {
    switch (status) {
      case 'ok':
        return { color: 'var(--accent-green)', icon: <CheckCircle2 size={14} />, text: 'Calibrated' };
      case 'drift_detected':
        return { color: 'var(--accent-yellow)', icon: <AlertTriangle size={14} />, text: 'Drift Detected' };
      case 'overdue':
        return { color: 'var(--accent-red)', icon: <AlertTriangle size={14} />, text: 'Overdue' };
      default:
        return { color: 'var(--text-muted)', icon: <Settings size={14} />, text: 'Not Configured' };
    }
  };

  const statusDisplay = config ? getStatusDisplay(config.calibration_status) : null;

  return (
    <div className="slide-up">
      {/* ================================================================
          MACHINE SELECTOR + STATUS
          ================================================================ */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="input-group" style={{ marginBottom: 0, minWidth: '200px' }}>
            <label>Select Machine</label>
            <select
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value)}
            >
              {machines.length === 0 && (
                <option value="">No machines available</option>
              )}
              {machines.map(m => (
                <option key={m.machine_id} value={m.machine_id}>{m.machine_id}</option>
              ))}
            </select>
          </div>

          {statusDisplay && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: statusDisplay.color }}>
              {statusDisplay.icon}
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{statusDisplay.text}</span>
              {config?.last_calibrated && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                  Last: {new Date(config.last_calibrated).toLocaleDateString()}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ================================================================
          CALIBRATION CARDS GRID
          ================================================================ */}
      {config ? (
        <>
          <div className="calibration-grid">
            {/* Temperature calibration */}
            <div className="calibration-card">
              <h4>
                <Thermometer size={16} style={{ color: 'var(--accent-blue)' }} />
                Temperature (K)
              </h4>
              <div className="input-group">
                <label>Min Threshold</label>
                <input
                  type="number"
                  value={config.temp_min}
                  onChange={(e) => updateField('temp_min', e.target.value)}
                  step="0.5"
                />
              </div>
              <div className="input-group">
                <label>Max Threshold</label>
                <input
                  type="number"
                  value={config.temp_max}
                  onChange={(e) => updateField('temp_max', e.target.value)}
                  step="0.5"
                />
              </div>
              <div className="input-group">
                <label>Calibration Offset</label>
                <input
                  type="number"
                  value={config.temp_offset}
                  onChange={(e) => updateField('temp_offset', e.target.value)}
                  step="0.1"
                />
              </div>
            </div>

            {/* RPM calibration */}
            <div className="calibration-card">
              <h4>
                <Gauge size={16} style={{ color: 'var(--accent-cyan)' }} />
                Rotational Speed (RPM)
              </h4>
              <div className="input-group">
                <label>Min RPM</label>
                <input
                  type="number"
                  value={config.rpm_min}
                  onChange={(e) => updateField('rpm_min', e.target.value)}
                  step="50"
                />
              </div>
              <div className="input-group">
                <label>Max RPM</label>
                <input
                  type="number"
                  value={config.rpm_max}
                  onChange={(e) => updateField('rpm_max', e.target.value)}
                  step="50"
                />
              </div>
            </div>

            {/* Torque calibration */}
            <div className="calibration-card">
              <h4>
                <Zap size={16} style={{ color: 'var(--accent-yellow)' }} />
                Torque (Nm)
              </h4>
              <div className="input-group">
                <label>Min Torque</label>
                <input
                  type="number"
                  value={config.torque_min}
                  onChange={(e) => updateField('torque_min', e.target.value)}
                  step="1"
                />
              </div>
              <div className="input-group">
                <label>Max Torque</label>
                <input
                  type="number"
                  value={config.torque_max}
                  onChange={(e) => updateField('torque_max', e.target.value)}
                  step="1"
                />
              </div>
            </div>

            {/* Tool wear limit */}
            <div className="calibration-card">
              <h4>
                <Activity size={16} style={{ color: 'var(--accent-red)' }} />
                Tool Wear (min)
              </h4>
              <div className="input-group">
                <label>Replacement Threshold</label>
                <input
                  type="number"
                  value={config.tool_wear_limit}
                  onChange={(e) => updateField('tool_wear_limit', e.target.value)}
                  step="10"
                />
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Tool will be flagged for replacement when wear exceeds this value.
              </p>
            </div>
          </div>

          {/* ================================================================
              NOTES + SAVE
              ================================================================ */}
          <div className="glass-panel" style={{ marginTop: '1.5rem' }}>
            <div className="input-group">
              <label>Calibration Notes</label>
              <input
                type="text"
                value={config.notes || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add any notes about this calibration..."
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              {saved && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-green)', fontSize: '0.85rem' }}>
                  <CheckCircle2 size={16} /> Saved successfully
                </span>
              )}
              <button className="btn" onClick={saveConfig} disabled={saving}>
                {saving ? (
                  <><RefreshCw size={16} className="spin" /> Saving...</>
                ) : (
                  <><Save size={16} /> Save Calibration</>
                )}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <Settings size={48} />
          <h3>No Machine Selected</h3>
          <p>Start the backend and run the simulator to configure calibration.</p>
        </div>
      )}
    </div>
  );
}
