@echo off
echo ==========================================
echo Sekolahku - Unified Binary Build Script
echo ==========================================

REM Step 1: Frontend Build
echo [1/4] Building Frontend (Next.js)...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend build failed. Fix TSC/Lint errors first.
    exit /b %ERRORLEVEL%
)

REM Step 2: Prepare Go Dist folder
echo [2/4] Preparing Go distribution folder...
if exist "go-backend\cmd\api\dist" rd /s /q "go-backend\cmd\api\dist"
mkdir "go-backend\cmd\api\dist"

REM Step 3: Copy static files
echo [3/4] Copying static files to Go backend...
xcopy /e /i /y "out\*" "go-backend\cmd\api\dist\"

REM Step 4: Build Go Binary
echo [4/4] Building Unified Binary...
cd go-backend
go build -o ..\sekolahku.exe .\cmd\api
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Go build failed.
    cd ..
    exit /b %ERRORLEVEL%
)

cd ..
echo ==========================================
echo [SUCCESS] Binary created: sekolahku.exe
echo ==========================================
