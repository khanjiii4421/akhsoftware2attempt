require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const XLSX = require('xlsx');
const https = require('https');
const http = require('http');
const zlib = require('zlib');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // For backend operations

// Validate Supabase configuration
if (!SUPABASE_URL || SUPABASE_URL.trim() === '' || SUPABASE_URL.includes('your-project-ref')) {
  console.error('\n❌ ERROR: SUPABASE_URL is not properly configured in .env file.');
  console.error('Please update .env file with your actual Supabase URL from: Project Settings -> API');
  console.error('Example: SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co\n');
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY.trim() === '' || SUPABASE_SERVICE_ROLE_KEY.includes('your-service-role-key-here')) {
  console.error('\n❌ ERROR: SUPABASE_SERVICE_ROLE_KEY is not properly configured in .env file.');
  console.error('Please update .env file with your actual Supabase Service Role Key from: Project Settings -> API');
  console.error('⚠️  WARNING: Service Role Key has admin privileges. Keep it secret!\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

// Mock in-memory database helper functions - these will be replaced with Supabase calls
;

// Quantity-based Return DC Configuration for Affan/Self
// Format: { maxQty: maximum quantity, dc: return DC amount (will be negative) }
// You can modify these values as needed
const QUANTITY_BASED_RETURN_DC = [
  { maxQty: 2, dc: 200 },       // Qty 1-2: -200
  { maxQty: 5, dc: 350 },       // Qty 3-5: -350
  { maxQty: 11, dc: 550 },      // Qty 6-11: -550
  { maxQty: 19, dc: 850 },      // Qty 12-19: -850
  { maxQty: Infinity, dc: 1000 } // Qty 20+: -1000
];

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Increase limit for bulk uploads
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Initialize in-memory data with default admin user
async function initializeData() {
  try {
    // Ensure the admin user exists in Supabase
    console.log('Supabase data initialization started...');
    
    const { data: existingUsers, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .eq('username', 'admin');

    if (fetchError) {
      console.error('❌ Error checking for existing admin user:', fetchError.message || fetchError);
      console.error('⚠️  This might be due to:');
      console.error('   1. Incorrect SUPABASE_URL in .env file');
      console.error('   2. Network connectivity issues');
      console.error('   3. Supabase project is not accessible');
      console.error('   4. Database tables might not exist yet');
      console.error('   The server will continue running, but admin user initialization failed.');
      return; // Don't throw, let server continue
    }

    if (existingUsers && existingUsers.length === 0) {
      const adminPassword = bcrypt.hashSync('admin123', 10);
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          username: 'admin',
          password: adminPassword,
          role: 'admin',
          is_blocked: 0,
          blocked_until: null,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('❌ Error creating default admin user:', insertError.message || insertError);
        console.error('⚠️  Make sure the "users" table exists in your Supabase database.');
        return; // Don't throw, let server continue
      }
      console.log('✅ Default admin user created successfully in Supabase');
    } else {
      console.log('✅ Admin user already exists in Supabase');
    }
  } catch (error) {
    console.error('❌ Error initializing data:', error.message || error);
    console.error('⚠️  The server will continue running, but initialization may have failed.');
    // Don't throw - let the server start even if initialization fails
  }
}

// Initialize data on startup (non-blocking)
initializeData().catch(err => {
  console.error('❌ Fatal error during initialization:', err.message || err);
  // Server continues to run
});

// Middleware for authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Auth Routes
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.toLowerCase());

    if (error) {
      console.error('Supabase error during login:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    const user = users[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is blocked
    if (user.is_blocked === 1) {
      const blockedUntil = user.blocked_until ? new Date(user.blocked_until) : null;
      if (blockedUntil && blockedUntil > new Date()) {
        return res.status(403).json({ error: 'Account is blocked' });
      } else {
        // Unblock if time has passed
        const { error: updateError } = await supabase
          .from('users')
          .update({ is_blocked: 0, blocked_until: null, updated_at: new Date().toISOString() })
          .eq('id', user.id);

        if (updateError) {
          console.error('Supabase error unblocking user:', updateError);
          // Don't block login if unblocking fails, just log it
        }
        user.is_blocked = 0;
        user.blocked_until = null;
      }
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/create-seller', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { username, password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);

  try {
    const { data, error } = await supabase
      .from('users')
      .insert({
        username: username,
        password: hashedPassword,
        role: 'seller',
        is_blocked: 0,
        blocked_until: null,
        created_at: new Date().toISOString()
      })
      .select('id');

    if (error) {
      if (error.code === '23505') { // Supabase unique violation
        return res.status(400).json({ error: 'Username already exists' });
      }
      console.error('Supabase error creating seller:', error);
      return res.status(500).json({ error: 'Failed to create seller' });
    }

    res.json({ message: 'Seller created successfully', id: data[0].id });
  } catch (err) {
    console.error('Error creating seller:', err);
    return res.status(500).json({ error: 'Failed to create seller' });
  }
});

// Seller Management
app.get('/api/sellers', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { data: sellers, error } = await supabase
      .from('users')
      .select('id, username, role, is_blocked, blocked_until, created_at')
      .eq('role', 'seller');

    if (error) {
      console.error('Supabase error fetching sellers:', error);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(sellers);
  } catch (err) {
    console.error('Error fetching sellers:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/block-seller', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { sellerId, hours } = req.body;
  const blockedUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  try {
    const { error } = await supabase
      .from('users')
      .update({ is_blocked: 1, blocked_until: blockedUntil, updated_at: new Date().toISOString() })
      .eq('id', sellerId);

    if (error) {
      console.error('Supabase error blocking seller:', error);
      return res.status(500).json({ error: 'Failed to block seller' });
    }
    res.json({ message: 'Seller blocked successfully' });
  } catch (err) {
    console.error('Error blocking seller:', err);
    return res.status(500).json({ error: 'Failed to block seller' });
  }
});

app.post('/api/unblock-seller', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { sellerId } = req.body;
  try {
    const { error } = await supabase
      .from('users')
      .update({ is_blocked: 0, blocked_until: null, updated_at: new Date().toISOString() })
      .eq('id', sellerId);

    if (error) {
      console.error('Supabase error unblocking seller:', error);
      return res.status(500).json({ error: 'Failed to unblock seller' });
    }
    res.json({ message: 'Seller unblocked successfully' });
  } catch (err) {
    console.error('Error unblocking seller:', err);
    return res.status(500).json({ error: 'Failed to unblock seller' });
  }
});

app.delete('/api/delete-seller/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.params.id)
      .eq('role', 'seller');

    if (error) {
      console.error('Supabase error deleting seller:', error);
      return res.status(500).json({ error: 'Failed to delete seller' });
    }
    res.json({ message: 'Seller deleted successfully' });
  } catch (err) {
    console.error('Error deleting seller:', err);
    return res.status(500).json({ error: 'Failed to delete seller' });
  }
});

// Product Routes
app.get('/api/products', authenticateToken, async (req, res) => {
  const { seller_name } = req.query;
  try {
    let query = supabase
      .from('products')
      .select('*');

    if (req.user.role === 'seller') {
      query = query.ilike('seller_name', req.user.username);
    } else if (seller_name) {
      query = query.ilike('seller_name', seller_name);
    }

    query = query.order('seller_name', { ascending: true }).order('product_name', { ascending: true }).limit(5000);

    const { data: products, error } = await query;

    if (error) {
      console.error('Supabase error fetching products:', error);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(products);
  } catch (err) {
    console.error('Error fetching products:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { seller_name, product_name, price } = req.body;
  const normalizedSellerName = seller_name.toLowerCase();
  const normalizedProductName = product_name.toLowerCase();
  
  try {
    // Check if product exists (case-insensitive)
    const { data: existingProducts, error: fetchError } = await supabase
      .from('products')
      .select('id')
      .ilike('seller_name', seller_name)
      .ilike('product_name', product_name);

    if (fetchError) {
      console.error('Supabase error checking for existing product:', fetchError);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (existingProducts && existingProducts.length > 0) {
      // Update existing product
      const { data, error: updateError } = await supabase
        .from('products')
        .update({ price: price, updated_at: new Date().toISOString() })
        .eq('id', existingProducts[0].id)
        .select('id');

      if (updateError) {
        console.error('Supabase error updating product:', updateError);
        return res.status(500).json({ error: 'Failed to update product' });
      }
      res.json({ message: 'Product updated successfully', id: data[0].id });
    } else {
      // Insert new product
      const { data, error: insertError } = await supabase
        .from('products')
        .insert({
          seller_name: normalizedSellerName,
          product_name: normalizedProductName,
          price: price,
          created_at: new Date().toISOString()
        })
        .select('id');

      if (insertError) {
        console.error('Supabase error adding product:', insertError);
        return res.status(500).json({ error: 'Failed to add product' });
      }
      res.json({ message: 'Product added successfully', id: data[0].id });
    }
  } catch (err) {
    console.error('Error adding/updating product:', err);
    return res.status(500).json({ error: 'Failed to add product' });
  }
});

app.post('/api/products/bulk', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { products } = req.body;
  
  // Validate products array
  if (!products || !Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ error: 'No products provided' });
  }

  try {
    // Process products in batches to avoid overwhelming the database
    const BATCH_SIZE = 100;
    let totalInserted = 0;
    
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      
      // Validate and format each product
      const formattedProducts = batch
        .filter(product => product.seller_name && product.product_name && product.price)
        .map(product => ({
          seller_name: (product.seller_name || '').toLowerCase().trim(),
          product_name: (product.product_name || '').toLowerCase().trim(),
          price: parseFloat(product.price)
        }));

      if (formattedProducts.length === 0) {
        continue;
      }

      // Insert products (use insert instead of upsert to avoid timestamp issues)
      const { data, error } = await supabase
        .from('products')
        .upsert(formattedProducts, { 
          onConflict: 'seller_name,product_name',
          ignoreDuplicates: false 
        })
        .select();

      if (error) {
        console.error('Supabase error bulk uploading products:', error);
        return res.status(500).json({ 
          error: 'Failed to bulk upload products', 
          details: error.message,
          inserted: totalInserted 
        });
      }
      
      totalInserted += formattedProducts.length;
      console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: Inserted ${formattedProducts.length} products`);
    }
    
    res.json({ 
      message: `Successfully uploaded ${totalInserted} products`,
      count: totalInserted 
    });
  } catch (err) {
    console.error('Error bulk uploading products:', err);
    return res.status(500).json({ 
      error: 'Failed to bulk upload products', 
      details: err.message 
    });
  }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', req.params.id);

    if (error) {
      console.error('Supabase error deleting product:', error);
      return res.status(500).json({ error: 'Failed to delete product' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    return res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Calculate shipper price from products (async version)
const calculateShipperPrice = async (productsString, sellerName) => {
  if (!productsString || !sellerName) {
    return 0;
  }
  
  const productNames = productsString.split(',').map(p => p.trim()).filter(p => p.length > 0);
  
  if (productNames.length === 0) {
    return 0;
  }
  
  // Get unique product names for database query
  const uniqueProductNames = [...new Set(productNames.map(n => n.toLowerCase()))];
  const placeholders = uniqueProductNames.map((_, i) => `$${i + 2}`).join(',');
  
  // Normalize seller name for case-insensitive lookup
  const normalizedSellerName = (sellerName || '').toLowerCase();
  
  try {
    // First, let's check what products exist for this seller (for debugging)
    const { data: allProducts, error: allProductsError } = await supabase
      .from('products')
      .select('product_name, price, seller_name')
      .ilike('seller_name', sellerName);

    if (allProductsError) {
      console.error('Supabase error fetching all products for seller:', allProductsError);
      // Continue with partial data or return 0, depending on desired error handling
    }
    
    if (allProducts && allProducts.length > 0) {
      console.log(`[Debug] All products for seller "${sellerName}":`, allProducts.map(p => `${p.seller_name}:${p.product_name}(${p.price})`).join(', '));
    }
    
    const { data: products, error } = await supabase
      .from('products')
      .select('product_name, price')
      .ilike('seller_name', sellerName)
      .in('product_name', uniqueProductNames);

    if (error) {
      console.error('Supabase error fetching products for shipper price calculation:', error);
      return 0;
    }
    
    // Debug: Log what products were found
    console.log(`[Shipper Price] Seller: "${sellerName}" (normalized: "${normalizedSellerName}")`);
    console.log(`[Shipper Price] Searching for products: ${uniqueProductNames.join(', ')}`);
    console.log(`[Shipper Price] Found ${products.length} products in database:`, products.length > 0 ? products.map(p => `${p.product_name}(${p.price})`).join(', ') : 'NONE');
    
    // Create price map from database results
    const priceMap = {};
    products.forEach(p => { 
      priceMap[p.product_name.toLowerCase()] = parseFloat(p.price) || 0; 
    });
    
    // Count occurrences of each product in the original list
    const productCount = {};
    productNames.forEach(name => {
      const key = name.toLowerCase();
      productCount[key] = (productCount[key] || 0) + 1;
    });
    
    // Calculate total price: price * count for each product
    let totalPrice = 0;
    Object.keys(productCount).forEach(productKey => {
      const price = priceMap[productKey] || 0;
      const count = productCount[productKey];
      const productTotal = price * count;
      totalPrice += productTotal;
      
      if (price === 0) {
        console.warn(`[WARNING] Product "${productKey}" not found in database for seller "${sellerName}" or price is 0. Please add this product in Products page.`);
      } else {
        console.log(`[Shipper Price] Product: ${productKey}, Price: ${price}, Count: ${count}, Subtotal: ${productTotal}, Total so far: ${totalPrice}`);
      }
    });
    
    console.log(`[Shipper Price] Final shipper price for "${productsString}" (seller: ${sellerName}): ${totalPrice}`);
    return totalPrice;
  } catch (err) {
    console.error('Error calculating shipper price:', err);
    return 0;
  }
};

// Order Routes
app.get('/api/orders', authenticateToken, async (req, res) => {
  const { seller_name, status, shipper_paid } = req.query;
  try {
    let query = supabase
      .from('orders')
      .select('*');

    if (req.user.role === 'seller') {
      query = query.ilike('seller_name', req.user.username);
    } else if (seller_name) {
      query = query.ilike('seller_name', seller_name);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (shipper_paid !== undefined) {
      query = query.eq('shipper_paid', shipper_paid);
    }

    query = query.order('created_at', { ascending: false }).limit(10000);

    const { data: orders, error } = await query;

    if (error) {
      console.error('Supabase error fetching orders:', error);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(orders);
  } catch (err) {
    console.error('Error fetching orders:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/orders', authenticateToken, async (req, res) => {
  const {
    order_number, seller_name, customer_name, customer_address, city,
    phone1, phone2, seller_price, dc, products
  } = req.body;

  if (req.user.role === 'seller' && seller_name.toLowerCase() !== req.user.username.toLowerCase()) {
    return res.status(403).json({ error: 'You can only create orders for yourself' });
  }

  try {
    const shipper_price = await calculateShipperPrice(products, seller_name);
    const profit = parseFloat(seller_price) - parseFloat(dc || 0) - shipper_price;
    const normalizedSellerName = (seller_name || '').toLowerCase();

    const { data, error } = await supabase
      .from('orders')
      .insert({
        order_number: order_number,
        seller_name: normalizedSellerName,
        customer_name: customer_name,
        customer_address: customer_address,
        city: city,
        phone1: phone1,
        phone2: phone2 || '',
        seller_price: seller_price,
        dc: dc || 0,
        shipper_price: shipper_price,
        profit: profit,
        products: products,
        status: 'pending',
        shipper_paid: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id');

    if (error) {
      if (error.code === '23505') { // Supabase unique violation
        return res.status(400).json({ error: 'Order number already exists' });
      }
      console.error('Supabase error creating order:', error);
      return res.status(500).json({ error: 'Failed to create order' });
    }
    res.json({ message: 'Order created successfully', id: data[0].id });
  } catch (err) {
    console.error('Error creating order:', err);
    return res.status(500).json({ error: 'Failed to create order' });
  }
});

app.put('/api/orders/:id', authenticateToken, async (req, res) => {
  const {
    customer_name, customer_address, city, phone1, phone2,
    seller_price, dc, products, tracking_id, status, shipper_paid
  } = req.body;

  try {
    const { data: existingOrder, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', req.params.id);

    if (fetchError) {
      console.error('Supabase error fetching order for update:', fetchError);
      return res.status(500).json({ error: 'Database error' });
    }
    const order = existingOrder[0];
    
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (req.user.role === 'seller' && order.seller_name.toLowerCase() !== req.user.username.toLowerCase()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const productsToUse = products !== undefined ? products : order.products;
    const shipper_price = await calculateShipperPrice(productsToUse, order.seller_name);

    const newSellerPrice = parseFloat(seller_price !== undefined ? seller_price : order.seller_price);
    const newDc = parseFloat(dc !== undefined ? dc : order.dc);
    const newProfit = newSellerPrice - newDc - shipper_price;

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        customer_name: customer_name !== undefined ? customer_name : order.customer_name,
        customer_address: customer_address !== undefined ? customer_address : order.customer_address,
        city: city !== undefined ? city : order.city,
        phone1: phone1 !== undefined ? phone1 : order.phone1,
        phone2: phone2 !== undefined ? phone2 : order.phone2,
        products: productsToUse,
        seller_price: newSellerPrice,
        dc: newDc,
        shipper_price: shipper_price,
        profit: newProfit,
        tracking_id: tracking_id !== undefined ? tracking_id : order.tracking_id,
        status: status !== undefined ? status : order.status,
        shipper_paid: shipper_paid !== undefined ? shipper_paid : order.shipper_paid,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id);

    if (updateError) {
      console.error('Supabase error updating order:', updateError);
      return res.status(500).json({ error: 'Failed to update order' });
    }
    res.json({ message: 'Order updated successfully' });
  } catch (err) {
    console.error('Error updating order:', err);
    return res.status(500).json({ error: 'Failed to update order' });
  }
});

// Delete ALL orders (admin only) - MUST be before /api/orders/:id route
app.delete('/api/orders/delete-all', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  console.log('[Delete All Orders] Deleting all orders from Supabase');

  try {
    // First, check total count
    const { count: orderCount, error: countError } = await supabase
      .from('orders')
      .select('count', { count: 'exact', head: true });

    if (countError) {
      console.error('Supabase error counting orders for delete-all:', countError);
      return res.status(500).json({ error: 'Database error' });
    }
    
    console.log(`[Delete All Orders] Found ${orderCount} total orders`);

    if (orderCount === 0) {
      return res.status(404).json({ 
        error: 'No orders found in Supabase',
        deleted_count: 0
      });
    }

    // Delete all orders
    const { count: deletedCount, error: deleteError } = await supabase
      .from('orders')
      .delete()
      .neq('id', 0); // Use a condition that always evaluates to true to delete all rows. Adjust if RLS is in place.

    if (deleteError) {
      console.error('Supabase error deleting all orders:', deleteError);
      return res.status(500).json({ error: 'Failed to delete orders: ' + deleteError.message });
    }
    console.log(`[Delete All Orders] Successfully deleted ${deletedCount} orders`);
    res.json({ 
      message: `Successfully deleted all ${deletedCount} orders`,
      deleted_count: deletedCount
    });
  } catch (err) {
    console.error('Error deleting all orders:', err);
    return res.status(500).json({ error: 'Failed to delete orders: ' + err.message });
  }
});

// Delete all orders for a seller - MUST be before /api/orders/:id route
app.delete('/api/orders/delete-all-for-seller', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  // Try to get seller_name from query params first, then body
  const seller_name = req.query.seller_name || req.body.seller_name;
  
  if (!seller_name) {
    return res.status(400).json({ error: 'Seller name is required' });
  }

  console.log(`[Delete All Orders] Checking orders for seller: ${seller_name}`);

  try {
    // First, check if any orders exist for this seller
    const { count: orderCount, error: countError } = await supabase
      .from('orders')
      .select('count', { count: 'exact', head: true })
      .ilike('seller_name', seller_name);

    if (countError) {
      console.error('Supabase error counting orders for delete-all-for-seller:', countError);
      return res.status(500).json({ error: 'Database error' });
    }
    
    console.log(`[Delete All Orders] Found ${orderCount} orders for seller ${seller_name}`);

    if (orderCount === 0) {
      return res.status(404).json({ 
        error: `No orders found for seller "${seller_name}"`,
        deleted_count: 0
      });
    }

    // Delete all orders for this seller
    const { count: deletedCount, error: deleteError } = await supabase
      .from('orders')
      .delete()
      .ilike('seller_name', seller_name);

    if (deleteError) {
      console.error('Supabase error deleting orders for seller:', deleteError);
      return res.status(500).json({ error: 'Failed to delete orders: ' + deleteError.message });
    }
    console.log(`[Delete All Orders] Successfully deleted ${deletedCount} orders for seller ${seller_name}`);
    res.json({ 
      message: `Successfully deleted ${deletedCount} orders for seller "${seller_name}"`,
      deleted_count: deletedCount
    });
  } catch (err) {
    console.error('Error deleting orders:', err);
    return res.status(500).json({ error: 'Failed to delete orders: ' + err.message });
  }
});

// Delete single order by ID - MUST be after specific routes
app.delete('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const { data: existingOrder, error: fetchError } = await supabase
      .from('orders')
      .select('seller_name')
      .eq('id', req.params.id);

    if (fetchError) {
      console.error('Supabase error fetching order for delete:', fetchError);
      return res.status(500).json({ error: 'Database error' });
    }
    const order = existingOrder[0];
    
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (req.user.role === 'seller' && order.seller_name.toLowerCase() !== req.user.username.toLowerCase()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { error: deleteError } = await supabase
      .from('orders')
      .delete()
      .eq('id', req.params.id);

    if (deleteError) {
      console.error('Supabase error deleting order:', deleteError);
      return res.status(500).json({ error: 'Failed to delete order' });
    }
    res.json({ message: 'Order deleted successfully' });
  } catch (err) {
    console.error('Error deleting order:', err);
    return res.status(500).json({ error: 'Failed to delete order' });
  }
});

// Bulk Update Status by Tracking IDs or Order Numbers
app.post('/api/orders/bulk-update-status', authenticateToken, async (req, res) => {
  console.log('[Bulk Update Status] Request received');
  try {
    const { seller_name, update_by, new_status, identifiers } = req.body;
    console.log('[Bulk Update Status] Data:', { seller_name, update_by, new_status, identifiers_count: identifiers?.length });

    if (!seller_name || !update_by || !new_status || !identifiers || !Array.isArray(identifiers)) {
      console.log('[Bulk Update Status] Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['tracking_id', 'order_number'].includes(update_by)) {
      return res.status(400).json({ error: 'Invalid update_by field. Must be "tracking_id" or "order_number"' });
    }

    if (!['pending', 'delivered', 'return', 'cancel'].includes(new_status)) {
      return res.status(400).json({ error: 'Invalid status. Must be pending, delivered, return, or cancel' });
    }

    // Check if user is seller and matches seller_name
    if (req.user.role === 'seller' && seller_name.toLowerCase() !== req.user.username.toLowerCase()) {
      return res.status(403).json({ error: 'You can only update orders for yourself' });
    }

    let updatedCount = 0;
    let notFoundCount = 0;
    const notFound = [];
    const errors = [];

    // Process each identifier
    for (const identifier of identifiers) {
      const trimmedId = identifier.trim();
      if (!trimmedId) continue;

      try {
        let updateBuilder = supabase.from('orders').update({ status: new_status, updated_at: new Date().toISOString() });
        if (update_by === 'tracking_id') {
          updateBuilder = updateBuilder.eq('tracking_id', trimmedId);
        } else {
          updateBuilder = updateBuilder.eq('order_number', trimmedId);
        }
        const { data, error } = await updateBuilder.eq('seller_name', seller_name);

        if (error) {
          throw error;
        }

        if (data.length > 0) {
          updatedCount++;
        } else {
          notFoundCount++;
          notFound.push(trimmedId);
        }
      } catch (err) {
        console.error(`Error updating order with ${update_by} ${trimmedId}:`, err);
        errors.push(`${trimmedId}: ${err.message}`);
      }
    }

    res.json({
      message: `Bulk update completed. Updated: ${updatedCount}, Not found: ${notFoundCount}`,
      updated_count: updatedCount,
      not_found_count: notFoundCount,
      total_processed: identifiers.length,
      not_found: notFound.length > 0 ? notFound : undefined,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error in bulk-update-status:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});

// Bulk Update Tracking IDs by Order Numbers
app.post('/api/orders/bulk-update-tracking', authenticateToken, async (req, res) => {
  console.log('[Bulk Update Tracking] Request received');
  console.log('[Bulk Update Tracking] Request body:', JSON.stringify(req.body).substring(0, 200));
  try {
    const { seller_name, updates } = req.body;
    console.log('[Bulk Update Tracking] Data:', { seller_name, updates_count: updates?.length });

    if (!seller_name || !updates || !Array.isArray(updates)) {
      console.log('[Bulk Update Tracking] Missing required fields');
      return res.status(400).json({ error: 'Missing required fields: seller_name and updates array' });
    }

    // Check if user is seller and matches seller_name
    if (req.user.role === 'seller' && seller_name.toLowerCase() !== req.user.username.toLowerCase()) {
      return res.status(403).json({ error: 'You can only update orders for yourself' });
    }

    let updatedCount = 0;
    let notFoundCount = 0;
    const notFound = [];
    const errors = [];

    // Process each update
    for (const update of updates) {
      const orderNumber = update.order_number?.trim();
      const trackingId = update.tracking_id?.trim();

      if (!orderNumber || !trackingId) continue;

      try {
        const { data, error } = await supabase
          .from('orders')
          .update({ tracking_id: trackingId, updated_at: new Date().toISOString() })
          .eq('seller_name', seller_name)
          .eq('order_number', orderNumber);

        if (error) {
          throw error;
        }

        if (data.length > 0) {
          updatedCount++;
        } else {
          notFoundCount++;
          notFound.push(orderNumber);
        }
      } catch (err) {
        console.error(`Error updating tracking for order ${orderNumber}:`, err);
        errors.push(`${orderNumber}: ${err.message}`);
      }
    }

    res.json({
      message: `Bulk tracking update completed. Updated: ${updatedCount}, Not found: ${notFoundCount}`,
      updated_count: updatedCount,
      not_found_count: notFoundCount,
      total_processed: updates.length,
      not_found: notFound.length > 0 ? notFound : undefined,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error in bulk-update-tracking:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});


// Helper function to detect courier from tracking ID
function detectCourier(trackingId) {
  if (!trackingId || trackingId.trim() === '') return 'Unknown';
  const trimmed = trackingId.trim().toUpperCase();
  
  if (trimmed.startsWith('17')) return 'TCS';
  if (trimmed.startsWith('56') || trimmed.startsWith('55')) return 'M&P';
  if (trimmed.startsWith('19')) return 'Trax';
  if (trimmed.startsWith('AM')) return 'Leopard';
  
  return 'Unknown';
}

// Scan Dispatched Parcel
app.post('/api/dispatched/scan', authenticateToken, async (req, res) => {
  const { tracking_id } = req.body;
  
  if (!tracking_id || tracking_id.trim() === '') {
    return res.status(400).json({ error: 'Tracking ID is required' });
  }
  
  const trimmedTrackingId = tracking_id.trim();
  const courier = detectCourier(trimmedTrackingId);
  const now = new Date();
  const dispatchDate = now.toISOString().split('T')[0];
  const dispatchTime = now.toTimeString().split(' ')[0];
  
  try {
    // First, check if parcel already dispatched today
    const { data: existingParcels, error: checkError } = await supabase
      .from('dispatched_parcels')
      .select('id')
      .eq('tracking_id', trimmedTrackingId)
      .eq('dispatch_date', dispatchDate)
      .limit(1);

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" which is OK
      console.error('Error checking existing parcel:', checkError);
    }

    if (existingParcels && existingParcels.length > 0) {
      return res.status(409).json({ 
        error: 'This parcel has already been dispatched today',
        tracking_id: trimmedTrackingId
      });
    }

    // Insert into dispatched_parcels
    const { data: insertData, error: insertError } = await supabase
      .from('dispatched_parcels')
      .insert({
        tracking_id: trimmedTrackingId,
        courier: courier,
        dispatch_date: dispatchDate,
        dispatch_time: dispatchTime,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error inserting dispatched parcel:', insertError);
      return res.status(500).json({ error: 'Failed to dispatch parcel: ' + insertError.message });
    }

    if (!insertData) {
      return res.status(500).json({ error: 'Failed to dispatch parcel' });
    }
    
    // Update order status to 'dispatched' for all orders with this tracking ID
    const { data: updateData, error: updateError } = await supabase
      .from('orders')
      .update({ status: 'dispatched', updated_at: new Date().toISOString() })
      .eq('tracking_id', trimmedTrackingId);

    if (updateError) {
      console.error('Error updating order status:', updateError);
      return res.status(500).json({ error: 'Failed to update order status.' });
    }
    
    res.json({
      tracking_id: trimmedTrackingId,
      courier: courier,
      dispatch_date: dispatchDate,
      dispatch_time: dispatchTime,
      order_updated: updateData && updateData.length > 0
    });
  } catch (err) {
    console.error('Error inserting dispatched parcel:', err);
    return res.status(500).json({ error: 'Failed to save dispatched parcel: ' + err.message });
  }
});

// Delete Dispatched Parcel
app.delete('/api/dispatched/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    const { data, error } = await supabase
      .from('dispatched_parcels')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting dispatched parcel:', error);
      return res.status(500).json({ error: 'Failed to delete dispatched parcel.' });
    }

    if (data.length === 0) {
      return res.status(404).json({ error: 'Parcel not found' });
    }
    
    res.json({ 
      message: 'Parcel deleted successfully',
      deleted_id: id
    });
  } catch (err) {
    console.error('Error deleting dispatched parcel:', err);
    return res.status(500).json({ error: 'Failed to delete parcel: ' + err.message });
  }
});

// Get Dispatched Parcels by Date
app.get('/api/dispatched', authenticateToken, async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  try {
    const { data: parcels, error } = await supabase
      .from('dispatched_parcels')
      .select('*')
      .eq('dispatch_date', targetDate)
      .order('dispatch_time', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error fetching dispatched parcels:', error);
      return res.status(500).json({ error: 'Database error: ' + error.message });
    }

    // Get order information for each parcel
    const parcelsWithOrders = await Promise.all((parcels || []).map(async (parcel) => {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, status')
        .eq('tracking_id', parcel.tracking_id)
        .limit(1)
        .single();

      return {
        ...parcel,
        order_id: orders?.id || null,
        order_number: orders?.order_number || null,
        customer_name: orders?.customer_name || null,
        parcel_status: orders?.status || 'dispatched',
        order_status: orders?.status || null
      };
    }));

    res.json(parcelsWithOrders);
  } catch (err) {
    console.error('Error fetching dispatched parcels:', err);
    return res.status(500).json({ error: 'Database error: ' + err.message });
  }
});


// Update order status by tracking ID
app.post('/api/orders/update-status', authenticateToken, async (req, res) => {
  const { tracking_id, status } = req.body;

  if (!tracking_id || !status) {
    return res.status(400).json({ error: 'Tracking ID and status are required' });
  }

  const allowedStatuses = ['pending', 'dispatched', 'delivered', 'return', 'cancel'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ status: status, updated_at: new Date().toISOString() })
      .eq('tracking_id', tracking_id.trim());

    if (error) {
      console.error('Error updating order status:', error);
      return res.status(500).json({ error: 'Failed to update order status.' });
    }

    if (data.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({ message: 'Status updated successfully', updated_count: result.rowCount });
  } catch (err) {
    console.error('Error updating order status:', err);
    return res.status(500).json({ error: 'Failed to update status' });
  }
});

// Helper function to fetch TCS tracking status
function fetchTCSStatus(trackingId) {
  return new Promise((resolve, reject) => {
    // TCS tracking API endpoint
    const trackingUrl = `https://www.tcsexpress.com/track?consignment_no=${trackingId}`;
    
    const options = {
      hostname: 'www.tcsexpress.com',
      path: `/track?consignment_no=${trackingId}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    };

    const req = https.get(options, (res) => {
      let responseData = [];
      let responseSize = 0;

      // Handle compressed responses
      let stream = res;
      if (res.headers['content-encoding'] === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      } else if (res.headers['content-encoding'] === 'deflate') {
        stream = res.pipe(zlib.createInflate());
      } else if (res.headers['content-encoding'] === 'br') {
        stream = res.pipe(zlib.createBrotliDecompress());
      }

      stream.on('data', (chunk) => {
        responseData.push(chunk);
        responseSize += chunk.length;
      });

      stream.on('end', () => {
        try {
          const data = Buffer.concat(responseData).toString('utf-8');
          
          // Check if we got a valid response
          if (res.statusCode !== 200) {
            reject(new Error(`TCS website returned status code: ${res.statusCode}`));
            return;
          }
          
          // Check if response is too small (might be an error page)
          if (data.length < 100) {
            reject(new Error('TCS website returned insufficient data'));
            return;
          }
          // Parse HTML to extract status
          // TCS website typically shows status in the response
          // Look for status keywords in the HTML
          const statusMap = {
            'delivered': ['delivered', 'completed', 'successfully delivered'],
            'return': ['return', 'returned', 'returned to origin'],
            'pending': ['pending', 'in transit', 'out for delivery', 'dispatched'],
            'dispatched': ['dispatched', 'picked up', 'collected']
          };

          const htmlLower = data.toLowerCase();
          let foundStatus = null;
          let tcsStatus = 'Unknown';

          // Remove Accept-Encoding from headers to avoid compression issues
          // Better patterns for TCS status detection
          
          // Check for delivered status (multiple patterns)
          const deliveredPatterns = [
            /delivered/i,
            /successfully delivered/i,
            /delivery completed/i,
            /delivered to consignee/i,
            /delivered successfully/i,
            /out for delivery.*delivered/i,
            /status.*delivered/i
          ];
          
          // Check for return status
          const returnPatterns = [
            /returned to origin/i,
            /rtd/i,
            /return/i,
            /returned/i,
            /rto/i,
            /return to sender/i
          ];
          
          // Check for in transit
          const transitPatterns = [
            /in transit/i,
            /out for delivery/i,
            /on the way/i,
            /in route/i,
            /dispatched/i
          ];
          
          // Check for picked up
          const pickedUpPatterns = [
            /picked up/i,
            /collected/i,
            /collected from/i
          ];

          // Priority: Delivered > Return > In Transit > Picked Up
          let statusFound = false;
          
          for (const pattern of deliveredPatterns) {
            if (pattern.test(data)) {
              foundStatus = 'delivered';
              const match = data.match(new RegExp(pattern.source.replace(/\\/g, ''), 'i'));
              tcsStatus = match ? match[0] : 'Delivered';
              statusFound = true;
              break;
            }
          }
          
          if (!statusFound) {
            for (const pattern of returnPatterns) {
              if (pattern.test(data)) {
                foundStatus = 'return';
                const match = data.match(new RegExp(pattern.source.replace(/\\/g, ''), 'i'));
                tcsStatus = match ? match[0] : 'Return';
                statusFound = true;
                break;
              }
            }
          }
          
          if (!statusFound) {
            for (const pattern of transitPatterns) {
              if (pattern.test(data)) {
                foundStatus = 'dispatched';
                const match = data.match(new RegExp(pattern.source.replace(/\\/g, ''), 'i'));
                tcsStatus = match ? match[0] : 'In Transit';
                statusFound = true;
                break;
              }
            }
          }
          
          if (!statusFound) {
            for (const pattern of pickedUpPatterns) {
              if (pattern.test(data)) {
                foundStatus = 'dispatched';
                const match = data.match(new RegExp(pattern.source.replace(/\\/g, ''), 'i'));
                tcsStatus = match ? match[0] : 'Picked Up';
                statusFound = true;
                break;
              }
            }
          }

          // Try to extract status from JSON if present (some sites use JSON)
          try {
            const jsonMatch = data.match(/\{[\s\S]*"status"[\s\S]*\}/i);
            if (jsonMatch) {
              const jsonData = JSON.parse(jsonMatch[0]);
              if (jsonData.status) {
                const jsonStatus = jsonData.status.toLowerCase();
                if (jsonStatus.includes('delivered')) {
                  foundStatus = 'delivered';
                  tcsStatus = jsonData.status;
                } else if (jsonStatus.includes('return')) {
                  foundStatus = 'return';
                  tcsStatus = jsonData.status;
                }
              }
            }
          } catch (e) {
            // Ignore JSON parse errors
          }

          // Try to extract from common HTML patterns
          const htmlPatterns = [
            /<div[^>]*class[^>]*status[^>]*>([^<]+)<\/div>/i,
            /<span[^>]*class[^>]*status[^>]*>([^<]+)<\/span>/i,
            /<td[^>]*>([^<]*(?:delivered|return|transit)[^<]*)<\/td>/i,
            /status[:\s]*<strong>([^<]+)<\/strong>/i,
            /current status[:\s]*([^<\n]+)/i
          ];

          for (const pattern of htmlPatterns) {
            const match = data.match(pattern);
            if (match && match[1]) {
              const statusText = match[1].trim().toLowerCase();
              if (statusText.includes('delivered') && !foundStatus) {
                foundStatus = 'delivered';
                tcsStatus = match[1].trim();
                break;
              } else if ((statusText.includes('return') || statusText.includes('rtd') || statusText.includes('rto')) && !foundStatus) {
                foundStatus = 'return';
                tcsStatus = match[1].trim();
                break;
              }
            }
          }

          resolve({
            status_found: foundStatus !== null,
            order_status: foundStatus || 'pending',
            tcs_status: tcsStatus,
            raw_html_length: data.length
          });
        } catch (error) {
          reject(error);
        }
      });
      stream.on('error', (error) => {
        reject(new Error('Stream error: ' + error.message));
      });
    });

    req.on('error', (error) => {
      reject(new Error('Request error: ' + error.message));
    });

    // Set timeout
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout after 15 seconds'));
    });
  });
}

// Check TCS Status for a single order
app.post('/api/orders/check-tcs-status', authenticateToken, async (req, res) => {
  const { tracking_id } = req.body;

  if (!tracking_id || !tracking_id.trim().startsWith('17')) {
    return res.status(400).json({ error: 'Invalid TCS tracking ID (must start with 17)' });
  }

  const trimmedId = tracking_id.trim();

  try {
    // First get current order status
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('tracking_id', trimmedId);

    if (orderError) {
      console.error('Error fetching order status:', orderError);
      return res.status(500).json({ error: 'Failed to fetch order status.' });
    }

    const order = orderData[0];

    if (!order) {
      return res.status(404).json({ error: 'Order not found with this tracking ID' });
    }

    // Fetch TCS status
    const result = await fetchTCSStatus(trimmedId);
    
    // Update order status if different and not pending/dispatched
    if (result.status_found && result.order_status && 
        result.order_status !== order.status && 
        (result.order_status === 'delivered' || result.order_status === 'return')) {
      
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: result.order_status, updated_at: new Date().toISOString() })
        .eq('tracking_id', trimmedId);
      
      res.json({
        status_found: true,
        tcs_status: result.tcs_status,
        order_status: result.order_status,
        current_status: order.status,
        updated: !updateError
      });
    } else {
      res.json({
        status_found: result.status_found,
        tcs_status: result.tcs_status,
        order_status: result.order_status || order.status,
        current_status: order.status,
        updated: false
      });
    }
  } catch (error) {
    console.error('Error fetching TCS status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch TCS status: ' + error.message,
      status_found: false
    });
  }
});

// Auto-check all TCS orders
app.post('/api/orders/auto-check-tcs', authenticateToken, async (req, res) => {
  try {
    // Get all orders with TCS tracking IDs (starting with 17) that are not delivered or returned
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, tracking_id, status')
      .like('tracking_id', '17%')
      .in('status', ['pending', 'dispatched'])
      .order('updated_at', { ascending: true })
      .limit(50);

    if (ordersError) {
      console.error('Supabase error fetching TCS orders:', ordersError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!orders || orders.length === 0) {
      return res.json({ 
        checked: 0, 
        updated: 0, 
        errors: 0,
        message: 'No TCS orders found to check'
      });
    }

    let checked = 0;
    let updated = 0;
    let errors = 0;

    for (const order of orders) {
      if (!order || !order.tracking_id) {
        errors++;
        continue;
      }

      try {
        const result = await fetchTCSStatus(order.tracking_id);
        checked++;
        
        // Update if status is delivered or return
        if (result.status_found && result.order_status && 
            (result.order_status === 'delivered' || result.order_status === 'return') &&
            result.order_status !== order.status) {
          
          const { error: updateError } = await supabase
            .from('orders')
            .update({ status: result.order_status, updated_at: new Date().toISOString() })
            .eq('id', order.id);
          
          if (!updateError) {
            updated++;
          } else {
            errors++;
            console.error(`Error updating order ${order.id}:`, updateError);
          }
        }
        
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        errors++;
        console.error(`Error checking TCS status for ${order.tracking_id}:`, error);
      }
    }

    res.json({
      checked: checked,
      updated: updated,
      errors: errors,
      total: orders.length
    });
  } catch (err) {
    console.error('Error in auto-check-tcs:', err);
    return res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// Bulk update delivered
app.post('/api/orders/bulk-update-delivered', authenticateToken, async (req, res) => {
  const { tracking_ids } = req.body;

  if (!tracking_ids || !Array.isArray(tracking_ids) || tracking_ids.length === 0) {
    return res.status(400).json({ error: 'tracking_ids array is required' });
  }

  let updatedCount = 0;
  let notFoundCount = 0;
  const notFound = [];

  for (const trackingId of tracking_ids) {
    const trimmedId = trackingId?.trim();
    if (!trimmedId) continue;

    try {
      const { data, error } = await supabase
        .from('orders')
        .update({ status: 'delivered', updated_at: new Date().toISOString() })
        .eq('tracking_id', trimmedId);

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        updatedCount++;
      } else {
        notFoundCount++;
        notFound.push(trimmedId);
      }
    } catch (err) {
      console.error(`Error updating order with tracking ID ${trimmedId}:`, err);
    }
  }

  res.json({
    message: `Updated ${updatedCount} orders to delivered`,
    updated_count: updatedCount,
    not_found_count: notFoundCount,
    not_found: notFound
  });
});

// Bulk scan return - Update orders to return status by tracking IDs
app.post('/api/orders/bulk-scan-return', authenticateToken, async (req, res) => {
  const { tracking_ids } = req.body;

  if (!tracking_ids || !Array.isArray(tracking_ids) || tracking_ids.length === 0) {
    return res.status(400).json({ error: 'tracking_ids array is required' });
  }

  let updatedCount = 0;
  let notFoundCount = 0;
  const notFound = [];
  const errors = [];

  for (const trackingId of tracking_ids) {
    const trimmedId = trackingId?.trim();
    if (!trimmedId) continue;

    try {
      const { data, error } = await supabase
        .from('orders')
        .update({ status: 'return', updated_at: new Date().toISOString() })
        .eq('tracking_id', trimmedId);

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        updatedCount++;
      } else {
        notFoundCount++;
        notFound.push(trimmedId);
      }
    } catch (err) {
      console.error(`Error updating order with tracking ID ${trimmedId}:`, err);
      errors.push(`${trimmedId}: ${err.message}`);
    }
  }

  res.json({
    message: `Updated ${updatedCount} orders to return status`,
    updated_count: updatedCount,
    not_found_count: notFoundCount,
    total_processed: tracking_ids.length,
    not_found: notFound.length > 0 ? notFound : undefined,
    errors: errors.length > 0 ? errors : undefined
  });
});

// Get Dispatched Statistics
app.get('/api/dispatched/stats', authenticateToken, async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  try {
    // Get all dispatched parcels for the date
    const { data: parcels, error } = await supabase
      .from('dispatched_parcels')
      .select('courier')
      .eq('dispatch_date', targetDate);

    if (error) {
      console.error('Supabase error fetching dispatched stats:', error);
      return res.status(500).json({ error: 'Database error: ' + error.message });
    }

    // Initialize courier stats
    const courierStats = {
      'TCS': 0,
      'M&P': 0,
      'Trax': 0,
      'Leopard': 0,
      'Unknown': 0
    };
    
    // Count by courier
    (parcels || []).forEach(parcel => {
      const courier = parcel.courier || 'Unknown';
      if (courierStats.hasOwnProperty(courier)) {
        courierStats[courier]++;
      } else {
        courierStats['Unknown']++;
      }
    });
    
    res.json({
      date: targetDate,
      total: (parcels || []).length,
      by_courier: courierStats
    });
  } catch (err) {
    console.error('Error fetching dispatched stats:', err);
    return res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// Search Orders
app.get('/api/orders/search', authenticateToken, async (req, res) => {
  const { query: searchQuery } = req.query;

  if (!searchQuery) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    let baseQuery = supabase
      .from('orders')
      .select('*');

    if (req.user.role === 'seller') {
      baseQuery = baseQuery.ilike('seller_name', req.user.username);
    }

    // Supabase doesn't support OR easily, so we'll fetch and filter
    const { data: orders, error } = await baseQuery.limit(10000);

    if (error) {
      console.error('Supabase error searching orders:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    // Filter in memory for complex search
    const searchTerm = searchQuery.toLowerCase();
    const filteredOrders = (orders || []).filter(order => {
      return (
        (order.order_number && order.order_number.toLowerCase().includes(searchTerm)) ||
        (order.seller_name && order.seller_name.toLowerCase().includes(searchTerm)) ||
        (order.customer_name && order.customer_name.toLowerCase().includes(searchTerm)) ||
        (order.phone1 && order.phone1.toLowerCase().includes(searchTerm)) ||
        (order.phone2 && order.phone2.toLowerCase().includes(searchTerm)) ||
        (order.tracking_id && order.tracking_id.toLowerCase().includes(searchTerm))
      );
    });

    res.json(filteredOrders);
  } catch (err) {
    console.error('Error searching orders:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Bulk Upload Orders - Optimized for fast processing
app.post('/api/orders/bulk', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { orders } = req.body;
  const startTime = Date.now();
  let processed = 0;
  let errors = [];
  
  try {
    // Process orders in batches for better performance
    const batchSize = 100;
    const ordersToInsert = [];
    
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      
      try {
        const shipper_price = await calculateShipperPrice(order.products, order.seller_name);
        const profit = parseFloat(order.seller_price) - parseFloat(order.dc || 0) - shipper_price;
        const normalizedSellerName = (order.seller_name || '').toLowerCase();
        const trackingId = order.tracking_id && order.tracking_id.trim() ? order.tracking_id.trim() : null;

        ordersToInsert.push({
          order_number: order.order_number,
          seller_name: normalizedSellerName,
          customer_name: order.customer_name,
          customer_address: order.customer_address,
          city: order.city,
          phone1: order.phone1,
          phone2: order.phone2 || '',
          seller_price: order.seller_price,
          dc: order.dc || 0,
          shipper_price: shipper_price,
          profit: profit,
          products: order.products,
          tracking_id: trackingId,
          status: order.status || 'pending',
          shipper_paid: order.shipper_paid || 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        processed++;
      } catch (err) {
        errors.push({ index: i, error: err.message });
        processed++;
      }
    }
    
    // Insert orders in batches using upsert (handles conflicts)
    for (let i = 0; i < ordersToInsert.length; i += batchSize) {
      const batch = ordersToInsert.slice(i, i + batchSize);
      
      const { error: batchError } = await supabase
        .from('orders')
        .upsert(batch, { 
          onConflict: 'order_number',
          ignoreDuplicates: false // Update if exists
        });
      
      if (batchError) {
        console.error(`Error inserting batch ${i}-${i + batch.length}:`, batchError);
        // Add batch errors
        batch.forEach((order, batchIndex) => {
          errors.push({ index: i + batchIndex, error: batchError.message });
        });
      }
    }
    
    const endTime = Date.now();
    const processingTime = ((endTime - startTime) / 1000).toFixed(2);
    const speed = processed > 0 ? (processed / parseFloat(processingTime)).toFixed(0) : 0;
    
    res.json({ 
      message: `Bulk upload completed. Processed ${processed} orders in ${processingTime}s (${speed} orders/sec)`,
      errors: errors.length > 0 ? errors : undefined,
      stats: {
        total: orders.length,
        processed: processed,
        errors: errors.length,
        time: processingTime,
        speed: speed
      }
    });
    
  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ error: 'Failed to process bulk upload: ' + error.message });
  }
});

// Dashboard Stats
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  const { seller_name } = req.query;
  let whereClause = '';
  let params = [];
  let paramIndex = 1;

  if (seller_name) {
    whereClause = `WHERE LOWER(seller_name) = LOWER($${paramIndex})`;
    params.push(seller_name);
    paramIndex++;
  } else if (req.user.role === 'seller') {
    whereClause = `WHERE LOWER(seller_name) = LOWER($${paramIndex})`;
    params.push(req.user.username);
    paramIndex++;
  }

  try {
    // Build base query
    let baseQuery = supabase.from('orders').select('*', { count: 'exact', head: false });
    
    if (seller_name) {
      baseQuery = baseQuery.ilike('seller_name', seller_name);
    } else if (req.user.role === 'seller') {
      baseQuery = baseQuery.ilike('seller_name', req.user.username);
    }

    // Get all orders for stats
    const { data: allOrders, error: ordersError } = await baseQuery;

    if (ordersError) {
      console.error('Supabase error fetching orders for stats:', ordersError);
      return res.status(500).json({ error: 'Database error' });
    }

    const orders = allOrders || [];
    
    // Calculate stats from data
    const totalOrders = orders.length;
    const totalDelivered = orders.filter(o => o.status === 'delivered').length;
    const totalReturns = orders.filter(o => o.status === 'return').length;
    const totalPaid = orders.filter(o => o.shipper_paid === 1 || o.shipper_paid === true).length;

    // Financials for delivered orders only
    const deliveredOrders = orders.filter(o => o.status === 'delivered');
    const totalSellerPrice = deliveredOrders.reduce((sum, o) => sum + (parseFloat(o.seller_price) || 0), 0);
    const totalShipperPrice = deliveredOrders.reduce((sum, o) => sum + (parseFloat(o.shipper_price) || 0), 0);
    const totalDc = deliveredOrders.reduce((sum, o) => sum + (parseFloat(o.dc) || 0), 0);
    const totalProfit = deliveredOrders.reduce((sum, o) => sum + (parseFloat(o.profit) || 0), 0);

    // Admin Profit Calculation (for delivered orders only)
    const adminProfit = totalSellerPrice - totalShipperPrice - totalDc - totalProfit;

    res.json({
      total_orders: totalOrders,
      total_delivered: totalDelivered,
      total_returns: totalReturns,
      total_paid: totalPaid,
      financials: {
        total_seller_price: totalSellerPrice,
        total_shipper_price: totalShipperPrice,
        total_dc: totalDc,
        total_profit: totalProfit,
        admin_profit: adminProfit
      }
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Top Products
app.get('/api/dashboard/top-products', authenticateToken, async (req, res) => {
  const { seller_name, limit = 10 } = req.query;
  let whereClause = '';
  let params = [];

  if (seller_name) {
    whereClause = 'WHERE LOWER(seller_name) = LOWER($1)';
    params.push(seller_name);
  } else if (req.user.role === 'seller') {
    whereClause = 'WHERE LOWER(seller_name) = LOWER($1)';
    params.push(req.user.username);
  }

  try {
    let query = supabase.from('orders').select('products');
    
    if (seller_name) {
      query = query.ilike('seller_name', seller_name);
    } else if (req.user.role === 'seller') {
      query = query.ilike('seller_name', req.user.username);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error('Supabase error fetching orders for top products:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    const productCount = {};
    (orders || []).forEach(order => {
      if (order.products) {
        const products = order.products.split(',').map(p => p.trim().toLowerCase());
        products.forEach(product => {
          productCount[product] = (productCount[product] || 0) + 1;
        });
      }
    });

    const topProducts = Object.entries(productCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, parseInt(limit));

    res.json(topProducts);
  } catch (err) {
    console.error('Error fetching top products:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Top Cities
app.get('/api/dashboard/top-cities', authenticateToken, async (req, res) => {
  const { limit = 10, seller_name } = req.query;
  let whereClause = '';
  let params = [];
  let paramIndex = 1;

  if (seller_name) {
    whereClause = `WHERE LOWER(seller_name) = LOWER($${paramIndex})`;
    params.push(seller_name);
    paramIndex++;
  } else if (req.user.role === 'seller') {
    whereClause = `WHERE LOWER(seller_name) = LOWER($${paramIndex})`;
    params.push(req.user.username);
    paramIndex++;
  }

  try {
    let query = supabase.from('orders').select('city');
    
    if (seller_name) {
      query = query.ilike('seller_name', seller_name);
    } else if (req.user.role === 'seller') {
      query = query.ilike('seller_name', req.user.username);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error('Supabase error fetching orders for top cities:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    // Count cities manually
    const cityCount = {};
    (orders || []).forEach(order => {
      if (order.city) {
        cityCount[order.city] = (cityCount[order.city] || 0) + 1;
      }
    });

    const topCities = Object.entries(cityCount)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, parseInt(limit));

    res.json(topCities);
  } catch (err) {
    console.error('Error fetching top cities:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Seller-wise Stats
app.get('/api/dashboard/seller-stats', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('seller_name, status');

    if (error) {
      console.error('Supabase error fetching orders for seller stats:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    // Group by seller_name
    const sellerStats = {};
    (orders || []).forEach(order => {
      const sellerName = order.seller_name;
      if (!sellerStats[sellerName]) {
        sellerStats[sellerName] = {
          seller_name: sellerName,
          total_orders: 0,
          delivered: 0,
          returns: 0
        };
      }
      sellerStats[sellerName].total_orders++;
      if (order.status === 'delivered') sellerStats[sellerName].delivered++;
      if (order.status === 'return') sellerStats[sellerName].returns++;
    });

    res.json(Object.values(sellerStats));
  } catch (err) {
    console.error('Error fetching seller stats:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Sales Trends
app.get('/api/dashboard/sales-trends', authenticateToken, async (req, res) => {
  const { period = 'day' } = req.query;

  try {
    let query = supabase.from('orders').select('created_at');
    
    if (req.user.role === 'seller') {
      query = query.ilike('seller_name', req.user.username);
    }

    const { data: orders, error } = await query.order('created_at', { ascending: false }).limit(10000);

    if (error) {
      console.error('Supabase error fetching orders for sales trends:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    // Group by period manually
    const periodCount = {};
    (orders || []).forEach(order => {
      if (order.created_at) {
        const date = new Date(order.created_at);
        let periodKey = '';
        
        if (period === 'week') {
          const year = date.getFullYear();
          const startDate = new Date(year, 0, 1);
          const days = Math.floor((date - startDate) / (24 * 60 * 60 * 1000));
          const week = Math.ceil((days + startDate.getDay() + 1) / 7);
          periodKey = `${year}-W${week.toString().padStart(2, '0')}`;
        } else if (period === 'month') {
          periodKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        } else {
          periodKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        }
        
        periodCount[periodKey] = (periodCount[periodKey] || 0) + 1;
      }
    });

    const trends = Object.entries(periodCount)
      .map(([period, count]) => ({ period, count }))
      .sort((a, b) => b.period.localeCompare(a.period))
      .slice(0, 30);

    res.json(trends);
  } catch (err) {
    console.error('Error fetching sales trends:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Download Orders
app.get('/api/orders/download', authenticateToken, async (req, res) => {
  const { seller_name, status, shipper_paid } = req.query;

  try {
    let supabaseQuery = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100000);

    if (req.user.role === 'seller') {
      supabaseQuery = supabaseQuery.ilike('seller_name', req.user.username);
    } else if (seller_name) {
      supabaseQuery = supabaseQuery.ilike('seller_name', seller_name);
    }

    if (status) {
      supabaseQuery = supabaseQuery.eq('status', status);
    }

    if (shipper_paid !== undefined) {
      supabaseQuery = supabaseQuery.eq('shipper_paid', shipper_paid);
    }

    const { data: orders, error } = await supabaseQuery;

    if (error) {
      console.error('Supabase error exporting orders:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.json');
    res.json(orders || []);
  } catch (err) {
    console.error('Error exporting orders:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Billing Routes
app.get('/api/billing/unpaid-orders', authenticateToken, async (req, res) => {
  const { seller_name } = req.query;

  if (!seller_name) {
    return res.status(400).json({ error: 'Seller name is required' });
  }

  if (req.user.role === 'seller' && seller_name.toLowerCase() !== req.user.username.toLowerCase()) {
    return res.status(403).json({ error: 'You can only view your own orders' });
  }

  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .ilike('seller_name', seller_name)
      .in('status', ['delivered', 'return'])
      .eq('shipper_paid', 0)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error fetching unpaid orders:', error);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(orders || []);
  } catch (err) {
    console.error('Error fetching unpaid orders:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/billing/mark-paid', authenticateToken, async (req, res) => {
  const { seller_name, order_ids } = req.body;

  if (!seller_name || !order_ids || !Array.isArray(order_ids)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (req.user.role === 'seller' && seller_name.toLowerCase() !== req.user.username.toLowerCase()) {
    return res.status(403).json({ error: 'You can only mark your own orders as paid' });
  }

  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ shipper_paid: 1, updated_at: new Date().toISOString() })
      .in('id', order_ids)
      .ilike('seller_name', seller_name)
      .in('status', ['delivered', 'return']);

    if (error) {
      console.error('Supabase error marking orders as paid:', error);
      return res.status(500).json({ error: 'Failed to mark orders as paid' });
    }
    res.json({ message: `Successfully marked ${data?.length || 0} orders as paid` });
  } catch (err) {
    console.error('Error marking orders as paid:', err);
    return res.status(500).json({ error: 'Failed to mark orders as paid' });
  }
});

app.post('/api/billing/generate-bill', authenticateToken, async (req, res) => {
  const { seller_name, bill_number } = req.body;

  if (!seller_name) {
    return res.status(400).json({ error: 'Seller name is required' });
  }

  if (req.user.role === 'seller' && seller_name.toLowerCase() !== req.user.username.toLowerCase()) {
    return res.status(403).json({ error: 'You can only generate bills for yourself' });
  }

  try {
    // Get unpaid orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .ilike('seller_name', seller_name)
      .in('status', ['delivered', 'return'])
      .eq('shipper_paid', 0)
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('Supabase error fetching unpaid orders for bill:', ordersError);
      return res.status(500).json({ error: 'Database error' });
    }

    // Process orders with billing logic
    const isAffanOrSelf = seller_name.toLowerCase() === 'affan' || seller_name.toLowerCase() === 'self';

    // Function to calculate return DC based on quantity for Affan/Self
    const calculateReturnDcByQuantity = (quantity) => {
      for (const range of QUANTITY_BASED_RETURN_DC) {
        if (quantity <= range.maxQty) {
          return range.dc;
        }
      }
      return QUANTITY_BASED_RETURN_DC[QUANTITY_BASED_RETURN_DC.length - 1].dc;
    };

    const processedOrders = orders.map(order => {
      const isReturn = order.status === 'return';
      let adjustedProfit = parseFloat(order.profit || 0);
      let adjustedDc = parseFloat(order.dc || 0);
      let adjustedShipperPrice = parseFloat(order.shipper_price || 0);
      let adjustedSellerPrice = parseFloat(order.seller_price || 0);

      if (isReturn) {
        let returnDcAmount = 0;
        
        if (isAffanOrSelf) {
          const orderProducts = order.products.split(',').map(p => p.trim()).filter(p => p.length > 0);
          const quantity = orderProducts.length;
          returnDcAmount = calculateReturnDcByQuantity(quantity);
          adjustedShipperPrice = -parseFloat(order.shipper_price || 0);
          adjustedSellerPrice = -parseFloat(order.seller_price || 0);
        } else {
          returnDcAmount = parseFloat(order.dc || 0);
        }
        
        adjustedDc = -returnDcAmount;
        adjustedProfit = -returnDcAmount;
      }

      return {
        ...order,
        adjusted_profit: adjustedProfit,
        adjusted_dc: adjustedDc,
        adjusted_shipper_price: adjustedShipperPrice,
        adjusted_seller_price: adjustedSellerPrice
      };
    });

    // Calculate totals
    const totalDelivered = processedOrders.filter(o => o.status === 'delivered').length;
    const totalReturns = processedOrders.filter(o => o.status === 'return').length;
    const totalProfit = processedOrders.reduce((sum, o) => sum + o.adjusted_profit, 0);
    const totalDc = processedOrders.reduce((sum, o) => sum + o.adjusted_dc, 0);
    const totalShipperPrice = processedOrders.reduce((sum, o) => sum + (o.adjusted_shipper_price || o.shipper_price || 0), 0);
    const totalSellerPrice = processedOrders.reduce((sum, o) => sum + (o.adjusted_seller_price || o.seller_price || 0), 0);
    const deliveredRatio = totalDelivered + totalReturns > 0 
      ? ((totalDelivered / (totalDelivered + totalReturns)) * 100).toFixed(2) 
      : 0;
    const returnRatio = totalDelivered + totalReturns > 0 
      ? ((totalReturns / (totalDelivered + totalReturns)) * 100).toFixed(2) 
      : 0;

    if (processedOrders.length === 0) {
      return res.status(400).json({ 
        error: 'No unpaid orders found (delivered/return). Cannot generate empty bill.' 
      });
    }

    const billData = {
      seller_name: seller_name,
      orders: processedOrders,
      summary: {
        total_orders: processedOrders.length,
        total_delivered: totalDelivered,
        total_returns: totalReturns,
        total_profit: totalProfit,
        total_dc: totalDc,
        total_shipper_price: totalShipperPrice,
        total_seller_price: totalSellerPrice,
        delivered_ratio: deliveredRatio,
        return_ratio: returnRatio
      }
    };

    // Save bill if bill_number is provided
    if (bill_number && bill_number.trim()) {
      const { data: billDataInsert, error: billInsertError } = await supabase
        .from('bills')
        .upsert({
          bill_number: bill_number.trim(),
          seller_name: seller_name,
          bill_data: JSON.stringify(processedOrders),
          summary_data: JSON.stringify(billData.summary),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'bill_number'
        })
        .select('id')
        .single();
      
      if (billInsertError) {
        console.error('Supabase error saving bill:', billInsertError);
        return res.status(500).json({ error: 'Failed to save bill' });
      }
      
      const billId = billDataInsert.id;
      
      // Check if expenses already exist for this bill
      const { data: existingExpense, error: expenseCheckError } = await supabase
        .from('expenses')
        .select('id')
        .eq('bill_number', bill_number.trim())
        .in('expense_type', ['shipper_price', 'dc']);
      
      if (expenseCheckError) {
        console.error('Supabase error checking existing expenses:', expenseCheckError);
      }
      
      if (!existingExpense || existingExpense.length === 0) {
        // Add shipper price as expense
        if (totalShipperPrice !== 0) {
          const { error: shipperExpenseError } = await supabase
            .from('expenses')
            .insert({
              seller_name: seller_name,
              expense_type: 'shipper_price',
              amount: totalShipperPrice,
              description: `Shipper price for bill ${bill_number.trim()}`,
              bill_number: bill_number.trim(),
              bill_id: billId,
              created_by: req.user.username || 'system',
              created_at: new Date().toISOString()
            });
          
          if (shipperExpenseError) {
            console.error('Supabase error inserting shipper expense:', shipperExpenseError);
          }
        }
        
        // Add DC as expense
        if (totalDc !== 0) {
          const { error: dcExpenseError } = await supabase
            .from('expenses')
            .insert({
              seller_name: seller_name,
              expense_type: 'dc',
              amount: totalDc,
              description: `DC for bill ${bill_number.trim()}`,
              bill_number: bill_number.trim(),
              bill_id: billId,
              created_by: req.user.username || 'system',
              created_at: new Date().toISOString()
            });
          
          if (dcExpenseError) {
            console.error('Supabase error inserting DC expense:', dcExpenseError);
          }
        }
      }
      
      res.json({
        ...billData,
        bill_number: bill_number.trim(),
        saved: true
      });
    } else {
      res.json(billData);
    }
  } catch (err) {
    console.error('Error generating bill:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Get all saved bills
app.get('/api/bills', authenticateToken, async (req, res) => {
  const { seller_name } = req.query;

  try {
    let query = supabase
      .from('bills')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (req.user.role === 'seller') {
      query = query.ilike('seller_name', req.user.username);
    } else if (seller_name) {
      query = query.ilike('seller_name', seller_name);
    }

    const { data: bills, error } = await query;
    
    if (error) {
      console.error('Supabase error fetching bills:', error);
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Parse JSON data for each bill
    const parsedBills = (bills || []).map(bill => ({
      id: bill.id,
      bill_number: bill.bill_number,
      seller_name: bill.seller_name,
      bill_data: JSON.parse(bill.bill_data),
      summary_data: JSON.parse(bill.summary_data),
      created_at: bill.created_at
    }));
    
    res.json(parsedBills);
  } catch (err) {
    console.error('Error fetching bills:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});


// Get single bill by bill number
app.get('/api/bills/:bill_number', authenticateToken, async (req, res) => {
  const { bill_number } = req.params;
  
  try {
    const { data: bill, error } = await supabase
      .from('bills')
      .select('*')
      .eq('bill_number', bill_number)
      .single();
    
    if (error || !bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }
    
    // Check access permission
    if (req.user.role === 'seller' && bill.seller_name.toLowerCase() !== req.user.username.toLowerCase()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({
      id: bill.id,
      bill_number: bill.bill_number,
      seller_name: bill.seller_name,
      bill_data: JSON.parse(bill.bill_data),
      summary_data: JSON.parse(bill.summary_data),
      created_at: bill.created_at
    });
  } catch (err) {
    console.error('Error fetching bill:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Delete bill (requires admin password)
app.delete('/api/bills/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ error: 'Admin password is required to delete bill' });
  }
  
  try {
    // Verify admin password
    const { data: adminUsers, error: adminError } = await supabase
      .from('users')
      .select('*')
      .ilike('username', 'admin')
      .eq('role', 'admin')
      .limit(1);
    
    if (adminError || !adminUsers || adminUsers.length === 0) {
      return res.status(404).json({ error: 'Admin user not found' });
    }
    
    const adminUser = adminUsers[0];
    const validPassword = await bcrypt.compare(password, adminUser.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }
    
    // Password verified, delete the bill
    const { error: deleteError } = await supabase
      .from('bills')
      .delete()
      .eq('id', req.params.id);
    
    if (deleteError) {
      console.error('Supabase error deleting bill:', deleteError);
      return res.status(500).json({ error: 'Failed to delete bill' });
    }
    
    res.json({ message: 'Bill deleted successfully' });
  } catch (err) {
    console.error('Error deleting bill:', err);
    return res.status(500).json({ error: 'Failed to delete bill' });
  }
});

// Backup Routes
app.get('/api/backup/create', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const backup = await createBackupData();
    res.json(backup);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create backup: ' + err.message });
  }
});

app.post('/api/backup/restore', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const backup = req.body;
  
  if (!backup || !backup.timestamp) {
    return res.status(400).json({ error: 'Invalid backup file' });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    let restored = {
      orders: 0,
      products: 0,
      bills: 0,
      users: 0,
      dispatched_parcels: 0
    };

    // Delete existing data (except admin user)
    await client.query('DELETE FROM orders');
    await client.query('DELETE FROM products');
    await client.query('DELETE FROM bills');
    await client.query('DELETE FROM dispatched_parcels');

    // Restore orders
    if (backup.orders && backup.orders.length > 0) {
      for (const order of backup.orders) {
        await client.query(
          `INSERT INTO orders (
            order_number, seller_name, customer_name, customer_address, city,
            phone1, phone2, seller_price, dc, shipper_price, profit, products, tracking_id, status, shipper_paid, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (order_number) DO NOTHING`,
          [
            order.order_number, order.seller_name, order.customer_name, order.customer_address, order.city,
            order.phone1, order.phone2 || '', order.seller_price, order.dc || 0, order.shipper_price || 0,
            order.profit || 0, order.products, order.tracking_id || '', order.status || 'pending',
            order.shipper_paid || 0, order.created_at || new Date().toISOString(), order.updated_at || new Date().toISOString()
          ]
        );
        restored.orders++;
      }
    }

    // Restore products
    if (backup.products && backup.products.length > 0) {
      for (const product of backup.products) {
        await client.query(
          'INSERT INTO products (seller_name, product_name, price, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
          [product.seller_name, product.product_name, product.price, product.created_at || new Date().toISOString()]
        );
        restored.products++;
      }
    }

    // Restore bills
    if (backup.bills && backup.bills.length > 0) {
      for (const bill of backup.bills) {
        await client.query(
          'INSERT INTO bills (bill_number, seller_name, bill_data, summary_data, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
          [bill.bill_number, bill.seller_name, bill.bill_data, bill.summary_data, bill.created_at || new Date().toISOString()]
        );
        restored.bills++;
      }
    }

    // Restore users (but preserve admin user)
    if (backup.users && backup.users.length > 0) {
      for (const user of backup.users) {
        if (user.role === 'admin') continue;
        await client.query(
          'INSERT INTO users (username, password, role, is_blocked, blocked_until, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (username) DO NOTHING',
          [user.username, user.password || '', user.role || 'seller', user.is_blocked || 0, user.blocked_until || null, user.created_at || new Date().toISOString()]
        );
        restored.users++;
      }
    }

    // Restore dispatched parcels
    if (backup.dispatched_parcels && backup.dispatched_parcels.length > 0) {
      for (const parcel of backup.dispatched_parcels) {
        await client.query(
          'INSERT INTO dispatched_parcels (tracking_id, courier, dispatch_date, dispatch_time, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
          [parcel.tracking_id, parcel.courier, parcel.dispatch_date, parcel.dispatch_time, parcel.created_at || new Date().toISOString()]
        );
        restored.dispatched_parcels++;
      }
    }

    await client.query('COMMIT');

    res.json({
      message: 'Backup restored successfully',
      restored: restored
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Restore error:', err);
    return res.status(500).json({ error: 'Failed to restore backup: ' + err.message });
  } finally {
    client.release();
  }
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper function to create backup data
async function createBackupData() {
  const ordersResult = await pool.query('SELECT * FROM orders');
  const productsResult = await pool.query('SELECT * FROM products');
  const billsResult = await pool.query('SELECT * FROM bills');
  const dispatchedResult = await pool.query('SELECT * FROM dispatched_parcels');
  const usersResult = await pool.query('SELECT id, username, role, is_blocked, blocked_until, created_at FROM users');

  return {
    timestamp: new Date().toISOString(),
    version: '1.0',
    orders: ordersResult.rows || [],
    products: productsResult.rows || [],
    bills: billsResult.rows || [],
    dispatched_parcels: dispatchedResult.rows || [],
    users: usersResult.rows || []
  };
}

// Function to upload backup to Google Drive (simplified - saves to local file that can be synced)
function saveBackupToFile(backupData, callback) {
  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const filename = `backup_${backupData.timestamp.replace(/[:.]/g, '-')}.json`;
  const filepath = path.join(backupDir, filename);

  fs.writeFile(filepath, JSON.stringify(backupData, null, 2), (err) => {
    if (err) return callback(err);
    callback(null, { filepath, filename });
  });
}

// Automatic backup function
async function performAutoBackup() {
  console.log('[Auto Backup] Starting automatic backup...');
  
  try {
    const settingsResult = await pool.query('SELECT * FROM auto_backup_settings WHERE enabled = 1 LIMIT 1');
    const settings = settingsResult.rows[0];

    if (!settings) {
      console.log('[Auto Backup] Auto backup is not enabled');
      return;
    }

    const backupData = await createBackupData();

    saveBackupToFile(backupData, async (err, fileInfo) => {
      if (err) {
        console.error('[Auto Backup] Error saving backup file:', err);
        return;
      }

      console.log(`[Auto Backup] Backup saved successfully: ${fileInfo.filename}`);
      
      // Update last backup date
      const nextBackupDate = new Date();
      nextBackupDate.setDate(nextBackupDate.getDate() + 7); // Next week
      
      try {
        await pool.query(
          `UPDATE auto_backup_settings 
           SET last_backup_date = $1, next_backup_date = $2, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $3`,
          [new Date().toISOString(), nextBackupDate.toISOString(), settings.id]
        );
        console.log(`[Auto Backup] Next backup scheduled for: ${nextBackupDate.toISOString()}`);
      } catch (updateErr) {
        console.error('[Auto Backup] Error updating backup date:', updateErr);
      }
    });
  } catch (err) {
    console.error('[Auto Backup] Error:', err);
  }
}

// Schedule automatic backup every Sunday at 2 AM
cron.schedule('0 2 * * 0', () => {
  performAutoBackup();
}, {
  scheduled: true,
  timezone: "Asia/Karachi"
});

console.log('[Auto Backup] Scheduled weekly backup every Sunday at 2 AM');

// Auto Backup API Endpoints
app.get('/api/backup/auto/settings', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const result = await pool.query('SELECT * FROM auto_backup_settings LIMIT 1');
    let settings = result.rows[0];

    if (!settings) {
      // Create default settings
      const nextBackupDate = new Date();
      nextBackupDate.setDate(nextBackupDate.getDate() + 7);
      
      const insertResult = await pool.query(
        `INSERT INTO auto_backup_settings (enabled, frequency, next_backup_date, email) 
         VALUES (1, 'weekly', $1, $2) RETURNING *`,
        [nextBackupDate.toISOString(), req.user.username]
      );
      settings = insertResult.rows[0];
    }
    
    res.json(settings);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get settings: ' + err.message });
  }
});

app.post('/api/backup/auto/settings', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { enabled, frequency, email } = req.body;

  try {
    const existingResult = await pool.query('SELECT * FROM auto_backup_settings LIMIT 1');
    const existing = existingResult.rows[0];

    if (existing) {
      await pool.query(
        `UPDATE auto_backup_settings 
         SET enabled = $1, frequency = $2, email = $3, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $4`,
        [enabled !== undefined ? enabled : existing.enabled, frequency || existing.frequency, email || req.user.username, existing.id]
      );
      res.json({ message: 'Settings updated successfully' });
    } else {
      const nextBackupDate = new Date();
      nextBackupDate.setDate(nextBackupDate.getDate() + 7);
      
      await pool.query(
        `INSERT INTO auto_backup_settings (enabled, frequency, next_backup_date, email) 
         VALUES ($1, $2, $3, $4)`,
        [enabled !== undefined ? enabled : 1, frequency || 'weekly', nextBackupDate.toISOString(), email || req.user.username]
      );
      res.json({ message: 'Settings created successfully' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update settings: ' + err.message });
  }
});

app.post('/api/backup/auto/trigger', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  performAutoBackup();
  res.json({ message: 'Manual backup triggered. Check server logs for status.' });
});

// Employee Management APIs

// Get all employees
app.get('/api/employees', authenticateToken, async (req, res) => {
  try {
    const { data: employees, error } = await supabase
      .from('employees')
      .select('*')
      .order('employee_id', { ascending: true });

    if (error) {
      console.error('Supabase error fetching employees:', error);
      return res.status(500).json({ error: 'Database error: ' + error.message });
    }

    res.json(employees || []);
  } catch (err) {
    console.error('Error fetching employees:', err);
    return res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// Get single employee
app.get('/api/employees/:employee_id', authenticateToken, async (req, res) => {
  const { employee_id } = req.params;
  try {
    const { data: employee, error } = await supabase
      .from('employees')
      .select('*')
      .eq('employee_id', employee_id)
      .limit(1)
      .single();

    if (error || !employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json(employee);
  } catch (err) {
    console.error('Error fetching employee:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Create employee
app.post('/api/employees', authenticateToken, async (req, res) => {
  const { employee_id, name, phone, email, designation, department, salary, join_date, status } = req.body;

  if (!employee_id || !name) {
    return res.status(400).json({ error: 'Employee ID and name are required' });
  }

  try {
    const { data: employee, error } = await supabase
      .from('employees')
      .insert({
        employee_id: employee_id,
        name: name,
        phone: phone || null,
        email: email || null,
        designation: designation || null,
        department: department || null,
        salary: salary || null,
        join_date: join_date || null,
        status: status || 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505' || error.message.includes('duplicate') || error.message.includes('unique')) {
        return res.status(409).json({ error: 'Employee ID already exists' });
      }
      console.error('Supabase error creating employee:', error);
      return res.status(500).json({ error: 'Failed to create employee: ' + error.message });
    }

    res.json({ message: 'Employee created successfully', id: employee.id });
  } catch (err) {
    console.error('Error creating employee:', err);
    return res.status(500).json({ error: 'Failed to create employee: ' + err.message });
  }
});

// Update employee
app.put('/api/employees/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { employee_id, name, phone, email, designation, department, salary, join_date, status } = req.body;

  try {
    const { data, error } = await supabase
      .from('employees')
      .update({
        employee_id: employee_id,
        name: name,
        phone: phone || null,
        email: email || null,
        designation: designation || null,
        department: department || null,
        salary: salary || null,
        join_date: join_date || null,
        status: status || 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('id');

    if (error) {
      console.error('Supabase error updating employee:', error);
      return res.status(500).json({ error: 'Failed to update employee: ' + error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({ message: 'Employee updated successfully' });
  } catch (err) {
    console.error('Error updating employee:', err);
    return res.status(500).json({ error: 'Failed to update employee: ' + err.message });
  }
});

// Delete employee
app.delete('/api/employees/:employee_id', authenticateToken, async (req, res) => {
  const { employee_id } = req.params;

  try {
    const { data, error } = await supabase
      .from('employees')
      .delete()
      .eq('employee_id', employee_id)
      .select('id');

    if (error) {
      console.error('Supabase error deleting employee:', error);
      return res.status(500).json({ error: 'Failed to delete employee' });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({ message: 'Employee deleted successfully' });
  } catch (err) {
    console.error('Error deleting employee:', err);
    return res.status(500).json({ error: 'Failed to delete employee' });
  }
});

// Register fingerprint
app.post('/api/employees/:employee_id/fingerprint', authenticateToken, async (req, res) => {
  const { employee_id } = req.params;
  const { fingerprint_data } = req.body;

  if (!fingerprint_data) {
    return res.status(400).json({ error: 'Fingerprint data is required' });
  }

  try {
    // Check if employee exists
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id')
      .eq('employee_id', employee_id)
      .limit(1)
      .single();

    if (empError || !employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check if this fingerprint already exists for another employee
    const { data: existingFingerprints, error: existingError } = await supabase
      .from('employee_fingerprints')
      .select('employee_id')
      .eq('fingerprint_data', fingerprint_data)
      .neq('employee_id', employee_id)
      .limit(1);
    
    if (existingFingerprints && existingFingerprints.length > 0) {
      return res.status(400).json({ 
        error: 'This fingerprint is already registered with another employee. Each fingerprint must be unique.' 
      });
    }

    // Get existing fingerprint count for this employee
    const { count, error: countError } = await supabase
      .from('employee_fingerprints')
      .select('*', { count: 'exact', head: true })
      .eq('employee_id', employee_id);

    const fingerprintIndex = count || 0;

    // Check if fingerprint_index already exists for this employee
    const { data: existingIndex, error: indexError } = await supabase
      .from('employee_fingerprints')
      .select('id')
      .eq('employee_id', employee_id)
      .eq('fingerprint_index', fingerprintIndex)
      .limit(1)
      .single();

    if (existingIndex) {
      // Update existing fingerprint
      const { error: updateError } = await supabase
        .from('employee_fingerprints')
        .update({ fingerprint_data: fingerprint_data })
        .eq('employee_id', employee_id)
        .eq('fingerprint_index', fingerprintIndex);
      
      if (updateError) {
        console.error('Supabase error updating fingerprint:', updateError);
        return res.status(500).json({ error: 'Failed to register fingerprint: ' + updateError.message });
      }
    } else {
      // Insert new fingerprint
      const { error: insertError } = await supabase
        .from('employee_fingerprints')
        .insert({
          employee_id: employee_id,
          fingerprint_data: fingerprint_data,
          fingerprint_index: fingerprintIndex,
          created_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.error('Supabase error inserting fingerprint:', insertError);
        return res.status(500).json({ error: 'Failed to register fingerprint: ' + insertError.message });
      }
    }

    res.json({ message: 'Fingerprint registered successfully', fingerprint_index: fingerprintIndex });
  } catch (err) {
    console.error('Error registering fingerprint:', err);
    return res.status(500).json({ error: 'Failed to register fingerprint: ' + err.message });
  }
});

// Get employee fingerprints
app.get('/api/employees/:employee_id/fingerprints', authenticateToken, async (req, res) => {
  const { employee_id } = req.params;
  try {
    const { data: fingerprints, error } = await supabase
      .from('employee_fingerprints')
      .select('*')
      .eq('employee_id', employee_id)
      .order('fingerprint_index', { ascending: true });

    if (error) {
      console.error('Supabase error fetching fingerprints:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json(fingerprints || []);
  } catch (err) {
    console.error('Error fetching fingerprints:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Match fingerprint and mark attendance
app.post('/api/attendance/mark', authenticateToken, async (req, res) => {
  const { fingerprint_data, employee_id, attendance_type } = req.body;

  if (!fingerprint_data && !employee_id) {
    return res.status(400).json({ error: 'Fingerprint data or employee ID is required' });
  }

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().split(' ')[0];

  try {
    let employee;
    
    // If employee_id is provided directly, use it
    if (employee_id) {
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('employee_id', employee_id)
        .limit(1)
        .single();
      
      if (empError || !empData) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      employee = empData;
    } else {
      // Try to match fingerprint (exact match)
      const { data: matchData, error: matchError } = await supabase
        .from('employee_fingerprints')
        .select('employee_id')
        .eq('fingerprint_data', fingerprint_data)
        .limit(1)
        .single();
      
      if (matchError || !matchData) {
        return res.status(404).json({ error: 'Fingerprint not found. Please register fingerprint first.' });
      }

      const matchedEmployeeId = matchData.employee_id;
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('employee_id', matchedEmployeeId)
        .limit(1)
        .single();
      
      if (empError || !empData) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      employee = empData;
    }

    await processAttendanceMark(employee.employee_id, employee.name, today, currentTime, res, attendance_type);
  } catch (err) {
    return res.status(500).json({ error: 'Database error' });
  }
});

// Helper function to process attendance mark
async function processAttendanceMark(employeeId, employeeName, date, time, res, requestedType) {
  try {
    // Check if attendance record exists for today
    const { data: existingRecords, error: existingError } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('attendance_date', date)
      .limit(1)
      .single();
    
    const existing = existingError || !existingRecords ? null : existingRecords;

    // If explicit type requested (check-in or check-out)
    if (requestedType === 'check-in') {
      if (!existing) {
        // First check-in of the day
        const { error: insertError } = await supabase
          .from('attendance')
          .insert({
            employee_id: employeeId,
            attendance_date: date,
            check_in_time: time,
            status: 'present',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (insertError) {
          console.error('Supabase error inserting attendance:', insertError);
          return res.status(500).json({ error: 'Failed to record attendance' });
        }
        
        res.json({
          message: 'Check-in recorded successfully',
          employee_name: employeeName,
          check_in_time: time,
          attendance_date: date,
          attendance_type: 'check-in',
          time: time
        });
      } else if (existing.check_in_time && !existing.check_out_time) {
        return res.status(400).json({ error: 'Employee already checked in today. Please check out first.' });
      } else if (existing.check_out_time) {
        return res.status(400).json({ error: 'Employee already completed attendance for today.' });
      } else {
        // Update check-in time
        const { error: updateError } = await supabase
          .from('attendance')
          .update({ check_in_time: time, updated_at: new Date().toISOString() })
          .eq('employee_id', employeeId)
          .eq('attendance_date', date);
        
        if (updateError) {
          console.error('Supabase error updating attendance:', updateError);
          return res.status(500).json({ error: 'Failed to update attendance' });
        }
        res.json({
          message: 'Check-in updated successfully',
          employee_name: employeeName,
          check_in_time: time,
          attendance_date: date,
          attendance_type: 'check-in',
          time: time
        });
      }
    } else if (requestedType === 'check-out') {
      if (!existing || !existing.check_in_time) {
        return res.status(400).json({ error: 'Employee must check in first before checking out.' });
      } else if (existing.check_out_time) {
        return res.status(400).json({ error: 'Employee already checked out today.' });
      } else {
        // Check-out
        const checkInTime = existing.check_in_time;
        const [checkInHour, checkInMin] = checkInTime.split(':').map(Number);
        const [checkOutHour, checkOutMin] = time.split(':').map(Number);

        const checkInMinutes = checkInHour * 60 + checkInMin;
        const checkOutMinutes = checkOutHour * 60 + checkOutMin;
        let diffMinutes = checkOutMinutes - checkInMinutes;
        if (diffMinutes < 0) diffMinutes += 24 * 60;
        const totalHours = diffMinutes / 60;

        const { error: updateError } = await supabase
          .from('attendance')
          .update({ 
            check_out_time: time, 
            total_hours: totalHours, 
            updated_at: new Date().toISOString() 
          })
          .eq('employee_id', employeeId)
          .eq('attendance_date', date);
        
        if (updateError) {
          console.error('Supabase error updating attendance:', updateError);
          return res.status(500).json({ error: 'Failed to update attendance' });
        }
        res.json({
          message: 'Check-out recorded successfully',
          employee_name: employeeName,
          check_out_time: time,
          attendance_date: date,
          attendance_type: 'check-out',
          total_hours: totalHours.toFixed(2),
          time: time
        });
      }
    } else {
      // Auto-detect (original behavior)
      if (!existing) {
        // First check-in of the day
        const { error: insertError } = await supabase
          .from('attendance')
          .insert({
            employee_id: employeeId,
            attendance_date: date,
            check_in_time: time,
            status: 'present',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (insertError) {
          console.error('Supabase error inserting attendance:', insertError);
          return res.status(500).json({ error: 'Failed to record attendance' });
        }
        
        res.json({
          message: 'Check-in recorded successfully',
          employee_name: employeeName,
          check_in_time: time,
          attendance_date: date,
          attendance_type: 'check-in',
          time: time
        });
      } else if (!existing.check_out_time) {
        // Check-out
        const checkInTime = existing.check_in_time;
        const [checkInHour, checkInMin] = checkInTime.split(':').map(Number);
        const [checkOutHour, checkOutMin] = time.split(':').map(Number);

        const checkInMinutes = checkInHour * 60 + checkInMin;
        const checkOutMinutes = checkOutHour * 60 + checkOutMin;
        let diffMinutes = checkOutMinutes - checkInMinutes;
        if (diffMinutes < 0) diffMinutes += 24 * 60;
        const totalHours = diffMinutes / 60;

        const { error: updateError } = await supabase
          .from('attendance')
          .update({ 
            check_out_time: time, 
            total_hours: totalHours, 
            updated_at: new Date().toISOString() 
          })
          .eq('employee_id', employeeId)
          .eq('attendance_date', date);
        
        if (updateError) {
          console.error('Supabase error updating attendance:', updateError);
          return res.status(500).json({ error: 'Failed to update attendance' });
        }
        res.json({
          message: 'Check-out recorded successfully',
          employee_name: employeeName,
          check_out_time: time,
          attendance_date: date,
          attendance_type: 'check-out',
          total_hours: totalHours.toFixed(2),
          time: time
        });
      } else {
        // Already checked in and out
        res.json({
          message: 'Attendance already completed for today',
          employee_name: employeeName,
          check_in: existing.check_in_time,
          check_out: existing.check_out_time,
          total_hours: existing.total_hours
        });
      }
    }
  } catch (err) {
    return res.status(500).json({ error: 'Database error' });
  }
}

// Get attendance records
app.get('/api/attendance', authenticateToken, async (req, res) => {
  const { date, employee_id } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    let attendanceQuery = supabase
      .from('attendance')
      .select(`
        *,
        employees!inner(name)
      `)
      .eq('attendance_date', targetDate)
      .order('check_in_time', { ascending: false });

    if (employee_id) {
      attendanceQuery = attendanceQuery.eq('employee_id', employee_id);
    }

    const { data: attendanceRecords, error } = await attendanceQuery;

    if (error) {
      console.error('Supabase error fetching attendance:', error);
      return res.status(500).json({ error: 'Database error: ' + error.message });
    }

    // Fetch employee names for each attendance record
    const employeeIds = [...new Set((attendanceRecords || []).map(r => r.employee_id))];
    const { data: employees } = await supabase
      .from('employees')
      .select('employee_id, name')
      .in('employee_id', employeeIds);

    const employeeMap = {};
    (employees || []).forEach(emp => {
      employeeMap[emp.employee_id] = emp.name;
    });

    // Transform data to include employee_name
    const transformedRecords = (attendanceRecords || []).map(record => ({
      ...record,
      employee_name: employeeMap[record.employee_id] || null
    }));

    res.json(transformedRecords);
  } catch (err) {
    console.error('Error fetching attendance:', err);
    return res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// Update attendance
app.put('/api/attendance/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { check_in_time, check_out_time, status, remarks } = req.body;

  // Calculate total hours if both times provided
  let totalHours = 0;
  if (check_in_time && check_out_time) {
    const [inHour, inMin] = check_in_time.split(':').map(Number);
    const [outHour, outMin] = check_out_time.split(':').map(Number);
    const inMinutes = inHour * 60 + inMin;
    const outMinutes = outHour * 60 + outMin;
    let diffMinutes = outMinutes - inMinutes;
    if (diffMinutes < 0) diffMinutes += 24 * 60;
    totalHours = diffMinutes / 60;
  }

  try {
    const { data, error } = await supabase
      .from('attendance')
      .update({
        check_in_time: check_in_time || null,
        check_out_time: check_out_time || null,
        total_hours: totalHours,
        status: status || 'present',
        remarks: remarks || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('id');

    if (error) {
      console.error('Supabase error updating attendance:', error);
      return res.status(500).json({ error: 'Failed to update attendance' });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    res.json({ message: 'Attendance updated successfully' });
  } catch (err) {
    console.error('Error updating attendance:', err);
    return res.status(500).json({ error: 'Failed to update attendance' });
  }
});

// Leaves APIs

// Get leaves
app.get('/api/leaves', authenticateToken, async (req, res) => {
  const { status, employee_id } = req.query;
  let query = `
    SELECT l.*, e.name as employee_name
    FROM leaves l
    LEFT JOIN employees e ON l.employee_id = e.employee_id
    WHERE 1=1
  `;
  let params = [];
  let paramIndex = 1;

  if (status) {
    query += ` AND l.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }
  if (employee_id) {
    query += ` AND l.employee_id = $${paramIndex}`;
    params.push(employee_id);
    paramIndex++;
  }

  query += ' ORDER BY l.start_date DESC';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Database error' });
  }
});

// Create leave
app.post('/api/leaves', authenticateToken, async (req, res) => {
  const { employee_id, leave_type, start_date, end_date, total_days, reason } = req.body;

  if (!employee_id || !leave_type || !start_date || !end_date || !total_days) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO leaves (employee_id, leave_type, start_date, end_date, total_days, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING id`,
      [employee_id, leave_type, start_date, end_date, total_days, reason || null]
    );
    res.json({ message: 'Leave applied successfully', id: result.rows[0].id });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create leave: ' + err.message });
  }
});

// Approve leave
app.post('/api/leaves/:id/approve', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const result = await pool.query(
      `UPDATE leaves SET status = 'approved', approved_by = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [user.username, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Leave not found' });
    res.json({ message: 'Leave approved successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to approve leave' });
  }
});

// Reject leave
app.post('/api/leaves/:id/reject', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const result = await pool.query(
      `UPDATE leaves SET status = 'rejected', approved_by = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [user.username, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Leave not found' });
    res.json({ message: 'Leave rejected' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reject leave' });
  }
});

// Short Leaves APIs

// Get short leaves
app.get('/api/short-leaves', authenticateToken, async (req, res) => {
  const { date, status } = req.query;
  let query = `
    SELECT sl.*, e.name as employee_name
    FROM short_leaves sl
    LEFT JOIN employees e ON sl.employee_id = e.employee_id
    WHERE 1=1
  `;
  let params = [];
  let paramIndex = 1;

  if (date) {
    query += ` AND sl.leave_date = $${paramIndex}`;
    params.push(date);
    paramIndex++;
  }
  if (status) {
    query += ` AND sl.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  query += ' ORDER BY sl.leave_date DESC, sl.leave_time DESC';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Database error' });
  }
});

// Create short leave
app.post('/api/short-leaves', authenticateToken, async (req, res) => {
  const { employee_id, leave_date, leave_time, return_time, duration_hours, reason } = req.body;

  if (!employee_id || !leave_date || !leave_time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO short_leaves (employee_id, leave_date, leave_time, return_time, duration_hours, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING id`,
      [employee_id, leave_date, leave_time, return_time || null, duration_hours || 0, reason || null]
    );
    res.json({ message: 'Short leave applied successfully', id: result.rows[0].id });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create short leave: ' + err.message });
  }
});

// Approve short leave
app.post('/api/short-leaves/:id/approve', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const result = await pool.query(
      `UPDATE short_leaves SET status = 'approved', approved_by = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [user.username, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Short leave not found' });
    res.json({ message: 'Short leave approved successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to approve short leave' });
  }
});

// Reject short leave
app.post('/api/short-leaves/:id/reject', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const result = await pool.query(
      `UPDATE short_leaves SET status = 'rejected', approved_by = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [user.username, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Short leave not found' });
    res.json({ message: 'Short leave rejected' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reject short leave' });
  }
});

// ==================== RETURN SCAN APIs ====================

// Scan tracking ID for return
app.post('/api/return-scan', authenticateToken, async (req, res) => {
  const { tracking_id } = req.body;
  
  if (!tracking_id) {
    return res.status(400).json({ error: 'Tracking ID is required' });
  }
  
  try {
    // First check if this tracking ID exists in orders
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('tracking_id', tracking_id)
      .limit(1)
      .single();
    
    const order = orderError || !orderData ? null : orderData;
    
    // Check if already scanned today
    const today = new Date().toISOString().split('T')[0];
    const { data: existingScans, error: scanCheckError } = await supabase
      .from('return_scans')
      .select('*')
      .eq('tracking_id', tracking_id)
      .eq('scan_date', today)
      .limit(1)
      .single();
    
    const existingScan = scanCheckError || !existingScans ? null : existingScans;
    
    if (existingScan) {
      return res.json({ 
        success: false, 
        message: 'Already scanned today',
        scan: existingScan,
        order: order || null
      });
    }
    
    // Insert new scan
    const now = new Date();
    const scanDate = now.toISOString().split('T')[0];
    const scanTime = now.toTimeString().split(' ')[0];
    
    const { data: insertData, error: insertError } = await supabase
      .from('return_scans')
      .insert({
        tracking_id: tracking_id,
        order_number: order ? order.order_number : null,
        seller_name: order ? order.seller_name : 'Unknown',
        customer_name: order ? order.customer_name : 'Unknown',
        status: 'scanned',
        scan_date: scanDate,
        scan_time: scanTime,
        scanned_by: req.user.username
      })
      .select('id')
      .single();
    
    if (insertError) {
      console.error('Supabase error inserting return scan:', insertError);
      return res.status(500).json({ error: 'Failed to save scan' });
    }
    
    res.json({
      success: true,
      message: order ? 'Tracking ID scanned successfully' : 'Tracking ID scanned (not found in orders)',
      scan_id: insertData.id,
      order: order || null,
      scan: {
        id: insertData.id,
        tracking_id: tracking_id,
        order_number: order ? order.order_number : null,
        seller_name: order ? order.seller_name : 'Unknown',
        customer_name: order ? order.customer_name : 'Unknown',
        status: 'scanned',
        scan_date: scanDate,
        scan_time: scanTime
      }
    });
  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Get all scanned returns
app.get('/api/return-scans', authenticateToken, async (req, res) => {
  const { date, seller_name } = req.query;
  
  try {
    let query = supabase
      .from('return_scans')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (date) {
      query = query.eq('scan_date', date);
    }
    
    if (seller_name) {
      query = query.ilike('seller_name', seller_name);
    } else if (req.user.role === 'seller') {
      query = query.ilike('seller_name', req.user.username);
    }
    
    const { data: scans, error } = await query;
    
    if (error) {
      console.error('Supabase error fetching return scans:', error);
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(scans || []);
  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Delete scanned return
app.delete('/api/return-scans/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    const { error: deleteError } = await supabase
      .from('return_scans')
      .delete()
      .eq('id', id);
    
    if (deleteError) {
      console.error('Supabase error deleting return scan:', deleteError);
      return res.status(500).json({ error: 'Failed to delete scan' });
    }
    
    res.json({ success: true, message: 'Scan deleted' });
  } catch (err) {
    console.error('Delete error:', err);
    return res.status(500).json({ error: 'Failed to delete scan' });
  }
});

// Clear all scans for a date
app.delete('/api/return-scans/clear/:date', authenticateToken, async (req, res) => {
  const { date } = req.params;
  
  try {
    const { error: deleteError } = await supabase
      .from('return_scans')
      .delete()
      .eq('scan_date', date);
    
    if (deleteError) {
      console.error('Supabase error clearing return scans:', deleteError);
      return res.status(500).json({ error: 'Failed to clear scans' });
    }
    
    res.json({ success: true, message: `Cleared scans for ${date}` });
  } catch (err) {
    console.error('Clear error:', err);
    return res.status(500).json({ error: 'Failed to clear scans' });
  }
});

// Export for Vercel serverless functions
module.exports = app;

// Only listen if not in Vercel environment
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

