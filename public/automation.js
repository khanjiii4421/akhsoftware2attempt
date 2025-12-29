// Automation - Bulk Status Update
let sellersList = [];

// Load sellers on page load
window.addEventListener('DOMContentLoaded', async () => {
    await loadSellers();
    await loadSellersForTracking();
    setupFileInput();
    setupTrackingFileInput();
    setupBulkReturnFileInput();
});

// Load sellers
async function loadSellers() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (user.role === 'admin') {
        const apiBase = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : (typeof API_BASE !== 'undefined' ? API_BASE : 'http://localhost:3000/api');
        const response = await fetchWithAuth(`${apiBase}/sellers`);
        if (response) {
            const sellers = await response.json();
            sellersList = sellers;
            
            const sellerSelect = document.getElementById('sellerSelect');
            if (sellerSelect) {
                sellerSelect.innerHTML = '<option value="">Select Seller</option>';
                sellers.forEach(seller => {
                    const option = document.createElement('option');
                    option.value = seller.username;
                    option.textContent = seller.username;
                    sellerSelect.appendChild(option);
                });
            }
        }
    } else {
        // For sellers, set their own name
        const sellerSelect = document.getElementById('sellerSelect');
        if (sellerSelect) {
            sellerSelect.innerHTML = `<option value="${user.username}" selected>${user.username}</option>`;
            sellerSelect.disabled = true;
        }
    }
}

// Load sellers for tracking upload
async function loadSellersForTracking() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (user.role === 'admin') {
        const apiBase = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : (typeof API_BASE !== 'undefined' ? API_BASE : 'http://localhost:3000/api');
        const response = await fetchWithAuth(`${apiBase}/sellers`);
        if (response) {
            const sellers = await response.json();
            
            const sellerSelect = document.getElementById('trackingSellerSelect');
            if (sellerSelect) {
                sellerSelect.innerHTML = '<option value="">Select Seller</option>';
                sellers.forEach(seller => {
                    const option = document.createElement('option');
                    option.value = seller.username;
                    option.textContent = seller.username;
                    sellerSelect.appendChild(option);
                });
            }
        }
    } else {
        // For sellers, set their own name
        const sellerSelect = document.getElementById('trackingSellerSelect');
        if (sellerSelect) {
            sellerSelect.innerHTML = `<option value="${user.username}" selected>${user.username}</option>`;
            sellerSelect.disabled = true;
        }
    }
}

// Toggle input method label
function toggleInputMethod() {
    const updateBy = document.getElementById('updateBy').value;
    const inputLabel = document.getElementById('inputLabel');
    
    if (updateBy === 'tracking_id') {
        inputLabel.textContent = 'Enter Tracking IDs (one per line or comma separated) *';
        document.getElementById('idsInput').placeholder = 'Enter tracking IDs, one per line or separated by commas\nExample:\nTRK123456\nTRK789012\nOR\nTRK123456,TRK789012,TRK345678';
    } else if (updateBy === 'order_number') {
        inputLabel.textContent = 'Enter Order Reference Numbers (one per line or comma separated) *';
        document.getElementById('idsInput').placeholder = 'Enter order numbers, one per line or separated by commas\nExample:\nORD001\nORD002\nOR\nORD001,ORD002,ORD003';
    }
}

// Setup file input
function setupFileInput() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    // Check if it's Excel file
                    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                        await readExcelFile(file);
                    } else {
                        // Text file
                        const text = await file.text();
                        document.getElementById('idsInput').value = text;
                    }
                } catch (error) {
                    alert('Error reading file: ' + error.message);
                }
            }
        });
    }
}

// Read Excel file
async function readExcelFile(file) {
    if (typeof XLSX === 'undefined') {
        alert('Excel library not loaded. Please refresh the page.');
        return;
    }
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        // Extract IDs from first column (regardless of header name)
        const ids = jsonData.map(row => {
            const firstKey = Object.keys(row)[0];
            return row[firstKey] || '';
        }).filter(id => id && id.toString().trim());
        
        document.getElementById('idsInput').value = ids.join('\n');
    } catch (error) {
        alert('Error reading Excel file: ' + error.message);
    }
}

// Clear form
function clearForm() {
    document.getElementById('automationForm').reset();
    document.getElementById('resultMessage').style.display = 'none';
    document.getElementById('fileInput').value = '';
    loadSellers(); // Reload sellers
}

// Parse IDs from input
function parseIds(input) {
    if (!input || !input.trim()) return [];
    
    // Split by newlines and commas, then trim and filter empty
    return input
        .split(/[\n,]+/)
        .map(id => id.trim())
        .filter(id => id.length > 0);
}

// Handle form submission
document.getElementById('automationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const sellerName = document.getElementById('sellerSelect').value;
    const updateBy = document.getElementById('updateBy').value;
    const newStatus = document.getElementById('newStatus').value;
    const idsInput = document.getElementById('idsInput').value;
    
    if (!sellerName || !updateBy || !newStatus || !idsInput.trim()) {
        alert('Please fill all required fields');
        return;
    }
    
    const ids = parseIds(idsInput);
    if (ids.length === 0) {
        alert('Please enter at least one ID or number');
        return;
    }
    
    if (!confirm(`Are you sure you want to update status to "${newStatus}" for ${ids.length} orders?`)) {
        return;
    }
    
    try {
        const apiBase = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : (typeof API_BASE !== 'undefined' ? API_BASE : 'http://localhost:3000/api');
        const response = await fetchWithAuth(`${apiBase}/orders/bulk-update-status`, {
            method: 'POST',
            body: JSON.stringify({
                seller_name: sellerName,
                update_by: updateBy,
                new_status: newStatus,
                identifiers: ids
            })
        });
        
        if (!response) {
            alert('Failed to connect to server. Please check your authentication.');
            return;
        }
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Server returned non-JSON response:', text.substring(0, 200));
            alert('Server error: Received invalid response. Please check server logs.');
            return;
        }
        
        const data = await response.json();
        if (response.ok) {
            showResult(data, true);
        } else {
            showResult(data, false);
        }
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Error updating status: ' + error.message);
    }
});

// Show result message
function showResult(data, success) {
    const resultDiv = document.getElementById('resultMessage');
    resultDiv.style.display = 'block';
    
    if (success) {
        resultDiv.className = 'success-message';
        resultDiv.innerHTML = `
            <h3>✅ Update Successful!</h3>
            <p><strong>Total Processed:</strong> ${data.total_processed || 0}</p>
            <p><strong>Successfully Updated:</strong> ${data.updated_count || 0}</p>
            <p><strong>Not Found:</strong> ${data.not_found_count || 0}</p>
            ${data.not_found && data.not_found.length > 0 ? 
                `<p><strong>Not Found IDs:</strong> ${data.not_found.join(', ')}</p>` : ''}
            ${data.errors && data.errors.length > 0 ? 
                `<p><strong>Errors:</strong> ${data.errors.join(', ')}</p>` : ''}
        `;
    } else {
        resultDiv.className = 'error-message';
        resultDiv.innerHTML = `
            <h3>❌ Update Failed</h3>
            <p>${data.error || 'Unknown error occurred'}</p>
        `;
    }
    
    // Scroll to result
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Download Tracking IDs Template
function downloadTrackingTemplate() {
    if (typeof XLSX === 'undefined') {
        // Load XLSX library if not available
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
        script.onload = () => {
            createTrackingTemplate();
        };
        document.head.appendChild(script);
    } else {
        createTrackingTemplate();
    }
}

function createTrackingTemplate() {
    const templateData = [
        {
            'Tracking ID': 'TRK123456'
        },
        {
            'Tracking ID': 'TRK789012'
        },
        {
            'Tracking ID': 'TRK345678'
        },
        {
            'Tracking ID': 'TRK901234'
        },
        {
            'Tracking ID': 'TRK567890'
        }
    ];
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tracking IDs Template');
    
    // Set column width
    ws['!cols'] = [
        { wch: 20 } // Tracking ID
    ];
    
    XLSX.writeFile(wb, 'Tracking_IDs_Template.xlsx');
}

// Download Order Numbers Template
function downloadOrderNumberTemplate() {
    if (typeof XLSX === 'undefined') {
        // Load XLSX library if not available
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
        script.onload = () => {
            createOrderNumberTemplate();
        };
        document.head.appendChild(script);
    } else {
        createOrderNumberTemplate();
    }
}

function createOrderNumberTemplate() {
    const templateData = [
        {
            'Order Number': 'ORD001'
        },
        {
            'Order Number': 'ORD002'
        },
        {
            'Order Number': 'ORD003'
        },
        {
            'Order Number': 'ORD004'
        },
        {
            'Order Number': 'ORD005'
        }
    ];
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Order Numbers Template');
    
    // Set column width
    ws['!cols'] = [
        { wch: 20 } // Order Number
    ];
    
    XLSX.writeFile(wb, 'Order_Numbers_Template.xlsx');
}

// Download Tracking Upload Template (Order Number + Tracking ID)
function downloadTrackingUploadTemplate() {
    if (typeof XLSX === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
        script.onload = () => {
            createTrackingUploadTemplate();
        };
        document.head.appendChild(script);
    } else {
        createTrackingUploadTemplate();
    }
}

function createTrackingUploadTemplate() {
    const templateData = [
        {
            'Order Number': 'ORD001',
            'Tracking ID': 'TRK123456'
        },
        {
            'Order Number': 'ORD002',
            'Tracking ID': 'TRK789012'
        },
        {
            'Order Number': 'ORD003',
            'Tracking ID': 'TRK345678'
        },
        {
            'Order Number': 'ORD004',
            'Tracking ID': 'TRK901234'
        },
        {
            'Order Number': 'ORD005',
            'Tracking ID': 'TRK567890'
        }
    ];
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tracking Upload Template');
    
    // Set column widths
    ws['!cols'] = [
        { wch: 20 }, // Order Number
        { wch: 20 }  // Tracking ID
    ];
    
    XLSX.writeFile(wb, 'Tracking_IDs_Upload_Template.xlsx');
}

// Setup tracking file input
function setupTrackingFileInput() {
    const fileInput = document.getElementById('trackingFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                // File will be processed on form submit
            }
        });
    }
}

// Clear tracking form
function clearTrackingForm() {
    document.getElementById('trackingUploadForm').reset();
    document.getElementById('trackingResultMessage').style.display = 'none';
    document.getElementById('trackingFileInput').value = '';
    loadSellersForTracking();
}

// Handle tracking upload form submission
document.getElementById('trackingUploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const sellerName = document.getElementById('trackingSellerSelect').value;
    const fileInput = document.getElementById('trackingFileInput');
    const file = fileInput.files[0];
    
    if (!sellerName || !file) {
        alert('Please select seller and upload file');
        return;
    }
    
    if (typeof XLSX === 'undefined') {
        alert('Excel library not loaded. Please refresh the page.');
        return;
    }
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        // Extract Order Number and Tracking ID
        const updates = jsonData.map(row => {
            const orderNumber = row['Order Number'] || row['order_number'] || row['OrderNumber'] || '';
            const trackingId = row['Tracking ID'] || row['tracking_id'] || row['TrackingId'] || row['Tracking ID'] || '';
            return {
                order_number: String(orderNumber).trim(),
                tracking_id: String(trackingId).trim()
            };
        }).filter(item => item.order_number && item.tracking_id);
        
        if (updates.length === 0) {
            alert('No valid data found in file. Please check the format.');
            return;
        }
        
        if (!confirm(`Are you sure you want to update tracking IDs for ${updates.length} orders?`)) {
            return;
        }
        
        console.log('Sending request with:', { seller_name: sellerName, updates_count: updates.length });
        
        const apiBase = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : (typeof API_BASE !== 'undefined' ? API_BASE : 'http://localhost:3000/api');
        const response = await fetchWithAuth(`${apiBase}/orders/bulk-update-tracking`, {
            method: 'POST',
            body: JSON.stringify({
                seller_name: sellerName,
                updates: updates
            })
        });
        
        if (!response) {
            alert('Failed to connect to server. Please check your authentication.');
            return;
        }
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers.get('content-type'));
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Server returned non-JSON response. Status:', response.status);
            console.error('Response text (first 500 chars):', text.substring(0, 500));
            
            // Try to show more helpful error
            if (response.status === 404) {
                alert('Error: Endpoint not found. Please make sure server is restarted and endpoint exists.');
            } else if (response.status === 401 || response.status === 403) {
                alert('Error: Authentication failed. Please login again.');
            } else {
                alert(`Server error (Status ${response.status}): Received invalid response. Check browser console for details.`);
            }
            return;
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (response.ok) {
            showTrackingResult(data, true);
        } else {
            showTrackingResult(data, false);
        }
    } catch (error) {
        console.error('Error uploading tracking IDs:', error);
        alert('Error uploading tracking IDs: ' + error.message);
    }
});

// Show tracking upload result
function showTrackingResult(data, success) {
    const resultDiv = document.getElementById('trackingResultMessage');
    resultDiv.style.display = 'block';
    
    if (success) {
        resultDiv.className = 'success-message';
        resultDiv.innerHTML = `
            <h3>✅ Upload Successful!</h3>
            <p><strong>Total Processed:</strong> ${data.total_processed || 0}</p>
            <p><strong>Successfully Updated:</strong> ${data.updated_count || 0}</p>
            <p><strong>Not Found:</strong> ${data.not_found_count || 0}</p>
            ${data.not_found && data.not_found.length > 0 ? 
                `<p><strong>Not Found Order Numbers:</strong> ${data.not_found.join(', ')}</p>` : ''}
            ${data.errors && data.errors.length > 0 ? 
                `<p><strong>Errors:</strong> ${data.errors.join(', ')}</p>` : ''}
        `;
    } else {
        resultDiv.className = 'error-message';
        resultDiv.innerHTML = `
            <h3>❌ Upload Failed</h3>
            <p>${data.error || 'Unknown error occurred'}</p>
        `;
    }
    
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Setup bulk return file input
function setupBulkReturnFileInput() {
    const fileInput = document.getElementById('bulkReturnFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    // Check if it's Excel file
                    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                        await readBulkReturnExcelFile(file);
                    } else {
                        // Text file
                        const text = await file.text();
                        document.getElementById('bulkReturnInput').value = text;
                    }
                } catch (error) {
                    alert('Error reading file: ' + error.message);
                }
            }
        });
    }
}

// Read Excel file for bulk return
async function readBulkReturnExcelFile(file) {
    if (typeof XLSX === 'undefined') {
        alert('Excel library not loaded. Please refresh the page.');
        return;
    }
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        // Extract tracking IDs from first column
        const trackingIds = jsonData.map(row => {
            const firstKey = Object.keys(row)[0];
            return row[firstKey] || '';
        }).filter(id => id && id.toString().trim());
        
        document.getElementById('bulkReturnInput').value = trackingIds.join('\n');
    } catch (error) {
        alert('Error reading Excel file: ' + error.message);
    }
}

// Clear bulk return form
function clearBulkReturnForm() {
    document.getElementById('bulkReturnForm').reset();
    document.getElementById('bulkReturnResultMessage').style.display = 'none';
    document.getElementById('bulkReturnFileInput').value = '';
}

// Handle bulk return form submission
if (document.getElementById('bulkReturnForm')) {
    document.getElementById('bulkReturnForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const trackingIdsInput = document.getElementById('bulkReturnInput').value;
        
        if (!trackingIdsInput.trim()) {
            alert('Please enter tracking IDs');
            return;
        }
        
        const trackingIds = parseIds(trackingIdsInput);
        if (trackingIds.length === 0) {
            alert('Please enter at least one tracking ID');
            return;
        }
        
        if (!confirm(`Are you sure you want to mark ${trackingIds.length} orders as return?`)) {
            return;
        }
        
        try {
            console.log('Sending bulk return request with:', { tracking_ids_count: trackingIds.length });
            
            const apiBase = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : (typeof API_BASE !== 'undefined' ? API_BASE : 'http://localhost:3000/api');
            const response = await fetchWithAuth(`${apiBase}/orders/bulk-scan-return`, {
                method: 'POST',
                body: JSON.stringify({
                    tracking_ids: trackingIds
                })
            });
            
            if (!response) {
                alert('Failed to connect to server. Please check your authentication.');
                return;
            }
            
            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers.get('content-type'));
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Server returned non-JSON response. Status:', response.status);
                console.error('Response text (first 500 chars):', text.substring(0, 500));
                
                if (response.status === 404) {
                    alert('Error: Endpoint not found. Please make sure server is restarted.');
                } else if (response.status === 401 || response.status === 403) {
                    alert('Error: Authentication failed. Please login again.');
                } else {
                    alert(`Server error (Status ${response.status}): Received invalid response. Check browser console for details.`);
                }
                return;
            }
            
            const data = await response.json();
            console.log('Response data:', data);
            
            if (response.ok) {
                showBulkReturnResult(data, true);
            } else {
                showBulkReturnResult(data, false);
            }
        } catch (error) {
            console.error('Error in bulk return scan:', error);
            alert('Error in bulk return scan: ' + error.message);
        }
    });
}

// Show bulk return result
function showBulkReturnResult(data, success) {
    const resultDiv = document.getElementById('bulkReturnResultMessage');
    resultDiv.style.display = 'block';
    
    if (success) {
        resultDiv.className = 'success-message';
        resultDiv.innerHTML = `
            <h3>✅ Bulk Return Scan Successful!</h3>
            <p><strong>Total Processed:</strong> ${data.total_processed || 0}</p>
            <p><strong>Successfully Updated:</strong> ${data.updated_count || 0}</p>
            <p><strong>Not Found:</strong> ${data.not_found_count || 0}</p>
            ${data.not_found && data.not_found.length > 0 ? 
                `<p><strong>Not Found Tracking IDs:</strong> ${data.not_found.join(', ')}</p>` : ''}
            ${data.errors && data.errors.length > 0 ? 
                `<p><strong>Errors:</strong> ${data.errors.join(', ')}</p>` : ''}
        `;
    } else {
        resultDiv.className = 'error-message';
        resultDiv.innerHTML = `
            <h3>❌ Bulk Return Scan Failed</h3>
            <p>${data.error || 'Unknown error occurred'}</p>
        `;
    }
    
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

