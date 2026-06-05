@echo off
echo ==========================================
echo Sekolahku - Linux Binary Build Script
echo ==========================================

REM Set Environment Variable for Frontend Build to ensure relative API paths
set NEXT_PUBLIC_API_URL=

REM Temporarily rename .env.local so Next.js doesn't read localhost URL
if exist ".env.local" (
    echo [INFO] Temporarily renaming .env.local to .env.local.tmp
    ren .env.local .env.local.tmp
)

REM Step 1: Frontend Build
echo [1/4] Building Frontend (Next.js) with relative API URL...
call npm run build
set BUILD_ERR=%ERRORLEVEL%

REM Restore .env.local
if exist ".env.local.tmp" (
    echo [INFO] Restoring .env.local
    ren .env.local.tmp .env.local
)

if %BUILD_ERR% NEQ 0 (
    echo [ERROR] Frontend build failed. Fix TSC/Lint errors first.
    exit /b %BUILD_ERR%
)

REM Step 2: Prepare Go Dist folder
echo [2/4] Preparing Go distribution folder...
if exist "go-backend\cmd\api\dist" rd /s /q "go-backend\cmd\api\dist"
mkdir "go-backend\cmd\api\dist"

REM Step 3: Copy static files
echo [3/4] Copying static files to Go backend...
xcopy /e /i /y "out\*" "go-backend\cmd\api\dist\"

REM Step 4: Build Go Linux Binary
echo [4/4] Building Unified Go Linux Binary...
cd go-backend
set GOOS=linux
set GOARCH=amd64
set CGO_ENABLED=0
go build -o ..\sekolahku_linux .\cmd\api
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Go build failed.
    cd ..
    exit /b %ERRORLEVEL%
)

cd ..
echo ==========================================
echo [SUCCESS] Linux Binary created: sekolahku_linux
echo ==========================================
