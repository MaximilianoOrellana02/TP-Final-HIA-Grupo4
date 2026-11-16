@echo off
set "MANTIS_SIM_DATA=%LOCALAPPDATA%\tp-final-orellana\mantis-automation"
if not exist "%MANTIS_SIM_DATA%" mkdir "%MANTIS_SIM_DATA%"
"%LOCALAPPDATA%\Programs\Python\Launcher\py.exe" -3 "%~dp0mantis_simulacion.py" ejecutar >> "%MANTIS_SIM_DATA%\run.log" 2>&1
