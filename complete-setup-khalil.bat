@echo off
echo ========================================
echo 🚀 COMPLETE SETUP - KHALIL
echo ========================================
echo.

echo Step 1: Setting Git User Configuration...
git config --global user.name "khalil"
git config --global user.email "khanjiii4421@gmail.com"
echo ✅ Git user configured
echo.

echo Step 2: Verifying Git Configuration...
git config --global user.name
git config --global user.email
echo.

echo Step 3: Checking Git Remote...
git remote -v >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Remote already configured
    git remote -v
) else (
    echo 📦 Adding GitHub remote...
    git remote add origin https://github.com/Khanjii4421/akhsoftware2attempt.git
    echo ✅ Remote added: https://github.com/Khanjii4421/akhsoftware2attempt.git
)
echo.

echo Step 4: Adding all files...
git add .
echo ✅ Files added
echo.

echo Step 5: Creating commit...
git commit -m "Ready for Vercel + Netlify deployment"
if %errorlevel% equ 0 (
    echo ✅ Commit created successfully!
) else (
    echo ⚠️  Commit may have failed or already exists
    echo    Checking status...
    git status
)
echo.

echo Step 6: Setting branch to main...
git branch -M main
echo ✅ Branch set to main
echo.

echo Step 7: Pushing to GitHub...
echo ⚠️  This will push your code to: https://github.com/Khanjii4421/akhsoftware2attempt.git
echo.
set /p CONFIRM="Continue with push? (Y/N): "
if /i "%CONFIRM%"=="Y" (
    echo.
    echo Pushing to GitHub...
    git push -u origin main
    if %errorlevel% equ 0 (
        echo.
        echo ========================================
        echo ✅ SUCCESS! Code pushed to GitHub!
        echo ========================================
        echo.
        echo Repository: https://github.com/Khanjii4421/akhsoftware2attempt
        echo.
        echo Next Steps:
        echo 1. Go to Vercel: https://vercel.com
        echo    - Sign up with GitHub
        echo    - Import repository: akhsoftware2attempt
        echo    - Set environment variables
        echo    - Deploy!
        echo.
        echo 2. Go to Netlify: https://netlify.com
        echo    - Sign up with GitHub
        echo    - Import repository: akhsoftware2attempt
        echo    - Build settings: Publish directory = public
        echo    - Set NETLIFY_API_URL = https://your-vercel-url.vercel.app/api
        echo    - Deploy!
        echo.
        echo 3. See detailed guide: VERCEL_NETLIFY_DEPLOYMENT.md
    ) else (
        echo.
        echo ❌ Push failed. Possible reasons:
        echo    - GitHub authentication required
        echo    - Network issue
        echo    - Repository access issue
        echo.
        echo Solutions:
        echo 1. GitHub Personal Access Token use karein (password nahi)
        echo 2. Check network connection
        echo 3. Verify repository access
        echo.
        echo You can push manually later with:
        echo    git push -u origin main
    )
) else (
    echo ⚠️  Push skipped. You can push later with:
    echo    git push -u origin main
)
echo.
pause

