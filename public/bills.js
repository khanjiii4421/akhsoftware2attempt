// Load sellers for filter
async function loadSellers() {
    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        const sellerFilter = document.getElementById('sellerFilter');
        sellerFilter.innerHTML = '<option value="">All Sellers</option>';

        if (user.role === 'admin') {
            const apiBase = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'http://localhost:3000/api';
            const response = await fetch(`${apiBase}/sellers`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const sellers = await response.json();
            sellers.forEach(seller => {
                const option = document.createElement('option');
                option.value = seller.username;
                option.textContent = seller.username;
                sellerFilter.appendChild(option);
            });
        } else {
            // For sellers, only show their own name
            const option = document.createElement('option');
            option.value = user.username;
            option.textContent = user.username;
            sellerFilter.appendChild(option);
            sellerFilter.value = user.username;
        }
    } catch (error) {
        console.error('Error loading sellers:', error);
    }
}

// Load all bills
async function loadBills() {
    try {
        const token = localStorage.getItem('token');
        const sellerFilter = document.getElementById('sellerFilter');
        const sellerName = sellerFilter ? sellerFilter.value : '';
        
        const apiBase = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'http://localhost:3000/api';
        let url = `${apiBase}/bills`;
        if (sellerName) {
            url += `?seller_name=${encodeURIComponent(sellerName)}`;
        }
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load bills');
        }

        const bills = await response.json();
        loadedBillsCache = bills; // Cache bills for search
        displayBills(bills);
        return bills; // Return bills for search functionality
    } catch (error) {
        console.error('Error loading bills:', error);
        const tbody = document.getElementById('billsTableBody');
        tbody.innerHTML = '<tr><td colspan="11" class="loading">Error loading bills: ' + error.message + '</td></tr>';
        loadedBillsCache = []; // Clear cache on error
        throw error;
    }
}

// Display bills in table (optimized for fast rendering)
function displayBills(bills) {
    const tbody = document.getElementById('billsTableBody');
    
    // Show loading state
    tbody.innerHTML = '<tr><td colspan="11" class="loading">Loading bills...</td></tr>';

    if (bills.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="loading">No bills found</td></tr>';
        return;
    }

    // Use requestAnimationFrame for smooth rendering
    requestAnimationFrame(() => {
        // Build HTML string first (much faster than DOM manipulation)
        const rowsHTML = bills.map(bill => {
            const summary = bill.summary_data;
            
            // Get first customer name from orders (for display)
            const firstOrder = bill.bill_data && bill.bill_data.length > 0 ? bill.bill_data[0] : null;
            const customerName = firstOrder ? escapeHtml(firstOrder.customer_name) : '-';
            
            // Determine overall status (if all delivered, show delivered, if any return, show mixed)
            let overallStatus = 'pending';
            if (summary.total_returns === 0 && summary.total_delivered > 0) {
                overallStatus = 'delivered';
            } else if (summary.total_returns > 0 && summary.total_delivered === 0) {
                overallStatus = 'return';
            } else if (summary.total_returns > 0 && summary.total_delivered > 0) {
                overallStatus = 'mixed';
            }
            
            const billNumEscaped = escapeHtml(bill.bill_number);
            return `
                <tr>
                    <td><strong>${billNumEscaped}</strong></td>
                    <td>${escapeHtml(bill.seller_name)}</td>
                    <td>${customerName}</td>
                    <td>${summary.total_orders}</td>
                    <td style="color: #4caf50; font-weight: bold;">${summary.total_delivered}</td>
                    <td style="color: #e74c3c; font-weight: bold;">${summary.total_returns}</td>
                    <td style="color: ${summary.total_profit < 0 ? '#e74c3c' : '#4caf50'}; font-weight: bold;">${parseFloat(summary.total_profit).toFixed(2)}</td>
                    <td style="color: ${summary.total_dc < 0 ? '#e74c3c' : '#333'}; font-weight: bold;">${parseFloat(summary.total_dc).toFixed(2)}</td>
                    <td><span class="status-badge status-${overallStatus}">${overallStatus.toUpperCase()}</span></td>
                    <td>${new Date(bill.created_at).toLocaleDateString()}</td>
                    <td>
                        <button onclick="viewBillDetail('${billNumEscaped}')" class="btn-primary" style="padding: 5px 10px; font-size: 12px; margin-right: 5px;">View</button>
                        ${isAdmin() ? `<button onclick="deleteBill(${bill.id})" class="btn-danger" style="padding: 5px 10px; font-size: 12px;">Delete</button>` : ''}
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

// Search in bills by tracking ID or order number
async function searchInBills() {
    const trackingId = document.getElementById('searchTrackingId').value.trim();
    const orderNumber = document.getElementById('searchOrderNumber').value.trim();
    const sellerFilter = document.getElementById('sellerFilter');
    const selectedSeller = sellerFilter ? sellerFilter.value : '';
    
    if (!trackingId && !orderNumber) {
        alert('Please enter Tracking ID or Order Number to search');
        return;
    }
    
    if (!selectedSeller) {
        alert('Please select a seller first');
        return;
    }
    
    // Get all bills for the selected seller and search
    try {
        await loadBills();
        await searchInLoadedBills(trackingId, orderNumber, selectedSeller);
    } catch (error) {
        console.error('Error in search:', error);
    }
}

// Store loaded bills globally for search
let loadedBillsCache = [];

// Store current bill for download
let currentBillForDownload = null;

// Search in already loaded bills
async function searchInLoadedBills(trackingId, orderNumber, sellerName) {
    try {
        // Use cached bills if available, otherwise fetch
        let bills = loadedBillsCache;
        
        if (bills.length === 0) {
            const token = localStorage.getItem('token');
            const apiBase = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'http://localhost:3000/api';
            let url = `${apiBase}/bills`;
            if (sellerName) {
                url += `?seller_name=${encodeURIComponent(sellerName)}`;
            }
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load bills');
            }

            bills = await response.json();
            loadedBillsCache = bills;
        }
        
        const results = [];
        
        // Search through all bills
        bills.forEach(bill => {
            if (bill.bill_data && Array.isArray(bill.bill_data)) {
                bill.bill_data.forEach(order => {
                    let match = false;
                    
                    if (trackingId && order.tracking_id && 
                        order.tracking_id.toLowerCase().includes(trackingId.toLowerCase())) {
                        match = true;
                    }
                    
                    if (orderNumber && order.order_number && 
                        order.order_number.toLowerCase().includes(orderNumber.toLowerCase())) {
                        match = true;
                    }
                    
                    if (match) {
                        results.push({
                            bill: bill,
                            order: order
                        });
                    }
                });
            }
        });
        
        displaySearchResults(results, trackingId, orderNumber);
    } catch (error) {
        console.error('Error searching bills:', error);
        alert('Error searching bills: ' + error.message);
    }
}

// Display search results
function displaySearchResults(results, trackingId, orderNumber) {
    const searchResultsDiv = document.getElementById('searchResults');
    
    if (results.length === 0) {
        searchResultsDiv.innerHTML = `
            <div style="padding: 15px; background: #fff3cd; border: 2px solid #ffc107; border-radius: 5px; color: #856404;">
                <strong>⚠️ No Results Found</strong><br>
                ${trackingId ? `Tracking ID: "${trackingId}"` : ''} 
                ${orderNumber ? `Order Number: "${orderNumber}"` : ''} 
                not found in any bills for the selected seller.
            </div>
        `;
        searchResultsDiv.style.display = 'block';
        return;
    }
    
    let html = `
        <div style="background: #d4edda; border: 2px solid #28a745; border-radius: 5px; padding: 15px; margin-bottom: 10px;">
            <strong style="color: #155724;">✓ Found ${results.length} result(s)</strong>
        </div>
        <div style="overflow-x: auto;">
            <table class="data-table" style="width: 100%; background: white;">
                <thead>
                    <tr style="background: #667eea; color: white;">
                        <th>Bill Number</th>
                        <th>Order Number</th>
                        <th>Tracking ID</th>
                        <th>Customer Name</th>
                        <th>Status</th>
                        <th>Seller Price</th>
                        <th>Profit</th>
                        <th>Bill Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    results.forEach(result => {
        const { bill, order } = result;
        const profit = order.adjusted_profit !== undefined ? order.adjusted_profit : order.profit;
        
        html += `
            <tr style="background: ${order.status === 'delivered' ? '#d4edda' : order.status === 'return' ? '#f8d7da' : '#fff3cd'};">
                <td><strong>${bill.bill_number}</strong></td>
                <td>${order.order_number}</td>
                <td><strong>${order.tracking_id || '-'}</strong></td>
                <td>${order.customer_name}</td>
                <td><span class="status-badge status-${order.status}">${order.status.toUpperCase()}</span></td>
                <td>${parseFloat(order.seller_price || 0).toFixed(2)}</td>
                <td style="color: ${profit < 0 ? '#e74c3c' : '#4caf50'}; font-weight: bold;">${parseFloat(profit || 0).toFixed(2)}</td>
                <td>${new Date(bill.created_at).toLocaleDateString()}</td>
                <td>
                    <button onclick="viewBillDetail('${bill.bill_number}')" class="btn-primary" style="padding: 5px 10px; font-size: 12px;">View Bill</button>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    searchResultsDiv.innerHTML = html;
    searchResultsDiv.style.display = 'block';
}

// Clear search
function clearSearch() {
    document.getElementById('searchTrackingId').value = '';
    document.getElementById('searchOrderNumber').value = '';
    document.getElementById('searchResults').style.display = 'none';
    document.getElementById('searchResults').innerHTML = '';
    loadedBillsCache = []; // Clear cache
}

// Check if user is admin
function isAdmin() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role === 'admin';
}

// View bill detail
async function viewBillDetail(billNumber) {
    try {
        const token = localStorage.getItem('token');
        const apiBase = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'http://localhost:3000/api';
        const response = await fetch(`${apiBase}/bills/${billNumber}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load bill details');
        }

        const bill = await response.json();
        showBillDetailModal(bill);
    } catch (error) {
        console.error('Error loading bill detail:', error);
        alert('Error loading bill details: ' + error.message);
    }
}

// Show bill detail modal
function showBillDetailModal(bill) {
    // Store bill for download
    currentBillForDownload = bill;
    
    const modal = document.getElementById('billDetailModal');
    const title = document.getElementById('billDetailTitle');
    const content = document.getElementById('billDetailContent');
    
    title.textContent = `Bill #${bill.bill_number} - ${bill.seller_name}`;
    
    const summary = bill.summary_data;
    let html = `
        <div style="margin-bottom: 20px; padding: 15px; background: #f0f4ff; border-radius: 8px;">
            <h3 style="color: #667eea; margin-bottom: 10px;">Summary</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">
                <div><strong>Total Orders:</strong> ${summary.total_orders}</div>
                <div><strong>Delivered:</strong> ${summary.total_delivered}</div>
                <div><strong>Returns:</strong> ${summary.total_returns}</div>
                <div><strong>Total Profit:</strong> ${parseFloat(summary.total_profit).toFixed(2)}</div>
                <div><strong>Total DC:</strong> ${parseFloat(summary.total_dc).toFixed(2)}</div>
                <div><strong>Delivered Ratio:</strong> ${summary.delivered_ratio}%</div>
                <div><strong>Return Ratio:</strong> ${summary.return_ratio}%</div>
                <div><strong>Date:</strong> ${new Date(bill.created_at).toLocaleString()}</div>
            </div>
        </div>
        
        <h3 style="margin-bottom: 10px;">Orders</h3>
        <div style="overflow-x: auto;">
            <table class="data-table" style="width: 100%;">
                <thead>
                    <tr>
                        <th>Order #</th>
                        <th>Customer</th>
                        <th>Product</th>
                        <th>Seller Price</th>
                        <th>DC</th>
                        <th>Shipper Price</th>
                        <th>Profit</th>
                        <th>Tracking ID</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    bill.bill_data.forEach(order => {
        const profit = order.adjusted_profit !== undefined ? order.adjusted_profit : order.profit;
        const dc = order.adjusted_dc !== undefined ? order.adjusted_dc : order.dc;
        
        html += `
            <tr class="status-${order.status}">
                <td>${order.order_number}</td>
                <td>${order.customer_name}</td>
                <td>${order.products}</td>
                <td>${parseFloat(order.seller_price || 0).toFixed(2)}</td>
                <td style="color: ${dc < 0 ? '#e74c3c' : '#333'}; font-weight: ${dc < 0 ? 'bold' : 'normal'};">${parseFloat(dc || 0).toFixed(2)}</td>
                <td>${parseFloat(order.shipper_price || 0).toFixed(2)}</td>
                <td style="color: ${profit < 0 ? '#e74c3c' : '#333'}; font-weight: ${profit < 0 ? 'bold' : 'normal'};">${parseFloat(profit || 0).toFixed(2)}</td>
                <td>${order.tracking_id || '-'}</td>
                <td><span class="status-badge status-${order.status}">${order.status.toUpperCase()}</span></td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    content.innerHTML = html;
    modal.style.display = 'block';
}

// Close bill detail modal
function closeBillDetailModal() {
    document.getElementById('billDetailModal').style.display = 'none';
}

// Delete bill (requires admin password)
async function deleteBill(billId) {
    if (!confirm('Are you sure you want to delete this bill? This action cannot be undone.')) {
        return;
    }

    // Prompt for admin password
    const password = prompt('Please enter admin password to delete this bill:');
    
    if (!password) {
        alert('Password is required to delete bill.');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const apiBase = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'http://localhost:3000/api';
        const response = await fetch(`${apiBase}/bills/${billId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password: password })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to delete bill');
        }

        const data = await response.json();
        alert('✅ ' + data.message);
        loadBills();
    } catch (error) {
        console.error('Error deleting bill:', error);
        alert('❌ Error deleting bill: ' + error.message);
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('billDetailModal');
    if (event.target === modal) {
        closeBillDetailModal();
    }
}

// Tab switching
function switchTab(tab) {
    const searchTab = document.getElementById('searchTab');
    const matchingTab = document.getElementById('matchingTab');
    const searchSection = document.getElementById('searchSection');
    const matchingSection = document.getElementById('matchingSection');
    
    if (tab === 'search') {
        searchTab.classList.add('active');
        searchTab.style.background = '#667eea';
        searchTab.style.color = 'white';
        matchingTab.classList.remove('active');
        matchingTab.style.background = '#e0e0e0';
        matchingTab.style.color = '#333';
        searchSection.style.display = 'block';
        matchingSection.style.display = 'none';
    } else {
        matchingTab.classList.add('active');
        matchingTab.style.background = '#667eea';
        matchingTab.style.color = 'white';
        searchTab.classList.remove('active');
        searchTab.style.background = '#e0e0e0';
        searchTab.style.color = '#333';
        searchSection.style.display = 'none';
        matchingSection.style.display = 'block';
        
        // Load sellers for matching
        loadMatchingSellers();
    }
}

// Load sellers for matching section
async function loadMatchingSellers() {
    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        const sellerFilter = document.getElementById('matchingSellerFilter');
        sellerFilter.innerHTML = '<option value="">Select Seller</option>';

        if (user.role === 'admin') {
            const apiBase = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'http://localhost:3000/api';
            const response = await fetch(`${apiBase}/sellers`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const sellers = await response.json();
            sellers.forEach(seller => {
                const option = document.createElement('option');
                option.value = seller.username;
                option.textContent = seller.username;
                sellerFilter.appendChild(option);
            });
        } else {
            const option = document.createElement('option');
            option.value = user.username;
            option.textContent = user.username;
            sellerFilter.appendChild(option);
            sellerFilter.value = user.username;
        }
    } catch (error) {
        console.error('Error loading sellers for matching:', error);
    }
}

// Handle Excel file upload
async function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (typeof XLSX === 'undefined') {
        alert('Excel library not loaded. Please refresh the page.');
        return;
    }
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        if (jsonData.length === 0) {
            alert('Excel file is empty');
            return;
        }
        
        // Parse Excel data
        const parsedData = [];
        jsonData.forEach(row => {
            // Try different column name variations
            const ref = row['Reference Number'] || row['ReferenceNumber'] || row['Order Number'] || row['OrderNumber'] || row['Reference'] || row['Order'] || '';
            const profit = row['Profit'] || row['profit'] || 0;
            const status = row['Status'] || row['status'] || 'pending';
            
            if (ref) {
                parsedData.push({
                    reference: String(ref).trim(),
                    profit: parseFloat(profit) || 0,
                    status: String(status).trim().toLowerCase()
                });
            }
        });
        
        if (parsedData.length === 0) {
            alert('No valid data found. Please check column names: Reference Number, Profit, Status');
            return;
        }
        
        // Display in textarea for review
        const textarea = document.getElementById('referenceNumbersInput');
        const text = parsedData.map(item => `${item.reference},${item.profit},${item.status}`).join('\n');
        textarea.value = text;
        
        alert(`Successfully loaded ${parsedData.length} entries from Excel file`);
    } catch (error) {
        console.error('Error reading Excel file:', error);
        alert('Error reading Excel file: ' + error.message);
    }
}

// Download Excel template
function downloadMatchingTemplate() {
    if (typeof XLSX === 'undefined') {
        alert('Excel library not loaded. Please refresh the page.');
        return;
    }
    
    const templateData = [
        ['Reference Number', 'Profit', 'Status'],
        ['ORD001', 500.50, 'delivered'],
        ['ORD002', 750.25, 'return'],
        ['ORD003', 300.00, 'pending'],
        ['ORD004', 450.75, 'delivered']
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bill Matching Template');
    
    // Set column widths
    ws['!cols'] = [
        { wch: 20 }, // Reference Number
        { wch: 15 }, // Profit
        { wch: 15 }  // Status
    ];
    
    XLSX.writeFile(wb, 'Bill_Matching_Template.xlsx');
}

// Parse reference numbers input (now supports status)
function parseReferenceNumbers(input) {
    const data = [];
    const lines = input.trim().split('\n');
    
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        // Try comma separated format: reference,profit,status
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 2) {
            const ref = parts[0];
            const profit = parseFloat(parts[1]);
            const status = parts[2] || 'pending'; // Default to pending if not provided
            
            if (ref && !isNaN(profit)) {
                data.push({ 
                    reference: ref, 
                    profit: profit,
                    status: status.toLowerCase()
                });
            }
        }
    }
    
    return data;
}

// Match bills with uploaded reference numbers
async function matchBills() {
    const sellerFilter = document.getElementById('matchingSellerFilter');
    const sellerName = sellerFilter ? sellerFilter.value : '';
    const input = document.getElementById('referenceNumbersInput').value.trim();
    
    if (!sellerName) {
        alert('Please select a seller first');
        return;
    }
    
    if (!input) {
        alert('Please enter reference numbers with profit');
        return;
    }
    
    const uploadedData = parseReferenceNumbers(input);
    if (uploadedData.length === 0) {
        alert('Invalid format. Please use: ReferenceNumber,Profit (one per line)');
        return;
    }
    
    try {
        // Load all bills for the seller
        const token = localStorage.getItem('token');
        const apiBase = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'http://localhost:3000/api';
        const response = await fetch(`${apiBase}/bills?seller_name=${encodeURIComponent(sellerName)}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load bills');
        }

        const bills = await response.json();
        
        // Build a map of all orders in bills
        const billOrdersMap = new Map(); // reference -> {bill, order, status}
        const billOrdersList = [];
        
        bills.forEach(bill => {
            if (bill.bill_data && Array.isArray(bill.bill_data)) {
                bill.bill_data.forEach(order => {
                    const ref = order.order_number;
                    const profit = order.adjusted_profit !== undefined ? order.adjusted_profit : order.profit;
                    billOrdersMap.set(ref, {
                        bill: bill,
                        order: order,
                        status: order.status,
                        profit: profit
                    });
                    billOrdersList.push({
                        reference: ref,
                        profit: profit,
                        bill: bill,
                        order: order,
                        status: order.status
                    });
                });
            }
        });
        
        // Match uploaded data with bills
        const matched = [];
        const notMatched = [];
        const alreadyPaid = [];
        
        uploadedData.forEach(uploaded => {
            const billOrder = billOrdersMap.get(uploaded.reference);
            
            if (billOrder) {
                // Check if profit matches (within 0.01 tolerance for floating point)
                const profitMatch = Math.abs(billOrder.profit - uploaded.profit) < 0.01;
                // Check if status matches
                const statusMatch = billOrder.status.toLowerCase() === uploaded.status.toLowerCase();
                
                if (profitMatch && statusMatch) {
                    matched.push({
                        reference: uploaded.reference,
                        uploadedProfit: uploaded.profit,
                        uploadedStatus: uploaded.status,
                        billProfit: billOrder.profit,
                        billStatus: billOrder.status,
                        bill: billOrder.bill,
                        order: billOrder.order,
                        status: billOrder.status,
                        matchType: 'matched'
                    });
                } else if (profitMatch && !statusMatch) {
                    // Profit matches but status doesn't
                    matched.push({
                        reference: uploaded.reference,
                        uploadedProfit: uploaded.profit,
                        uploadedStatus: uploaded.status,
                        billProfit: billOrder.profit,
                        billStatus: billOrder.status,
                        bill: billOrder.bill,
                        order: billOrder.order,
                        status: billOrder.status,
                        matchType: 'status_mismatch'
                    });
                } else {
                    // Reference exists but profit doesn't match
                    matched.push({
                        reference: uploaded.reference,
                        uploadedProfit: uploaded.profit,
                        uploadedStatus: uploaded.status,
                        billProfit: billOrder.profit,
                        billStatus: billOrder.status,
                        bill: billOrder.bill,
                        order: billOrder.order,
                        status: billOrder.status,
                        matchType: 'profit_mismatch'
                    });
                }
                
                // Mark as already paid (in a bill)
                alreadyPaid.push({
                    reference: uploaded.reference,
                    profit: uploaded.profit,
                    uploadedStatus: uploaded.status,
                    bill: billOrder.bill,
                    order: billOrder.order,
                    status: billOrder.status
                });
            } else {
                // Not found in any bill
                notMatched.push({
                    reference: uploaded.reference,
                    profit: uploaded.profit,
                    status: uploaded.status,
                    matchType: 'not_in_bill'
                });
            }
        });
        
        // Find orders in bills that are not in uploaded list
        const extraInBills = [];
        billOrdersList.forEach(billOrder => {
            const found = uploadedData.find(u => u.reference === billOrder.reference);
            if (!found) {
                extraInBills.push(billOrder);
            }
        });
        
        displayMatchingResults(matched, notMatched, alreadyPaid, extraInBills, uploadedData.length);
    } catch (error) {
        console.error('Error matching bills:', error);
        alert('Error matching bills: ' + error.message);
    }
}

// Display matching results
function displayMatchingResults(matched, notMatched, alreadyPaid, extraInBills, totalUploaded) {
    const resultsDiv = document.getElementById('matchingResults');
    resultsDiv.style.display = 'block';
    
    let html = `
        <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin-bottom: 15px; border: 2px solid #2196f3;">
            <h4 style="margin: 0; color: #1976d2;">📊 Matching Summary</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 10px;">
                <div><strong>Total Uploaded:</strong> ${totalUploaded}</div>
                <div style="color: #4caf50;"><strong>Matched:</strong> ${matched.filter(m => m.matchType === 'matched').length}</div>
                <div style="color: #e74c3c;"><strong>Not in Bills:</strong> ${notMatched.length}</div>
                <div style="color: #ff9800;"><strong>Already Paid:</strong> ${alreadyPaid.length}</div>
                <div style="color: #9c27b0;"><strong>Extra in Bills:</strong> ${extraInBills.length}</div>
            </div>
        </div>
    `;
    
    // Not Matched (Not in any bill)
    if (notMatched.length > 0) {
        html += `
            <div style="background: #ffebee; border: 2px solid #e74c3c; border-radius: 5px; padding: 15px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #c62828;">❌ Not in Any Bill (${notMatched.length})</h4>
                <p style="color: #666; margin-bottom: 10px;">These reference numbers are not found in any bill:</p>
                <div style="overflow-x: auto;">
                    <table class="data-table" style="width: 100%; background: white;">
                        <thead>
                            <tr style="background: #e74c3c; color: white;">
                                <th>Reference Number</th>
                                <th>Uploaded Profit</th>
                                <th>Uploaded Status</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        notMatched.forEach(item => {
            const statusText = item.status ? item.status.toUpperCase() : 'NOT SPECIFIED';
            html += `
                <tr>
                    <td><strong>${item.reference}</strong></td>
                    <td>${item.profit.toFixed(2)}</td>
                    <td><span class="status-badge status-${item.status || 'pending'}">${statusText}</span></td>
                    <td><span style="color: #e74c3c; font-weight: bold;">NOT IN BILL</span></td>
                </tr>
            `;
        });
        html += `</tbody></table></div></div>`;
    }
    
    // Already Paid (In Bills)
    if (alreadyPaid.length > 0) {
        html += `
            <div style="background: #fff3e0; border: 2px solid #ff9800; border-radius: 5px; padding: 15px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #e65100;">💰 Already Paid in Bills (${alreadyPaid.length})</h4>
                <p style="color: #666; margin-bottom: 10px;">These reference numbers are already in bills:</p>
                <div style="overflow-x: auto;">
                    <table class="data-table" style="width: 100%; background: white;">
                        <thead>
                            <tr style="background: #ff9800; color: white;">
                                <th>Reference Number</th>
                                <th>Bill Number</th>
                                <th>Status</th>
                                <th>Profit in Bill</th>
                                <th>Customer Name</th>
                                <th>Bill Date</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        alreadyPaid.forEach(item => {
            const profit = item.order.adjusted_profit !== undefined ? item.order.adjusted_profit : item.order.profit;
            html += `
                <tr style="background: ${item.status === 'delivered' ? '#d4edda' : item.status === 'return' ? '#f8d7da' : '#fff3cd'};">
                    <td><strong>${item.reference}</strong></td>
                    <td><strong>${item.bill.bill_number}</strong></td>
                    <td><span class="status-badge status-${item.status}">${item.status.toUpperCase()}</span></td>
                    <td style="color: ${profit < 0 ? '#e74c3c' : '#4caf50'}; font-weight: bold;">${profit.toFixed(2)}</td>
                    <td>${item.order.customer_name}</td>
                    <td>${new Date(item.bill.created_at).toLocaleDateString()}</td>
                    <td>
                        <button onclick="viewBillDetail('${item.bill.bill_number}')" class="btn-primary" style="padding: 5px 10px; font-size: 12px;">View Bill</button>
                    </td>
                </tr>
            `;
        });
        html += `</tbody></table></div></div>`;
    }
    
    // Matched (Reference + Profit both match)
    const perfectMatches = matched.filter(m => m.matchType === 'matched');
    if (perfectMatches.length > 0) {
        html += `
            <div style="background: #e8f5e9; border: 2px solid #4caf50; border-radius: 5px; padding: 15px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #2e7d32;">✅ Perfectly Matched (${perfectMatches.length})</h4>
                <p style="color: #666; margin-bottom: 10px;">These reference numbers and profits match exactly with bills:</p>
                <div style="overflow-x: auto;">
                    <table class="data-table" style="width: 100%; background: white;">
                        <thead>
                            <tr style="background: #4caf50; color: white;">
                                <th>Reference Number</th>
                                <th>Bill Number</th>
                                <th>Status</th>
                                <th>Profit</th>
                                <th>Customer Name</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        perfectMatches.forEach(item => {
            html += `
                <tr>
                    <td><strong>${item.reference}</strong></td>
                    <td><strong>${item.bill.bill_number}</strong></td>
                    <td><span class="status-badge status-${item.status}">${item.status.toUpperCase()}</span></td>
                    <td style="color: ${item.billProfit < 0 ? '#e74c3c' : '#4caf50'}; font-weight: bold;">${item.billProfit.toFixed(2)}</td>
                    <td>${item.order.customer_name}</td>
                    <td>
                        <button onclick="viewBillDetail('${item.bill.bill_number}')" class="btn-primary" style="padding: 5px 10px; font-size: 12px;">View Bill</button>
                    </td>
                </tr>
            `;
        });
        html += `</tbody></table></div></div>`;
    }
    
    // Profit Mismatch
    const profitMismatches = matched.filter(m => m.matchType === 'profit_mismatch');
    if (profitMismatches.length > 0) {
        html += `
            <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 5px; padding: 15px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #856404;">⚠️ Profit Mismatch (${profitMismatches.length})</h4>
                <p style="color: #666; margin-bottom: 10px;">These reference numbers exist but profit doesn't match:</p>
                <div style="overflow-x: auto;">
                    <table class="data-table" style="width: 100%; background: white;">
                        <thead>
                            <tr style="background: #ffc107; color: #333;">
                                <th>Reference Number</th>
                                <th>Uploaded Profit</th>
                                <th>Bill Profit</th>
                                <th>Uploaded Status</th>
                                <th>Bill Status</th>
                                <th>Bill Number</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        profitMismatches.forEach(item => {
            html += `
                <tr>
                    <td><strong>${item.reference}</strong></td>
                    <td style="color: #e74c3c;">${item.uploadedProfit.toFixed(2)}</td>
                    <td style="color: #4caf50;">${item.billProfit.toFixed(2)}</td>
                    <td><span class="status-badge status-${item.uploadedStatus}">${item.uploadedStatus.toUpperCase()}</span></td>
                    <td><span class="status-badge status-${item.billStatus}">${item.billStatus.toUpperCase()}</span></td>
                    <td><strong>${item.bill.bill_number}</strong></td>
                    <td>
                        <button onclick="viewBillDetail('${item.bill.bill_number}')" class="btn-primary" style="padding: 5px 10px; font-size: 12px;">View Bill</button>
                    </td>
                </tr>
            `;
        });
        html += `</tbody></table></div></div>`;
    }
    
    // Status Mismatch
    const statusMismatches = matched.filter(m => m.matchType === 'status_mismatch');
    if (statusMismatches.length > 0) {
        html += `
            <div style="background: #ffe0b2; border: 2px solid #ff9800; border-radius: 5px; padding: 15px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #e65100;">⚠️ Status Mismatch (${statusMismatches.length})</h4>
                <p style="color: #666; margin-bottom: 10px;">These reference numbers have matching profit but status doesn't match:</p>
                <div style="overflow-x: auto;">
                    <table class="data-table" style="width: 100%; background: white;">
                        <thead>
                            <tr style="background: #ff9800; color: white;">
                                <th>Reference Number</th>
                                <th>Profit</th>
                                <th>Uploaded Status</th>
                                <th>Bill Status</th>
                                <th>Bill Number</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        statusMismatches.forEach(item => {
            html += `
                <tr>
                    <td><strong>${item.reference}</strong></td>
                    <td style="color: #4caf50; font-weight: bold;">${item.billProfit.toFixed(2)}</td>
                    <td><span class="status-badge status-${item.uploadedStatus}">${item.uploadedStatus.toUpperCase()}</span></td>
                    <td><span class="status-badge status-${item.billStatus}">${item.billStatus.toUpperCase()}</span></td>
                    <td><strong>${item.bill.bill_number}</strong></td>
                    <td>
                        <button onclick="viewBillDetail('${item.bill.bill_number}')" class="btn-primary" style="padding: 5px 10px; font-size: 12px;">View Bill</button>
                    </td>
                </tr>
            `;
        });
        html += `</tbody></table></div></div>`;
    }
    
    // Extra in Bills (In bills but not in uploaded list)
    if (extraInBills.length > 0) {
        html += `
            <div style="background: #f3e5f5; border: 2px solid #9c27b0; border-radius: 5px; padding: 15px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #6a1b9a;">📦 Extra in Bills (${extraInBills.length})</h4>
                <p style="color: #666; margin-bottom: 10px;">These parcels are in bills but NOT in your uploaded list. Add them to your list:</p>
                <div style="overflow-x: auto;">
                    <table class="data-table" style="width: 100%; background: white;">
                        <thead>
                            <tr style="background: #9c27b0; color: white;">
                                <th>Reference Number</th>
                                <th>Bill Number</th>
                                <th>Status</th>
                                <th>Profit</th>
                                <th>Customer Name</th>
                                <th>Message</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        extraInBills.forEach(item => {
            const statusMessage = item.status === 'delivered' ? 'DELIVERED - Add to bill' : 
                                 item.status === 'return' ? 'RETURN - Add to bill' : 
                                 'PENDING - Not delivered/return';
            html += `
                <tr style="background: ${item.status === 'delivered' ? '#d4edda' : item.status === 'return' ? '#f8d7da' : '#fff3cd'};">
                    <td><strong>${item.reference}</strong></td>
                    <td><strong>${item.bill.bill_number}</strong></td>
                    <td><span class="status-badge status-${item.status}">${item.status.toUpperCase()}</span></td>
                    <td style="color: ${item.profit < 0 ? '#e74c3c' : '#4caf50'}; font-weight: bold;">${item.profit.toFixed(2)}</td>
                    <td>${item.order.customer_name}</td>
                    <td style="color: #9c27b0; font-weight: bold;">${statusMessage}</td>
                    <td>
                        <button onclick="viewBillDetail('${item.bill.bill_number}')" class="btn-primary" style="padding: 5px 10px; font-size: 12px;">View Bill</button>
                    </td>
                </tr>
            `;
        });
        html += `</tbody></table></div></div>`;
    }
    
    resultsDiv.innerHTML = html;
}

// Clear matching
function clearMatching() {
    document.getElementById('referenceNumbersInput').value = '';
    document.getElementById('excelFileInput').value = '';
    document.getElementById('matchingResults').style.display = 'none';
    document.getElementById('matchingResults').innerHTML = '';
}

// Download bill as PDF
function downloadBillPDF() {
    if (!currentBillForDownload) {
        alert('No bill data available');
        return;
    }

    const bill = currentBillForDownload;
    const summary = bill.summary_data;
    
    // Check if jsPDF is available
    if (typeof window.jspdf === 'undefined') {
        alert('PDF library not loaded. Please refresh the page.');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(255, 140, 0); // Orange color
    doc.text('BILL', 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`Bill #: ${bill.bill_number}`, 14, 35);
    doc.text(`Seller: ${bill.seller_name}`, 14, 43);
    doc.text(`Date: ${new Date(bill.created_at).toLocaleDateString()}`, 14, 51);
    
    // Summary Box
    doc.setFillColor(240, 244, 255);
    doc.rect(14, 58, 182, 35, 'F');
    
    doc.setFontSize(12);
    doc.setTextColor(102, 126, 234);
    doc.text('Summary', 18, 67);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Orders: ${summary.total_orders}`, 18, 76);
    doc.text(`Delivered: ${summary.total_delivered}`, 70, 76);
    doc.text(`Returns: ${summary.total_returns}`, 120, 76);
    doc.text(`Total Profit: ${parseFloat(summary.total_profit).toFixed(2)}`, 18, 85);
    doc.text(`Total DC: ${parseFloat(summary.total_dc).toFixed(2)}`, 70, 85);
    doc.text(`Delivered Ratio: ${summary.delivered_ratio}%`, 120, 85);
    
    // Orders Table
    const tableData = bill.bill_data.map(order => {
        const profit = order.adjusted_profit !== undefined ? order.adjusted_profit : order.profit;
        const dc = order.adjusted_dc !== undefined ? order.adjusted_dc : order.dc;
        return [
            order.order_number,
            order.customer_name.substring(0, 20),
            order.products ? order.products.substring(0, 20) : '-',
            parseFloat(order.seller_price || 0).toFixed(2),
            parseFloat(dc || 0).toFixed(2),
            parseFloat(order.shipper_price || 0).toFixed(2),
            parseFloat(profit || 0).toFixed(2),
            order.tracking_id || '-',
            order.status.toUpperCase()
        ];
    });
    
    doc.autoTable({
        head: [['Order #', 'Customer', 'Product', 'Seller Price', 'DC', 'Shipper', 'Profit', 'Tracking', 'Status']],
        body: tableData,
        startY: 100,
        theme: 'grid',
        styles: {
            fontSize: 8,
            cellPadding: 2
        },
        headStyles: {
            fillColor: [102, 126, 234],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
        },
        columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 25 },
            2: { cellWidth: 25 },
            3: { cellWidth: 20 },
            4: { cellWidth: 15 },
            5: { cellWidth: 18 },
            6: { cellWidth: 18 },
            7: { cellWidth: 25 },
            8: { cellWidth: 18 }
        },
        didParseCell: function(data) {
            // Color code status
            if (data.column.index === 8 && data.section === 'body') {
                const status = data.cell.raw;
                if (status === 'DELIVERED') {
                    data.cell.styles.textColor = [76, 175, 80];
                } else if (status === 'RETURN') {
                    data.cell.styles.textColor = [231, 76, 60];
                }
            }
            // Color code profit
            if (data.column.index === 6 && data.section === 'body') {
                const profit = parseFloat(data.cell.raw);
                if (profit < 0) {
                    data.cell.styles.textColor = [231, 76, 60];
                } else {
                    data.cell.styles.textColor = [76, 175, 80];
                }
            }
        }
    });
    
    // Footer with totals
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    
    // Total summary at bottom
    doc.setFillColor(102, 126, 234);
    doc.rect(14, finalY, 182, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(`Total Profit: Rs. ${parseFloat(summary.total_profit).toFixed(2)}`, 20, finalY + 8);
    doc.text(`Total DC: Rs. ${parseFloat(summary.total_dc).toFixed(2)}`, 80, finalY + 8);
    doc.text(`Delivered: ${summary.total_delivered} | Returns: ${summary.total_returns}`, 130, finalY + 8);
    
    // Save PDF
    doc.save(`Bill_${bill.bill_number}_${bill.seller_name}.pdf`);
}

// Download all bills as Excel
function downloadAllBillsExcel() {
    if (loadedBillsCache.length === 0) {
        alert('No bills to export. Please load bills first.');
        return;
    }
    
    if (typeof XLSX === 'undefined') {
        alert('Excel library not loaded. Please refresh the page.');
        return;
    }
    
    const bills = loadedBillsCache;
    const wb = XLSX.utils.book_new();
    
    // Sheet 1: Bills Summary
    const summaryHeaders = [
        'Bill Number', 'Seller Name', 'Total Orders', 'Delivered', 
        'Returns', 'Total Profit', 'Total DC', 'Delivered Ratio', 'Return Ratio', 'Date'
    ];
    
    const summaryData = bills.map(bill => {
        const summary = bill.summary_data;
        return [
            bill.bill_number,
            bill.seller_name,
            summary.total_orders,
            summary.total_delivered,
            summary.total_returns,
            parseFloat(summary.total_profit).toFixed(2),
            parseFloat(summary.total_dc).toFixed(2),
            `${summary.delivered_ratio}%`,
            `${summary.return_ratio}%`,
            new Date(bill.created_at).toLocaleDateString()
        ];
    });
    
    // Calculate grand totals
    let grandTotalOrders = 0, grandDelivered = 0, grandReturns = 0, grandProfit = 0, grandDC = 0;
    bills.forEach(bill => {
        const summary = bill.summary_data;
        grandTotalOrders += summary.total_orders;
        grandDelivered += summary.total_delivered;
        grandReturns += summary.total_returns;
        grandProfit += parseFloat(summary.total_profit);
        grandDC += parseFloat(summary.total_dc);
    });
    
    summaryData.push([]);
    summaryData.push([
        'GRAND TOTAL', '', grandTotalOrders, grandDelivered, grandReturns, 
        grandProfit.toFixed(2), grandDC.toFixed(2), '', '', ''
    ]);
    
    const summaryWs = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryData]);
    summaryWs['!cols'] = [
        { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, 
        { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }
    ];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Bills Summary');
    
    // Sheet 2: All Orders Detail
    const orderHeaders = [
        'Bill Number', 'Seller', 'Order Number', 'Customer Name', 'Product', 
        'Seller Price', 'DC', 'Shipper Price', 'Profit', 'Tracking ID', 'Status', 'Bill Date'
    ];
    
    const allOrders = [];
    bills.forEach(bill => {
        if (bill.bill_data && Array.isArray(bill.bill_data)) {
            bill.bill_data.forEach(order => {
                const profit = order.adjusted_profit !== undefined ? order.adjusted_profit : order.profit;
                const dc = order.adjusted_dc !== undefined ? order.adjusted_dc : order.dc;
                allOrders.push([
                    bill.bill_number,
                    bill.seller_name,
                    order.order_number,
                    order.customer_name,
                    order.products || '-',
                    parseFloat(order.seller_price || 0).toFixed(2),
                    parseFloat(dc || 0).toFixed(2),
                    parseFloat(order.shipper_price || 0).toFixed(2),
                    parseFloat(profit || 0).toFixed(2),
                    order.tracking_id || '-',
                    order.status.toUpperCase(),
                    new Date(bill.created_at).toLocaleDateString()
                ]);
            });
        }
    });
    
    const ordersWs = XLSX.utils.aoa_to_sheet([orderHeaders, ...allOrders]);
    ordersWs['!cols'] = [
        { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 22 }, { wch: 25 },
        { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 12 }
    ];
    XLSX.utils.book_append_sheet(wb, ordersWs, 'All Orders');
    
    // Get seller name for filename
    const sellerFilter = document.getElementById('sellerFilter');
    const sellerName = sellerFilter && sellerFilter.value ? sellerFilter.value : 'All_Sellers';
    
    // Save Excel file
    XLSX.writeFile(wb, `All_Bills_${sellerName}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Download bill as Excel
function downloadBillExcel() {
    if (!currentBillForDownload) {
        alert('No bill data available');
        return;
    }
    
    if (typeof XLSX === 'undefined') {
        alert('Excel library not loaded. Please refresh the page.');
        return;
    }

    const bill = currentBillForDownload;
    const summary = bill.summary_data;
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Sheet 1: Bill Summary
    const summaryData = [
        ['BILL DETAILS'],
        [],
        ['Bill Number', bill.bill_number],
        ['Seller Name', bill.seller_name],
        ['Date', new Date(bill.created_at).toLocaleDateString()],
        [],
        ['SUMMARY'],
        ['Total Orders', summary.total_orders],
        ['Delivered', summary.total_delivered],
        ['Returns', summary.total_returns],
        ['Total Profit', parseFloat(summary.total_profit).toFixed(2)],
        ['Total DC', parseFloat(summary.total_dc).toFixed(2)],
        ['Delivered Ratio', `${summary.delivered_ratio}%`],
        ['Return Ratio', `${summary.return_ratio}%`]
    ];
    
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs['!cols'] = [{ wch: 20 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
    
    // Sheet 2: Order Details
    const orderHeaders = [
        'Order Number', 'Customer Name', 'Product', 'Seller Price', 
        'DC', 'Shipper Price', 'Profit', 'Tracking ID', 'Status'
    ];
    
    const orderData = bill.bill_data.map(order => {
        const profit = order.adjusted_profit !== undefined ? order.adjusted_profit : order.profit;
        const dc = order.adjusted_dc !== undefined ? order.adjusted_dc : order.dc;
        return [
            order.order_number,
            order.customer_name,
            order.products || '-',
            parseFloat(order.seller_price || 0).toFixed(2),
            parseFloat(dc || 0).toFixed(2),
            parseFloat(order.shipper_price || 0).toFixed(2),
            parseFloat(profit || 0).toFixed(2),
            order.tracking_id || '-',
            order.status.toUpperCase()
        ];
    });
    
    // Add totals row
    orderData.push([]);
    orderData.push([
        'TOTALS', '', '', '', 
        parseFloat(summary.total_dc).toFixed(2), '', 
        parseFloat(summary.total_profit).toFixed(2), '', 
        `D:${summary.total_delivered} R:${summary.total_returns}`
    ]);
    
    const ordersWs = XLSX.utils.aoa_to_sheet([orderHeaders, ...orderData]);
    ordersWs['!cols'] = [
        { wch: 18 }, // Order Number
        { wch: 25 }, // Customer Name
        { wch: 30 }, // Product
        { wch: 12 }, // Seller Price
        { wch: 10 }, // DC
        { wch: 12 }, // Shipper Price
        { wch: 10 }, // Profit
        { wch: 20 }, // Tracking ID
        { wch: 12 }  // Status
    ];
    XLSX.utils.book_append_sheet(wb, ordersWs, 'Orders');
    
    // Save Excel file
    XLSX.writeFile(wb, `Bill_${bill.bill_number}_${bill.seller_name}.xlsx`);
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    loadSellers();
    loadBills();
});

