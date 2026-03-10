const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATABASE_PATH = path.join(__dirname, "..", "data", "pdm_database.json");

const SENSOR_LIMITS = {
  vibration: { min: 0, max: 12, baselineLow: 2, baselineHigh: 8 },
  temperature: { min: 10, max: 130, baselineLow: 55, baselineHigh: 110 },
  current: { min: 0, max: 100, baselineLow: 18, baselineHigh: 85 },
  rpm: { min: 400, max: 4200, baselineLow: 1200, baselineHigh: 3500 },
};

const DEFAULT_SENSORS = {
  vibration: 3.6,
  temperature: 64,
  current: 28,
  rpm: 2400,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, decimals = 4) => Number(value.toFixed(decimals));
const average = values =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const createId = prefix => `${prefix}_${crypto.randomUUID().split("-")[0]}`;

const emptyMonitoring = () => ({
  confusion: { tp: 0, tn: 0, fp: 0, fn: 0 },
  labeledSamples: 0,
  baselineAccuracy: null,
  currentAccuracy: null,
  degradationPercent: null,
  updatedAt: new Date().toISOString(),
});

const createDefaultDatabase = () => ({
  meta: {
    name: "predictive-maintenance-v2",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  },
  assets: [
    {
      id: "asset-01",
      name: "Compressor A1",
      location: "Plant 1 / Line A",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSensors: { ...DEFAULT_SENSORS },
      lastRiskScore: 0.18,
      lastHealthScore: 84,
      riskTrend: "stable",
      status: "ONLINE",
      recommendedAction: "Continue routine monitoring.",
    },
    {
      id: "asset-02",
      name: "Milling Head B2",
      location: "Plant 1 / Line B",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSensors: { ...DEFAULT_SENSORS, vibration: 4.2, temperature: 70 },
      lastRiskScore: 0.24,
      lastHealthScore: 79,
      riskTrend: "stable",
      status: "ONLINE",
      recommendedAction: "Continue routine monitoring.",
    },
    {
      id: "asset-03",
      name: "Pump C3",
      location: "Plant 2 / Line C",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSensors: { ...DEFAULT_SENSORS, current: 31, rpm: 2150 },
      lastRiskScore: 0.22,
      lastHealthScore: 81,
      riskTrend: "stable",
      status: "ONLINE",
      recommendedAction: "Continue routine monitoring.",
    },
  ],
  sensorReadings: [],
  alerts: [],
  maintenanceLogs: [],
  monitoring: emptyMonitoring(),
});

const ensureDatabase = () => {
  const directory = path.dirname(DATABASE_PATH);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
  if (!fs.existsSync(DATABASE_PATH)) {
    fs.writeFileSync(DATABASE_PATH, JSON.stringify(createDefaultDatabase(), null, 2), "utf-8");
  }
};

const readDatabase = () => {
  ensureDatabase();
  const raw = fs.readFileSync(DATABASE_PATH, "utf-8");
  return JSON.parse(raw);
};

const writeDatabase = db => {
  db.meta.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATABASE_PATH, JSON.stringify(db, null, 2), "utf-8");
};

const safeNumber = value => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeScore = (value, low, high) => {
  if (high === low) {
    return 0;
  }
  return clamp((value - low) / (high - low), 0, 1);
};

const determineRiskLevel = riskScore => {
  if (riskScore >= 0.82) {
    return "CRITICAL";
  }
  if (riskScore >= 0.68) {
    return "HIGH";
  }
  if (riskScore >= 0.42) {
    return "MEDIUM";
  }
  return "LOW";
};

const buildRecommendation = ({ riskLevel, sensors, missingFields, calibrationIssues }) => {
  const actions = [];

  if (riskLevel === "CRITICAL") {
    actions.push("Issue immediate maintenance work order.");
  } else if (riskLevel === "HIGH") {
    actions.push("Schedule maintenance within the next shift.");
  } else if (riskLevel === "MEDIUM") {
    actions.push("Increase sampling frequency and inspect within 24 hours.");
  } else {
    actions.push("Continue routine monitoring.");
  }

  if (missingFields.length > 0) {
    actions.push("Restore missing telemetry channels from edge gateway.");
  }
  if (calibrationIssues.length > 0) {
    actions.push("Calibrate sensors flagged as out of range.");
  }
  if (sensors.vibration > 7.5) {
    actions.push("Inspect bearing wear and shaft alignment.");
  }
  if (sensors.temperature > 98) {
    actions.push("Inspect cooling and lubrication systems.");
  }
  if (sensors.current > 72) {
    actions.push("Check electrical load and winding health.");
  }
  if (sensors.rpm < 1300) {
    actions.push("Inspect drivetrain slippage and motor control loop.");
  }

  return Array.from(new Set(actions)).slice(0, 4).join(" ");
};

const evaluateReading = ({ sensors, missingFields, calibrationIssues, recentRiskScores }) => {
  const vibrationRisk = normalizeScore(
    sensors.vibration,
    SENSOR_LIMITS.vibration.baselineLow,
    SENSOR_LIMITS.vibration.baselineHigh,
  );
  const temperatureRisk = normalizeScore(
    sensors.temperature,
    SENSOR_LIMITS.temperature.baselineLow,
    SENSOR_LIMITS.temperature.baselineHigh,
  );
  const currentRisk = normalizeScore(
    sensors.current,
    SENSOR_LIMITS.current.baselineLow,
    SENSOR_LIMITS.current.baselineHigh,
  );

  const rpmRisk = clamp((2000 - sensors.rpm) / 2000, 0, 1) + clamp((sensors.rpm - 3600) / 600, 0, 1) * 0.3;

  const recentSlope =
    recentRiskScores.length > 1
      ? recentRiskScores[recentRiskScores.length - 1] - recentRiskScores[0]
      : 0;

  const trendRisk = clamp(recentSlope * 1.6, -0.25, 0.4);

  const baseRisk =
    vibrationRisk * 0.33 +
    temperatureRisk * 0.31 +
    currentRisk * 0.22 +
    rpmRisk * 0.14 +
    trendRisk;

  const qualityPenalty = missingFields.length * 0.05 + calibrationIssues.length * 0.08;
  const riskScore = clamp(baseRisk + qualityPenalty, 0, 1);
  const healthScore = clamp(100 - riskScore * 78 - missingFields.length * 4 - calibrationIssues.length * 6, 0, 100);

  return {
    riskScore: round(riskScore),
    healthScore: round(healthScore, 1),
    riskLevel: determineRiskLevel(riskScore),
  };
};

const updateMonitoring = ({ db, predictedFailure, failureLabel }) => {
  if (failureLabel === null || failureLabel === undefined) {
    return;
  }

  const actual = Number(failureLabel) >= 1 ? 1 : 0;
  const predicted = predictedFailure ? 1 : 0;

  if (predicted === 1 && actual === 1) {
    db.monitoring.confusion.tp += 1;
  } else if (predicted === 1 && actual === 0) {
    db.monitoring.confusion.fp += 1;
  } else if (predicted === 0 && actual === 1) {
    db.monitoring.confusion.fn += 1;
  } else {
    db.monitoring.confusion.tn += 1;
  }

  db.monitoring.labeledSamples += 1;

  const { tp, tn, fp, fn } = db.monitoring.confusion;
  const total = tp + tn + fp + fn;
  const accuracy = total > 0 ? (tp + tn) / total : null;
  db.monitoring.currentAccuracy = accuracy === null ? null : round(accuracy, 4);

  if (db.monitoring.baselineAccuracy === null && db.monitoring.labeledSamples >= 40) {
    db.monitoring.baselineAccuracy = db.monitoring.currentAccuracy;
  }

  if (db.monitoring.baselineAccuracy !== null && db.monitoring.currentAccuracy !== null) {
    const drop = db.monitoring.baselineAccuracy - db.monitoring.currentAccuracy;
    db.monitoring.degradationPercent = round(drop * 100, 2);
  }

  db.monitoring.updatedAt = new Date().toISOString();
};

const getRecentRiskScores = (db, assetId, limit = 10) =>
  db.sensorReadings
    .filter(reading => reading.assetId === assetId)
    .slice(-limit)
    .map(reading => reading.riskScore);

const computeRiskTrend = riskScores => {
  if (riskScores.length < 3) {
    return "stable";
  }
  const delta = riskScores[riskScores.length - 1] - riskScores[0];
  if (delta > 0.08) {
    return "rising";
  }
  if (delta < -0.08) {
    return "improving";
  }
  return "stable";
};

const upsertAlertForReading = ({ db, asset, reading }) => {
  const openAlert = db.alerts.find(alert => alert.assetId === asset.id && alert.status === "OPEN");
  const shouldOpen = reading.riskScore >= 0.68 || reading.quality.calibrationIssues.length > 1;

  if (!shouldOpen) {
    if (openAlert && reading.riskScore < 0.4) {
      openAlert.status = "RESOLVED";
      openAlert.updatedAt = new Date().toISOString();
      openAlert.message = "Auto-resolved after risk returned to safe range.";
    }
    return null;
  }

  if (openAlert) {
    openAlert.severity = reading.riskLevel;
    openAlert.riskScore = reading.riskScore;
    openAlert.healthScore = reading.healthScore;
    openAlert.updatedAt = new Date().toISOString();
    openAlert.message = reading.recommendedAction;
    return openAlert;
  }

  const alert = {
    id: createId("alert"),
    assetId: asset.id,
    assetName: asset.name,
    severity: reading.riskLevel,
    status: "OPEN",
    riskScore: reading.riskScore,
    healthScore: reading.healthScore,
    message: reading.recommendedAction,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.alerts.unshift(alert);
  return alert;
};

const processReading = (db, payload) => {
  const assetId = payload.assetId;
  const asset = db.assets.find(item => item.id === assetId);
  if (!asset) {
    throw new Error(`Asset ${assetId} was not found`);
  }

  const missingFields = [];
  const calibrationIssues = [];
  const sensors = {};

  Object.keys(SENSOR_LIMITS).forEach(sensorName => {
    let value = safeNumber(payload[sensorName]);
    if (value === null) {
      missingFields.push(sensorName);
      value = asset.lastSensors[sensorName] ?? DEFAULT_SENSORS[sensorName];
    }

    const { min, max } = SENSOR_LIMITS[sensorName];
    if (value < min || value > max) {
      calibrationIssues.push(`${sensorName}_out_of_range`);
    }
    sensors[sensorName] = round(value, 3);
  });

  const recentRiskScores = getRecentRiskScores(db, asset.id, 8);
  const evaluated = evaluateReading({
    sensors,
    missingFields,
    calibrationIssues,
    recentRiskScores,
  });

  const predictedFailure = evaluated.riskScore >= 0.68;
  const failureLabel = safeNumber(payload.failureLabel);

  updateMonitoring({ db, predictedFailure, failureLabel });

  const reading = {
    id: createId("reading"),
    assetId: asset.id,
    assetName: asset.name,
    timestamp: payload.timestamp ? new Date(payload.timestamp).toISOString() : new Date().toISOString(),
    sensors,
    riskScore: evaluated.riskScore,
    healthScore: evaluated.healthScore,
    riskLevel: evaluated.riskLevel,
    predictedFailure,
    failureLabel: failureLabel === null ? null : failureLabel >= 1 ? 1 : 0,
    quality: {
      missingFields,
      calibrationIssues,
    },
    recommendedAction: buildRecommendation({
      riskLevel: evaluated.riskLevel,
      sensors,
      missingFields,
      calibrationIssues,
    }),
  };

  db.sensorReadings.push(reading);
  if (db.sensorReadings.length > 25000) {
    db.sensorReadings = db.sensorReadings.slice(-25000);
  }

  const updatedRiskScores = getRecentRiskScores(db, asset.id, 10).concat(reading.riskScore);
  asset.lastSensors = sensors;
  asset.lastRiskScore = reading.riskScore;
  asset.lastHealthScore = reading.healthScore;
  asset.riskTrend = computeRiskTrend(updatedRiskScores);
  asset.updatedAt = new Date().toISOString();
  asset.recommendedAction = reading.recommendedAction;
  asset.status = reading.riskLevel === "CRITICAL" ? "REQUIRES_IMMEDIATE_ATTENTION" : "ONLINE";

  const alert = upsertAlertForReading({ db, asset, reading });
  return { reading, alert };
};

const ingestReadings = records => {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("records must be a non-empty array");
  }

  const db = readDatabase();
  let alertsTriggered = 0;
  const affectedAssets = new Set();
  const savedReadings = [];

  records.forEach(record => {
    const output = processReading(db, record);
    affectedAssets.add(output.reading.assetId);
    savedReadings.push(output.reading);
    if (output.alert) {
      alertsTriggered += 1;
    }
  });

  writeDatabase(db);
  return {
    inserted: records.length,
    alertsTriggered,
    affectedAssets: Array.from(affectedAssets),
    latest: savedReadings[savedReadings.length - 1],
  };
};

const addAsset = payload => {
  const db = readDatabase();
  const nextNumber = db.assets.length + 1;
  const asset = {
    id: `asset-${String(nextNumber).padStart(2, "0")}`,
    name: payload.name || `Machine ${nextNumber}`,
    location: payload.location || "Unassigned line",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastSensors: { ...DEFAULT_SENSORS },
    lastRiskScore: 0.2,
    lastHealthScore: 80,
    riskTrend: "stable",
    status: "ONLINE",
    recommendedAction: "Continue routine monitoring.",
  };
  db.assets.push(asset);
  writeDatabase(db);
  return asset;
};

const listAssets = () => {
  const db = readDatabase();
  return db.assets;
};

const listReadings = ({ assetId = null, limit = 100 } = {}) => {
  const db = readDatabase();
  let readings = db.sensorReadings;
  if (assetId) {
    readings = readings.filter(reading => reading.assetId === assetId);
  }
  return readings.slice(-limit);
};

const listAlerts = ({ status = null } = {}) => {
  const db = readDatabase();
  let alerts = db.alerts;
  if (status) {
    alerts = alerts.filter(alert => alert.status === status.toUpperCase());
  }
  return alerts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

const updateAlert = (alertId, payload) => {
  const db = readDatabase();
  const alert = db.alerts.find(item => item.id === alertId);
  if (!alert) {
    return null;
  }
  if (payload.status) {
    alert.status = payload.status.toUpperCase();
  }
  if (payload.message) {
    alert.message = payload.message;
  }
  alert.updatedAt = new Date().toISOString();
  writeDatabase(db);
  return alert;
};

const simulateReadings = ({ pointsPerAsset = 20, noise = 0.16, missingRate = 0.04 } = {}) => {
  const db = readDatabase();
  const records = [];

  db.assets.forEach(asset => {
    const base = asset.lastSensors || DEFAULT_SENSORS;
    for (let index = 0; index < pointsPerAsset; index += 1) {
      const drift = index / Math.max(pointsPerAsset, 1);
      records.push({
        assetId: asset.id,
        vibration: round(base.vibration + drift * 2 + (Math.random() - 0.5) * noise * 6, 3),
        temperature: round(base.temperature + drift * 10 + (Math.random() - 0.5) * noise * 24, 3),
        current: round(base.current + drift * 6 + (Math.random() - 0.5) * noise * 14, 3),
        rpm: round(base.rpm - drift * 260 + (Math.random() - 0.5) * noise * 420, 3),
        failureLabel: drift > 0.83 ? 1 : 0,
        timestamp: new Date(Date.now() - (pointsPerAsset - index) * 60000).toISOString(),
      });

      if (Math.random() < missingRate) {
        const keys = Object.keys(SENSOR_LIMITS);
        const missingKey = keys[Math.floor(Math.random() * keys.length)];
        records[records.length - 1][missingKey] = null;
      }
    }
  });

  return ingestReadings(records);
};

const dashboardSnapshot = () => {
  const db = readDatabase();
  const openAlerts = db.alerts.filter(alert => alert.status === "OPEN");
  const avgHealth = db.assets.length ? average(db.assets.map(asset => asset.lastHealthScore)) : 0;
  const avgRisk = db.assets.length ? average(db.assets.map(asset => asset.lastRiskScore)) : 0;

  return {
    summary: {
      totalAssets: db.assets.length,
      openAlerts: openAlerts.length,
      highRiskAssets: db.assets.filter(asset => asset.lastRiskScore >= 0.68).length,
      avgHealthScore: round(avgHealth, 2),
      avgRiskScore: round(avgRisk, 4),
      dataPoints: db.sensorReadings.length,
      monitoring: db.monitoring,
    },
    assets: db.assets.sort((a, b) => b.lastRiskScore - a.lastRiskScore),
    alerts: openAlerts.slice(0, 20),
    recentReadings: db.sensorReadings.slice(-80),
  };
};

module.exports = {
  ensureDatabase,
  ingestReadings,
  addAsset,
  listAssets,
  listReadings,
  listAlerts,
  updateAlert,
  simulateReadings,
  dashboardSnapshot,
};
