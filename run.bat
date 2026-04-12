@echo off
chcp 65001 >nul 2>&1
title PulseGrid - One-Click Launcher
color 0A

echo.
echo  ====================================================
echo       PulseGrid Predictive Maintenance Platform
echo               One-Click Launcher v2.1
echo  ====================================================
echo.

:: Save the script directory so paths work from desktop shortcut
set ROOT=%~dp0
cd /d %ROOT%

:: ===================================================================
:: STEP 1: Install Python dependencies
:: ===================================================================
echo  [1/5] Installing Python dependencies...
call pip install -r requirements.txt -q 2>nul
if errorlevel 1 (
    echo  [ERROR] Failed to install Python dependencies!
    echo  Make sure Python and pip are installed and on PATH.
    pause
    exit /b 1
)
echo        Done.
echo.

:: ===================================================================
:: STEP 2: Train the ML model (if not already trained)
:: ===================================================================
if not exist "ml\model.joblib" (
    echo  [2/5] Training ML model - first run...
    call python ml\train_model.py
    if errorlevel 1 (
        echo  [WARN] Model training had issues.
    ) else (
        echo        Model trained successfully.
    )
) else (
    echo  [2/5] ML model already exists - skipping training.
)
echo.

:: ===================================================================
:: STEP 3: Start FastAPI Backend
:: ===================================================================
echo  [3/5] Starting FastAPI Backend on port 8000...

:: Create a temp batch file for backend to avoid nested quote issues
echo @echo off > %ROOT%_start_backend.bat
echo title PulseGrid Backend >> %ROOT%_start_backend.bat
echo cd /d %ROOT%backend >> %ROOT%_start_backend.bat
echo python -m uvicorn main:app --reload --port 8000 >> %ROOT%_start_backend.bat

start "PulseGrid Backend" cmd /k %ROOT%_start_backend.bat
echo        Backend launched in new window.
echo.

:: ===================================================================
:: STEP 4: Start React Frontend
:: ===================================================================
echo  [4/5] Starting React Frontend on port 5173...

:: Create a temp batch file for frontend
echo @echo off > %ROOT%_start_frontend.bat
echo title PulseGrid Frontend >> %ROOT%_start_frontend.bat
echo cd /d %ROOT%frontend >> %ROOT%_start_frontend.bat
echo call npm install --silent 2^>nul >> %ROOT%_start_frontend.bat
echo npx vite --port 5173 >> %ROOT%_start_frontend.bat

start "PulseGrid Frontend" cmd /k %ROOT%_start_frontend.bat
echo        Frontend launched in new window.
echo.

:: ===================================================================
:: STEP 5: Wait for services, then start simulator
:: ===================================================================
echo  [5/5] Waiting 12 seconds for servers to initialize...
ping -n 13 127.0.0.1 >nul

echo        Starting IoT Sensor Simulator (5 machines)...

:: Create a temp batch file for simulator
echo @echo off > %ROOT%_start_simulator.bat
echo title PulseGrid Simulator >> %ROOT%_start_simulator.bat
echo cd /d %ROOT% >> %ROOT%_start_simulator.bat
echo python simulator\client.py --machines 5 --speed 1.0 >> %ROOT%_start_simulator.bat

start "PulseGrid Simulator" cmd /k %ROOT%_start_simulator.bat
echo        Simulator launched in new window.
echo.

:: ===================================================================
:: DONE
:: ===================================================================
echo  ====================================================
echo   All services started successfully!
echo.
echo   Backend:   http://localhost:8000
echo   Frontend:  http://localhost:5173
echo   Health:    http://localhost:8000/api/health
echo  ====================================================
echo.

echo  Opening dashboard in your browser...
ping -n 4 127.0.0.1 >nul
start http://localhost:5173

echo.
echo  Press any key to close this launcher window.
echo  (The services will keep running in their own windows)
pause >nul

:: Cleanup temp files
del %ROOT%_start_backend.bat 2>nul
del %ROOT%_start_frontend.bat 2>nul
del %ROOT%_start_simulator.bat 2>nul
