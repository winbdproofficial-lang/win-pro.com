# WINBD-PRO PRODUCTION DEPLOYMENT CHECKLIST
# Complete guide to deploy live site with all providers

## 🔴 CRITICAL: ADD THESE TO RENDER IMMEDIATELY

Go to: Render Dashboard → Your Web Service → Settings → Environment

Add ALL these environment variables:

### DATABASE
DATABASE_URL=your_supabase_connection_string_here
DB_POOL_MAX=20

### AUTHENTICATION  
JWT_SECRET=generate_random_32_char_string_here
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_DAYS=30

### SECURITY
CORS_ORIGIN=https://your-production-domain.com
TRUST_PROXY=true
NODE_ENV=production
PORT=8080

### PRAGMATIC PLAY
WINBD_PRAGMATIC_AGENT_ID=stagingWinBDBDT
WINBD_PRAGMATIC_API_TOKEN=your_token_here
WINBD_PRAGMATIC_SECRET_KEY=your_secret_here
WINBD_PRAGMATIC_ENDPOINT=ptapi.loginxgamesapi.com

### PGSOFT
WINBD_PGSOFT_AGENT_ID=stagingWinBDBDT
WINBD_PGSOFT_API_TOKEN=your_token_here
WINBD_PGSOFT_SECRET_KEY=your_secret_here
WINBD_PGSOFT_ENDPOINT=ggapi.loginxgamesapi.com

### AMATIC
WINBD_AMATIC_AGENT_ID=stagingWinBDBDT
WINBD_AMATIC_API_TOKEN=your_token_here
WINBD_AMATIC_SECRET_KEY=your_secret_here
WINBD_AMATIC_ENDPOINT=amapi.loginxgamesapi.com

### AMUSNET
WINBD_AMUSNET_AGENT_ID=stagingWinBDBDT
WINBD_AMUSNET_API_TOKEN=your_token_here
WINBD_AMUSNET_SECRET_KEY=your_secret_here
WINBD_AMUSNET_ENDPOINT=apiang.gitamus.net

### PROVIDER CALLBACKS
PROVIDER_CALLBACK_URL=https://win-proo-server.onrender.com/api/bt/v1/provider/callback

### PAYMENT (OPTIONAL)
SSLCOMMERZ_MODE=live
SSLCOMMERZ_STORE_ID=your_store_id_here
SSLCOMMERZ_STORE_PASSWORD=your_password_here

### TELEGRAM (OPTIONAL)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHANNEL=your_channel_id_here

## ✅ WHAT HAS BEEN FIXED

### Backend (backend/src/)
- ✅ providerAdapter.js - Provider config optional (graceful degradation)
- ✅ server.js - All routes configured
- ✅ auth.js - JWT authentication working
- ✅ db.js - Supabase connection with region handling

### Frontend
- ✅ app.js - Complete auth flow
- ✅ auth-gate.js - Protected pages & login guards
- ✅ provider-lobby.js - Game catalog loading
- ✅ style.css - Responsive design

### Admin Panel
- ✅ /admin - Full admin dashboard
- ✅ User management
- ✅ Payment management
- ✅ Audit logs

### Database (backend/sql/)
- ✅ users table with auth
- ✅ refresh_tokens table
- ✅ wallets table
- ✅ wallet_ledger table
- ✅ payment_intents table
- ✅ audit_logs table

## 🚀 FINAL DEPLOYMENT STEPS

### Step 1: Update Render Environment Variables
1. Go to Render Dashboard
2. Select your service (win-proo-server)
3. Click Settings → Environment
4. Add ALL variables from above (use actual credentials)
5. Click Save

### Step 2: Render Auto-Restart
- Service automatically restarts after saving
- Watch logs to confirm startup success

### Step 3: Run Database Migrations
In Render Shell or via start command:
```bash
npm install
npm run migrate
```

### Step 4: Test Health Endpoints
```bash
# Test backend health
curl https://win-proo-server.onrender.com/health

# Should return:
# {"success":true,"brand":"WINBD-PRO","time":"..."}
```

### Step 5: Test Login
1. Go to https://win-proo-server.onrender.com
2. Register new account
3. Login with credentials
4. Should see game catalog

### Step 6: Test Providers
1. Frontend should load games from all configured providers
2. Admin dashboard should show provider status
3. Game launch should work

## ⚠️ COMMON ISSUES & FIXES

### Issue: "Internal server error" on login
- Check DATABASE_URL is set in Render
- Check JWT_SECRET is >= 32 characters
- Check database migrations ran: `npm run migrate`

### Issue: No games showing
- Check provider credentials in Render Environment
- Check PROVIDER_CALLBACK_URL is correct
- Check provider API endpoints are reachable

### Issue: Admin panel not loading
- Login first as regular user
- Check admin user exists in database
- Check JWT_SECRET is same for admin & user

## 📋 PRODUCTION CHECKLIST

- ✅ Backend code cleaned
- ✅ Demo data removed
- ✅ Provider config optional
- ✅ Environment variables documented
- ✅ Database migrations ready
- ✅ Frontend optimized
- ✅ Admin panel secured
- ✅ Error handling improved
- ⏳ Render environment configured (YOUR TASK)
- ⏳ New provider credentials from Pragmatic, PGSoft, Amatic, Amusnet (YOUR TASK)

## 🎯 NEXT: 2 THINGS YOU MUST DO

1. **Add Render Environment Variables** - Copy all variables above into Render dashboard
2. **Update Provider Credentials** - Replace staging tokens with production tokens from providers

Once done, site will be LIVE! ✅
