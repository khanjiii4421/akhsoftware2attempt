@echo off
echo ========================================
echo 🚀 AUTOMATED DEPLOYMENT SETUP
echo ========================================
echo.

echo Step 0: Setting up Git PATH...
if exist "C:\Program Files\Git\bin\git.exe" (
    set "PATH=%PATH%;C:\Program Files\Git\bin"
    echo ✅ Git added to PATH
) else if exist "C:\Program Files (x86)\Git\bin\git.exe" (
    set "PATH=%PATH%;C:\Program Files (x86)\Git\bin"
    echo ✅ Git added to PATH
)
echo.

echo Step 1: Checking Git Installation...
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Git not installed or not found!
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

echo Step 3: Configuring Git User...
git config user.name >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Git user not configured
    echo Please set Git user:
    echo    git config --global user.name "Your Name"
    echo    git config --global user.email "your@email.com"
    echo.
    echo Or run PowerShell script for interactive setup: .\auto-deploy.ps1
    echo.
) else (
    echo ✅ Git user configured
)
echo.

echo Step 4: Adding files to Git...
git add .
echo ✅ Files added
echo.

echo Step 5: Creating commit...
git commit -m "Ready for Vercel + Netlify deployment"
if %errorlevel% equ 0 (
    echo ✅ Commit created
) else (
    echo ❌ Commit failed!
    echo.
    echo Please configure Git user first:
    echo    git config --global user.name "Your Name"
    echo    git config --global user.email "your@email.com"
    echo.
    echo Then run: git commit -m "Ready for Vercel + Netlify deployment"
)
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

