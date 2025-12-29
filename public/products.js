// Products Management
let productsCache = [];
let sellersList = [];

// Load products on page load
window.addEventListener('DOMContentLoaded', async () => {
    await loadSellers();
    await loadProducts();
});

// Load sellers
async function loadSellers() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (user.role === 'admin') {
        const response = await fetchWithAuth(`${API_BASE}/sellers`);
        if (response) {
            const sellers = await response.json();
            sellersList = sellers;
            
            // Populate filter dropdown
            const sellerFilter = document.getElementById('sellerFilter');
            if (sellerFilter) {
                sellerFilter.innerHTML = '<option value="">All Sellers</option>';
                sellers.forEach(seller => {
                    const option = document.createElement('option');
                    option.value = seller.username;
                    option.textContent = seller.username;
                    sellerFilter.appendChild(option);
                });
            }
            
            // Populate form dropdown
            populateSellerDropdown(sellers);
        }
    } else {
        // For sellers, only show their own name
        populateSellerDropdown([{ username: user.username }]);
    }
}

// Populate seller dropdown in form
function populateSellerDropdown(sellers) {
    const sellerDropdown = document.getElementById('productSellerName');
    if (sellerDropdown) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        // Keep the first option (Select Seller)
        sellerDropdown.innerHTML = '<option value="">Select Seller</option>';
        sellers.forEach(seller => {
            const option = document.createElement('option');
            option.value = seller.username;
            option.textContent = seller.username;
            sellerDropdown.appendChild(option);
        });
        
        // For sellers (non-admin), auto-select their name and disable dropdown
        if (user.role === 'seller' && sellers.length === 1) {
            sellerDropdown.value = user.username;
            sellerDropdown.disabled = true;
        } else {
            sellerDropdown.disabled = false;
        }
    }
}

// Load products
async function loadProducts() {
    const sellerFilter = document.getElementById('sellerFilter')?.value || '';
    let url = `${API_BASE}/products`;
    if (sellerFilter) url += `?seller_name=${sellerFilter}`;
    
    // Show loading state
    const tbody = document.getElementById('productsTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading">Loading products...</td></tr>';
    }
    
    const response = await fetchWithAuth(url);
    if (response) {
        const products = await response.json();
        productsCache = products;
        displayProducts(products);
    }
}

// Display products in table (optimized for fast rendering)
function displayProducts(products) {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;
    
    // Show loading state
    tbody.innerHTML = '<tr><td colspan="4" class="loading">Loading products...</td></tr>';
    
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading">No products found</td></tr>';
        return;
    }
    
    // Use requestAnimationFrame for smooth rendering
    requestAnimationFrame(() => {
        // Build HTML string first (much faster than DOM manipulation)
        const rowsHTML = products.map(product => {
            return `
                <tr>
                    <td>${escapeHtml(product.seller_name)}</td>
                    <td>${escapeHtml(product.product_name)}</td>
                    <td>${parseFloat(product.price).toFixed(2)}</td>
                    <td class="action-buttons">
                        <button onclick="editProduct(${product.id})" class="btn-primary" style="padding: 5px 10px; font-size: 11px;">Edit</button>
                        <button onclick="deleteProduct(${product.id})" class="btn-danger" style="padding: 5px 10px; font-size: 11px;">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Insert all rows at once (single DOM operation)
        tbody.innerHTML = rowsHTML;
    });
}

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Open add product modal
function openAddProductModal() {
    document.getElementById('productForm').reset();
    document.getElementById('productForm').removeAttribute('data-product-id');
    document.getElementById('productModalTitle').textContent = 'Add Product';
    // Ensure seller dropdown is populated
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role === 'admin' && sellersList.length > 0) {
        populateSellerDropdown(sellersList);
    } else if (user.role === 'seller') {
        populateSellerDropdown([{ username: user.username }]);
    }
    document.getElementById('productModal').style.display = 'block';
}

// Close product modal
function closeProductModal() {
    document.getElementById('productModal').style.display = 'none';
}

// Edit product
function editProduct(id) {
    const product = productsCache.find(p => p.id === id);
    if (!product) return;
    
    // Ensure seller dropdown is populated before setting value
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role === 'admin' && sellersList.length > 0) {
        populateSellerDropdown(sellersList);
    } else if (user.role === 'seller') {
        populateSellerDropdown([{ username: user.username }]);
    }
    
    // Set values after dropdown is populated
    setTimeout(() => {
        const sellerSelect = document.getElementById('productSellerName');
        // Find matching option (case-insensitive)
        const options = sellerSelect.options;
        for (let i = 0; i < options.length; i++) {
            if (options[i].value.toLowerCase() === product.seller_name.toLowerCase()) {
                sellerSelect.selectedIndex = i;
                break;
            }
        }
        // If not found, add it as a new option (for edge cases)
        if (sellerSelect.value === '') {
            const option = document.createElement('option');
            option.value = product.seller_name;
            option.textContent = product.seller_name;
            sellerSelect.appendChild(option);
            sellerSelect.value = product.seller_name;
        }
        
        document.getElementById('productName').value = product.product_name;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productForm').setAttribute('data-product-id', id);
        document.getElementById('productModalTitle').textContent = 'Edit Product';
    }, 10);
    
    document.getElementById('productModal').style.display = 'block';
}

// Save product
document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const productId = document.getElementById('productForm').getAttribute('data-product-id');
    const productData = {
        seller_name: document.getElementById('productSellerName').value,
        product_name: document.getElementById('productName').value,
        price: document.getElementById('productPrice').value
    };
    
    const response = await fetchWithAuth(`${API_BASE}/products`, {
        method: 'POST',
        body: JSON.stringify(productData)
    });
    
    if (response) {
        const data = await response.json();
        if (response.ok) {
            closeProductModal();
            document.getElementById('productForm').removeAttribute('data-product-id');
            loadProducts();
        } else {
            alert(data.error || 'Failed to save product');
        }
    }
});

// Delete product
async function deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    const response = await fetchWithAuth(`${API_BASE}/products/${id}`, {
        method: 'DELETE'
    });
    
    if (response) {
        const data = await response.json();
        if (response.ok) {
            alert('Product deleted successfully');
            loadProducts();
        } else {
            alert(data.error || 'Failed to delete product');
        }
    }
}

// Bulk upload
function openBulkUploadModal() {
    document.getElementById('bulkUploadModal').style.display = 'block';
}

function closeBulkUploadModal() {
    document.getElementById('bulkUploadModal').style.display = 'none';
    document.getElementById('bulkFileInput').value = '';
}

async function processBulkUpload() {
    const fileInput = document.getElementById('bulkFileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a file');
        return;
    }
    
    // Disable upload button to prevent double-clicking
    const uploadBtn = event.target;
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Processing...';
    
    try {
        // Load XLSX if not already loaded
        if (typeof XLSX === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        // Convert Excel data to product format with validation
        const products = jsonData
            .map(row => ({
                seller_name: (row['Seller Name'] || row['seller_name'] || '').toString().trim(),
                product_name: (row['Product Name'] || row['product_name'] || '').toString().trim(),
                price: parseFloat(row['Price'] || row['price'] || 0)
            }))
            .filter(product => product.seller_name && product.product_name && product.price > 0);
        
        if (products.length === 0) {
            alert('No valid products found in file. Please ensure the file has columns: Seller Name, Product Name, and Price');
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload';
            return;
        }
        
        console.log(`Uploading ${products.length} products...`);
        
        const response = await fetchWithAuth(`${API_BASE}/products/bulk`, {
            method: 'POST',
            body: JSON.stringify({ products })
        });
        
        if (response && response.ok) {
            const data = await response.json();
            alert(data.message || `Successfully uploaded ${data.count || products.length} products!`);
            closeBulkUploadModal();
            await loadProducts(); // Reload products to show new data
        } else if (response) {
            const data = await response.json();
            alert(`Error: ${data.error || 'Failed to upload products'}\n${data.details || ''}`);
        } else {
            alert('Network error. Please check your connection and try again.');
        }
    } catch (error) {
        console.error('Error processing bulk upload:', error);
        alert('Error reading file: ' + error.message);
    } finally {
        // Re-enable button
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload';
    }
}

// Close modals when clicking outside
window.onclick = function(event) {
    const modals = document.getElementsByClassName('modal');
    for (let modal of modals) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    }
}

