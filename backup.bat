@echo off
cd /d "%~dp0"
echo Starting Auto Backup: %date% %time%
call npx tsx scripts/backup-db.ts
echo Backup finished.
