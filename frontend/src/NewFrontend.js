import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import "./new-frontend.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

const defaultReadingForm = {
  vibration: "",
  temperature: "",
  current: "",
  rpm: "",
  failureLabel: "0",
};

const defaultAssetForm = {
  name: "",
  location: "",
};

const riskClass = riskLevel => {
  if (riskLevel === "CRITICAL") return "chip critical";
  if (riskLevel === "HIGH") return "chip high";
  if (riskLevel === "MEDIUM") return "chip medium";
  return "chip low";
};

const formatPct = value => {
  if (value === null || value === undefined) return "--";
  return `${(Number(value) * 100).toFixed(1)}%`;
};

function determineRiskLabel(score) {
  if (score >= 0.82) return "CRITICAL";
  if (score >= 0.68) return "HIGH";
  if (score >= 0.42) return "MEDIUM";
  return "LOW";
}

const NewFrontend = () => {
  const [summary, setSummary] = useState(null);
  const [assets, setAssets] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [readings, setReadings] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState("");
  const [readingForm, setReadingForm] = useState(defaultReadingForm);
  const [assetForm, setAssetForm] = useState(defaultAssetForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async () => {
    const response = await axios.get(`${API_BASE}/api/v2/dashboard`);
    const payload = response.data;
    setSummary(payload.summary);
    setAssets(payload.assets || []);
    setAlerts(payload.alerts || []);

    if (!selectedAsset && payload.assets && payload.assets.length > 0) {
      setSelectedAsset(payload.assets[0].id);
    }
  }, [selectedAsset]);

  const fetchReadings = useCallback(async assetId => {
    if (!assetId) {
      return;
    }
    const response = await axios.get(`${API_BASE}/api/v2/readings`, {
      params: { assetId, limit: 60 },
    });
    setReadings(response.data.readings || []);
  }, []);

  const fullRefresh = useCallback(
    async ({ background = false } = {}) => {
      try {
        if (background) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError("");
        await fetchDashboard();
      } catch (err) {
        setError(err?.response?.data?.message || "Unable to load dashboard data.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchDashboard],
  );

  useEffect(() => {
    fullRefresh();
  }, [fullRefresh]);

  useEffect(() => {
    if (selectedAsset) {
      fetchReadings(selectedAsset).catch(() => {
        setError("Unable to load readings for selected asset.");
      });
    }
  }, [selectedAsset, fetchReadings]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      fullRefresh({ background: true });
      if (selectedAsset) {
        fetchReadings(selectedAsset).catch(() => {});
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [selectedAsset, fullRefresh, fetchReadings]);

  const submitReading = async event => {
    event.preventDefault();
    if (!selectedAsset) {
      setError("Select an asset before sending readings.");
      return;
    }

    const payload = {
      assetId: selectedAsset,
      vibration: readingForm.vibration === "" ? null : Number(readingForm.vibration),
      temperature: readingForm.temperature === "" ? null : Number(readingForm.temperature),
      current: readingForm.current === "" ? null : Number(readingForm.current),
      rpm: readingForm.rpm === "" ? null : Number(readingForm.rpm),
      failureLabel: readingForm.failureLabel === "" ? null : Number(readingForm.failureLabel),
      timestamp: new Date().toISOString(),
    };

    try {
      await axios.post(`${API_BASE}/api/v2/readings`, payload);
      setReadingForm(defaultReadingForm);
      await fetchDashboard();
      await fetchReadings(selectedAsset);
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to submit reading.");
    }
  };

  const submitAsset = async event => {
    event.preventDefault();
    try {
      const response = await axios.post(`${API_BASE}/api/v2/assets`, assetForm);
      const createdAsset = response.data.asset;
      setAssetForm(defaultAssetForm);
      await fetchDashboard();
      setSelectedAsset(createdAsset.id);
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to create asset.");
    }
  };

  const runSimulation = async () => {
    try {
      await axios.post(`${API_BASE}/api/v2/readings/simulate`, {
        pointsPerAsset: 12,
        noise: 0.2,
        missingRate: 0.06,
      });
      await fetchDashboard();
      if (selectedAsset) {
        await fetchReadings(selectedAsset);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Simulation request failed.");
    }
  };

  const resolveAlert = async alertId => {
    try {
      await axios.patch(`${API_BASE}/api/v2/alerts/${alertId}`, { status: "RESOLVED" });
      await fetchDashboard();
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to update alert.");
    }
  };

  const selectedAssetObject = useMemo(
    () => assets.find(asset => asset.id === selectedAsset) || null,
    [assets, selectedAsset],
  );

  const riskHealthData = useMemo(() => {
    const labels = readings.map(item =>
      new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    );
    return {
      labels,
      datasets: [
        {
          label: "Risk Score",
          data: readings.map(item => item.riskScore),
          borderColor: "#ff8c61",
          backgroundColor: "rgba(255, 140, 97, 0.2)",
          tension: 0.25,
          yAxisID: "yRisk",
        },
        {
          label: "Health Score",
          data: readings.map(item => item.healthScore),
          borderColor: "#4dd8a4",
          backgroundColor: "rgba(77, 216, 164, 0.2)",
          tension: 0.25,
          yAxisID: "yHealth",
        },
      ],
    };
  }, [readings]);

  const sensorData = useMemo(() => {
    const labels = readings.map(item =>
      new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    );
    return {
      labels,
      datasets: [
        {
          label: "Vibration",
          data: readings.map(item => item.sensors.vibration),
          borderColor: "#f76c6c",
          backgroundColor: "rgba(247, 108, 108, 0.18)",
          tension: 0.25,
        },
        {
          label: "Temperature",
          data: readings.map(item => item.sensors.temperature),
          borderColor: "#ffb347",
          backgroundColor: "rgba(255, 179, 71, 0.18)",
          tension: 0.25,
        },
        {
          label: "Current",
          data: readings.map(item => item.sensors.current),
          borderColor: "#6aa9ff",
          backgroundColor: "rgba(106, 169, 255, 0.18)",
          tension: 0.25,
        },
        {
          label: "RPM",
          data: readings.map(item => item.sensors.rpm),
          borderColor: "#b18cff",
          backgroundColor: "rgba(177, 140, 255, 0.18)",
          tension: 0.25,
        },
      ],
    };
  }, [readings]);

  if (loading) {
    return <div className="loader">Loading new frontend dashboard...</div>;
  }

  return (
    <div className="pdm-shell">
      <div className="hero-card">
        <div>
          <h1>PulseGrid Maintenance Console</h1>
          <p>Brand-new frontend connected to the new persistent database.</p>
        </div>
        <div className="hero-actions">
          <button onClick={() => fullRefresh({ background: true })}>Refresh</button>
          <button onClick={runSimulation}>Run Simulation</button>
          <span>{refreshing ? "Auto-refreshing..." : "Live refresh every 5s"}</span>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="kpi-grid">
        <div className="kpi-card">
          <small>Total Assets</small>
          <h3>{summary?.totalAssets || 0}</h3>
        </div>
        <div className="kpi-card">
          <small>Open Alerts</small>
          <h3>{summary?.openAlerts || 0}</h3>
        </div>
        <div className="kpi-card">
          <small>Average Health</small>
          <h3>{summary?.avgHealthScore || 0}</h3>
        </div>
        <div className="kpi-card">
          <small>Monitoring Accuracy</small>
          <h3>{formatPct(summary?.monitoring?.currentAccuracy)}</h3>
        </div>
      </div>

      <div className="main-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Assets</h2>
            <p>Tap a machine to inspect trend and sensors.</p>
          </div>
          <div className="asset-list">
            {assets.map(asset => {
              const riskLabel = determineRiskLabel(asset.lastRiskScore);
              return (
                <button
                  key={asset.id}
                  className={`asset-card ${selectedAsset === asset.id ? "active" : ""}`}
                  onClick={() => setSelectedAsset(asset.id)}
                >
                  <div>
                    <h4>{asset.name}</h4>
                    <small>{asset.location}</small>
                  </div>
                  <div className={riskClass(riskLabel)}>{riskLabel}</div>
                  <div className="asset-stats">
                    <span>Health: {asset.lastHealthScore}</span>
                    <span>Risk: {(asset.lastRiskScore * 100).toFixed(1)}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Selected Asset</h2>
            <p>
              {selectedAssetObject
                ? `${selectedAssetObject.name} (${selectedAssetObject.id})`
                : "No asset selected"}
            </p>
          </div>
          <div className="chart-wrap">
            <Line
              data={riskHealthData}
              options={{
                maintainAspectRatio: false,
                responsive: true,
                scales: {
                  yRisk: { type: "linear", position: "left", min: 0, max: 1 },
                  yHealth: {
                    type: "linear",
                    position: "right",
                    min: 0,
                    max: 100,
                    grid: { drawOnChartArea: false },
                  },
                },
              }}
            />
          </div>
          <div className="chart-wrap">
            <Line
              data={sensorData}
              options={{
                maintainAspectRatio: false,
                responsive: true,
              }}
            />
          </div>
        </section>
      </div>

      <div className="forms-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Ingest Sensor Reading</h2>
            <p>Submit manual readings for the selected asset.</p>
          </div>
          <form className="inline-form" onSubmit={submitReading}>
            <input
              placeholder="Vibration"
              value={readingForm.vibration}
              onChange={e => setReadingForm(prev => ({ ...prev, vibration: e.target.value }))}
            />
            <input
              placeholder="Temperature"
              value={readingForm.temperature}
              onChange={e => setReadingForm(prev => ({ ...prev, temperature: e.target.value }))}
            />
            <input
              placeholder="Current"
              value={readingForm.current}
              onChange={e => setReadingForm(prev => ({ ...prev, current: e.target.value }))}
            />
            <input
              placeholder="RPM"
              value={readingForm.rpm}
              onChange={e => setReadingForm(prev => ({ ...prev, rpm: e.target.value }))}
            />
            <select
              value={readingForm.failureLabel}
              onChange={e => setReadingForm(prev => ({ ...prev, failureLabel: e.target.value }))}
            >
              <option value="0">Failure Label: 0</option>
              <option value="1">Failure Label: 1</option>
            </select>
            <button type="submit">Send Reading</button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Create New Asset</h2>
            <p>Connected directly to the new database-backed API.</p>
          </div>
          <form className="inline-form" onSubmit={submitAsset}>
            <input
              placeholder="Asset Name"
              value={assetForm.name}
              onChange={e => setAssetForm(prev => ({ ...prev, name: e.target.value }))}
            />
            <input
              placeholder="Location"
              value={assetForm.location}
              onChange={e => setAssetForm(prev => ({ ...prev, location: e.target.value }))}
            />
            <button type="submit">Create Asset</button>
          </form>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Open Alerts</h2>
          <p>Resolve alerts after maintenance actions are complete.</p>
        </div>
        {alerts.length === 0 ? (
          <div className="empty">No open alerts.</div>
        ) : (
          <div className="alert-list">
            {alerts.map(alert => (
              <div className="alert-item" key={alert.id}>
                <div>
                  <strong>{alert.assetName}</strong>
                  <p>{alert.message}</p>
                  <small>
                    Severity: {alert.severity} | Risk: {(alert.riskScore * 100).toFixed(1)}%
                  </small>
                </div>
                <button onClick={() => resolveAlert(alert.id)}>Resolve</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default NewFrontend;