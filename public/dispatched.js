// Live Date/Time Display
function updateLiveDateTime() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    const timeStr = now.toLocaleTimeString('en-US', { 
        hour12: true, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    document.getElementById('liveDateTime').textContent = `${dateStr} - ${timeStr}`;
}

// Update every second
setInterval(updateLiveDateTime, 1000);
updateLiveDateTime();

// Auto-scan timer
let autoScanTimer = null;

// Set today's date as default
document.addEventListener('DOMContentLoaded', () => {
    const dateFilter = document.getElementById('dateFilter');
    const today = new Date().toISOString().split('T')[0];
    dateFilter.value = today;
    loadDispatchedParcels();
    loadStats();
    
    // Focus on tracking input
    const trackingInput = document.getElementById('trackingIdInput');
    if (trackingInput) {
        trackingInput.focus();
        
        // Auto-scan on input (after 500ms delay)
        trackingInput.addEventListener('input', function() {
            const value = this.value.trim();
            
            // Clear previous timer
            if (autoScanTimer) {
                clearTimeout(autoScanTimer);
            }
            
            // If there's a value and it looks like a complete tracking ID (at least 5 characters)
            if (value.length >= 5) {
                autoScanTimer = setTimeout(() => {
                    scanParcel();
                }, 500); // Wait 500ms after last input
            }
        });
        
        // Also handle paste events
        trackingInput.addEventListener('paste', function() {
            setTimeout(() => {
                const value = this.value.trim();
                if (value.length >= 5) {
                    if (autoScanTimer) {
                        clearTimeout(autoScanTimer);
                    }
                    autoScanTimer = setTimeout(() => {
                        scanParcel();
                    }, 300);
                }
            }, 10);
        });
    }
});

// Detect courier from tracking ID
function detectCourier(trackingId) {
    if (!trackingId || trackingId.trim() === '') return 'Unknown';
    const trimmed = trackingId.trim().toUpperCase();
    
    if (trimmed.startsWith('17')) return 'TCS';
    if (trimmed.startsWith('56') || trimmed.startsWith('55')) return 'M&P';
    if (trimmed.startsWith('19')) return 'Trax';
    if (trimmed.startsWith('AM')) return 'Leopard';
    
    return 'Unknown';
}

// Scan parcel
async function scanParcel() {
    const trackingIdInput = document.getElementById('trackingIdInput');
    const trackingId = trackingIdInput.value.trim();
    const scanResult = document.getElementById('scanResult');
    
    if (!trackingId) {
        scanResult.style.display = 'block';
        scanResult.innerHTML = '<div style="padding: 10px; background: #ffebee; color: #c62828; border-radius: 5px; border: 1px solid #ef5350;">Please enter a tracking ID</div>';
        return;
    }
    
    const courier = detectCourier(trackingId);
    
    // Show warning if courier is Unknown
    if (courier === 'Unknown') {
        scanResult.style.display = 'block';
        scanResult.innerHTML = `
            <div style="padding: 10px; background: #fff3cd; color: #856404; border-radius: 5px; border: 1px solid #ffc107;">
                ⚠️ <strong>Warning:</strong> Tracking ID format is not correct!<br>
                Expected formats: Starts with 17 (TCS), 55/56 (M&P), 19 (Trax), or AM (Leopard)<br>
                Current ID: <strong>${escapeHtml(trackingId)}</strong>
            </div>
        `;
        
        // Ask user if they still want to proceed
        if (!confirm('Tracking ID format is not recognized. Do you still want to dispatch it as Unknown?')) {
            trackingIdInput.value = '';
            trackingIdInput.focus();
            return;
        }
    }
    
    try {
        const response = await fetchWithAuth(`${API_BASE}/dispatched/scan`, {
            method: 'POST',
            body: JSON.stringify({ tracking_id: trackingId })
        });
        
        if (!response) {
            scanResult.style.display = 'block';
            scanResult.innerHTML = '<div style="padding: 10px; background: #ffebee; color: #c62828; border-radius: 5px; border: 1px solid #ef5350;">Failed to connect to server</div>';
            return;
        }
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            scanResult.style.display = 'block';
            scanResult.innerHTML = `
                <div style="padding: 10px; background: #ffebee; color: #c62828; border-radius: 5px; border: 1px solid #ef5350;">
                    ❌ Server error: Invalid response format. Please check server connection.
                </div>
            `;
            console.error('Non-JSON response:', text);
            return;
        }
        
        const data = await response.json();
        
        if (response.ok) {
            const warningMsg = courier === 'Unknown' ? '<br><div style="margin-top: 10px; padding: 8px; background: rgba(255, 152, 0, 0.1); border-left: 3px solid #ff9800; border-radius: 5px; color: #ff9800; font-weight: 600;">⚠️ Warning: Unknown courier format</div>' : '';
            scanResult.className = 'scan-result';
            scanResult.style.display = 'block';
            scanResult.style.background = '#e8f5e9';
            scanResult.style.color = '#2e7d32';
            scanResult.style.border = '2px solid #4caf50';
            scanResult.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                    <span style="font-size: 24px;">✅</span>
                    <strong style="font-size: 18px;">Parcel dispatched successfully!</strong>
                </div>
                <div style="display: grid; grid-template-columns: auto 1fr; gap: 10px 15px; margin-top: 15px;">
                    <strong>Tracking ID:</strong> <span>${escapeHtml(data.tracking_id)}</span>
                    <strong>Courier:</strong> <span>${escapeHtml(data.courier)}</span>
                    <strong>Date:</strong> <span>${data.dispatch_date}</span>
                    <strong>Time:</strong> <span>${data.dispatch_time}</span>
                </div>
                ${warningMsg}
            `;
            trackingIdInput.value = '';
            trackingIdInput.focus();
            
            // Reload parcels and stats
            setTimeout(() => {
                loadDispatchedParcels();
                loadStats();
            }, 500);
        } else {
            scanResult.className = 'scan-result';
            scanResult.style.display = 'block';
            scanResult.style.background = '#ffebee';
            scanResult.style.color = '#c62828';
            scanResult.style.border = '2px solid #ef5350';
            scanResult.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 24px;">❌</span>
                    <strong>${data.error || 'Failed to dispatch parcel'}</strong>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error scanning parcel:', error);
        scanResult.style.display = 'block';
        scanResult.innerHTML = `
            <div style="padding: 10px; background: #ffebee; color: #c62828; border-radius: 5px; border: 1px solid #ef5350;">
                Error: ${error.message || 'Network error. Please check your connection.'}
            </div>
        `;
    }
}

// Download all dispatched parcels
async function downloadDispatchedParcels() {
    const dateFilter = document.getElementById('dateFilter');
    const date = dateFilter.value || new Date().toISOString().split('T')[0];
    
    try {
        const response = await fetchWithAuth(`${API_BASE}/dispatched?date=${date}`);
        
        if (!response) {
            alert('Failed to connect to server');
            return;
        }
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            alert('Server error: Invalid response format');
            return;
        }
        
        const parcels = await response.json();
        
        if (parcels.length === 0) {
            alert('No parcels to download for this date');
            return;
        }
        
        // Prepare CSV data
        const headers = ['Tracking ID', 'Courier', 'Dispatch Date', 'Dispatch Time', 'Status', 'Order Number', 'Customer Name', 'Order Status'];
        const rows = parcels.map(parcel => [
            parcel.tracking_id || '',
            parcel.courier || '',
            parcel.dispatch_date || '',
            parcel.dispatch_time || '',
            parcel.parcel_status || 'dispatched',
            parcel.order_number || '',
            parcel.customer_name || '',
            parcel.order_status || ''
        ]);
        
        // Create CSV content
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        
        // Create blob and download
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `dispatched_parcels_${date}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert(`Downloaded ${parcels.length} parcels successfully!`);
    } catch (error) {
        console.error('Error downloading parcels:', error);
        alert('Error downloading parcels: ' + error.message);
    }
}

// Load dispatched parcels
async function loadDispatchedParcels() {
    const dateFilter = document.getElementById('dateFilter');
    const date = dateFilter.value || new Date().toISOString().split('T')[0];
    const tbody = document.getElementById('parcelsTableBody');
    
            tbody.innerHTML = '<tr><td colspan="9" class="loading">Loading dispatched parcels...</td></tr>';
    
    try {
        const response = await fetchWithAuth(`${API_BASE}/dispatched?date=${date}`);
        
        if (!response) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #c62828;">Failed to load parcels</td></tr>';
            return;
        }
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #c62828;">Server error: Invalid response format</td></tr>';
            console.error('Non-JSON response:', text);
            return;
        }
        
        const parcels = await response.json();
        
        if (parcels.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #666;">No parcels dispatched on this date</td></tr>';
            return;
        }
        
        tbody.innerHTML = parcels.map(parcel => {
            const status = parcel.parcel_status || 'dispatched';
            let statusBadge = '';
            let statusColor = '';
            let statusClass = '';
            
            if (status === 'return') {
                statusBadge = '🔄 RETURN';
                statusColor = '#ff9800';
                statusClass = 'status-badge';
            } else if (status === 'delivered') {
                statusBadge = '✅ DELIVERED';
                statusColor = '#4caf50';
                statusClass = 'status-badge';
            } else {
                statusBadge = '📤 DISPATCHED';
                statusColor = '#2196f3';
                statusClass = 'status-badge';
            }
            
            const courierColors = {
                'TCS': { bg: '#2196f3', color: 'white' },
                'M&P': { bg: '#ff9800', color: 'white' },
                'Trax': { bg: '#9c27b0', color: 'white' },
                'Leopard': { bg: '#4caf50', color: 'white' },
                'Unknown': { bg: '#757575', color: 'white' }
            };
            
            const courierStyle = courierColors[parcel.courier] || courierColors['Unknown'];
            
            // Escape tracking ID for use in onclick
            const safeTrackingId = escapeHtml(parcel.tracking_id).replace(/'/g, "\\'");
            
            // Get order ID from order_number or use tracking_id as fallback
            const orderIdDisplay = parcel.order_number ? escapeHtml(parcel.order_number) : (parcel.tracking_id ? escapeHtml(parcel.tracking_id) : '-');
            const orderIdValue = parcel.order_id || parcel.id || '';
            
            return `
                <tr>
                    <td><strong style="color: #212529; font-size: 14px;">${escapeHtml(parcel.tracking_id)}</strong></td>
                    <td>
                        <span class="courier-badge" style="background: ${courierStyle.bg}; color: ${courierStyle.color}; padding: 4px 10px; border-radius: 5px; font-size: 11px; font-weight: 600;">
                            ${escapeHtml(parcel.courier)}
                        </span>
                    </td>
                    <td>${parcel.dispatch_date}</td>
                    <td>${parcel.dispatch_time}</td>
                    <td>
                        <span class="${statusClass}" style="background: ${statusColor}; color: white; padding: 4px 10px; border-radius: 5px; font-size: 10px; font-weight: 600;">
                            ${statusBadge}
                        </span>
                    </td>
                    <td>${parcel.order_number ? escapeHtml(parcel.order_number) : '<span style="color: #999;">-</span>'}</td>
                    <td>
                        ${orderIdValue ? `<button class="dispatched-btn" onclick="viewOrder('${escapeHtml(parcel.tracking_id)}')" title="View Order">📦 ${orderIdDisplay}</button>` : '<span style="color: #999;">-</span>'}
                    </td>
                    <td>${parcel.customer_name ? escapeHtml(parcel.customer_name) : '<span style="color: #999;">-</span>'}</td>
                    <td>
                        <button onclick="deleteParcel(${parcel.id}, '${safeTrackingId}')" 
                                class="delete-btn"
                                title="Delete this parcel">
                            🗑️
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading dispatched parcels:', error);
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #c62828;">Error loading parcels: ' + error.message + '</td></tr>';
    }
}

// View order details
function viewOrder(trackingId) {
    // Open orders page and filter by tracking ID
    window.location.href = `orders.html?tracking=${encodeURIComponent(trackingId)}`;
}

// Delete parcel
async function deleteParcel(id, trackingId) {
    if (!id || !trackingId) {
        alert('Error: Invalid parcel information');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete parcel?\n\nTracking ID: ${trackingId}\n\nThis action cannot be undone.`)) {
        return;
    }
    
    const tbody = document.getElementById('parcelsTableBody');
    const originalContent = tbody.innerHTML;
    
    try {
        // Show loading state
        tbody.innerHTML = '<tr><td colspan="9" class="loading">Deleting parcel...</td></tr>';
        
        const response = await fetchWithAuth(`${API_BASE}/dispatched/${id}`, {
            method: 'DELETE'
        });
        
        if (!response) {
            tbody.innerHTML = originalContent;
            alert('❌ Failed to connect to server. Please check your connection.');
            return;
        }
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            tbody.innerHTML = originalContent;
            console.error('Non-JSON response:', text);
            alert('❌ Server error: Invalid response format');
            return;
        }
        
        const data = await response.json();
        
        if (response.ok) {
            // Show success message
            tbody.innerHTML = '<tr><td colspan="8" class="loading" style="color: #4caf50; font-weight: 600;">✅ Parcel deleted successfully!</td></tr>';
            
            // Reload after short delay
            setTimeout(() => {
                loadDispatchedParcels();
                loadStats();
            }, 500);
        } else {
            tbody.innerHTML = originalContent;
            alert(`❌ ${data.error || 'Failed to delete parcel'}`);
        }
    } catch (error) {
        console.error('Error deleting parcel:', error);
        tbody.innerHTML = originalContent;
        alert(`❌ Error: ${error.message || 'Network error. Please try again.'}`);
    }
}

// Load statistics
async function loadStats() {
    const dateFilter = document.getElementById('dateFilter');
    const date = dateFilter.value || new Date().toISOString().split('T')[0];
    const statsDiv = document.getElementById('dashboardStats');
    
    try {
        const response = await fetchWithAuth(`${API_BASE}/dispatched/stats?date=${date}`);
        
        if (!response) {
            statsDiv.innerHTML = '<div style="grid-column: 1/-1; padding: 15px; background: #ffebee; color: #c62828; border-radius: 5px;">Failed to load statistics</div>';
            return;
        }
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            statsDiv.innerHTML = '<div style="grid-column: 1/-1; padding: 15px; background: #ffebee; color: #c62828; border-radius: 5px;">Server error: Invalid response format</div>';
            return;
        }
        
        const stats = await response.json();
        
        const courierColors = {
            'TCS': { bg: '#2196f3', color: 'white' },
            'M&P': { bg: '#ff9800', color: 'white' },
            'Trax': { bg: '#9c27b0', color: 'white' },
            'Leopard': { bg: '#4caf50', color: 'white' },
            'Unknown': { bg: '#757575', color: 'white' }
        };
        
        let html = `
            <div class="stat-card" style="grid-column: 1/-1; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);">
                <div class="stat-number" style="color: white; -webkit-text-fill-color: white;">${stats.total}</div>
                <div class="stat-label" style="color: rgba(255,255,255,0.9);">Total Parcels Dispatched</div>
            </div>
        `;
        
        ['TCS', 'M&P', 'Trax', 'Leopard'].forEach(courier => {
            const count = stats.by_courier[courier] || 0;
            const colors = courierColors[courier] || courierColors['Unknown'];
            html += `
                <div class="stat-card" style="background: ${colors.bg}; color: ${colors.color}; border: 2px solid ${colors.bg};">
                    <div class="stat-number" style="color: ${colors.color}; -webkit-text-fill-color: ${colors.color};">${count}</div>
                    <div class="stat-label" style="color: ${colors.color === 'white' ? 'rgba(255,255,255,0.9)' : '#666'};">
                        ${courier}
                    </div>
                </div>
            `;
        });
        
        statsDiv.innerHTML = html;
    } catch (error) {
        console.error('Error loading statistics:', error);
        statsDiv.innerHTML = '<div style="grid-column: 1/-1; padding: 15px; background: #ffebee; color: #c62828; border-radius: 5px;">Error loading statistics: ' + error.message + '</div>';
    }
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

