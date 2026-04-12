"""
================================================================================
VIRTUAL IOT DEVICE SIMULATOR 
================================================================================
Simulates an advanced IoT node directly communicating with the PulseGrid backend.
Can function in "fleet mode" (multiple machines) or "single device mode".

Features:
  - Registers with the Backend Device Registry
  - Sends regular heartbeats to appear 'Online'
  - Polls for remote commands (Inject Fault, Stop)
  - Streams telemetry data to the API (which then broadcasts via WebSocket)

Run Single Device:
  python client.py --single --device-id EDGE-A1
================================================================================
"""

import requests
import time
import random
import math
import argparse
import sys
import os
import io
import threading
from datetime import datetime

# API configuration — override via CLI --api-url or env PULSEGRID_API_URL
DEFAULT_API_URL = os.environ.get("PULSEGRID_API_URL", "http://localhost:8000")
BASE_URL = DEFAULT_API_URL
API_URL = f"{BASE_URL}/api/simulate"
DEVICE_API_URL = f"{BASE_URL}/api/iot/devices"

# Retry configuration
MAX_RETRIES = 5
BASE_RETRY_DELAY = 1.0  # seconds

MACHINE_PROFILES = {
    'CNC-M1': {'name': 'CNC Mill #1', 'base_temp': 298.0, 'base_rpm': 1500, 'base_torque': 40.0, 'type': 1, 'wear_rate': 1.5},
    'CNC-M2': {'name': 'CNC Mill #2', 'base_temp': 300.0, 'base_rpm': 1800, 'base_torque': 35.0, 'type': 2, 'wear_rate': 1.0},
    'LATHE-L1': {'name': 'Lathe #1', 'base_temp': 297.0, 'base_rpm': 2000, 'base_torque': 45.0, 'type': 0, 'wear_rate': 2.0},
    'PRESS-P1': {'name': 'Press #1', 'base_temp': 301.0, 'base_rpm': 1200, 'base_torque': 55.0, 'type': 1, 'wear_rate': 1.2},
    'DRILL-D1': {'name': 'Drill #1', 'base_temp': 299.0, 'base_rpm': 2200, 'base_torque': 30.0, 'type': 0, 'wear_rate': 1.8},
    'EDGE-A1': {'name': 'Edge Node A1', 'base_temp': 295.0, 'base_rpm': 1000, 'base_torque': 20.0, 'type': 2, 'wear_rate': 0.5},
}

class IoTDevice:
    def __init__(self, machine_id: str, profile: dict, noise_multiplier: float = 1.0):
        self.machine_id = machine_id
        self.profile = profile
        self.noise_multiplier = noise_multiplier
        self.tool_wear = random.uniform(0, 50)
        self.cycle = 0
        self.fault_mode = False
        self.fault_duration = 0
        self.running = True
        
        self.register_device()
        
    def register_device(self):
        try:
            requests.post(f"{DEVICE_API_URL}/register", json={
                "machine_id": self.machine_id,
                "profile": self.profile['name'],
                "ip": "127.0.0.1"
            })
            print(f"[+] {self.machine_id} registered with PulseGrid.")
        except Exception as e:
            print(f"[!] Registration failed for {self.machine_id}: {e}")

    def send_heartbeat(self):
        while self.running:
            try:
                requests.post(f"{DEVICE_API_URL}/{self.machine_id}/heartbeat")
            except:
                pass
            time.sleep(5)
            
    def poll_commands(self):
        while self.running:
            try:
                res = requests.get(f"{DEVICE_API_URL}/{self.machine_id}/poll_command")
                cmd = res.json().get("command")
                if cmd == "inject_fault":
                    print(f"\n[!] REMOTE COMMAND RECEIVED: INJECT FAULT on {self.machine_id} [!]\n")
                    self.fault_mode = True
                    self.fault_duration = random.randint(10, 20)
                elif cmd == "resolve_fault":
                    print(f"\n[!] REMOTE COMMAND RECEIVED: RESOLVE FAULT on {self.machine_id} [!]\n")
                    self.fault_duration = 0
                    self.fault_mode = False
                elif cmd == "stop":
                    print(f"\n[!] REMOTE COMMAND RECEIVED: STOP on {self.machine_id} [!]\n")
                    self.running = False
            except:
                pass
            time.sleep(2)

    def generate_reading(self) -> dict:
        """Generate a realistic sensor reading with wear-based degradation."""
        self.cycle += 1
        time_factor = math.sin(self.cycle * 0.1) * 0.5
        noise_factor = random.gauss(0, 1) * self.noise_multiplier
        
        # Wear-based degradation: as tool wear increases, temps rise and torque increases
        wear_ratio = min(self.tool_wear / 250.0, 1.0)  # 0.0 to 1.0
        degradation_temp = wear_ratio * 3.0   # Up to +3K at max wear
        degradation_torque = wear_ratio * 8.0  # Up to +8Nm at max wear
        
        air_temp = self.profile['base_temp'] + time_factor * 2 + noise_factor * 0.5 + degradation_temp
        process_temp = air_temp + 8 + noise_factor * 1.5 + degradation_temp * 0.5
        rpm = self.profile['base_rpm'] + time_factor * 100 + noise_factor * 50 - wear_ratio * 50
        torque = self.profile['base_torque'] + noise_factor * 5 + degradation_torque
        
        self.tool_wear += self.profile['wear_rate'] * random.uniform(0.5, 1.5)
        
        if self.tool_wear > 250:
            self.tool_wear = random.uniform(0, 10)
            print(f"   🔧 {self.machine_id}: Tool replaced")
        
        if not self.fault_mode and random.random() < 0.02:
            self.fault_mode = True
            self.fault_duration = random.randint(3, 8)
            print(f"   ⚡ {self.machine_id}: RANDOM FAULT INJECTED")
            
        if self.fault_mode:
            air_temp += random.uniform(8, 15)
            torque += random.uniform(20, 40)
            rpm -= random.uniform(300, 600)
            self.fault_duration -= 1
            if self.fault_duration <= 0:
                self.fault_mode = False
                print(f"   ✅ {self.machine_id}: Fault resolved")
                
        return {
            'machine_id': self.machine_id,
            'type': self.profile['type'],
            'air_temp': round(max(290, min(320, air_temp)), 2),
            'process_temp': round(max(air_temp + 2, min(325, process_temp)), 2),
            'rpm': round(max(500, min(3500, rpm)), 1),
            'torque': round(max(1, min(90, torque)), 2),
            'tool_wear': round(self.tool_wear, 1),
            'rnf': round(random.uniform(-1, 1), 4),
        }

    def start_background_tasks(self):
        t1 = threading.Thread(target=self.send_heartbeat, daemon=True)
        t2 = threading.Thread(target=self.poll_commands, daemon=True)
        t1.start()
        t2.start()

def run_simulation(num_machines: int = 5, interval: float = 1.0, is_single_mode: bool = False, device_id: str = "EDGE-A1"):
    print("=" * 60)
    print("[*] PREDICTIVE MAINTENANCE -- IOT SENSOR SIMULATOR")
    print("=" * 60)
    
    simulators = {}
    if is_single_mode:
        profile = MACHINE_PROFILES.get(device_id, MACHINE_PROFILES['EDGE-A1'])
        simulators[device_id] = IoTDevice(device_id, profile)
        print(f"   Running in SINGLE DEVICE mode: {device_id}")
    else:
        machine_ids = list(MACHINE_PROFILES.keys())[:num_machines]
        for mid in machine_ids:
            simulators[mid] = IoTDevice(mid, MACHINE_PROFILES[mid])
        print(f"   Running in FLEET mode: {len(simulators)} devices")

    for sim in simulators.values():
        sim.start_background_tasks()
        
    print(f"\n[~] Simulating telemetry stream ({interval}s interval)...")
    
    i = 0
    try:
        while True:
            i += 1
            for mid, sim in simulators.items():
                if not sim.running:
                    continue
                reading = sim.generate_reading()
                retries = 0
                while retries <= MAX_RETRIES:
                    try:
                        response = requests.post(API_URL, json=reading, timeout=5)
                        res_data = response.json()
                        health = res_data.get('health_score', 0)
                        alerts = res_data.get('alerts_generated', 0)
                        h_icon = '[OK]' if health > 0.7 else ('[!!]' if health > 0.4 else '[XX]')
                        alert_str = f" [! {alerts} alerts]" if alerts > 0 else ""
                        print(f"   [{i}] {mid}: {h_icon} HLTH={health:.2f} | T={reading['air_temp']}K | RPM={reading['rpm']} | TQ={reading['torque']}Nm{alert_str}")
                        break  # Success
                    except requests.exceptions.ConnectionError:
                        retries += 1
                        if retries > MAX_RETRIES:
                            print(f"   [X] {mid}: Backend unreachable after {MAX_RETRIES} retries. Skipping.")
                        else:
                            delay = BASE_RETRY_DELAY * (2 ** (retries - 1)) + random.uniform(0, 0.5)
                            print(f"   [~] {mid}: Connection failed, retry {retries}/{MAX_RETRIES} in {delay:.1f}s...")
                            time.sleep(delay)
                    except Exception as e:
                        print(f"   [X] {mid}: Error: {e}")
                        break
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\n[STOP] Simulator stopped by user.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='PulseGrid IoT Sensor Simulator')
    parser.add_argument('--machines', type=int, default=5, help='Number of machines to simulate')
    parser.add_argument('--speed', type=float, default=1.0, help='Seconds between readings')
    parser.add_argument('--single', action='store_true', help='Run as a single advanced device')
    parser.add_argument('--device-id', type=str, default='EDGE-A1', help='Device ID for single mode')
    parser.add_argument('--api-url', type=str, default=None, help='Override backend API URL (e.g. http://192.168.1.10:8000)')
    args = parser.parse_args()
    
    # Apply URL override if provided
    if args.api_url:
        BASE_URL = args.api_url
        API_URL = f"{BASE_URL}/api/simulate"
        DEVICE_API_URL = f"{BASE_URL}/api/iot/devices"
    
    run_simulation(args.machines, args.speed, args.single, args.device_id)
