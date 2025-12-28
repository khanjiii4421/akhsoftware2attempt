# 🔧 Git PATH Issue Fix - PowerShell

Agar PowerShell mein "git is not recognized" error aaye, to yeh solutions try karein:

---

## 🎯 Quick Fix: Script Use Karen

### Method 1: Batch File Use Karen (Recommended) ✅
```powershell
.\auto-deploy.bat
```
Yeh file automatically Git PATH setup karti hai!

---

## 🛠️ Manual Fix Methods

### Method 1: PowerShell Mein Temporary PATH Add Karen

PowerShell window mein yeh command run karein:

```powershell
# Git ko PATH mein add karein (temporary - sirf is session ke liye)
$env:PATH += ";C:\Program Files\Git\bin"

# Verify karein
git --version
```

Agar yeh kaam na kare, to yeh try karein:
```powershell
$env:PATH += ";C:\Program Files\Git\cmd"
git --version
```

---

### Method 2: Git Ki Full Path Use Karen

Directly Git ki full path use karein:
```powershell
& "C:\Program Files\Git\bin\git.exe" --version
& "C:\Program Files\Git\bin\git.exe" init
& "C:\Program Files\Git\bin\git.exe" add .
```

Ya PowerShell alias create karein (session ke liye):
```powershell
Set-Alias git "C:\Program Files\Git\bin\git.exe"
git --version
```

---

### Method 3: Permanent PATH Fix (System Level)

1. **Windows Settings:**
   - Windows Key + X → **"System"**
   - **"Advanced system settings"** → **"Environment Variables"**
   - **"Path"** variable select karein → **"Edit"**
   - **"New"** click karein
   - Add karein: `C:\Program Files\Git\bin`
   - **"OK"** click karein
   - PowerShell restart karein

2. **PowerShell Se (Admin required):**
```powershell
# Admin PowerShell mein run karein
[Environment]::SetEnvironmentVariable(
    "Path",
    [Environment]::GetEnvironmentVariable("Path", "Machine") + ";C:\Program Files\Git\bin",
    "Machine"
)
```

---

### Method 4: Git Reinstall Karen (PATH Ke Saath)

1. Git uninstall karein (Control Panel se)
2. Download karein: https://git-scm.com/download/win
3. Install karte waqt **"Git from the command line and also from 3rd-party software"** select karein
4. Ya **"Use Git and optional Unix tools from the Command Prompt"** select karein
5. Install complete karein
6. PowerShell restart karein

---

## ✅ Verify Fix

Fix ke baad verify karein:
```powershell
git --version
```

Agar version dikhaye, to fix successful hai! ✅

---

## 🚀 Recommended Solution

**Best approach:** `auto-deploy.bat` file use karein jo automatically PATH handle karti hai:

```powershell
# PowerShell se batch file run karein
.\auto-deploy.bat
```

Ya PowerShell script update kar di hai jo ab automatically PATH detect karti hai:
```powershell
.\auto-deploy.ps1
```

---

## 📝 Notes

- **Temporary PATH:** Session close hone ke baad reset ho jata hai
- **Permanent PATH:** System restart ke baad bhi kaam karta hai
- **Batch files:** Automatically PATH setup karti hain
- **PowerShell scripts:** Ab updated hai PATH detection ke saath

---

**🎯 Quick Fix:** `auto-deploy.bat` double-click karein ya PowerShell se run karein!

