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
git remote get-url origin >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ GitHub remote configured
    git remote get-url origin
) else (
    echo ⚠️  GitHub remote not configured
    echo 📦 Adding GitHub remote: https://github.com/khanjiii4421/akhsoftware2attempt.git
    git remote add origin https://github.com/khanjiii4421/akhsoftware2attempt.git
    if %errorlevel% equ 0 (
        echo ✅ GitHub remote added successfully
    ) else (
        echo ❌ Failed to add remote
        echo.
        echo Please check and try again manually:
        echo    git remote add origin https://github.com/khanjiii4421/akhsoftware2attempt.git
    )
)
echo.

echo Step 7: Setting branch to main...
git branch -M main >nul 2>&1
echo ✅ Branch set to main
echo.

echo Step 8: Pushing to GitHub...
echo ⚠️  This will push your code to: https://github.com/khanjiii4421/akhsoftware2attempt.git
echo.
echo Note: Agar username/password mange, to:
echo    Username: khanjiii4421
echo    Password: GitHub Personal Access Token (password nahi!)
echo.
set /p CONFIRM_PUSH="Continue with push? (Y/N): "
if /i "%CONFIRM_PUSH%"=="Y" (
    echo.
    echo Pushing to GitHub...
    git push -u origin main
    if %errorlevel% equ 0 (
        echo.
        echo ========================================
        echo ✅ SUCCESS! Code pushed to GitHub!
        echo ========================================
        echo.
        echo Repository: https://github.com/khanjiii4421/akhsoftware2attempt
        echo.
        echo Next Steps:
        echo 1. Deploy on Vercel (see VERCEL_NETLIFY_DEPLOYMENT.md)
        echo 2. Deploy on Netlify (see VERCEL_NETLIFY_DEPLOYMENT.md)
    ) else (
        echo.
        echo ❌ Push failed! Possible reasons:
        echo    - GitHub authentication required
        echo    - Wrong username/password
        echo    - Personal Access Token nahi use kiya
        echo    - Network issue
        echo.
        echo Solutions:
        echo 1. GitHub Personal Access Token generate karein:
        echo    - Go to: https://github.com/settings/tokens
        echo    - Generate new token (classic)
        echo    - Select 'repo' scope
        echo    - Use token as password
        echo.
        echo 2. Baad mein push karne ke liye:
        echo    git push -u origin main
    )
) else (
    echo ⚠️  Push skipped. Aap baad mein push kar sakte hain:
    echo    git push -u origin main
)
echo.

echo ========================================
echo ✅ SETUP COMPLETE!
echo ========================================
echo.
pause

