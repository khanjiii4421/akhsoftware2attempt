# Quick Fix Script - Git PATH Setup for PowerShell
# Yeh script Git ko PATH mein add karega

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🔧 GIT PATH FIX - PowerShell" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Find Git installation
Write-Host "Searching for Git installation..." -ForegroundColor Yellow
$gitPaths = @(
    "C:\Program Files\Git\bin",
    "C:\Program Files (x86)\Git\bin",
    "C:\Program Files\Git\cmd",
    "C:\Program Files (x86)\Git\cmd"
)

$gitFound = $false
$gitDirectory = $null

foreach ($path in $gitPaths) {
    $gitExe = Join-Path $path "git.exe"
    if (Test-Path $gitExe) {
        $gitDirectory = $path
        Write-Host "✅ Git found at: $gitExe" -ForegroundColor Green
        $gitFound = $true
        break
    }
}

if (-not $gitFound) {
    Write-Host "❌ Git not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Git first:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://git-scm.com/download/win" -ForegroundColor Cyan
    Write-Host "2. Install Git (select 'Add to PATH' option)" -ForegroundColor Cyan
    Write-Host "3. Restart PowerShell" -ForegroundColor Cyan
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Add to PATH for current session
Write-Host ""
Write-Host "Adding Git to PATH (current session)..." -ForegroundColor Yellow
if ($env:PATH -notlike "*$gitDirectory*") {
    $env:PATH = "$gitDirectory;$env:PATH"
    Write-Host "✅ Git added to PATH for this session" -ForegroundColor Green
} else {
    Write-Host "✅ Git already in PATH" -ForegroundColor Green
}

# Verify
Write-Host ""
Write-Host "Verifying Git..." -ForegroundColor Yellow
try {
    $gitVersion = git --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Git working: $gitVersion" -ForegroundColor Green
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "✅ SUCCESS! Git is now available!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Note: Yeh fix sirf current PowerShell session ke liye hai." -ForegroundColor Yellow
        Write-Host "Permanent fix ke liye: FIX_GIT_PATH_POWERSHELL.md dekhein" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Ab aap git commands use kar sakte hain:" -ForegroundColor Green
        Write-Host "  git init" -ForegroundColor White
        Write-Host "  git add ." -ForegroundColor White
        Write-Host "  git commit -m 'message'" -ForegroundColor White
        Write-Host "  git push" -ForegroundColor White
        Write-Host ""
    } else {
        throw "Git command failed"
    }
} catch {
    Write-Host "❌ Git still not working!" -ForegroundColor Red
    Write-Host "Please try permanent fix method" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Press Enter to continue"

