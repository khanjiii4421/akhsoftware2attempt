# Error Fix Guide (Masle Ka Hal)

## Main Problem (Asli Masla)

**Error:** `ConnectTimeoutError: Connect Timeout Error`
**Reason:** Aapke `.env` file mein Supabase credentials placeholder values hain, actual values nahi hain.

## Solutions (Hal)

### 1. Supabase Credentials Configure Karen

**Step 1:** Supabase Dashboard mein jayen:
- https://supabase.com/dashboard
- Apna project select karen

**Step 2:** API Keys copy karen:
- Project Settings → API section mein jayen
- Copy karen:
  - `Project URL` → `SUPABASE_URL`
  - `anon public` key → `SUPABASE_ANON_KEY`
  - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Secret rakhen!)

**Step 3:** `.env` file update karen:
```
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT_SECRET=your-strong-random-secret-key-here
PORT=3000
```

### 2. Database Tables Create Karen

Supabase SQL Editor mein ye tables create karen:

```sql
-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'seller',
  is_blocked INTEGER DEFAULT 0,
  blocked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  seller_name VARCHAR(255) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(seller_name, product_name)
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  order_number VARCHAR(255) UNIQUE NOT NULL,
  seller_name VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255),
  customer_address TEXT,
  city VARCHAR(255),
  phone1 VARCHAR(50),
  phone2 VARCHAR(50),
  seller_price DECIMAL(10, 2),
  dc DECIMAL(10, 2) DEFAULT 0,
  shipper_price DECIMAL(10, 2) DEFAULT 0,
  profit DECIMAL(10, 2) DEFAULT 0,
  products TEXT,
  tracking_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  shipper_paid INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dispatched Parcels Table
CREATE TABLE IF NOT EXISTS dispatched_parcels (
  id BIGSERIAL PRIMARY KEY,
  tracking_id VARCHAR(255) NOT NULL,
  courier VARCHAR(100),
  dispatch_date DATE,
  dispatch_time TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_products_seller_name ON products(seller_name);
CREATE INDEX IF NOT EXISTS idx_orders_seller_name ON orders(seller_name);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_id ON orders(tracking_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
```

### 3. Code Fixes Applied

✅ Error handling improve ki gayi hai
✅ Async function errors properly handle kiye gaye hain
✅ Server ab gracefully handle karega agar Supabase connection fail ho

## Testing (Test Karen)

1. `.env` file update karen actual credentials se
2. Server restart karen: `npm start`
3. Agar abhi bhi error aaye, check karen:
   - Supabase URL sahi hai?
   - Network connection theek hai?
   - Supabase project accessible hai?

## Important Notes

⚠️ **Service Role Key** ko secret rakhen - ye admin privileges rakhta hai
⚠️ `.env` file ko `.gitignore` mein rakhen (git mein commit na karen)
⚠️ Production mein strong `JWT_SECRET` use karen

