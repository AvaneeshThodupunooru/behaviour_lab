@echo off
rem Start the Behavior Lab server on localhost. Double-click, or run from
rem anywhere: tools\run_server.bat
rem
rem Binds 127.0.0.1 deliberately. The session API has no authentication, so
rem --host 0.0.0.0 would let anyone on the same Wi-Fi read and write every
rem participant's session. Camera APIs work fine on http://localhost.
cd /d "%~dp0.."
.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
