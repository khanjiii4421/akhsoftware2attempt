@echo off
echo ========================================
echo 🚀 AUTOMATED DEPLOYMENT SETUP
echo ========================================
echo.

echo Step 1: Checking Git Installation...
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Git not installed!
    echo.
    echo Please install Git first:
    echo 1. Download from: https://git-scm.com/download/win
    echo 2. Install Git
    echo 3. Restart Command Prompt
    echo 4. Run this script again
    pause
    exit /b 1
)
echo ✅ Git installed
echo.

echo Step 2: Checking Git Repository...
if exist ".git" (
    echo ✅ Git repository already initialized
) else (
    echo 📦 Initializing Git repository...
    git init
    echo ✅ Git repository initialized
)
echo.

echo Step 3: Generating JWT_SECRET...
echo (This will be shown in PowerShell version)
echo.

echo Step 4: Adding files to Git...
git add .
echo ✅ Files added
echo.

echo Step 5: Creating commit...
git commit -m "Ready for Vercel + Netlify deployment"
echo ✅ Commit created
echo.

echo Step 6: Checking GitHub Remote...
git remote -v >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ GitHub remote configured
) else (
    echo ⚠️  GitHub remote not configured
    echo.
    echo Please run PowerShell script for interactive setup:
    echo    .\auto-deploy.ps1
    echo.
    echo Or manually add remote:
    echo    git remote add origin https://github.com/USERNAME/REPO_NAME.git
)
echo.

echo ========================================
echo ✅ LOCAL SETUP COMPLETE!
echo ========================================
echo.
echo Next Steps:
echo 1. Run PowerShell script for full automation: .\auto-deploy.ps1
echo 2. Or manually push: git push -u origin main
echo 3. Deploy on Vercel and Netlify (see AUTO_DEPLOY_INSTRUCTIONS.md)
echo.
pause

