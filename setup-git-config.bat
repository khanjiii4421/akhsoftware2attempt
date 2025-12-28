@echo off
echo ========================================
echo Git Configuration Setup
echo ========================================
echo.

echo Please enter your Git configuration:
echo.

set /p GIT_NAME="Enter your name: "
set /p GIT_EMAIL="Enter your email: "

if "%GIT_NAME%"=="" (
    echo ❌ Name cannot be empty!
    pause
    exit /b 1
)

if "%GIT_EMAIL%"=="" (
    echo ❌ Email cannot be empty!
    pause
    exit /b 1
)

echo.
echo Setting Git configuration...
git config --global user.name "%GIT_NAME%"
git config --global user.email "%GIT_EMAIL%"

echo.
echo ✅ Git configuration set successfully!
echo    Name: %GIT_NAME%
echo    Email: %GIT_EMAIL%
echo.
echo Now you can run: auto-deploy.bat
echo.
pause

