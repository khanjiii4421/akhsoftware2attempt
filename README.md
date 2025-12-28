# Order Management System

A comprehensive web application for managing orders with admin and seller functionality, built with HTML, CSS, and JavaScript.

## Features

### Authentication
- Admin login
- Seller login/creation
- Role-based access control

### Orders Management
- Create, edit, delete orders
- Automatic shipper price calculation based on products
- Profit calculation (Seller Price - DC - Shipper Price)
- Status tracking (Pending, Delivered, Return, Cancel)
- Paid/Unpaid tracking
- Filter by seller, status, and payment status
- Search by order number, seller, customer, phone, or tracking ID
- Scan return functionality
- Bulk upload/download orders
- WhatsApp and call integration

### Dashboard
- Total orders, delivered, returns, and paid counts
- Financial metrics (Seller Price, Shipper Price, DC, Profit, Admin Profit)
- Top products graph
- Top cities graph
- Delivered vs Returns KPI graph
- Sales trends (daily, weekly, monthly)
- Seller-wise filtering

### Products Management
- Add/edit products with seller name and price
- Bulk upload products
- Automatic shipper price calculation from product prices

### Seller Management (Admin Only)
- Create sellers
- Block sellers for a specific duration
- Delete sellers

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## Default Login

- **Username:** admin
- **Password:** admin123

**Important:** Change the default password in production!

## API Endpoints

### Authentication
- `POST /api/login` - Login
- `POST /api/create-seller` - Create seller (Admin only)

### Orders
- `GET /api/orders` - Get orders (with filters)
- `POST /api/orders` - Create order
- `PUT /api/orders/:id` - Update order
- `DELETE /api/orders/:id` - Delete order
- `POST /api/orders/scan-return` - Scan return
- `GET /api/orders/search` - Search orders
- `POST /api/orders/bulk` - Bulk upload orders
- `GET /api/orders/download` - Download orders

### Products
- `GET /api/products` - Get products
- `POST /api/products` - Add/update product
- `POST /api/products/bulk` - Bulk upload products

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/top-products` - Get top products
- `GET /api/dashboard/top-cities` - Get top cities
- `GET /api/dashboard/seller-stats` - Get seller-wise stats
- `GET /api/dashboard/sales-trends` - Get sales trends

### Sellers (Admin only)
- `GET /api/sellers` - Get all sellers
- `POST /api/block-seller` - Block seller
- `POST /api/unblock-seller` - Unblock seller
- `DELETE /api/delete-seller/:id` - Delete seller

## Product Price Calculation Logic

Products are stored with seller name and price. When creating an order:
1. Products are entered as comma-separated values (e.g., "ks1,ks1" or "pk1,ks1")
2. System looks up each product price from the products table
3. Shipper price = sum of all product prices
4. Profit = Seller Price - DC - Shipper Price

## Bulk Upload Format

### Orders JSON Format:
```json
[
  {
    "order_number": "ORD001",
    "seller_name": "seller1",
    "customer_name": "John Doe",
    "customer_address": "123 Main St",
    "city": "Islamabad",
    "phone1": "03001234567",
    "phone2": "",
    "seller_price": 5000,
    "dc": 200,
    "products": "ks1,pk1"
  }
]
```

### Products JSON Format:
```json
[
  {
    "seller_name": "seller1",
    "product_name": "ks1",
    "price": 1200
  }
]
```

## Notes

- The application uses local caching for fast data loading
- The UI is optimized for fast data processing
- All calculations are done automatically

## Technology Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express
- **Database:** Supabase (PostgreSQL)
- **Charts:** Chart.js

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
PORT=3000
JWT_SECRET=your-strong-random-secret-key-change-in-production
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Important:** Never commit the `.env` file to Git. It's already in `.gitignore`.

## Deployment

### 🤖 Automated Deployment (Recommended)

**Quick Start:**
1. Install Git (if not installed): https://git-scm.com/download/win
2. Run automated script:
   ```powershell
   .\auto-deploy.ps1
   ```
3. Follow the instructions shown by the script
4. Deploy on Vercel (Backend) and Netlify (Frontend)

**For complete automated deployment guide:** See [AUTO_DEPLOY_INSTRUCTIONS.md](./AUTO_DEPLOY_INSTRUCTIONS.md)

### 🚀 Manual Deployment

#### Vercel (Backend) + Netlify (Frontend) - Lifetime Free!

This application is configured for:
- **Backend:** Vercel (serverless functions)
- **Frontend:** Netlify (static hosting)
- **Database:** Supabase (already configured)

**Quick Deploy Steps:**

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
   git push -u origin main
   ```

2. **Deploy Backend on Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with GitHub
   - Import your repository
   - Set environment variables (see below)
   - Deploy!

3. **Deploy Frontend on Netlify:**
   - Go to [netlify.com](https://netlify.com)
   - Sign up with GitHub
   - Import your repository
   - Build settings: Publish directory = `public`
   - Set `NETLIFY_API_URL` = `https://your-vercel-url.vercel.app/api`
   - Deploy!

**Auto-Deployment:**
- Both Vercel and Netlify automatically deploy on every push to `main` branch
- No manual deployment needed!
- **Lifetime free hosting** - No 90-day limit!

**For detailed step-by-step instructions:**
- Quick guide: [QUICK_DEPLOY_VERCEL_NETLIFY.md](./QUICK_DEPLOY_VERCEL_NETLIFY.md)
- Complete guide: [VERCEL_NETLIFY_DEPLOYMENT.md](./VERCEL_NETLIFY_DEPLOYMENT.md)
- Automated setup: [AUTO_DEPLOY_INSTRUCTIONS.md](./AUTO_DEPLOY_INSTRUCTIONS.md)

## Database Setup

Before running the application, ensure your Supabase database has all required tables. Run the SQL script from `supabase_schema.sql` in your Supabase SQL Editor.

