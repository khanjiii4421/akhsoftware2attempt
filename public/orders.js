// Orders Management
let ordersCache = [];
let sellersList = [];
let currentPage = 1;
let rowsPerPage = 50; // Limit rows per page for better performance

// Load orders on page load
window.addEventListener('DOMContentLoaded', async () => {
    await loadSellers();
    await loadOrders();
    
    // Show delete all orders button for admin
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const deleteAllBtn = document.getElementById('deleteAllOrdersBtn');
    if (deleteAllBtn && user.role === 'admin') {
        deleteAllBtn.style.display = 'inline-block';
    }
});

// Load sellers for filter and dropdown
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
            const sellerNameSelect = document.getElementById('sellerName');
            if (sellerNameSelect) {
                sellerNameSelect.innerHTML = '<option value="">Select Seller</option>';
                sellers.forEach(seller => {
                    const option = document.createElement('option');
                    option.value = seller.username;
                    option.textContent = seller.username;
                    sellerNameSelect.appendChild(option);
                });
            }
        }
    } else {
        // For sellers, set their own name
        const sellerNameSelect = document.getElementById('sellerName');
        if (sellerNameSelect) {
            sellerNameSelect.innerHTML = `<option value="${user.username}" selected>${user.username}</option>`;
            sellerNameSelect.disabled = true;
        }
    }
}

// Load orders
async function loadOrders() {
    const sellerFilter = document.getElementById('sellerFilter')?.value || '';
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    const paidFilter = document.getElementById('paidFilter')?.value || '';
    
    // Reset to first page when filters change
    currentPage = 1;
    
    // Show loading state only if table exists
    const tbody = document.getElementById('ordersTableBody');
    if (tbody && tbody.children.length === 0) {
        tbody.innerHTML = '<tr><td colspan="16" class="loading">Loading orders...</td></tr>';
    }
    
    let url = `${API_BASE}/orders?`;
    if (sellerFilter) url += `seller_name=${encodeURIComponent(sellerFilter)}&`;
    if (statusFilter) url += `status=${encodeURIComponent(statusFilter)}&`;
    if (paidFilter !== '') url += `shipper_paid=${encodeURIComponent(paidFilter)}&`;
    
    try {
        const response = await fetchWithAuth(url);
        if (response && response.ok) {
            const orders = await response.json();
            if (orders && Array.isArray(orders)) {
                ordersCache = orders;
                displayOrders(orders);
            } else {
                throw new Error('Invalid response format');
            }
        } else {
            const errorData = response ? await response.json().catch(() => ({})) : {};
            throw new Error(errorData.error || 'Failed to load orders');
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="16" class="loading">Error loading orders: ${error.message || 'Please try again.'}</td></tr>`;
        }
        // Clear pagination on error
        const paginationInfo = document.getElementById('paginationInfo');
        const paginationControls = document.getElementById('paginationControls');
        if (paginationInfo) paginationInfo.textContent = 'Error loading orders';
        if (paginationControls) paginationControls.innerHTML = '';
        ordersCache = [];
    }
}

// Display orders in table (optimized for fast rendering with pagination)
function displayOrders(orders) {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;
    
    // Check user role
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'admin';
    
    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="16" class="loading">No orders found</td></tr>';
        if (typeof updatePaginationInfo === 'function') {
            updatePaginationInfo(0, 0, 0);
        }
        const paginationControls = document.getElementById('paginationControls');
        if (paginationControls) {
            paginationControls.innerHTML = '';
        }
        return;
    }
    
    // Calculate pagination
    const totalPages = Math.ceil(orders.length / rowsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = totalPages;
    }
    
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedOrders = orders.slice(startIndex, endIndex);
    
    // Update pagination info
    if (typeof updatePaginationInfo === 'function') {
        updatePaginationInfo(orders.length, startIndex + 1, Math.min(endIndex, orders.length));
    }
    
    // Build HTML string first (much faster than DOM manipulation)
    // Use requestAnimationFrame for smooth rendering with batching
    requestAnimationFrame(() => {
        // Batch rendering for better performance
        const batchSize = 10;
        let currentIndex = 0;
        
        function renderBatch() {
            const endIndex = Math.min(currentIndex + batchSize, paginatedOrders.length);
            const batch = paginatedOrders.slice(currentIndex, endIndex);
            
            const rowsHTML = batch.map(order => {
            const phone1Escaped = (order.phone1 || '').replace(/'/g, "\\'");
            const orderNumEscaped = (order.order_number || '').replace(/'/g, "\\'");
            const customerEscaped = (order.customer_name || '').replace(/'/g, "\\'");
            const statusEscaped = (order.status || 'pending').replace(/'/g, "\\'");
                
                // Truncate long addresses and names for display
                const customerName = escapeHtml(order.customer_name || '');
                const address = escapeHtml(order.customer_address || '');
            
            return `
                <tr>
                        <td style="white-space: nowrap;">${escapeHtml(order.order_number)}</td>
                        <td style="white-space: nowrap;">${escapeHtml(order.seller_name)}</td>
                        <td title="${customerName}">${customerName}</td>
                        <td title="${address}">${address}</td>
                        <td style="white-space: nowrap;">${escapeHtml(order.city)}</td>
                        <td style="white-space: nowrap;">${escapeHtml(order.phone1)}</td>
                        <td style="white-space: nowrap;">${escapeHtml(order.phone2 || '-')}</td>
                        <td style="white-space: nowrap; max-width: 150px;">${escapeHtml(order.products)}</td>
                        <td style="white-space: nowrap; text-align: right;">${parseFloat(order.seller_price || 0).toFixed(2)}</td>
                        <td style="white-space: nowrap; text-align: right;">${parseFloat(order.dc || 0).toFixed(2)}</td>
                        <td style="white-space: nowrap; text-align: right;">${parseFloat(order.shipper_price || 0).toFixed(2)}</td>
                        <td style="white-space: nowrap; text-align: right;">${parseFloat(order.profit || 0).toFixed(2)}</td>
                        <td style="white-space: nowrap;">${escapeHtml(order.tracking_id || '-')}</td>
                    <td>
                        ${isAdmin ? `
                        <select onchange="updateOrderStatus(${order.id}, this.value, this)" class="status-select" style="padding: 5px; border-radius: 3px; border: 1px solid #ddd; background-color: ${order.status === 'delivered' ? '#28a745' : order.status === 'return' ? '#dc3545' : 'white'}; color: ${order.status === 'delivered' || order.status === 'return' ? 'white' : '#000'};">
                            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="delivered" style="background-color: #28a745; color: white;" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                            <option value="return" style="background-color: #dc3545; color: white;" ${order.status === 'return' ? 'selected' : ''}>Return</option>
                            <option value="cancel" ${order.status === 'cancel' ? 'selected' : ''}>Cancel</option>
                        </select>
                        ` : `<span class="status-badge status-${order.status}">${order.status.toUpperCase()}</span>`}
                    </td>
                    <td>
                        ${isAdmin ? `
                        <select onchange="updateOrderPaid(${order.id}, this.value)" style="padding: 5px; border-radius: 3px; border: 1px solid #ddd;">
                            <option value="0" ${order.shipper_paid == 0 ? 'selected' : ''}>Unpaid</option>
                            <option value="1" ${order.shipper_paid == 1 ? 'selected' : ''}>Paid</option>
                        </select>
                        ` : `<span>${order.shipper_paid == 1 ? 'Paid' : 'Unpaid'}</span>`}
                    </td>
                        <td class="action-buttons" style="white-space: nowrap;">
                        ${isAdmin ? `<button onclick="editOrder(${order.id})" style="padding: 5px 10px; font-size: 11px; border: 1px solid #ddd; background: white; color: #333; border-radius: 3px; cursor: pointer;">Edit</button>` : ''}
                        <button onclick="callCustomer('${phone1Escaped}')" style="padding: 5px 10px; font-size: 11px; border: 1px solid #ddd; background: white; color: #333; border-radius: 3px; cursor: pointer;">Call</button>
                        <button onclick="whatsappMsg('${phone1Escaped}', '${orderNumEscaped}', '${customerEscaped}', '${statusEscaped}')" style="padding: 5px 10px; font-size: 11px; border: 1px solid #ddd; background: white; color: #333; border-radius: 3px; cursor: pointer;">WhatsApp</button>
                        ${isAdmin ? `<button onclick="deleteOrder(${order.id})" class="btn-danger" style="padding: 5px 10px; font-size: 11px; background: #dc3545; color: white; border: 2px solid #dc3545; border-radius: 3px; cursor: pointer; font-weight: 600;">Delete</button>` : ''}
                    </td>
                </tr>
            `;
        }).join('');
        
            // Append batch to table
            if (currentIndex === 0) {
        tbody.innerHTML = rowsHTML;
            } else {
                tbody.insertAdjacentHTML('beforeend', rowsHTML);
            }
            
            currentIndex = endIndex;
            
            // Continue rendering if more items
            if (currentIndex < paginatedOrders.length) {
                requestAnimationFrame(renderBatch);
            } else {
                // Update pagination controls after all rows are rendered
        updatePaginationControls(orders.length);
            }
        }
        
        // Start rendering
        renderBatch();
    });
}

// Update pagination info display
function updatePaginationInfo(total, start, end) {
    const paginationInfo = document.getElementById('paginationInfo');
    if (paginationInfo) {
        if (total === 0) {
            paginationInfo.textContent = 'No orders found';
        } else {
            paginationInfo.textContent = `Showing ${start}-${end} of ${total} orders`;
        }
    }
}

// Update pagination controls
function updatePaginationControls(totalOrders) {
    const totalPages = Math.ceil(totalOrders / rowsPerPage);
    const paginationControls = document.getElementById('paginationControls');
    
    if (!paginationControls) return;
    
    if (totalPages <= 1) {
        paginationControls.innerHTML = '';
        return;
    }
    
    let controlsHTML = '<div style="display: flex; gap: 10px; align-items: center; justify-content: center; margin-top: 20px; flex-wrap: wrap;">';
    
    // Previous button
    controlsHTML += `<button onclick="changePage(${currentPage - 1})" class="btn-secondary" ${currentPage === 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} style="padding: 8px 15px; font-size: 14px;">Previous</button>`;
    
    // Page numbers (show max 5 pages)
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
        controlsHTML += `<button onclick="changePage(1)" class="btn-secondary" style="padding: 8px 12px; font-size: 14px;">1</button>`;
        if (startPage > 2) {
            controlsHTML += `<span style="padding: 8px;">...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        controlsHTML += `<button onclick="changePage(${i})" class="${i === currentPage ? 'btn-primary' : 'btn-secondary'}" style="padding: 8px 12px; font-size: 14px; min-width: 40px;">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            controlsHTML += `<span style="padding: 8px;">...</span>`;
        }
        controlsHTML += `<button onclick="changePage(${totalPages})" class="btn-secondary" style="padding: 8px 12px; font-size: 14px;">${totalPages}</button>`;
    }
    
    // Next button
    controlsHTML += `<button onclick="changePage(${currentPage + 1})" class="btn-secondary" ${currentPage === totalPages ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} style="padding: 8px 15px; font-size: 14px;">Next</button>`;
    
    // Rows per page selector
    controlsHTML += `<select onchange="changeRowsPerPage(this.value)" style="padding: 8px; border-radius: 5px; border: 2px solid #000; margin-left: 20px;">
        <option value="25" ${rowsPerPage === 25 ? 'selected' : ''}>25 per page</option>
        <option value="50" ${rowsPerPage === 50 ? 'selected' : ''}>50 per page</option>
        <option value="100" ${rowsPerPage === 100 ? 'selected' : ''}>100 per page</option>
        <option value="200" ${rowsPerPage === 200 ? 'selected' : ''}>200 per page</option>
    </select>`;
    
    controlsHTML += '</div>';
    paginationControls.innerHTML = controlsHTML;
}

// Change page
function changePage(page) {
    const totalPages = Math.ceil(ordersCache.length / rowsPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    displayOrders(ordersCache);
    
    // Scroll to top of table
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) {
        tableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Change rows per page
function changeRowsPerPage(rows) {
    rowsPerPage = parseInt(rows);
    currentPage = 1; // Reset to first page
    displayOrders(ordersCache);
}

// Helper function to escape HTML (optimized - no DOM manipulation)
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Search orders
let searchTimeout;
function searchOrders() {
    clearTimeout(searchTimeout);
    const query = document.getElementById('searchInput').value.trim();
    
    searchTimeout = setTimeout(async () => {
        if (query.length < 2) {
            currentPage = 1; // Reset to first page
            displayOrders(ordersCache);
            return;
        }
        
        currentPage = 1; // Reset to first page on search
        const response = await fetchWithAuth(`${API_BASE}/orders/search?query=${encodeURIComponent(query)}`);
        if (response) {
            const orders = await response.json();
            displayOrders(orders);
        }
    }, 300);
}

// Open add order modal
function openAddOrderModal() {
    document.getElementById('orderId').value = '';
    document.getElementById('orderForm').reset();
    document.getElementById('modalTitle').textContent = 'Add Order';
    document.getElementById('orderModal').style.display = 'block';
}

// Close order modal
function closeOrderModal() {
    document.getElementById('orderModal').style.display = 'none';
}

// Edit order
function editOrder(id) {
    const order = ordersCache.find(o => o.id === id);
    if (!order) return;
    
    document.getElementById('orderId').value = order.id;
    document.getElementById('orderNumber').value = order.order_number;
    document.getElementById('sellerName').value = order.seller_name;
    document.getElementById('customerName').value = order.customer_name;
    document.getElementById('customerAddress').value = order.customer_address;
    document.getElementById('city').value = order.city;
    document.getElementById('phone1').value = order.phone1;
    document.getElementById('phone2').value = order.phone2 || '';
    document.getElementById('products').value = order.products;
    document.getElementById('sellerPrice').value = order.seller_price;
    document.getElementById('dc').value = order.dc;
    document.getElementById('trackingId').value = order.tracking_id || '';
    document.getElementById('status').value = order.status;
    document.getElementById('shipperPaid').value = order.shipper_paid;
    
    document.getElementById('modalTitle').textContent = 'Edit Order';
    document.getElementById('orderModal').style.display = 'block';
}

// Save order
document.getElementById('orderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const orderId = document.getElementById('orderId').value;
    const orderData = {
        order_number: document.getElementById('orderNumber').value,
        seller_name: document.getElementById('sellerName').value,
        customer_name: document.getElementById('customerName').value,
        customer_address: document.getElementById('customerAddress').value,
        city: document.getElementById('city').value,
        phone1: document.getElementById('phone1').value,
        phone2: document.getElementById('phone2').value,
        products: document.getElementById('products').value,
        seller_price: document.getElementById('sellerPrice').value,
        dc: document.getElementById('dc').value || 0,
        tracking_id: document.getElementById('trackingId').value,
        status: document.getElementById('status').value,
        shipper_paid: document.getElementById('shipperPaid').value
    };
    
    let response;
    if (orderId) {
        // Update
        response = await fetchWithAuth(`${API_BASE}/orders/${orderId}`, {
            method: 'PUT',
            body: JSON.stringify(orderData)
        });
    } else {
        // Create
        response = await fetchWithAuth(`${API_BASE}/orders`, {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
    }
    
    if (response) {
        const data = await response.json();
        if (response.ok) {
            closeOrderModal();
            loadOrders();
        } else {
            alert(data.error || 'Failed to save order');
        }
    }
});

// Delete order
async function deleteOrder(id) {
    if (!confirm('Are you sure you want to delete this order?')) return;
    
    const response = await fetchWithAuth(`${API_BASE}/orders/${id}`, {
        method: 'DELETE'
    });
    
    if (response) {
        const data = await response.json();
        if (response.ok) {
            loadOrders();
        } else {
            alert(data.error || 'Failed to delete order');
        }
    }
}

// Call customer
function callCustomer(phone) {
    window.location.href = `tel:${phone}`;
}

// WhatsApp message
function whatsappMsg(phone, orderNumber, customerName, status) {
    const statusText = status === 'pending' ? 'dispatched' : status;
    const message = `AOA sir ${customerName}, your order ${orderNumber} is ${statusText}`;
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
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
        
        // Convert Excel data to order format
        const orders = jsonData.map(row => {
            const trackingId = row['Tracking ID'] || row['tracking_id'] || row['TrackingId'] || '';
            const orderData = {
                order_number: row['Order Number'] || row['order_number'] || '',
                seller_name: row['Seller Name'] || row['seller_name'] || '',
                customer_name: row['Customer Name'] || row['customer_name'] || '',
                customer_address: row['Address'] || row['address'] || row['Customer Address'] || '',
                city: row['City'] || row['city'] || '',
                phone1: String(row['Phone 1'] || row['phone1'] || row['Phone1'] || ''),
                phone2: String(row['Phone 2'] || row['phone2'] || row['Phone2'] || ''),
                seller_price: parseFloat(row['Seller Price'] || row['seller_price'] || 0),
                dc: parseFloat(row['DC'] || row['dc'] || 0),
                products: String(row['Products'] || row['products'] || ''),
                tracking_id: trackingId ? String(trackingId).trim() : ''
            };
            return orderData;
        });
        
        if (orders.length === 0) {
            alert('No orders found in file');
            return;
        }
        
        // Debug: Check if tracking IDs are being read
        const ordersWithTracking = orders.filter(o => o.tracking_id && o.tracking_id.trim());
        if (ordersWithTracking.length > 0) {
            console.log(`Found ${ordersWithTracking.length} orders with tracking IDs`);
        }
        
        // Show progress for large uploads (up to 10000 orders in one go)
        const totalOrders = orders.length;
        if (totalOrders > 1000) {
            const proceed = confirm(`You are about to upload ${totalOrders} orders in one go. This may take a few moments. Continue?`);
            if (!proceed) return;
        }
        
        // Show loading indicator
        const loadingDiv = document.getElementById('bulkUploadLoading');
        const loadingText = document.getElementById('loadingText');
        const loadingProgress = document.getElementById('loadingProgress');
        const uploadBtn = document.getElementById('bulkUploadBtn');
        
        loadingDiv.style.display = 'block';
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';
        loadingText.textContent = `⚡ Processing ${totalOrders} orders...`;
        loadingProgress.textContent = '⏳ Please wait, uploading to database at high speed...';
        
        // Upload all orders at once (up to 10000 orders in one request)
        console.log(`Uploading ${totalOrders} orders in one request...`);
        
        const startTime = Date.now();
        
        const response = await fetchWithAuth(`${API_BASE}/orders/bulk`, {
            method: 'POST',
            body: JSON.stringify({ orders })
        });
        
        if (!response) {
            alert('Authentication failed. Please login again.');
            return;
        }
        
        // Check if response is ok
        if (!response.ok) {
            let errorMessage = 'Failed to upload orders';
            try {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } else {
                    if (response.status === 413) {
                        errorMessage = 'File too large. Server limit reached. Please contact administrator.';
                    } else if (response.status === 403) {
                        errorMessage = 'Admin access required. Only admins can upload orders.';
                    } else if (response.status === 401) {
                        errorMessage = 'Authentication failed. Please login again.';
                    } else {
                        errorMessage = `Server error (${response.status}). Please try again.`;
                    }
                }
            } catch (e) {
                if (response.status === 413) {
                    errorMessage = 'File too large. Server limit reached. Please contact administrator.';
                } else if (response.status === 403) {
                    errorMessage = 'Admin access required. Only admins can upload orders.';
                } else if (response.status === 401) {
                    errorMessage = 'Authentication failed. Please login again.';
                }
            }
            // Hide loading indicator on error
            const loadingDiv = document.getElementById('bulkUploadLoading');
            const uploadBtn = document.getElementById('bulkUploadBtn');
            if (loadingDiv) loadingDiv.style.display = 'none';
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload';
            }
            
            alert(errorMessage);
            return;
        }
        
        // Parse JSON response
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            // Hide loading indicator on error
            const loadingDiv = document.getElementById('bulkUploadLoading');
            const uploadBtn = document.getElementById('bulkUploadBtn');
            if (loadingDiv) loadingDiv.style.display = 'none';
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload';
            }
            
            alert('Server returned invalid response. Please try again.');
            return;
        }
        
        const data = await response.json();
        const endTime = Date.now();
        const processingTime = ((endTime - startTime) / 1000).toFixed(2);
        
        // Hide loading indicator
        loadingDiv.style.display = 'none';
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload';
        
        // Show success message with error details if any
        let message = `✅ Bulk upload completed!\n\nProcessed: ${totalOrders} order(s)\nTime: ${processingTime} seconds\nSpeed: ${(totalOrders / parseFloat(processingTime)).toFixed(0)} orders/second`;
        if (data.errors && data.errors.length > 0) {
            message += `\n\n⚠️ Note: ${data.errors.length} order(s) had errors.`;
            console.log('Upload errors:', data.errors);
        }
        
        alert(message);
        closeBulkUploadModal();
        loadOrders();
    } catch (error) {
        console.error('Bulk upload error:', error);
        
        // Hide loading indicator on error
        const loadingDiv = document.getElementById('bulkUploadLoading');
        const uploadBtn = document.getElementById('bulkUploadBtn');
        if (loadingDiv) loadingDiv.style.display = 'none';
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload';
        }
        
        if (error.message.includes('JSON')) {
            alert('Error: Server returned invalid response. Please check your authentication and try again.');
        } else {
            alert('Error reading file: ' + error.message);
        }
    }
}

// Update order status
async function updateOrderStatus(orderId, status, selectElement) {
    // Update dropdown color based on status
    if (selectElement) {
        if (status === 'delivered') {
            selectElement.style.backgroundColor = '#28a745';
            selectElement.style.color = 'white';
        } else if (status === 'return') {
            selectElement.style.backgroundColor = '#dc3545';
            selectElement.style.color = 'white';
        } else {
            selectElement.style.backgroundColor = 'white';
            selectElement.style.color = '#000';
        }
    }
    
    const order = ordersCache.find(o => o.id === orderId);
    if (!order) return;
    
    const response = await fetchWithAuth(`${API_BASE}/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({ status })
    });
    
    if (response) {
        const data = await response.json();
        if (response.ok) {
            loadOrders();
        } else {
            alert(data.error || 'Failed to update status');
        }
    }
}

// Update order paid status
async function updateOrderPaid(orderId, paid) {
    const order = ordersCache.find(o => o.id === orderId);
    if (!order) return;
    
    const response = await fetchWithAuth(`${API_BASE}/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({ shipper_paid: parseInt(paid) })
    });
    
    if (response) {
        const data = await response.json();
        if (response.ok) {
            loadOrders();
        } else {
            alert(data.error || 'Failed to update paid status');
        }
    }
}

// Scan return - Mark order as return by tracking ID
async function scanReturn() {
    const trackingIdInput = document.getElementById('returnScanInput');
    const resultDiv = document.getElementById('returnScanResult');
    
    if (!trackingIdInput || !resultDiv) return;
    
    const trackingId = trackingIdInput.value.trim();
    
    if (!trackingId) {
        alert('Please enter a tracking ID');
        return;
    }
    
    try {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<p style="color: #666;">Processing...</p>';
        
        const response = await fetchWithAuth(`${API_BASE}/orders/bulk-scan-return`, {
            method: 'POST',
            body: JSON.stringify({
                tracking_ids: [trackingId]
            })
        });
        
        if (!response) {
            resultDiv.innerHTML = '<p style="color: #dc3545;">❌ Failed to connect to server. Please check your authentication.</p>';
            return;
        }
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Server returned non-JSON response. Status:', response.status);
            console.error('Response text (first 500 chars):', text.substring(0, 500));
            
            if (response.status === 404) {
                resultDiv.innerHTML = `
                    <div style="background: #f8d7da; border: 2px solid #dc3545; border-radius: 8px; padding: 15px; color: #721c24;">
                        <strong>❌ Error:</strong> Endpoint not found. Please make sure server is restarted.
                    </div>
                `;
            } else if (response.status === 401 || response.status === 403) {
                resultDiv.innerHTML = `
                    <div style="background: #f8d7da; border: 2px solid #dc3545; border-radius: 8px; padding: 15px; color: #721c24;">
                        <strong>❌ Error:</strong> Authentication failed. Please login again.
                    </div>
                `;
            } else {
                resultDiv.innerHTML = `
                    <div style="background: #f8d7da; border: 2px solid #dc3545; border-radius: 8px; padding: 15px; color: #721c24;">
                        <strong>❌ Server Error (Status ${response.status}):</strong> Received invalid response. Please check if server is running and restarted.
                    </div>
                `;
            }
            return;
        }
        
        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error('Error parsing JSON response:', parseError);
            resultDiv.innerHTML = `
                <div style="background: #f8d7da; border: 2px solid #dc3545; border-radius: 8px; padding: 15px; color: #721c24;">
                    <strong>❌ Error:</strong> Server returned invalid response. Please check if server is running and restarted.
                </div>
            `;
            return;
        }
        
        if (response.ok) {
            if (data.updated_count > 0) {
                resultDiv.innerHTML = `
                    <div style="background: #d4edda; border: 2px solid #28a745; border-radius: 8px; padding: 15px; color: #155724;">
                        <strong>✅ Success!</strong> Order with tracking ID <strong>${escapeHtml(trackingId)}</strong> has been marked as return.
                    </div>
                `;
                trackingIdInput.value = '';
                trackingIdInput.focus();
                loadOrders(); // Refresh orders table
            } else {
                resultDiv.innerHTML = `
                    <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 15px; color: #856404;">
                        <strong>⚠️ Not Found</strong> No order found with tracking ID <strong>${escapeHtml(trackingId)}</strong>
                    </div>
                `;
            }
        } else {
            resultDiv.innerHTML = `
                <div style="background: #f8d7da; border: 2px solid #dc3545; border-radius: 8px; padding: 15px; color: #721c24;">
                    <strong>❌ Error:</strong> ${data.error || 'Failed to update order status'}
                </div>
            `;
        }
        
        // Auto-hide success message after 3 seconds
        if (response.ok && data.updated_count > 0) {
            setTimeout(() => {
                resultDiv.style.display = 'none';
            }, 3000);
        }
    } catch (error) {
        console.error('Error scanning return:', error);
        resultDiv.innerHTML = `
            <div style="background: #f8d7da; border: 2px solid #dc3545; border-radius: 8px; padding: 15px; color: #721c24;">
                <strong>❌ Error:</strong> ${error.message}
            </div>
        `;
    }
}

// Download order template
function downloadOrderTemplate() {
    if (typeof XLSX === 'undefined') {
        alert('Excel library not loaded. Please refresh the page.');
        return;
    }
    
    // Create template data with headers and example row
    const templateData = [
        {
            'Order Number': 'ORD001',
            'Seller Name': 'seller1',
            'Customer Name': 'John Doe',
            'Address': '123 Main Street',
            'City': 'Islamabad',
            'Phone 1': '03001234567',
            'Phone 2': '03001234568',
            'Products': 'wdk1,wdk1',
            'Seller Price': '5000',
            'DC': '200',
            'Tracking ID': 'TRK123456'
        },
        {
            'Order Number': 'ORD002',
            'Seller Name': 'seller1',
            'Customer Name': 'Jane Smith',
            'Address': '456 Park Avenue',
            'City': 'Lahore',
            'Phone 1': '03009876543',
            'Phone 2': '',
            'Products': 'pk1,wdk1',
            'Seller Price': '6000',
            'DC': '300',
            'Tracking ID': ''
        }
    ];
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders Template');
    
    // Set column widths
    ws['!cols'] = [
        { wch: 15 }, // Order Number
        { wch: 15 }, // Seller Name
        { wch: 20 }, // Customer Name
        { wch: 30 }, // Address
        { wch: 15 }, // City
        { wch: 15 }, // Phone 1
        { wch: 15 }, // Phone 2
        { wch: 20 }, // Products
        { wch: 15 }, // Seller Price
        { wch: 10 }, // DC
        { wch: 15 }  // Tracking ID
    ];
    
    XLSX.writeFile(wb, 'Order_Bulk_Upload_Template.xlsx');
}

// Download orders as Excel (with all filters applied)
async function downloadOrders() {
    const sellerFilter = document.getElementById('sellerFilter')?.value || '';
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    const paidFilter = document.getElementById('paidFilter')?.value || '';
    
    // Build URL with all filters (same as loadOrders)
    let url = `${API_BASE}/orders/download?`;
    const params = [];
    
    if (sellerFilter) {
        params.push(`seller_name=${encodeURIComponent(sellerFilter)}`);
    }
    if (statusFilter) {
        params.push(`status=${encodeURIComponent(statusFilter)}`);
    }
    if (paidFilter !== '') {
        params.push(`shipper_paid=${encodeURIComponent(paidFilter)}`);
    }
    
    url += params.join('&');
    
    const response = await fetchWithAuth(url);
    if (response) {
        const orders = await response.json();
        
        // Show confirmation with filter info
        let filterInfo = 'All Orders';
        if (sellerFilter || statusFilter || paidFilter !== '') {
            const filters = [];
            if (sellerFilter) filters.push(`Seller: ${sellerFilter}`);
            if (statusFilter) filters.push(`Status: ${statusFilter}`);
            if (paidFilter === '1') filters.push('Paid: Yes');
            if (paidFilter === '0') filters.push('Paid: No');
            filterInfo = filters.join(', ');
        }
        
        if (orders.length === 0) {
            alert(`No orders found with filters: ${filterInfo}`);
            return;
        }
        
        downloadOrdersAsExcel(orders, filterInfo);
    }
}

function downloadOrdersAsExcel(orders, filterInfo = '') {
    if (typeof XLSX === 'undefined') {
        alert('Excel library not loaded. Please refresh the page.');
        return;
    }
    
    // Create filename with filter info
    let filename = 'orders';
    if (filterInfo && filterInfo !== 'All Orders') {
        // Clean filter info for filename
        const cleanInfo = filterInfo.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        filename += '_' + cleanInfo;
    }
    filename += '_' + new Date().toISOString().split('T')[0] + '.xlsx';
    
    const ws = XLSX.utils.json_to_sheet(orders.map(order => ({
        'Order Number': order.order_number,
        'Seller Name': order.seller_name,
        'Customer Name': order.customer_name,
        'Address': order.customer_address,
        'City': order.city,
        'Phone 1': order.phone1,
        'Phone 2': order.phone2 || '',
        'Products': order.products, // Products included in download
        'Seller Price': parseFloat(order.seller_price || 0).toFixed(2),
        'DC': parseFloat(order.dc || 0).toFixed(2),
        'Shipper Price': parseFloat(order.shipper_price || 0).toFixed(2),
        'Profit': parseFloat(order.profit || 0).toFixed(2),
        'Tracking ID': order.tracking_id || '',
        'Status': order.status,
        'Paid': order.shipper_paid ? 'Yes' : 'No',
        'Created At': order.created_at
    })));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    XLSX.writeFile(wb, filename);
    
    // Show success message
    alert(`Successfully downloaded ${orders.length} order(s)${filterInfo ? ' with filters: ' + filterInfo : ''}`);
}

// Delete all orders (admin only)
async function deleteAllOrders() {
    if (!confirm('⚠️ WARNING: Are you sure you want to delete ALL orders from the database? This action cannot be undone!')) return;
    
    if (!confirm('⚠️ This will permanently delete ALL orders for ALL sellers. Are you absolutely sure?')) return;
    
    try {
        const response = await fetchWithAuth(`${API_BASE}/orders/delete-all`, {
            method: 'DELETE'
        });
        
        if (response) {
            const data = await response.json();
            if (response.ok) {
                alert(`✅ Success! ${data.message}\n\nDeleted ${data.deleted_count || 0} orders.`);
                loadOrders();
            } else {
                if (response.status === 404) {
                    alert(`ℹ️ ${data.error || 'No orders found in database'}`);
                } else {
                    alert(`❌ Error: ${data.error || 'Failed to delete orders'}`);
                }
            }
        } else {
            alert('❌ Failed to connect to server');
        }
    } catch (error) {
        console.error('Error deleting all orders:', error);
        alert('❌ Error deleting orders: ' + error.message);
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

