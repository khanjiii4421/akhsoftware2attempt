# PowerShell Script - GitHub Push with Authentication
# Yeh script aapko GitHub par code push karne mein help karega

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚀 GITHUB PUSH - EASY METHOD" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Git PATH setup
$env:PATH += ";C:\Program Files\Git\bin"

Write-Host "Step 1: Clearing old GitHub credentials..." -ForegroundColor Yellow
cmdkey /delete:LegacyGeneric:target=git:https://github.com 2>$null
Write-Host "✅ Old credentials cleared" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2: Checking repository status..." -ForegroundColor Yellow
cd "C:\Users\ThinkPad\Desktop\Adnan software kamalia"
git status
Write-Host ""

Write-Host "Step 3: Ready to push to GitHub!" -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  IMPORTANT - Authentication Required:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Jab push karein to ye details chahiye:" -ForegroundColor Cyan
Write-Host "  Username: khanjiii4421" -ForegroundColor White
Write-Host "  Password: GitHub Personal Access Token (password nahi!)" -ForegroundColor White
Write-Host ""
Write-Host "Agar token nahi hai, to:" -ForegroundColor Yellow
Write-Host "  1. https://github.com/settings/tokens par jayen" -ForegroundColor Cyan
Write-Host "  2. 'Generate new token (classic)' click karein" -ForegroundColor Cyan
Write-Host "  3. 'repo' scope select karein" -ForegroundColor Cyan
Write-Host "  4. Token generate karein aur copy karein" -ForegroundColor Cyan
Write-Host ""

$confirm = Read-Host "Push karna hai? (Y/N)"
if ($confirm -eq "Y" -or $confirm -eq "y") {
    Write-Host ""
    Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
    Write-Host "Note: Jab username/password mange, to:" -ForegroundColor Cyan
    Write-Host "  - Username: khanjiii4421" -ForegroundColor White
    Write-Host "  - Password: Apna Personal Access Token (password nahi)" -ForegroundColor White
    Write-Host ""
    
    git push -u origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "✅ SUCCESS! Code pushed to GitHub!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Repository: https://github.com/khanjiii4421/akhsoftware2attempt" -ForegroundColor Cyan
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "❌ Push failed!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Possible reasons:" -ForegroundColor Yellow
        Write-Host "  1. Wrong username/password" -ForegroundColor White
        Write-Host "  2. Personal Access Token nahi use kiya (password use kiya)" -ForegroundColor White
        Write-Host "  3. Token expired ya permissions nahi hain" -ForegroundColor White
        Write-Host ""
        Write-Host "Solution: Personal Access Token generate karein aur dobara try karein" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "⚠️  Push skipped. Aap baad mein push kar sakte hain:" -ForegroundColor Yellow
    Write-Host "   git push -u origin main" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

