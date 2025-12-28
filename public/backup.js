let currentBackupData = null;

// Load auto backup settings
async function loadAutoBackupSettings() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch('/api/backup/auto/settings', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            console.error('Failed to load auto backup settings');
            return;
        }

        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.error('Invalid response format from server');
            return;
        }

        const settings = await response.json();
        
        // Update UI
        document.getElementById('autoBackupEnabled').checked = settings.enabled === 1;
        document.getElementById('autoBackupEmail').value = settings.email || '';
        
        const statusText = settings.enabled === 1 ? 
            `<span style="color: #4caf50; font-weight: bold;">✅ Active</span>` : 
            `<span style="color: #ff9800; font-weight: bold;">⏸️ Paused</span>`;
        
        document.getElementById('autoBackupStatusText').innerHTML = statusText;
        document.getElementById('lastBackupDate').textContent = settings.last_backup_date ? 
            new Date(settings.last_backup_date).toLocaleString() : 'Never';
        document.getElementById('nextBackupDate').textContent = settings.next_backup_date ? 
            new Date(settings.next_backup_date).toLocaleString() : 'Not scheduled';
    } catch (error) {
        console.error('Error loading auto backup settings:', error);
    }
}

// Update auto backup settings
async function updateAutoBackupSettings() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showMessage('autoBackupMessage', 'Please login first', 'error');
            return;
        }

        const enabled = document.getElementById('autoBackupEnabled').checked ? 1 : 0;
        const email = document.getElementById('autoBackupEmail').value;

        const response = await fetch('/api/backup/auto/settings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ enabled, email })
        });

        if (!response.ok) {
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update settings');
            } else {
                throw new Error('Server error: Invalid response format');
            }
        }

        showMessage('autoBackupMessage', '✅ Auto backup settings updated successfully!', 'success');
        loadAutoBackupSettings();
    } catch (error) {
        showMessage('autoBackupMessage', `❌ Error: ${error.message}`, 'error');
    }
}

// Trigger manual backup
async function triggerManualBackup() {
    if (!confirm('Are you sure you want to trigger a manual backup now?')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showMessage('autoBackupMessage', 'Please login first', 'error');
            return;
        }

        showMessage('autoBackupMessage', '🔄 Triggering backup... Please wait.', 'info');

        const response = await fetch('/api/backup/auto/trigger', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to trigger backup');
            } else {
                throw new Error('Server error: Invalid response format');
            }
        }

        showMessage('autoBackupMessage', '✅ Backup triggered successfully! Check server logs for details.', 'success');
        
        // Reload settings after a delay
        setTimeout(() => {
            loadAutoBackupSettings();
        }, 2000);
    } catch (error) {
        showMessage('autoBackupMessage', `❌ Error: ${error.message}`, 'error');
    }
}

// Load settings on page load
window.addEventListener('DOMContentLoaded', () => {
    loadAutoBackupSettings();
});

// Create backup
async function createBackup() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showMessage('backupStatus', 'Please login first', 'error');
            return;
        }

        showMessage('backupStatus', 'Creating backup...', 'info');
        
        const response = await fetch('/api/backup/create', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create backup');
            } else {
                throw new Error('Server error: Invalid response format. Please check your connection.');
            }
        }

        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Server error: Invalid response format. Please check your connection.');
        }

        const data = await response.json();
        currentBackupData = data;
        
        // Enable download buttons
        document.getElementById('downloadBackupBtn').disabled = false;
        document.getElementById('downloadBackupCSVBtn').disabled = false;
        document.getElementById('uploadToDriveBtn').disabled = false;
        
        // Enable individual download buttons
        document.getElementById('downloadOrdersBtn').disabled = false;
        document.getElementById('downloadProductsBtn').disabled = false;
        document.getElementById('downloadBillsBtn').disabled = false;
        document.getElementById('downloadDispatchedBtn').disabled = false;
        document.getElementById('downloadUsersBtn').disabled = false;
        
        showMessage('backupStatus', `✅ Backup created successfully! (${data.timestamp})`, 'success');
    } catch (error) {
        showMessage('backupStatus', `❌ Error: ${error.message}`, 'error');
    }
}

// Download backup as Excel or CSV
function downloadBackup(format = 'excel') {
    if (!currentBackupData) {
        showMessage('backupStatus', 'Please create a backup first', 'error');
        return;
    }

    const timestamp = currentBackupData.timestamp.replace(/[:.]/g, '-').replace(/T/g, '_').split('.')[0];
    
    if (format === 'csv') {
        // Download CSV - create separate CSV files for each table
        downloadBackupAsCSV(timestamp);
    } else {
        // Download Excel with multiple sheets (requires XLSX library)
        if (typeof XLSX === 'undefined') {
            showMessage('backupStatus', 'Excel library not loaded. Please refresh the page.', 'error');
            return;
        }
        downloadBackupAsExcel(timestamp);
    }
}

// Download backup as Excel with multiple sheets (all data in one file with separate sheets)
function downloadBackupAsExcel(timestamp) {
    const wb = XLSX.utils.book_new();
    
    // Helper function to convert array of objects to worksheet
    const createSheet = (data, sheetName) => {
        if (!data || data.length === 0) {
            // Create empty sheet with headers if no data
            const emptyData = [{}];
            return XLSX.utils.json_to_sheet(emptyData);
        }
        return XLSX.utils.json_to_sheet(data);
    };
    
    // Create sheets for each table (always create sheets, even if empty)
    const wsOrders = createSheet(currentBackupData.orders || [], 'Orders');
    XLSX.utils.book_append_sheet(wb, wsOrders, 'Orders');
    
    const wsProducts = createSheet(currentBackupData.products || [], 'Products');
    XLSX.utils.book_append_sheet(wb, wsProducts, 'Products');
    
    const wsBills = createSheet(currentBackupData.bills || [], 'Bills');
    XLSX.utils.book_append_sheet(wb, wsBills, 'Bills');
    
    const wsDispatched = createSheet(currentBackupData.dispatched_parcels || [], 'Dispatched');
    XLSX.utils.book_append_sheet(wb, wsDispatched, 'Dispatched');
    
    const wsUsers = createSheet(currentBackupData.users || [], 'Users');
    XLSX.utils.book_append_sheet(wb, wsUsers, 'Users');
    
    // Add metadata sheet
    const metadata = [{
        'Backup Timestamp': currentBackupData.timestamp,
        'Version': currentBackupData.version || '1.0',
        'Total Orders': currentBackupData.orders?.length || 0,
        'Total Products': currentBackupData.products?.length || 0,
        'Total Bills': currentBackupData.bills?.length || 0,
        'Total Dispatched Parcels': currentBackupData.dispatched_parcels?.length || 0,
        'Total Users': currentBackupData.users?.length || 0
    }];
    const wsMetadata = XLSX.utils.json_to_sheet(metadata);
    XLSX.utils.book_append_sheet(wb, wsMetadata, 'Metadata');
    
    const filename = `backup_${timestamp}.xlsx`;
    XLSX.writeFile(wb, filename);
    
    showMessage('backupStatus', '✅ Excel backup downloaded successfully with separate sheets!', 'success');
}

// Download specific data type as separate Excel file
function downloadSpecificData(type) {
    if (!currentBackupData) {
        showMessage('backupStatus', 'Please create a backup first', 'error');
        return;
    }

    if (typeof XLSX === 'undefined') {
        showMessage('backupStatus', 'Excel library not loaded. Please refresh the page.', 'error');
        return;
    }

    const timestamp = currentBackupData.timestamp.replace(/[:.]/g, '-').replace(/T/g, '_').split('.')[0];
    const wb = XLSX.utils.book_new();
    
    let data = [];
    let filename = '';
    let sheetName = '';
    
    switch(type) {
        case 'orders':
            data = currentBackupData.orders || [];
            filename = `backup_orders_${timestamp}.xlsx`;
            sheetName = 'Orders';
            break;
        case 'products':
            data = currentBackupData.products || [];
            filename = `backup_products_${timestamp}.xlsx`;
            sheetName = 'Products';
            break;
        case 'bills':
            data = currentBackupData.bills || [];
            filename = `backup_bills_${timestamp}.xlsx`;
            sheetName = 'Bills';
            break;
        case 'dispatched':
            data = currentBackupData.dispatched_parcels || [];
            filename = `backup_dispatched_${timestamp}.xlsx`;
            sheetName = 'Dispatched';
            break;
        case 'users':
            data = currentBackupData.users || [];
            filename = `backup_users_${timestamp}.xlsx`;
            sheetName = 'Users';
            break;
        default:
            showMessage('backupStatus', 'Invalid data type', 'error');
            return;
    }
    
    if (data.length === 0) {
        showMessage('backupStatus', `No ${sheetName} data available to download`, 'error');
        return;
    }
    
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
    
    showMessage('backupStatus', `✅ ${sheetName} downloaded successfully!`, 'success');
}

// Download backup as CSV (creates separate CSV files for each table)
function downloadBackupAsCSV(timestamp) {
    // Helper to convert object array to CSV string (optimized for performance)
    const arrayToCSV = (data, tableName) => {
        if (!data || data.length === 0) {
            return null; // No data to export
        }
        
        // Get headers from first object - ensure consistent order
        const headers = Object.keys(data[0]);
        
        // Create header row with proper escaping
        const headerRow = headers.map(h => {
            // Convert snake_case to Title Case for better readability
            const formattedHeader = h.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            return `"${formattedHeader.replace(/"/g, '""')}"`;
        }).join(',');
        
        // Build CSV content efficiently
        const rows = [];
        rows.push(headerRow);
        
        // Process rows in batches for better performance
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const values = headers.map(header => {
                const value = row[header];
                // Handle null, undefined, dates, and escape quotes for CSV
                if (value === null || value === undefined) return '';
                // Convert dates to readable format
                if (value instanceof Date) {
                    return `"${value.toISOString().replace('T', ' ').split('.')[0]}"`;
                }
                const str = String(value).replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '');
                return `"${str}"`;
            });
            rows.push(values.join(','));
        }
        
        return rows.join('\n');
    };
    
    // Download each table as a separate CSV file
    const tables = [
        { data: currentBackupData.orders, name: 'Orders' },
        { data: currentBackupData.products, name: 'Products' },
        { data: currentBackupData.bills, name: 'Bills' },
        { data: currentBackupData.dispatched_parcels, name: 'Dispatched_Parcels' },
        { data: currentBackupData.users, name: 'Users' }
    ];
    
    // Filter tables that have data
    const tablesWithData = tables.filter(table => table.data && table.data.length > 0);
    
    if (tablesWithData.length === 0) {
        showMessage('backupStatus', 'No data to export', 'error');
        return;
    }
    
    // Use requestAnimationFrame for smoother downloads
    let downloadIndex = 0;
    
    const downloadNextFile = () => {
        if (downloadIndex >= tablesWithData.length) {
            showMessage('backupStatus', `✅ CSV backup downloaded successfully! (${tablesWithData.length} file${tablesWithData.length > 1 ? 's' : ''})`, 'success');
            return;
        }
        
        const table = tablesWithData[downloadIndex];
        const csvContent = arrayToCSV(table.data, table.name);
        
        if (csvContent) {
            // Use BOM for Excel UTF-8 support
            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `backup_${timestamp}_${table.name}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
        
        downloadIndex++;
        // Small delay between downloads
        if (downloadIndex < tablesWithData.length) {
            setTimeout(() => requestAnimationFrame(downloadNextFile), 150);
        } else {
            requestAnimationFrame(downloadNextFile);
        }
    };
    
    requestAnimationFrame(downloadNextFile);
}

// Open Google Drive
function openGoogleDrive() {
    window.open('https://drive.google.com', '_blank');
}

// Upload to Google Drive (opens Google Drive in new tab with instructions)
function uploadToDrive() {
    if (!currentBackupData) {
        showMessage('driveStatus', 'Please create a backup first', 'error');
        return;
    }

    // First download the Excel file (default format)
    downloadBackup('excel');
    
    // Show instructions
    showMessage('driveStatus', 
        '📥 Backup file downloaded! Now:<br>1. Go to Google Drive (link opened in new tab)<br>2. Click "New" → "File upload"<br>3. Select the downloaded backup Excel/CSV file<br>4. Your backup is now in Google Drive!', 
        'info'
    );
    
    // Open Google Drive
    setTimeout(() => {
        openGoogleDrive();
    }, 500);
}

// Preview backup file
function previewBackup() {
    const fileInput = document.getElementById('restoreFileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        showMessage('restoreStatus', 'Please select a backup file first', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            const preview = document.getElementById('backupPreview');
            preview.style.display = 'block';
            
            preview.innerHTML = `
                <h3 style="color: #0f766e; margin-top: 0;">Backup Preview</h3>
                <div style="background: white; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
                    <p><strong>Timestamp:</strong> ${data.timestamp || 'N/A'}</p>
                    <p><strong>Orders:</strong> ${data.orders?.length || 0}</p>
                    <p><strong>Products:</strong> ${data.products?.length || 0}</p>
                    <p><strong>Bills:</strong> ${data.bills?.length || 0}</p>
                    <p><strong>Users:</strong> ${data.users?.length || 0}</p>
                </div>
                <button onclick="document.getElementById('backupPreview').style.display='none'" class="btn-secondary">
                    Close Preview
                </button>
            `;
        } catch (error) {
            showMessage('restoreStatus', 'Invalid backup file format', 'error');
        }
    };
    reader.readAsText(file);
}

// Restore backup
async function restoreBackup() {
    const fileInput = document.getElementById('restoreFileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        showMessage('restoreStatus', 'Please select a backup file first', 'error');
        return;
    }

    if (!confirm('⚠️ WARNING: This will replace ALL current data with the backup data. This cannot be undone!\n\nAre you sure you want to continue?')) {
        return;
    }

    if (!confirm('This is your last chance. Click OK to proceed with restore, or Cancel to abort.')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showMessage('restoreStatus', 'Please login first', 'error');
            return;
        }

        showMessage('restoreStatus', 'Restoring backup... This may take a moment.', 'info');
        
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const backupData = JSON.parse(e.target.result);
                
                const response = await fetch('/api/backup/restore', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(backupData)
                });

                if (!response.ok) {
                    // Check if response is JSON
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const error = await response.json();
                        throw new Error(error.error || 'Failed to restore backup');
                    } else {
                        throw new Error('Server error: Invalid response format. Please check your connection.');
                    }
                }

                // Check if response is JSON
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('Server error: Invalid response format. Please check your connection.');
                }

                const data = await response.json();
                showMessage('restoreStatus', 
                    `✅ Backup restored successfully!<br>Restored: ${data.restored.orders} orders, ${data.restored.products} products, ${data.restored.bills} bills, ${data.restored.users} users`, 
                    'success'
                );
                
                // Clear file input
                fileInput.value = '';
                document.getElementById('backupPreview').style.display = 'none';
                
                // Reload page after 3 seconds
                setTimeout(() => {
                    window.location.reload();
                }, 3000);
            } catch (error) {
                showMessage('restoreStatus', `❌ Error: ${error.message}`, 'error');
            }
        };
        reader.readAsText(file);
    } catch (error) {
        showMessage('restoreStatus', `❌ Error: ${error.message}`, 'error');
    }
}

// Show message
function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.style.display = 'block';
    element.innerHTML = message;
    
    // Remove old classes
    element.classList.remove('success', 'error', 'info');
    
    // Add appropriate styling
    if (type === 'success') {
        element.style.background = '#d4edda';
        element.style.color = '#155724';
        element.style.border = '1px solid #c3e6cb';
    } else if (type === 'error') {
        element.style.background = '#f8d7da';
        element.style.color = '#721c24';
        element.style.border = '1px solid #f5c6cb';
    } else {
        element.style.background = '#d1ecf1';
        element.style.color = '#0c5460';
        element.style.border = '1px solid #bee5eb';
    }
}

