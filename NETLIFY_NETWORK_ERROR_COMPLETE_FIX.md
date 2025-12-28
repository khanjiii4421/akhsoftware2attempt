# 🔧 Netlify Network Error - Complete Solution (Urdu/Hindi)

Netlify par "Network error. Please try again." ka message aane ke **sabse common reasons** aur unke **complete solutions**:

---

## 🎯 **Main Issue: API URL Configure Nahi Hai**

Jab aap Netlify par deploy karte hain, to frontend ko nahi pata ke backend kahan hai. Isliye "Network error" aata hai.

---

## ✅ **Solution 1: Environment Variable Set Karen (MOST IMPORTANT)**

### Step 1: Netlify Dashboard Mein Jao

1. [netlify.com](https://netlify.com) par login karein
2. Apni site select karein
3. **"Site settings"** (left sidebar) click karein
4. **"Environment variables"** section mein jao

### Step 2: Environment Variable Add Karen

**"Add variable"** button click karein aur ye add karein:

**Key:**
```
NETLIFY_API_URL
```

**Value:**
```
https://YOUR-VERCEL-URL.vercel.app/api
```

**Example:**
Agar aapka Vercel URL `https://order-management-system.vercel.app` hai, to:
```
NETLIFY_API_URL = https://order-management-system.vercel.app/api
```

⚠️ **Important:**
- `/api` end mein zaroor add karein
- `https://` zaroor hona chahiye
- Space nahi hona chahiye `=` ke around

### Step 3: Redeploy Karen

1. **"Deploys"** tab mein jao
2. **"Trigger deploy"** → **"Deploy site"** click karein
3. Wait karein (1-2 minutes)

---

## ✅ **Solution 2: Vercel Backend URL Verify Karen**

### Step 1: Vercel Backend Test Karen

Browser mein ye URL open karein:
```
https://YOUR-VERCEL-URL.vercel.app/api/sellers
```

Agar ye URL kaam karta hai (data return karta hai), to backend sahi hai.

Agar error aaye, to:
1. Vercel dashboard mein jao
2. Environment variables check karein
3. Backend redeploy karein

### Step 2: CORS Check Karen

Agar backend kaam kar raha hai lekin Netlify se requests fail ho rahe hain, to CORS issue ho sakta hai.

**server.js** mein ye check karein:
```javascript
app.use(cors()); // Ye line honi chahiye
```

Agar nahi hai, to add karein:
```javascript
const cors = require('cors');
app.use(cors());
```

---

## ✅ **Solution 3: Build Script Verify Karen**

### Step 1: netlify.toml Check Karen

`netlify.toml` file mein ye hona chahiye:
```toml
[build]
  publish = "public"
  command = "node netlify-build-script.js"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "18"
```

### Step 2: Build Script Check Karen

`netlify-build-script.js` file sahi hai ya nahi verify karein. Ye file `public/config.js` mein `{{NETLIFY_API_URL}}` ko replace karti hai.

### Step 3: Build Logs Check Karen

1. Netlify dashboard → **"Deploys"** tab
2. Latest deploy click karein
3. **"Build logs"** section mein check karein

Agar ye message dikhe:
```
✅ API URL injected: https://your-backend.vercel.app/api
```
To script sahi kaam kar rahi hai.

Agar ye dikhe:
```
⚠️ NETLIFY_API_URL not set, using fallback
```
To environment variable set nahi hai (Solution 1 follow karein).

---

## ✅ **Solution 4: Browser Console Check Karen**

### Step 1: Browser Console Open Karen

1. Netlify site open karein
2. **F12** press karein (Developer Tools)
3. **"Console"** tab select karein

### Step 2: Error Messages Check Karen

Console mein ye messages dekhne chahiye:

**Agar API URL sahi set hai:**
```
Using Netlify environment API URL: https://your-backend.vercel.app/api
```

**Agar API URL set nahi hai:**
```
⚠️ API_BASE_URL not configured!
Please set NETLIFY_API_URL in Netlify environment variables
```

**Agar CORS error hai:**
```
Access to fetch at 'https://...' from origin 'https://...' has been blocked by CORS policy
```

### Step 3: Network Tab Check Karen

1. **"Network"** tab select karein
2. Page refresh karein
3. API requests check karein

**Agar request fail ho rahi hai:**
- Request URL check karein (sahi hai ya nahi)
- Status code check karein (404, 500, CORS error, etc.)

---

## ✅ **Solution 5: Complete Setup Verification**

### Checklist:

- [ ] **Vercel Backend Deployed:**
  - [ ] Vercel URL working hai
  - [ ] Environment variables set hain
  - [ ] API endpoints accessible hain

- [ ] **Netlify Frontend Deployed:**
  - [ ] Site accessible hai
  - [ ] `NETLIFY_API_URL` environment variable set hai
  - [ ] Build successful hai

- [ ] **Configuration Files:**
  - [ ] `netlify.toml` sahi hai
  - [ ] `netlify-build-script.js` exists hai
  - [ ] `public/config.js` exists hai

- [ ] **Testing:**
  - [ ] Browser console mein API URL sahi dikh raha hai
  - [ ] Network requests successful hain
  - [ ] Login kaam kar raha hai

---

## 🚀 **Quick Fix Steps (Step-by-Step)**

### Step 1: Vercel Backend URL Copy Karen

1. Vercel dashboard mein jao
2. Project select karein
3. URL copy karein (example: `https://order-management-system.vercel.app`)
4. End mein `/api` add karein: `https://order-management-system.vercel.app/api`

### Step 2: Netlify Environment Variable Set Karen

1. Netlify dashboard → Site settings → Environment variables
2. **"Add variable"** click karein
3. Key: `NETLIFY_API_URL`
4. Value: Vercel URL (jo Step 1 mein copy kiya)
5. Save karein

### Step 3: Redeploy Karen

1. Netlify dashboard → Deploys
2. **"Trigger deploy"** → **"Deploy site"**
3. Wait karein

### Step 4: Test Karen

1. Netlify site open karein
2. F12 press karein (Console)
3. Check karein ke API URL sahi dikh raha hai
4. Login try karein

---

## 🐛 **Common Errors aur Solutions**

### Error 1: "Network error. Please try again."

**Cause:** API URL set nahi hai

**Solution:**
- `NETLIFY_API_URL` environment variable set karein (Solution 1)

### Error 2: CORS Error

**Cause:** Backend CORS allow nahi kar raha

**Solution:**
- `server.js` mein `app.use(cors())` add karein

### Error 3: 404 Not Found

**Cause:** Vercel URL galat hai

**Solution:**
- Vercel URL verify karein
- `/api` end mein zaroor add karein

### Error 4: 500 Internal Server Error

**Cause:** Backend mein issue hai

**Solution:**
- Vercel logs check karein
- Backend environment variables verify karein

### Error 5: Build Fails

**Cause:** Build script issue

**Solution:**
- `netlify.toml` verify karein
- Build logs check karein
- Node version check karein (18 hona chahiye)

---

## 📝 **Important Notes**

1. **Environment Variable Name:** `NETLIFY_API_URL` exactly yehi hona chahiye (case-sensitive)

2. **API URL Format:** 
   - ✅ Correct: `https://your-backend.vercel.app/api`
   - ❌ Wrong: `https://your-backend.vercel.app` (missing `/api`)
   - ❌ Wrong: `http://your-backend.vercel.app/api` (http instead of https)

3. **Redeploy Required:** Environment variable set karne ke baad **zaroor redeploy** karein

4. **Build Script:** `netlify-build-script.js` automatically `{{NETLIFY_API_URL}}` ko replace karta hai

5. **Browser Cache:** Agar issue solve ho gaya hai lekin browser mein abhi bhi error dikh raha hai, to:
   - Hard refresh karein (Ctrl+Shift+R)
   - Browser cache clear karein

---

## 🎯 **Most Likely Issue**

**90% cases mein issue yeh hota hai:**

❌ **`NETLIFY_API_URL` environment variable set nahi hai**

✅ **Solution:** Netlify dashboard → Site settings → Environment variables → Add `NETLIFY_API_URL` → Redeploy

---

## 📞 **Still Having Issues?**

1. **Build logs check karein:** Netlify dashboard → Deploys → Build logs
2. **Browser console check karein:** F12 → Console tab
3. **Network tab check karein:** F12 → Network tab
4. **Vercel backend test karein:** Direct URL open karein browser mein

---

**🎉 Agar sab steps follow kiye, to issue solve ho jana chahiye!**

