/**
 * ==========================================================================
 * config.js — Centralized API configuration
 * ==========================================================================
 * 
 * In production, the API URL is read from the VITE_API_URL env variable.
 * In development, it defaults to http://localhost:8000.
 * 
 * Usage:  import { API, WS_URL } from './config';
 * ==========================================================================
 */

export const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Derive WebSocket URL from HTTP URL
const wsProtocol = API.startsWith('https') ? 'wss' : 'ws';
const wsHost = API.replace(/^https?:\/\//, '');
export const WS_URL = `${wsProtocol}://${wsHost}/ws/live`;
