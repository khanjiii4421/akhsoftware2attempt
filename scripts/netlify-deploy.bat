@echo off
echo ========================================
echo 🚀 NETLIFY DEPLOYMENT (CLI Method)
echo ========================================
echo.
echo Yeh script Netlify CLI se deploy karega (Network error ka solution)
echo.

echo Step 1: Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not installed!
    echo.
    echo Please install Node.js first:
    echo Download from: https://nodejs.org
    pause
    exit /b 1
)
echo ✅ Node.js installed
echo.

echo Step 2: Checking Netlify CLI...
netlify --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Netlify CLI not installed
    echo 📦 Installing Netlify CLI...
    echo.
    npm install -g netlify-cli
    if %errorlevel% neq 0 (
        echo ❌ Failed to install Netlify CLI
        echo.
        echo Please install manually:
        echo    npm install -g netlify-cli
        pause
        exit /b 1
    )
    echo ✅ Netlify CLI installed
) else (
    echo ✅ Netlify CLI already installed
)
echo.

echo Step 3: Checking if logged in to Netlify...
netlify status >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Not logged in to Netlify
    echo.
    echo 🔐 Logging in to Netlify...
    echo (Browser open hoga, wahan login karein)
    echo.
    netlify login
    if %errorlevel% neq 0 (
        echo ❌ Login failed
        pause
        exit /b 1
    )
    echo ✅ Logged in successfully
) else (
    echo ✅ Already logged in to Netlify
)
echo.

echo Step 4: Current Directory...
cd /d "%~dp0"
echo ✅ Current directory: %CD%
echo.

echo Step 5: Deploying to Netlify...
echo.
echo ⚠️  IMPORTANT: Pehle apna Vercel backend URL ready rakhein
echo    (Ye NETLIFY_API_URL environment variable mein set karna hoga)
echo.
echo Deployment options:
echo    1. Production deploy (--prod)
echo    2. Draft deploy (testing ke liye)
echo.
set /p DEPLOY_TYPE="Select option (1 for production, 2 for draft): "

if "%DEPLOY_TYPE%"=="1" (
    echo.
    echo 🚀 Deploying to PRODUCTION...
    echo.
    netlify deploy --dir=public --prod
) else if "%DEPLOY_TYPE%"=="2" (
    echo.
    echo 🧪 Deploying DRAFT (testing)...
    echo.
    netlify deploy --dir=public
) else (
    echo.
    echo ⚠️  Invalid option, using draft deploy...
    netlify deploy --dir=public
)

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo ✅ SUCCESS! Deployed to Netlify!
    echo ========================================
    echo.
    echo Next Steps:
    echo 1. Netlify dashboard mein jayen
    echo 2. Environment variable set karein:
    echo    NETLIFY_API_URL = https://your-vercel-url.vercel.app/api
    echo 3. Site settings → Environment variables → Add variable
    echo 4. Redeploy karein (ya GitHub se auto-deploy hoga)
    echo.
) else (
    echo.
    echo ❌ Deployment failed!
    echo.
    echo Possible solutions:
    echo 1. Network connection check karein
    echo 2. Netlify service status check karein: https://status.netlify.com
    echo 3. Error logs dekhein (upar wali lines)
    echo 4. See: NETLIFY_NETWORK_ERROR_FIX.md
    echo.
)

echo.
pause

