@echo off
title Predictive Maintenance Platform

echo ===================================================
echo     Predictive Maintenance Platform - Launcher     
echo ===================================================

echo.
echo [1/3] Installing Python dependencies...
pip install -r requirements.txt

echo.
echo [2/3] Starting FastAPI Backend...
:: The 'start' command opens a new terminal window
start "PredictIQ Backend" cmd /k "python -m uvicorn backend.main:app --reload --port 8000"

echo.
echo [3/3] Starting React Frontend...
start "PredictIQ Frontend" cmd /k "cd frontend && npm install && npm run dev"

echo.
echo Waiting 8 seconds for servers to initialize before starting the simulator...
timeout /t 8 /nobreak >nul

echo.
echo Starting Sensor Simulator with live data...
start "PredictIQ Simulator" cmd /k "python simulator/client.py --machines 5 --speed 1.0"

echo.
echo ===================================================
echo  All services started! 
echo  The frontend should be available at: http://localhost:5173
echo ===================================================
pause
