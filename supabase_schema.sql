-- =====================================================
-- Supabase Database Schema
-- =====================================================
-- 
-- Instructions:
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Copy and paste this entire file
-- 4. Click "Run" to execute
--
-- This will create all necessary tables and indexes for the Order Management System
-- =====================================================

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

-- Bills Table (for storing generated bills)
CREATE TABLE IF NOT EXISTS bills (
  id BIGSERIAL PRIMARY KEY,
  bill_number VARCHAR(255) UNIQUE NOT NULL,
  seller_name VARCHAR(255) NOT NULL,
  bill_data TEXT NOT NULL, -- JSON string of bill details
  summary_data TEXT NOT NULL, -- JSON string of summary
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses Table (for tracking expenses related to bills)
CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  seller_name VARCHAR(255) NOT NULL,
  expense_type VARCHAR(100) NOT NULL, -- e.g., 'shipper_price', 'dc', etc.
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  bill_number VARCHAR(255),
  bill_id BIGINT REFERENCES bills(id) ON DELETE CASCADE,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Return Scans Table (for tracking return scans)
CREATE TABLE IF NOT EXISTS return_scans (
  id BIGSERIAL PRIMARY KEY,
  tracking_id VARCHAR(255) NOT NULL,
  order_number VARCHAR(255),
  seller_name VARCHAR(255),
  customer_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'scanned',
  scan_date DATE NOT NULL,
  scan_time TIME,
  scanned_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employees Table (for employee management)
CREATE TABLE IF NOT EXISTS employees (
  id BIGSERIAL PRIMARY KEY,
  employee_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  designation VARCHAR(255),
  department VARCHAR(255),
  salary DECIMAL(10, 2),
  join_date DATE,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employee Fingerprints Table (for fingerprint-based attendance)
CREATE TABLE IF NOT EXISTS employee_fingerprints (
  id BIGSERIAL PRIMARY KEY,
  employee_id VARCHAR(255) NOT NULL,
  fingerprint_data TEXT NOT NULL,
  fingerprint_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(employee_id, fingerprint_index)
);

-- Attendance Table (for tracking employee attendance)
CREATE TABLE IF NOT EXISTS attendance (
  id BIGSERIAL PRIMARY KEY,
  employee_id VARCHAR(255) NOT NULL,
  attendance_date DATE NOT NULL,
  check_in_time TIME,
  check_out_time TIME,
  total_hours DECIMAL(5, 2),
  status VARCHAR(50) DEFAULT 'present',
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(employee_id, attendance_date)
);

-- Create indexes for better performance
-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_blocked ON users(is_blocked);

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_seller_name ON products(seller_name);
CREATE INDEX IF NOT EXISTS idx_products_product_name ON products(product_name);
CREATE INDEX IF NOT EXISTS idx_products_seller_product ON products(seller_name, product_name);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_seller_name ON orders(seller_name);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_id ON orders(tracking_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_shipper_paid ON orders(shipper_paid);
CREATE INDEX IF NOT EXISTS idx_orders_seller_status ON orders(seller_name, status);

-- Dispatched Parcels indexes
CREATE INDEX IF NOT EXISTS idx_dispatched_parcels_tracking_id ON dispatched_parcels(tracking_id);
CREATE INDEX IF NOT EXISTS idx_dispatched_parcels_dispatch_date ON dispatched_parcels(dispatch_date);
CREATE INDEX IF NOT EXISTS idx_dispatched_parcels_courier ON dispatched_parcels(courier);

-- Bills indexes
CREATE INDEX IF NOT EXISTS idx_bills_bill_number ON bills(bill_number);
CREATE INDEX IF NOT EXISTS idx_bills_seller_name ON bills(seller_name);
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at);

-- Expenses indexes
CREATE INDEX IF NOT EXISTS idx_expenses_seller_name ON expenses(seller_name);
CREATE INDEX IF NOT EXISTS idx_expenses_bill_number ON expenses(bill_number);
CREATE INDEX IF NOT EXISTS idx_expenses_bill_id ON expenses(bill_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_type ON expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);

-- Return Scans indexes
CREATE INDEX IF NOT EXISTS idx_return_scans_tracking_id ON return_scans(tracking_id);
CREATE INDEX IF NOT EXISTS idx_return_scans_scan_date ON return_scans(scan_date);
CREATE INDEX IF NOT EXISTS idx_return_scans_seller_name ON return_scans(seller_name);
CREATE INDEX IF NOT EXISTS idx_return_scans_created_at ON return_scans(created_at);

-- Employees indexes
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_created_at ON employees(created_at);

-- Employee Fingerprints indexes
CREATE INDEX IF NOT EXISTS idx_employee_fingerprints_employee_id ON employee_fingerprints(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_fingerprints_fingerprint_data ON employee_fingerprints(fingerprint_data);

-- Attendance indexes
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
CREATE INDEX IF NOT EXISTS idx_attendance_created_at ON attendance(created_at);

-- Add comments to tables for documentation
COMMENT ON TABLE users IS 'Stores user accounts (admin and sellers)';
COMMENT ON TABLE products IS 'Stores product information with seller association';
COMMENT ON TABLE orders IS 'Stores all order information including customer details, pricing, and status';
COMMENT ON TABLE dispatched_parcels IS 'Tracks dispatched parcels with courier and dispatch information';
COMMENT ON TABLE bills IS 'Stores generated bills with JSON data';
COMMENT ON TABLE expenses IS 'Tracks expenses related to bills and orders';
COMMENT ON TABLE return_scans IS 'Tracks return scans with tracking IDs and scan information';
COMMENT ON TABLE employees IS 'Stores employee information for employee management system';
COMMENT ON TABLE employee_fingerprints IS 'Stores fingerprint data for employees (for biometric attendance)';
COMMENT ON TABLE attendance IS 'Tracks employee attendance records with check-in/check-out times';

-- Enable Row Level Security (Optional - uncomment if needed)
-- Note: If you enable RLS, you'll need to create policies for each table
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE dispatched_parcels ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE return_scans ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE employee_fingerprints ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

