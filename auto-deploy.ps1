# Automated Deployment Script for Vercel + Netlify
# Yeh script aapko step-by-step guide karega

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚀 AUTOMATED DEPLOYMENT SETUP" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Git Installation
Write-Host "Step 1: Checking Git Installation..." -ForegroundColor Yellow
try {
    $gitVersion = git --version 2>&1
    Write-Host "✅ Git installed: $gitVersion" -ForegroundColor Green
    $gitInstalled = $true
} catch {
    Write-Host "❌ Git not installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Git first:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://git-scm.com/download/win" -ForegroundColor Cyan
    Write-Host "2. Install Git" -ForegroundColor Cyan
    Write-Host "3. Restart PowerShell" -ForegroundColor Cyan
    Write-Host "4. Run this script again" -ForegroundColor Cyan
    $gitInstalled = $false
    exit 1
}

Write-Host ""

# Step 2: Check if already a git repository
Write-Host "Step 2: Checking Git Repository..." -ForegroundColor Yellow
if (Test-Path ".git") {
    Write-Host "✅ Git repository already initialized" -ForegroundColor Green
} else {
    Write-Host "📦 Initializing Git repository..." -ForegroundColor Yellow
    git init
    Write-Host "✅ Git repository initialized" -ForegroundColor Green
}

Write-Host ""

# Step 3: Check for .env file
Write-Host "Step 3: Checking Environment Configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "✅ .env file exists" -ForegroundColor Green
    Write-Host "⚠️  Make sure .env has all required variables:" -ForegroundColor Yellow
    Write-Host "   - SUPABASE_URL" -ForegroundColor Cyan
    Write-Host "   - SUPABASE_ANON_KEY" -ForegroundColor Cyan
    Write-Host "   - SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor Cyan
    Write-Host "   - JWT_SECRET" -ForegroundColor Cyan
} else {
    Write-Host "⚠️  .env file not found" -ForegroundColor Yellow
    Write-Host "   Creating .env.example reference..." -ForegroundColor Cyan
}

Write-Host ""

# Step 4: Generate JWT_SECRET if needed
Write-Host "Step 4: JWT_SECRET Generation..." -ForegroundColor Yellow
$jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
Write-Host "✅ Generated JWT_SECRET: $jwtSecret" -ForegroundColor Green
Write-Host "   (Save this for Vercel environment variables)" -ForegroundColor Cyan
Write-Host ""

# Step 5: Configure Git User (if not set)
Write-Host "Step 5: Configuring Git User..." -ForegroundColor Yellow
$gitUser = git config --global user.name 2>&1
$gitEmail = git config --global user.email 2>&1

if (-not $gitUser -or $gitUser -match "error" -or $gitUser -eq "") {
    Write-Host "⚠️  Git user name not set" -ForegroundColor Yellow
    $userName = Read-Host "Enter your name (for Git commits)"
    if ($userName) {
        git config --global user.name $userName
        Write-Host "✅ Git user name set: $userName" -ForegroundColor Green
    }
} else {
    Write-Host "✅ Git user name: $gitUser" -ForegroundColor Green
}

if (-not $gitEmail -or $gitEmail -match "error" -or $gitEmail -eq "") {
    Write-Host "⚠️  Git email not set" -ForegroundColor Yellow
    $userEmail = Read-Host "Enter your email (for Git commits)"
    if ($userEmail) {
        git config --global user.email $userEmail
        Write-Host "✅ Git email set: $userEmail" -ForegroundColor Green
    }
} else {
    Write-Host "✅ Git email: $gitEmail" -ForegroundColor Green
}

Write-Host ""

# Step 6: Add all files
Write-Host "Step 6: Adding files to Git..." -ForegroundColor Yellow
git add .
Write-Host "✅ Files added" -ForegroundColor Green
Write-Host ""

# Step 7: Check for remote
Write-Host "Step 6: Checking GitHub Remote..." -ForegroundColor Yellow
$remote = git remote -v 2>&1
if ($remote -match "origin") {
    Write-Host "✅ GitHub remote already configured" -ForegroundColor Green
    Write-Host "   Remote: $remote" -ForegroundColor Cyan
} else {
    Write-Host "⚠️  GitHub remote not configured" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please provide GitHub repository URL:" -ForegroundColor Yellow
    Write-Host "Format: https://github.com/USERNAME/REPO_NAME.git" -ForegroundColor Cyan
    $repoUrl = Read-Host "Enter GitHub repository URL (or press Enter to skip)"
    
    if ($repoUrl) {
        git remote add origin $repoUrl
        Write-Host "✅ Remote added: $repoUrl" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Skipping remote setup. You can add it later:" -ForegroundColor Yellow
        Write-Host "   git remote add origin https://github.com/USERNAME/REPO_NAME.git" -ForegroundColor Cyan
    }
}

Write-Host ""

# Step 8: Commit
Write-Host "Step 8: Creating commit..." -ForegroundColor Yellow
$commitMessage = "Ready for Vercel + Netlify deployment"
git commit -m $commitMessage
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Commit created" -ForegroundColor Green
} else {
    Write-Host "❌ Commit failed. Please check Git configuration." -ForegroundColor Red
    Write-Host "   Run: git config --global user.name 'Your Name'" -ForegroundColor Yellow
    Write-Host "   Run: git config --global user.email 'your@email.com'" -ForegroundColor Yellow
}
Write-Host ""

# Step 9: Push to GitHub
Write-Host "Step 9: Pushing to GitHub..." -ForegroundColor Yellow
Write-Host "⚠️  This will push to GitHub. Continue? (Y/N)" -ForegroundColor Yellow
$confirm = Read-Host
if ($confirm -eq "Y" -or $confirm -eq "y") {
    git branch -M main
    git push -u origin main
    Write-Host "✅ Code pushed to GitHub!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Skipping push. You can push later with:" -ForegroundColor Yellow
    Write-Host "   git push -u origin main" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ LOCAL SETUP COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 10: Deployment Instructions
Write-Host "Next Steps for Deployment:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. VERCEL (Backend):" -ForegroundColor Cyan
Write-Host "   - Go to: https://vercel.com" -ForegroundColor White
Write-Host "   - Sign up with GitHub" -ForegroundColor White
Write-Host "   - Import your repository" -ForegroundColor White
Write-Host "   - Set environment variables:" -ForegroundColor White
Write-Host "     * NODE_ENV=production" -ForegroundColor Gray
Write-Host "     * PORT=3000" -ForegroundColor Gray
Write-Host "     * JWT_SECRET=$jwtSecret" -ForegroundColor Gray
Write-Host "     * SUPABASE_URL=[Your Supabase URL]" -ForegroundColor Gray
Write-Host "     * SUPABASE_ANON_KEY=[Your Supabase anon key]" -ForegroundColor Gray
Write-Host "     * SUPABASE_SERVICE_ROLE_KEY=[Your Supabase service_role key]" -ForegroundColor Gray
Write-Host "   - Deploy!" -ForegroundColor White
Write-Host ""

Write-Host "2. NETLIFY (Frontend):" -ForegroundColor Cyan
Write-Host "   - Go to: https://netlify.com" -ForegroundColor White
Write-Host "   - Sign up with GitHub" -ForegroundColor White
Write-Host "   - Import your repository" -ForegroundColor White
Write-Host "   - Build settings:" -ForegroundColor White
Write-Host "     * Publish directory: public" -ForegroundColor Gray
Write-Host "   - Set environment variable:" -ForegroundColor White
Write-Host "     * NETLIFY_API_URL=https://YOUR_VERCEL_URL.vercel.app/api" -ForegroundColor Gray
Write-Host "   - Deploy!" -ForegroundColor White
Write-Host ""

Write-Host "📚 For detailed guide, see: VERCEL_NETLIFY_DEPLOYMENT.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎉 Happy Deploying! 🚀" -ForegroundColor Green

