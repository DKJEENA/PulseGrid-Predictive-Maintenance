/**
 * ==========================================================================
 * App.jsx — Main Application Shell with 7-Tab Navigation
 * ==========================================================================
 * 
 * Tab Structure:
 *   1. Fleet Overview   — All machines at a glance
 *   2. Machine Detail   — Deep-dive into one machine
 *   3. Trend Analysis   — Multi-sensor trend charts
 *   4. Alert Center     — Active alerts with management
 *   5. AI Assistant     — Chat with your data
 *   6. Data & Models    — Upload dataset + model metrics
 *   7. Calibration      — Sensor calibration settings
 * 
 * The sidebar provides navigation, and the topbar shows the current page 
 * title with a notification bell showing active alert count.
 * ==========================================================================
 */

import React, { useState, useEffect } from 'react';
import './index.css';
import Dashboard from './Dashboard';
import MachineDetail from './MachineDetail';
import TrendAnalysis from './TrendAnalysis';
import AlertCenter from './AlertCenter';
import AIChatbot from './AIChatbot';
import DataModels from './DataModels';
import Calibration from './Calibration';
import IoTDevices from './IoTDevices';
import ManualDevice from './ManualDevice';
import axios from 'axios';

import {
  Cpu, LayoutDashboard, TrendingUp, Bell,
  Bot, Database, Settings, Activity, Radio, Laptop
} from 'lucide-react';

// --- API base URL (change for production) ---
import { API } from './config';

/**
 * Tab configuration — defines all navigation items
 * Each tab has an id, label, icon, and page title
 */
const TABS = [
  { id: 'overview', label: 'Fleet Overview', icon: LayoutDashboard, title: 'Real-Time Fleet Monitoring' },
  { id: 'iot', label: 'IoT Devices', icon: Radio, title: 'Live IoT Edge Devices' },
  { id: 'demo', label: 'Demo Device', icon: Laptop, title: 'Manual Demo Device - LAPTOP-01' },
  { id: 'detail', label: 'Machine Detail', icon: Cpu, title: 'Machine Deep Dive' },
  { id: 'trends', label: 'Trend Analysis', icon: TrendingUp, title: 'Sensor Trend Analysis' },
  { id: 'alerts', label: 'Alert Center', icon: Bell, title: 'Maintenance Alerts' },
  { id: 'chatbot', label: 'AI Assistant', icon: Bot, title: 'AI Data Assistant' },
  { id: 'data', label: 'Data & Models', icon: Database, title: 'Dataset & Model Management' },
  { id: 'calibration', label: 'Calibration', icon: Settings, title: 'Sensor Calibration' },
];

function App() {
  // --- State ---
  const [activeTab, setActiveTab] = useState('overview');      // Current active tab
  const [selectedMachine, setSelectedMachine] = useState(null); // Machine selected for detail view
  const [alertCount, setAlertCount] = useState(0);              // Active alert count for badge

  /**
   * Fetch active alert count for the notification badge.
   * Polls every 5 seconds to keep it updated.
   */
  useEffect(() => {
    const fetchAlertCount = async () => {
      try {
        const res = await axios.get(`${API}/api/alerts/summary`);
        setAlertCount(res.data.active || 0);
      } catch {
        // API not reachable — silent fail
      }
    };

    fetchAlertCount();
    const interval = setInterval(fetchAlertCount, 5000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Handle clicking a machine card — navigates to detail view
   */
  const handleMachineSelect = (machineId) => {
    setSelectedMachine(machineId);
    setActiveTab('detail');
  };

  /**
   * Get the current tab's page title for the topbar
   */
  const getCurrentTitle = () => {
    const tab = TABS.find(t => t.id === activeTab);
    return tab ? tab.title : '';
  };

  /**
   * Render the active tab's component
   */
  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <Dashboard onMachineSelect={handleMachineSelect} />;
      case 'iot':
        return <IoTDevices />;
      case 'demo':
        return <ManualDevice />;
      case 'detail':
        return (
          <MachineDetail
            machineId={selectedMachine}
            onBack={() => setActiveTab('overview')}
          />
        );
      case 'trends':
        return <TrendAnalysis />;
      case 'alerts':
        return <AlertCenter />;
      case 'chatbot':
        return <AIChatbot />;
      case 'data':
        return <DataModels />;
      case 'calibration':
        return <Calibration />;
      default:
        return <Dashboard onMachineSelect={handleMachineSelect} />;
    }
  };

  return (
    <div className="app-container">
      {/* ================================================================
          SIDEBAR — Navigation menu
          ================================================================ */}
      <aside className="sidebar">
        {/* Logo/Brand */}
        <div className="sidebar-header">
          <Activity size={24} />
          <h1>PredictIQ</h1>
        </div>

        {/* Navigation items */}
        <nav className="nav-menu">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <div
                key={tab.id}
                id={`nav-${tab.id}`}
                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={18} />
                {tab.label}
                {/* Show alert badge on the Alert Center nav item */}
                {tab.id === 'alerts' && alertCount > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    background: 'var(--accent-red)',
                    color: 'white',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                    minWidth: '20px',
                    textAlign: 'center',
                  }}>
                    {alertCount}
                  </span>
                )}
              </div>
            );
          })}
        </nav>

        {/* System status footer */}
        <div className="sidebar-footer">
          <div className="status-indicator"></div>
          <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
            System Online
          </span>
        </div>
      </aside>

      {/* ================================================================
          MAIN CONTENT AREA
          ================================================================ */}
      <main className="main-area">
        {/* Top bar with page title and notification bell */}
        <header className="topbar">
          <h2 className="page-title">{getCurrentTitle()}</h2>

          <div className="topbar-actions">
            {/* Notification bell */}
            <div
              className="notification-bell"
              onClick={() => setActiveTab('alerts')}
              title="View alerts"
            >
              <Bell size={20} />
              {alertCount > 0 && (
                <span className="notification-badge">{alertCount > 99 ? '99+' : alertCount}</span>
              )}
            </div>
          </div>
        </header>

        {/* Page content — renders the active tab */}
        <div className="content-wrapper fade-in" key={activeTab}>
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default App;
