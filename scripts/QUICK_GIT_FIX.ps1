# QUICK GIT FIX - Yeh file copy karein aur PowerShell mein paste karein
# Ya is file ko PowerShell se run karein: .\QUICK_GIT_FIX.ps1

# Git PATH add karein
$env:PATH += ";C:\Program Files\Git\bin"

# Verify
git --version

# Agar upar wala kaam na kare, to yeh try karein:
# $env:PATH += ";C:\Program Files\Git\cmd"
# git --version

Write-Host ""
Write-Host "✅ Ab git commands kaam karenge!" -ForegroundColor Green
Write-Host ""
Write-Host "Ab yeh commands run karein:" -ForegroundColor Yellow
Write-Host "  git add ." -ForegroundColor White
Write-Host "  git commit -m 'Your message'" -ForegroundColor White
Write-Host "  git push origin main" -ForegroundColor White

