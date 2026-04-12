import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Radio, Zap, ServerOff, Wifi, AlertTriangle, StopCircle } from 'lucide-react';
import { LineChart, Line, YAxis, XAxis, ResponsiveContainer, Tooltip } from 'recharts';

const API = 'http://localhost:8000';

export default function IoTDevices() {
  const [devices, setDevices] = useState([]);
  const [liveData, setLiveData] = useState([]);
  const [wsStatus, setWsStatus] = useState('connecting');
  const [selectedDevice, setSelectedDevice] = useState(null);
  
  const ws = useRef(null);
  const dataEndRef = useRef(null);

  // Device polling
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await axios.get(`${API}/api/iot/devices`);
        setDevices(res.data);
      } catch (err) {
        console.warn("Could not fetch devices", err.message);
      }
    };
    fetchDevices();
    const iv = setInterval(fetchDevices, 2000);
    return () => clearInterval(iv);
  }, []);

  // WebSocket Connection
  useEffect(() => {
    ws.current = new WebSocket(`ws://localhost:8000/ws/live`);
    
    ws.current.onopen = () => setWsStatus('connected');
    ws.current.onclose = () => setWsStatus('disconnected');
    
    ws.current.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'live_reading') {
        const d = payload.data;
        setLiveData(prev => {
          const newStream = [...prev, d].slice(-100); // Keep last 100
          return newStream;
        });
      }
    };

    return () => ws.current.close();
  }, []);

  // Auto-scroll logic via simple element ref
  useEffect(() => {
    dataEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveData]);

  const sendCommand = async (machineId, command) => {
    try {
      await axios.post(`${API}/api/iot/devices/${machineId}/command`, { command });
    } catch (e) {
      console.error(e);
    }
  };

  const selectedDeviceData = liveData.filter(d => d.machine_id === selectedDevice).slice(-20);

  return (
    <div className="slide-up" style={{ display: 'flex', gap: '2rem', height: '100%' }}>
      {/* LEFT COLUMN: Connect Devices List */}
      <div style={{ flex: '0 0 350px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="section-header" style={{ marginBottom: 0 }}>
          <h3 className="section-title"><Radio size={18} /> Edge Connections</h3>
          <span className={`badge ${wsStatus === 'connected' ? 'healthy' : 'danger'}`}>
            <Wifi size={12} style={{marginRight: 4}}/> 
            {wsStatus.toUpperCase()}
          </span>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
          {devices.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 1rem' }}>
              <ServerOff size={32} />
              <h4>No Active Devices</h4>
              <p style={{fontSize: '0.85rem'}}>Run a virtual device simulator to connect.</p>
            </div>
          ) : (
            devices.map(dev => (
              <div 
                key={dev.machine_id}
                className={`machine-card ${selectedDevice === dev.machine_id ? 'selected' : ''}`}
                style={{ cursor: 'pointer', opacity: dev.status === 'offline' ? 0.6 : 1, transition: 'all 0.2s', border: selectedDevice === dev.machine_id ? '1px solid var(--accent-blue)' : '' }}
                onClick={() => setSelectedDevice(dev.machine_id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, fontWeight: 600 }}>{dev.machine_id}</h4>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{dev.profile}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {dev.fault_mode && <AlertTriangle size={14} color="var(--accent-red)" />}
                    <div className={`pulse-dot ${dev.status === 'online' ? 'online' : 'offline'}`}></div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Live Data & Controls */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', overflow: 'hidden' }}>
        
        {/* Sub-Header & Controls */}
        <div className="machine-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
              {selectedDevice ? `Live Feed: ${selectedDevice}` : 'Global Telemetry Stream'}
            </h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Real-time low-latency WebSocket feed</span>
          </div>
          
          {selectedDevice && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn warning" onClick={() => sendCommand(selectedDevice, 'inject_fault')} title="Inject random fault">
                <Zap size={16} /> Fault
              </button>
              <button className="btn" onClick={() => sendCommand(selectedDevice, 'resolve_fault')} title="Resolve current fault">
                 Resolve
              </button>
              <button className="btn danger" onClick={() => sendCommand(selectedDevice, 'stop')} title="Stop Simulator">
                <StopCircle size={16} /> Stop
              </button>
            </div>
          )}
        </div>

        {/* Live Gauges (Only if device selected) */}
        {selectedDevice && selectedDeviceData.length > 0 && (
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="machine-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Air Temp</h4>
              <div className="radial-gauge">
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{selectedDeviceData[selectedDeviceData.length-1].air_temp.toFixed(1)}</div>
                <div style={{ fontSize: '0.75rem' }}>Kelvin</div>
              </div>
            </div>
            <div className="machine-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>RPM</h4>
              <div className="radial-gauge RPM">
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{selectedDeviceData[selectedDeviceData.length-1].rpm.toFixed(0)}</div>
                <div style={{ fontSize: '0.75rem' }}>Speed</div>
              </div>
            </div>
            <div className="machine-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Torque</h4>
              <div className="radial-gauge Torque">
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{selectedDeviceData[selectedDeviceData.length-1].torque.toFixed(1)}</div>
                <div style={{ fontSize: '0.75rem' }}>Nm</div>
              </div>
            </div>
            <div className="machine-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Health Score</h4>
              <div className="radial-gauge Health">
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{(selectedDeviceData[selectedDeviceData.length-1].health_score * 100).toFixed(0)}</div>
                <div style={{ fontSize: '0.75rem' }}>/ 100</div>
              </div>
            </div>
          </div>
        )}

        {/* Live Data Terminal View */}
        <div className="machine-card" style={{ flex: 1, backgroundColor: '#0A0A0A', border: '1px solid #1a1a2e', fontFamily: 'monospace', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
          <div style={{ background: '#111', padding: '0.5rem 1rem', display: 'flex', borderBottom: '1px solid #222', fontSize: '0.8rem', color: '#666' }}>
            <div style={{flex: 1}}>TIMESTAMP</div>
            <div style={{flex: 1}}>DEVICE_ID</div>
            <div style={{flex: 1}}>T(K)</div>
            <div style={{flex: 1}}>RPM</div>
            <div style={{flex: 1}}>TORQUE</div>
            <div style={{flex: 1}}>HEALTH</div>
            <div style={{flex: 1}}>STATUS</div>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
            {liveData.filter(d => !selectedDevice || d.machine_id === selectedDevice).map((row, i) => (
               <div key={i} style={{ 
                 display: 'flex', 
                 padding: '0.25rem 0.5rem', 
                 borderBottom: '1px solid #1a1a1a', 
                 fontSize: '0.85rem',
                 color: row.failure_risk ? '#ff4d4f' : '#888'
               }}>
                  <div style={{flex: 1}}>{new Date(row.timestamp).toLocaleTimeString()}</div>
                  <div style={{flex: 1, color: '#4aa0e6'}}>{row.machine_id}</div>
                  <div style={{flex: 1, color: '#ccc'}}>{row.air_temp.toFixed(1)}</div>
                  <div style={{flex: 1, color: '#ccc'}}>{row.rpm.toFixed(1)}</div>
                  <div style={{flex: 1, color: '#ccc'}}>{row.torque.toFixed(1)}</div>
                  <div style={{flex: 1, color: row.health_score > 0.7 ? '#4caf50' : (row.health_score > 0.4 ? '#ff9800' : '#ff4d4f')}}>
                    {row.health_score.toFixed(3)}
                  </div>
                  <div style={{flex: 1}}>{row.prediction}</div>
               </div>
            ))}
            {liveData.length === 0 && (
               <div style={{ color: '#444', textAlign: 'center', marginTop: '2rem' }}>
                 Waiting for telemetry data stream...
               </div>
            )}
            <div ref={dataEndRef} />
          </div>
        </div>

      </div>
    </div>
  );
}
