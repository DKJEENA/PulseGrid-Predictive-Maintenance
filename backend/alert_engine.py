"""
================================================================================
ALERT ENGINE — Rule-Based Maintenance Alert System
================================================================================
Generates maintenance alerts based on:
  1. Sensor threshold violations (temp, RPM, torque, tool wear)
  2. ML model failure predictions
  3. Calibration drift detection
  4. Health score degradation trends

Each alert includes:
  - Severity level (info / warning / critical)
  - Descriptive title and explanation
  - Recommended maintenance action
================================================================================
"""

from datetime import datetime
from typing import Dict, List, Optional, Any


# ===========================================================================
# ALERT THRESHOLD CONFIGURATION
# These define when alerts are triggered for each sensor type
# ===========================================================================
DEFAULT_THRESHOLDS = {
    'air_temp': {
        'warning_high': 304.0,    # K — above this triggers warning
        'critical_high': 308.0,   # K — above this triggers critical
        'warning_low': 296.0,     # K — below this triggers warning
        'critical_low': 293.0,    # K — below this triggers critical
    },
    'process_temp': {
        'warning_high': 312.0,
        'critical_high': 315.0,
        'warning_low': 305.0,
        'critical_low': 302.0,
    },
    'rpm': {
        'warning_high': 2500.0,
        'critical_high': 2800.0,
        'warning_low': 1100.0,
        'critical_low': 900.0,
    },
    'torque': {
        'warning_high': 60.0,
        'critical_high': 70.0,
        'warning_low': 5.0,
        'critical_low': 3.0,
    },
    'tool_wear': {
        'warning_high': 180.0,    # minutes — approaching replacement
        'critical_high': 220.0,   # minutes — immediate replacement needed
    },
    'health_score': {
        'warning_low': 0.65,      # Below this: machine degrading
        'critical_low': 0.40,     # Below this: failure imminent
    }
}

# ===========================================================================
# MAINTENANCE RECOMMENDATIONS
# Maps alert conditions to specific maintenance actions
# ===========================================================================
RECOMMENDATIONS = {
    'high_temp': {
        'warning': "Schedule coolant system inspection within 24 hours. Check ventilation and ambient conditions.",
        'critical': "IMMEDIATE ACTION: Shut down machine. Inspect coolant pump, heat exchanger, and thermal paste. Risk of thermal damage."
    },
    'low_temp': {
        'warning': "Monitor warm-up procedure. Check heating element if applicable.",
        'critical': "Machine operating below safe temperature. Risk of material brittleness. Allow proper warm-up before resuming."
    },
    'high_rpm': {
        'warning': "Reduce feed rate. Check spindle bearing condition and lubrication levels.",
        'critical': "CRITICAL OVERSPEED: Reduce RPM immediately. Inspect spindle bearings, drive belt tension, and motor controller."
    },
    'low_rpm': {
        'warning': "Check for mechanical drag. Inspect belt drive and motor power supply.",
        'critical': "RPM dangerously low. Possible motor failure, belt slippage, or power supply issue. Stop and inspect."
    },
    'high_torque': {
        'warning': "Check tool sharpness and material feed rate. Excessive load detected.",
        'critical': "OVERLOAD DETECTED: Stop operation. Inspect tool for breakage, check workpiece clamping, reduce depth of cut."
    },
    'low_torque': {
        'warning': "Torque below normal. Check tool engagement and material feed.",
        'critical': "Near-zero torque detected. Possible tool breakage or loss of workpiece contact. Inspect immediately."
    },
    'tool_wear': {
        'warning': "Tool wear approaching limit. Schedule tool replacement within next maintenance window.",
        'critical': "TOOL WEAR CRITICAL: Replace tool immediately. Continued operation risks workpiece damage and poor surface finish."
    },
    'ml_failure': {
        'critical': "ML MODEL PREDICTS FAILURE: Multiple sensor parameters indicate imminent machine failure. Schedule emergency maintenance inspection covering bearings, drive system, cooling, and cutting tool."
    },
    'health_degradation': {
        'warning': "Machine health trending downward. Review recent sensor trends and plan preventive maintenance.",
        'critical': "Health score critically low. Machine at high risk of unplanned failure. Prioritize inspection."
    }
}


def evaluate_sensor_reading(
    machine_id: str,
    air_temp: float,
    process_temp: float,
    rpm: float,
    torque: float,
    tool_wear: float,
    health_score: float,
    failure_risk: int,
    thresholds: Dict = None
) -> List[Dict[str, Any]]:
    """
    Evaluate a single sensor reading against thresholds and generate alerts.
    
    Args:
        machine_id: ID of the machine being evaluated
        air_temp: Current air temperature in Kelvin
        process_temp: Current process temperature in Kelvin
        rpm: Current rotational speed
        torque: Current torque in Nm
        tool_wear: Current tool wear in minutes
        health_score: ML-predicted health score (0-1)
        failure_risk: ML-predicted failure flag (0 or 1)
        thresholds: Optional custom thresholds (defaults to DEFAULT_THRESHOLDS)
    
    Returns:
        List of alert dictionaries ready to be saved to database
    """
    if thresholds is None:
        thresholds = DEFAULT_THRESHOLDS
    
    alerts = []
    now = datetime.utcnow()
    
    # --- Check air temperature ---
    t = thresholds.get('air_temp', {})
    if air_temp >= t.get('critical_high', 999):
        alerts.append(_create_alert(machine_id, 'critical', 'Critical High Temperature',
            f"Air temperature at {air_temp:.1f}K exceeds critical threshold ({t['critical_high']}K).",
            RECOMMENDATIONS['high_temp']['critical'], now))
    elif air_temp >= t.get('warning_high', 999):
        alerts.append(_create_alert(machine_id, 'warning', 'Elevated Air Temperature',
            f"Air temperature at {air_temp:.1f}K exceeds warning threshold ({t['warning_high']}K).",
            RECOMMENDATIONS['high_temp']['warning'], now))
    elif air_temp <= t.get('critical_low', -999):
        alerts.append(_create_alert(machine_id, 'critical', 'Critical Low Temperature',
            f"Air temperature at {air_temp:.1f}K below critical threshold ({t['critical_low']}K).",
            RECOMMENDATIONS['low_temp']['critical'], now))
    elif air_temp <= t.get('warning_low', -999):
        alerts.append(_create_alert(machine_id, 'warning', 'Low Air Temperature',
            f"Air temperature at {air_temp:.1f}K below warning threshold ({t['warning_low']}K).",
            RECOMMENDATIONS['low_temp']['warning'], now))
    
    # --- Check RPM ---
    r = thresholds.get('rpm', {})
    if rpm >= r.get('critical_high', 99999):
        alerts.append(_create_alert(machine_id, 'critical', 'Critical Overspeed',
            f"RPM at {rpm:.0f} exceeds critical threshold ({r['critical_high']}).",
            RECOMMENDATIONS['high_rpm']['critical'], now))
    elif rpm >= r.get('warning_high', 99999):
        alerts.append(_create_alert(machine_id, 'warning', 'High Rotational Speed',
            f"RPM at {rpm:.0f} exceeds warning threshold ({r['warning_high']}).",
            RECOMMENDATIONS['high_rpm']['warning'], now))
    elif rpm <= r.get('critical_low', -99999):
        alerts.append(_create_alert(machine_id, 'critical', 'Critical Low RPM',
            f"RPM at {rpm:.0f} below critical threshold ({r['critical_low']}).",
            RECOMMENDATIONS['low_rpm']['critical'], now))
    elif rpm <= r.get('warning_low', -99999):
        alerts.append(_create_alert(machine_id, 'warning', 'Low Rotational Speed',
            f"RPM at {rpm:.0f} below warning threshold ({r['warning_low']}).",
            RECOMMENDATIONS['low_rpm']['warning'], now))
    
    # --- Check torque ---
    tq = thresholds.get('torque', {})
    if torque >= tq.get('critical_high', 99999):
        alerts.append(_create_alert(machine_id, 'critical', 'Critical Torque Overload',
            f"Torque at {torque:.1f}Nm exceeds critical threshold ({tq['critical_high']}Nm).",
            RECOMMENDATIONS['high_torque']['critical'], now))
    elif torque >= tq.get('warning_high', 99999):
        alerts.append(_create_alert(machine_id, 'warning', 'Elevated Torque',
            f"Torque at {torque:.1f}Nm exceeds warning threshold ({tq['warning_high']}Nm).",
            RECOMMENDATIONS['high_torque']['warning'], now))
    elif torque <= tq.get('critical_low', -99999):
        alerts.append(_create_alert(machine_id, 'critical', 'Critical Low Torque',
            f"Torque at {torque:.1f}Nm below critical threshold ({tq['critical_low']}Nm).",
            RECOMMENDATIONS['low_torque']['critical'], now))
    
    # --- Check tool wear ---
    tw = thresholds.get('tool_wear', {})
    if tool_wear >= tw.get('critical_high', 99999):
        alerts.append(_create_alert(machine_id, 'critical', 'Tool Wear Critical',
            f"Tool wear at {tool_wear:.0f} min exceeds critical limit ({tw['critical_high']} min).",
            RECOMMENDATIONS['tool_wear']['critical'], now))
    elif tool_wear >= tw.get('warning_high', 99999):
        alerts.append(_create_alert(machine_id, 'warning', 'Tool Wear Warning',
            f"Tool wear at {tool_wear:.0f} min approaching limit ({tw['warning_high']} min).",
            RECOMMENDATIONS['tool_wear']['warning'], now))
    
    # --- Check ML failure prediction ---
    if failure_risk == 1:
        alerts.append(_create_alert(machine_id, 'critical', 'ML Model: Failure Predicted',
            f"The predictive model has flagged this machine for imminent failure (health score: {health_score:.2f}).",
            RECOMMENDATIONS['ml_failure']['critical'], now))
    
    # --- Check health score degradation ---
    hs = thresholds.get('health_score', {})
    if health_score <= hs.get('critical_low', 0):
        alerts.append(_create_alert(machine_id, 'critical', 'Health Score Critical',
            f"Machine health score at {health_score:.2f} — critically low.",
            RECOMMENDATIONS['health_degradation']['critical'], now))
    elif health_score <= hs.get('warning_low', 0):
        alerts.append(_create_alert(machine_id, 'warning', 'Health Score Declining',
            f"Machine health score at {health_score:.2f} — below optimal range.",
            RECOMMENDATIONS['health_degradation']['warning'], now))
    
    return alerts


def _create_alert(
    machine_id: str,
    severity: str,
    title: str,
    description: str,
    recommended_action: str,
    timestamp: datetime
) -> Dict[str, Any]:
    """Helper to create a standardized alert dictionary."""
    return {
        'machine_id': machine_id,
        'severity': severity,
        'title': title,
        'description': description,
        'recommended_action': recommended_action,
        'timestamp': timestamp,
        'acknowledged': False,
        'resolved': False,
    }


def get_recommendation_for_reading(
    air_temp: float,
    rpm: float,
    torque: float,
    tool_wear: float,
    health_score: float,
    failure_risk: int
) -> str:
    """
    Generate a concise maintenance recommendation string based on sensor values.
    This is stored alongside each sensor reading in the database.
    """
    issues = []
    
    if failure_risk == 1:
        return "[!] FAILURE IMMINENT -- Schedule emergency maintenance. Inspect all subsystems."
    
    if health_score < 0.4:
        issues.append("Health critically low")
    elif health_score < 0.65:
        issues.append("Health below optimal")
    
    if tool_wear > 220:
        issues.append("Tool replacement overdue")
    elif tool_wear > 180:
        issues.append("Schedule tool replacement")
    
    if torque > 60:
        issues.append("Reduce cutting load")
    
    if air_temp > 304:
        issues.append("Check cooling system")
    
    if rpm > 2500:
        issues.append("Reduce spindle speed")
    
    if not issues:
        return "All parameters nominal. No maintenance action required."
    
    return "Recommended: " + "; ".join(issues) + "."
