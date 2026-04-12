@echo off
title Virtual IoT Device Simulator
echo ===================================================
echo     Virtual IoT Device Launcher
echo ===================================================
echo.

set DEVICE_ID=%1
if "%DEVICE_ID%"=="" (
    set /p DEVICE_ID="Enter a Device ID (e.g., EDGE-X1): "
)
if "%DEVICE_ID%"=="" set DEVICE_ID=EDGE-X1

echo Starting Virtual Device: %DEVICE_ID%
echo Ensuring dependencies are installed...
pip install -q requests
echo.

python client.py --single --device-id %DEVICE_ID% --speed 2.0

pause
