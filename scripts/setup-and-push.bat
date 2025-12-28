@echo off
echo ========================================
echo 🚀 Complete Setup and Push
echo ========================================
echo.

echo Step 1: Setting Git User Configuration...
git config --global user.name "khalil"
git config --global user.email "khanjiii4421@gmail.com"
echo ✅ Git user configured:
echo    Name: khalil
echo    Email: khanjiii4421@gmail.com
echo.

echo Step 2: Verifying Git Configuration...
git config --global user.name
git config --global user.email
echo.

echo Step 3: Creating commit...
git commit -m "Ready for Vercel + Netlify deployment"
if %errorlevel% equ 0 (
    echo ✅ Commit created successfully!
) else (
    echo ❌ Commit failed. Checking status...
    git status
    pause
    exit /b 1
)
echo.

echo Step 4: Setting branch to main...
git branch -M main
echo ✅ Branch set to main
echo.

echo Step 5: Checking GitHub Remote...
git remote -v
if %errorlevel% neq 0 (
    echo ⚠️  No remote configured
    echo.
    echo Please add GitHub remote:
    echo    git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
    echo.
    set /p ADD_REMOTE="Do you want to add remote now? (Y/N): "
    if /i "%ADD_REMOTE%"=="Y" (
        set /p REPO_URL="Enter GitHub repository URL: "
        git remote add origin "%REPO_URL%"
        echo ✅ Remote added
    )
) else (
    echo ✅ Remote configured
)
echo.

echo Step 6: Pushing to GitHub...
echo ⚠️  This will push your code to GitHub.
set /p CONFIRM_PUSH="Continue with push? (Y/N): "
if /i "%CONFIRM_PUSH%"=="Y" (
    git push -u origin main
    if %errorlevel% equ 0 (
        echo.
        echo ========================================
        echo ✅ SUCCESS! Code pushed to GitHub!
        echo ========================================
        echo.
        echo Next Steps:
        echo 1. Go to Vercel: https://vercel.com
        echo 2. Go to Netlify: https://netlify.com
        echo 3. See: VERCEL_NETLIFY_DEPLOYMENT.md for details
    ) else (
        echo.
        echo ❌ Push failed. Possible reasons:
        echo    - GitHub credentials not configured
        echo    - Remote URL incorrect
        echo    - Network issue
        echo.
        echo Please check and try again.
    )
) else (
    echo ⚠️  Push skipped. You can push later with:
    echo    git push -u origin main
)
echo.
pause

