@echo off
cd /d "D:\antigravity\docstation"
uvicorn server:app --host 0.0.0.0 --port 8000
pause