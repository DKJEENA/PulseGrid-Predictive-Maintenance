"""
================================================================================
SENSOR SIMULATOR — Multi-Machine Industrial Data Generator
================================================================================
Simulates realistic sensor data for multiple CNC/Lathe machines.

Features:
  - Multiple machine profiles with distinct operating characteristics
  - Gradual tool wear degradation over time
  - Random fault injection for testing alert system
  - Configurable simulation speed
  - Sends data to FastAPI backend via REST API

Usage:
  python client.py                  # Run with defaults (5 machines)
  python client.py --machines 3     # Run with 3 machines
  python client.py --speed 0.5      # Run at 2x speed (0.5s between readings)
================================================================================
"""

import requests
import time
import random
import math
import argparse
from datetime import datetime

# ---------------------------------------------------------------------------
# API configuration
# ---------------------------------------------------------------------------
API_URL = "http://localhost:8000/api/simulate"

# ---------------------------------------------------------------------------
# Machine profiles — each has unique operating characteristics
# ---------------------------------------------------------------------------
MACHINE_PROFILES = {
    'CNC-M1': {
        'name': 'CNC Mill #1',
        'base_temp': 298.0,       # Base air temperature [K]
        'base_rpm': 1500,         # Nominal RPM
        'base_torque': 40.0,      # Nominal torque [Nm]
        'type': 1,                # Medium quality
        'wear_rate': 1.5,         # How fast the tool wears
    },
    'CNC-M2': {
        'name': 'CNC Mill #2',
        'base_temp': 300.0,
        'base_rpm': 1800,
        'base_torque': 35.0,
        'type': 2,                # High quality
        'wear_rate': 1.0,
    },
    'LATHE-L1': {
        'name': 'Lathe #1',
        'base_temp': 297.0,
        'base_rpm': 2000,
        'base_torque': 45.0,
        'type': 0,                # Low quality
        'wear_rate': 2.0,
    },
    'PRESS-P1': {
        'name': 'Press #1',
        'base_temp': 301.0,
        'base_rpm': 1200,
        'base_torque': 55.0,
        'type': 1,
        'wear_rate': 1.2,
    },
    'DRILL-D1': {
        'name': 'Drill #1',
        'base_temp': 299.0,
        'base_rpm': 2200,
        'base_torque': 30.0,
        'type': 0,
        'wear_rate': 1.8,
    },
}


class MachineSimulator:
    """
    Simulates one machine with realistic sensor patterns.
    Tool wear increases over time, and periodic faults can be injected.
    """
    
    def __init__(self, machine_id: str, profile: dict, noise_multiplier: float = 1.0):
        self.machine_id = machine_id
        self.profile = profile
        self.noise_multiplier = noise_multiplier
        self.tool_wear = random.uniform(0, 50)  # Start with some initial wear
        self.cycle = 0                           # Internal cycle counter
        self.fault_mode = False                  # Whether currently in a fault
        self.fault_duration = 0                  # How long the fault lasts
    
    def generate_reading(self) -> dict:
        """
        Generate one realistic sensor reading with noise and optional faults.
        
        Returns a dict ready to send to the API.
        """
        self.cycle += 1
        
        # --- Base values with sinusoidal variation (simulates daily/operational patterns) ---
        time_factor = math.sin(self.cycle * 0.1) * 0.5  # Slow oscillation
        noise_factor = random.gauss(0, 1) * self.noise_multiplier # Random noise
        
        air_temp = self.profile['base_temp'] + time_factor * 2 + noise_factor * 0.5
        process_temp = air_temp + 8 + noise_factor * 1.5  # Process is always hotter
        rpm = self.profile['base_rpm'] + time_factor * 100 + noise_factor * 50
        torque = self.profile['base_torque'] + noise_factor * 5
        
        # --- Tool wear increases gradually (realistic degradation) ---
        self.tool_wear += self.profile['wear_rate'] * random.uniform(0.5, 1.5)
        
        # Reset tool wear when it gets very high (simulates tool replacement)
        if self.tool_wear > 250:
            self.tool_wear = random.uniform(0, 10)
            print(f"   🔧 {self.machine_id}: Tool replaced (wear reset)")
        
        # --- Random fault injection (5% chance per reading) ---
        if not self.fault_mode and random.random() < 0.05:
            self.fault_mode = True
            self.fault_duration = random.randint(3, 8)  # Fault lasts 3-8 readings
            print(f"   ⚡ {self.machine_id}: FAULT INJECTED (duration: {self.fault_duration} readings)")
        
        # Apply fault effects
        if self.fault_mode:
            # During fault: temperature rises, torque spikes, RPM drops
            air_temp += random.uniform(5, 10)
            torque += random.uniform(15, 30)
            rpm -= random.uniform(200, 500)
            self.fault_duration -= 1
            
            if self.fault_duration <= 0:
                self.fault_mode = False
                print(f"   ✅ {self.machine_id}: Fault resolved")
        
        # --- Ensure physical bounds ---
        air_temp = max(290, min(320, air_temp))
        process_temp = max(air_temp + 2, min(325, process_temp))
        rpm = max(500, min(3500, rpm))
        torque = max(1, min(90, torque))
        
        return {
            'machine_id': self.machine_id,
            'type': self.profile['type'],
            'air_temp': round(air_temp, 2),
            'process_temp': round(process_temp, 2),
            'rpm': round(rpm, 1),
            'torque': round(torque, 2),
            'tool_wear': round(self.tool_wear, 1),
            'rnf': round(random.uniform(-1, 1), 4),
        }


def run_simulation(num_machines: int = 5, interval: float = 1.0, iterations: int = 200, noise_level: float = 1.0):
    """
    Run the multi-machine simulation loop.
    
    Args:
        num_machines: How many machines to simulate (1-5)
        interval: Seconds between readings
        iterations: Total readings per machine
        noise_level: Multiplier for gaussian noise
    """
    print("=" * 60)
    print("🏭 PREDICTIVE MAINTENANCE — SENSOR SIMULATOR")
    print("=" * 60)
    
    # Create machine simulators
    machine_ids = list(MACHINE_PROFILES.keys())[:num_machines]
    simulators = {}
    
    for mid in machine_ids:
        profile = MACHINE_PROFILES[mid]
        simulators[mid] = MachineSimulator(mid, profile, noise_multiplier=noise_level)
        print(f"   Initialized: {mid} ({profile['name']})")
    
    print(f"\n🔄 Simulating {iterations} readings per machine ({interval}s interval)...")
    print(f"   Target API: {API_URL}\n")
    
    for i in range(iterations):
        for mid, sim in simulators.items():
            reading = sim.generate_reading()
            
            try:
                response = requests.post(API_URL, json=reading)
                result = response.json()
                
                health = result.get('health_score', 0)
                status = result.get('prediction', 'UNKNOWN')
                alerts = result.get('alerts_generated', 0)
                
                # Color-coded console output
                health_icon = '🟢' if health > 0.7 else ('🟡' if health > 0.4 else '🔴')
                alert_str = f" [⚠️ {alerts} alerts]" if alerts > 0 else ""
                
                print(f"   [{i+1}/{iterations}] {mid}: {health_icon} Health={health:.2f} | "
                      f"T={reading['air_temp']}K | RPM={reading['rpm']} | "
                      f"Torque={reading['torque']}Nm | Wear={reading['tool_wear']}min"
                      f"{alert_str}")
                
            except requests.exceptions.ConnectionError:
                print(f"   ❌ API not reachable at {API_URL}. Is the backend running?")
                return
            except Exception as e:
                print(f"   ❌ Error: {e}")
        
        time.sleep(interval)
    
    print(f"\n✅ Simulation complete! Generated {iterations * num_machines} total readings.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Predictive Maintenance Sensor Simulator")
    parser.add_argument('--machines', type=int, default=5, help='Number of machines (1-5)')
    parser.add_argument('--speed', type=float, default=1.0, help='Seconds between readings')
    parser.add_argument('--iterations', type=int, default=200, help='Readings per machine')
    parser.add_argument('--noise', type=float, default=1.0, help='Noise multiplier to stress test the ML model')
    
    args = parser.parse_args()
    run_simulation(
        num_machines=min(args.machines, 5),
        interval=args.speed,
        iterations=args.iterations,
        noise_level=args.noise
    )
