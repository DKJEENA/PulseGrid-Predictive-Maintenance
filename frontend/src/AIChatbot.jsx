/**
 * ==========================================================================
 * AIChatbot.jsx — Offline AI Data Assistant
 * ==========================================================================
 * 
 * Chat interface for querying sensor data using natural language.
 * All processing happens on the backend — NO external API needed.
 * 
 * Features:
 *   - Chat bubble UI with typing indicators
 *   - Suggested quick queries for common questions
 *   - Inline data tables and stats in chat responses
 *   - Auto-scroll to latest message
 *   - Markdown-like bold text rendering
 * ==========================================================================
 */

import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, Bot, User, Sparkles } from 'lucide-react';

// --- API base URL ---
import { API } from './config';

// --- Suggested queries for quick access ---
const SUGGESTED_QUERIES = [
  "What is the average temperature?",
  "Which machines are at failure risk?",
  "Give me a dataset summary",
  "What causes failures?",
  "Show failure distribution",
  "What maintenance do you recommend?",
  "How many failures are there?",
  "Show me trend analysis",
];

export default function AIChatbot() {
  // --- State ---
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      content: "👋 Hello! I'm **PredictIQ AI Assistant**. I can analyze your sensor data, identify failure patterns, and recommend maintenance actions — all without any external API.\n\nTry asking me something like *\"What is the average temperature?\"* or *\"Which machines are at risk?\"*",
      type: 'text',
      data: null,
    }
  ]);
  const [input, setInput] = useState('');              // Current input text
  const [isTyping, setIsTyping] = useState(false);     // Bot typing indicator
  const messagesEndRef = useRef(null);                  // Ref for auto-scroll
  const inputRef = useRef(null);                        // Ref for input focus

  /**
   * Auto-scroll to the bottom when new messages arrive
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  /**
   * Send a message to the chatbot API
   */
  const sendMessage = async (messageText) => {
    const text = messageText || input.trim();
    if (!text) return;

    // Add user message to chat
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // Call the backend chatbot endpoint
      const response = await axios.post(`${API}/api/chatbot`, {
        message: text,
      });

      const botResponse = {
        role: 'bot',
        content: response.data.response || "I couldn't process that query.",
        type: response.data.type || 'text',
        data: response.data.data || null,
      };

      setMessages(prev => [...prev, botResponse]);
    } catch (err) {
      // Handle API errors gracefully
      setMessages(prev => [...prev, {
        role: 'bot',
        content: "⚠️ I couldn't connect to the backend. Make sure the FastAPI server is running on `localhost:8000`.",
        type: 'text',
        data: null,
      }]);
    }

    setIsTyping(false);
    inputRef.current?.focus();
  };

  /**
   * Handle Enter key to send message
   */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /**
   * Render bold text (* *) and line breaks in chat messages
   */
  const renderFormattedText = (text) => {
    if (!text) return null;
    
    // Split by lines
    return text.split('\n').map((line, lineIdx) => {
      // Replace **bold** patterns
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <React.Fragment key={lineIdx}>
          {lineIdx > 0 && <br />}
          {parts.map((part, partIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
            }
            // Replace *italic* patterns
            if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
              return <em key={partIdx}>{part.slice(1, -1)}</em>;
            }
            return <span key={partIdx}>{part}</span>;
          })}
        </React.Fragment>
      );
    });
  };

  /**
   * Render a data table inside a chat bubble
   */
  const renderTable = (data) => {
    if (!data || !Array.isArray(data) || data.length === 0) return null;
    
    const columns = Object.keys(data[0]);
    
    return (
      <table className="chat-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {columns.map(col => (
                <td key={col}>{row[col]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="chat-container">
      {/* ================================================================
          CHAT HEADER
          ================================================================ */}
      <div className="chat-header">
        <div className="chat-avatar">
          <Bot size={20} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>PredictIQ AI Assistant</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Dataset-powered • No external API
          </div>
        </div>
        <Sparkles size={16} style={{ marginLeft: 'auto', color: 'var(--accent-purple)' }} />
      </div>

      {/* ================================================================
          SUGGESTED QUERIES
          ================================================================ */}
      <div className="suggested-queries">
        {SUGGESTED_QUERIES.slice(0, 4).map((q, i) => (
          <button
            key={i}
            className="suggested-query"
            onClick={() => sendMessage(q)}
          >
            {q}
          </button>
        ))}
      </div>

      {/* ================================================================
          CHAT MESSAGES
          ================================================================ */}
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat-bubble ${msg.role}`}
          >
            {/* Render formatted text */}
            <div>{renderFormattedText(msg.content)}</div>
            
            {/* Render data table if present */}
            {msg.type === 'table' && msg.data && renderTable(msg.data)}
            
            {/* Render stats card if present */}
            {msg.type === 'stats' && msg.data && (
              <div style={{
                marginTop: '0.75rem',
                padding: '0.75rem',
                background: 'rgba(99, 102, 241, 0.06)',
                borderRadius: '8px',
                border: '1px solid rgba(99, 102, 241, 0.12)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.8rem',
              }}>
                {Object.entries(msg.data).map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{key}:</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {typeof val === 'number' ? val.toFixed(4) : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="typing-indicator">
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* ================================================================
          CHAT INPUT
          ================================================================ */}
      <div className="chat-input-area">
        <input
          ref={inputRef}
          type="text"
          className="chat-input"
          placeholder="Ask about your sensor data..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          id="chat-input"
        />
        <button
          className="btn"
          onClick={() => sendMessage()}
          disabled={!input.trim() || isTyping}
          style={{ padding: '0.75rem 1.25rem' }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
