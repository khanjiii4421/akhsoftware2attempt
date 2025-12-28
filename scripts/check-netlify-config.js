// Netlify Configuration Checker
// Yeh script check karta hai ke sab kuch sahi configure hai ya nahi

const fs = require('fs');
const path = require('path');

console.log('🔍 Netlify Configuration Checker\n');

// Check 1: netlify.toml exists
console.log('1. Checking netlify.toml...');
if (fs.existsSync('netlify.toml')) {
    const tomlContent = fs.readFileSync('netlify.toml', 'utf8');
    console.log('   ✅ netlify.toml exists');
    
    if (tomlContent.includes('publish = "public"')) {
        console.log('   ✅ Publish directory set to "public"');
    } else {
        console.log('   ⚠️  Publish directory not set to "public"');
    }
    
    if (tomlContent.includes('netlify-build-script.js')) {
        console.log('   ✅ Build script configured');
    } else {
        console.log('   ⚠️  Build script not found in netlify.toml');
    }
} else {
    console.log('   ❌ netlify.toml not found!');
}

// Check 2: netlify-build-script.js exists
console.log('\n2. Checking netlify-build-script.js...');
if (fs.existsSync('netlify-build-script.js')) {
    console.log('   ✅ netlify-build-script.js exists');
} else {
    console.log('   ❌ netlify-build-script.js not found!');
}

// Check 3: public/config.js exists
console.log('\n3. Checking public/config.js...');
if (fs.existsSync('public/config.js')) {
    const configContent = fs.readFileSync('public/config.js', 'utf8');
    console.log('   ✅ public/config.js exists');
    
    if (configContent.includes('{{NETLIFY_API_URL}}')) {
        console.log('   ✅ Placeholder {{NETLIFY_API_URL}} found (will be replaced during build)');
    } else {
        console.log('   ⚠️  Placeholder {{NETLIFY_API_URL}} not found');
    }
} else {
    console.log('   ❌ public/config.js not found!');
}

// Check 4: Environment variable (if running in Netlify)
console.log('\n4. Checking NETLIFY_API_URL environment variable...');
const apiUrl = process.env.NETLIFY_API_URL;
if (apiUrl) {
    console.log('   ✅ NETLIFY_API_URL is set');
    console.log(`   Value: ${apiUrl}`);
    
    if (apiUrl.startsWith('https://')) {
        console.log('   ✅ URL uses HTTPS');
    } else {
        console.log('   ⚠️  URL should use HTTPS');
    }
    
    if (apiUrl.endsWith('/api')) {
        console.log('   ✅ URL ends with /api');
    } else {
        console.log('   ⚠️  URL should end with /api');
    }
} else {
    console.log('   ⚠️  NETLIFY_API_URL not set');
    console.log('   📝 Set this in Netlify dashboard: Site settings → Environment variables');
}

// Check 5: public folder exists
console.log('\n5. Checking public folder...');
if (fs.existsSync('public')) {
    console.log('   ✅ public folder exists');
    
    const publicFiles = fs.readdirSync('public');
    const requiredFiles = ['index.html', 'config.js', 'auth.js'];
    const missingFiles = requiredFiles.filter(file => !publicFiles.includes(file));
    
    if (missingFiles.length === 0) {
        console.log('   ✅ All required files present');
    } else {
        console.log(`   ⚠️  Missing files: ${missingFiles.join(', ')}`);
    }
} else {
    console.log('   ❌ public folder not found!');
}

// Summary
console.log('\n📋 Summary:');
console.log('---');
console.log('Agar sab ✅ dikh rahe hain, to configuration sahi hai.');
console.log('Agar ⚠️ ya ❌ dikh rahe hain, to unhe fix karein.');
console.log('\n💡 Most common issue: NETLIFY_API_URL environment variable set nahi hai');
console.log('   Solution: Netlify dashboard → Site settings → Environment variables → Add NETLIFY_API_URL');

