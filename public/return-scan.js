// Return Scan - Track scanned return tracking IDs
let scansCache = [];

// Initialize page
window.addEventListener('DOMContentLoaded', async () => {
    // Set current date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    document.getElementById('dateFilter').value = today;
    
    // Load sellers
    await loadSellers();
    
    // Load scans
    await loadScans();
    
    // Focus on input
    document.getElementById('trackingInput').focus();
});

// Load sellers for filter
async function loadSellers() {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const sellerFilter = document.getElementById('sellerFilter');
        
        if (user.role === 'admin') {
            const response = await fetchWithAuth(`${API_BASE}/sellers`);
            if (response && response.ok) {
                const sellers = await response.json();
                sellers.forEach(seller => {
                    const option = document.createElement('option');
                    option.value = seller.username;
                    option.textContent = seller.username;
                    sellerFilter.appendChild(option);
                });
            }
        } else {
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

// Scan tracking ID
async function scanTrackingId() {
    const input = document.getElementById('trackingInput');
    const trackingId = input.value.trim();
    
    if (!trackingId) {
        alert('Please enter a tracking ID');
        input.focus();
        return;
    }
    
    try {
        const response = await fetchWithAuth(`${API_BASE}/return-scan`, {
            method: 'POST',
            body: JSON.stringify({ tracking_id: trackingId })
        });
        
        if (!response) {
            alert('Failed to scan tracking ID');
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Show last scan info
            showLastScanInfo(data.scan, data.order);
            
            // Play success sound (optional)
            playBeep(true);
            
            // Clear input and reload
            input.value = '';
            await loadScans();
        } else {
            // Already scanned
            showLastScanInfo(data.scan, data.order);
            alert(data.message || 'Already scanned today');
            playBeep(false);
        }
        
        input.focus();
    } catch (error) {
        console.error('Error scanning:', error);
        alert('Error: ' + error.message);
        input.focus();
    }
}

// Show last scan info
function showLastScanInfo(scan, order) {
    const infoDiv = document.getElementById('lastScanInfo');
    
    document.getElementById('lastTrackingId').textContent = scan.tracking_id || '-';
    document.getElementById('lastOrderNumber').textContent = scan.order_number || 'Not Found';
    document.getElementById('lastSellerName').textContent = scan.seller_name || 'Unknown';
    document.getElementById('lastStatus').textContent = order ? 'Found in Orders' : 'Not in System';
    document.getElementById('lastScanTime').textContent = scan.scan_time || '-';
    
    infoDiv.classList.add('show');
    
    // Update status color
    const statusSpan = document.getElementById('lastStatus');
    if (order) {
        statusSpan.style.color = '#27ae60';
    } else {
        statusSpan.style.color = '#f39c12';
    }
}

// Play beep sound
function playBeep(success) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = success ? 800 : 300;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.15);
    } catch (e) {
        // Audio not supported
    }
}

// Load scans
async function loadScans() {
    const dateFilter = document.getElementById('dateFilter').value;
    const sellerFilter = document.getElementById('sellerFilter').value;
    
    const tbody = document.getElementById('scansTableBody');
    tbody.innerHTML = '<tr><td colspan="10" class="empty-message">Loading scans...</td></tr>';
    
    try {
        let url = `${API_BASE}/return-scans`;
        const params = [];
        
        if (dateFilter) {
            params.push(`date=${dateFilter}`);
        }
        if (sellerFilter) {
            params.push(`seller_name=${encodeURIComponent(sellerFilter)}`);
        }
        
        if (params.length > 0) {
            url += '?' + params.join('&');
        }
        
        const response = await fetchWithAuth(url);
        
        if (!response || !response.ok) {
            tbody.innerHTML = '<tr><td colspan="10" class="empty-message">Failed to load scans</td></tr>';
            return;
        }
        
        const scans = await response.json();
        scansCache = scans;
        
        displayScans(scans);
        updateStats(scans);
    } catch (error) {
        console.error('Error loading scans:', error);
        tbody.innerHTML = `<tr><td colspan="10" class="empty-message">Error: ${error.message}</td></tr>`;
    }
}

// Display scans in table
function displayScans(scans) {
    const tbody = document.getElementById('scansTableBody');
    
    if (!scans || scans.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty-message">No scans found. Start scanning tracking IDs!</td></tr>';
        return;
    }
    
    tbody.innerHTML = scans.map((scan, index) => {
        const isFound = scan.order_number && scan.order_number !== 'null';
        const statusClass = isFound ? 'status-found' : 'status-notfound';
        const statusText = isFound ? 'Found' : 'Not Found';
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td class="tracking-id-cell">${escapeHtml(scan.tracking_id)}</td>
                <td><strong>${escapeHtml(scan.order_number || '-')}</strong></td>
                <td>${escapeHtml(scan.seller_name || 'Unknown')}</td>
                <td>${escapeHtml(scan.customer_name || '-')}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>${scan.scan_date || '-'}</td>
                <td>${scan.scan_time || '-'}</td>
                <td>${escapeHtml(scan.scanned_by || '-')}</td>
                <td>
                    <button onclick="deleteScan(${scan.id})" class="btn-delete">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Update stats
function updateStats(scans) {
    const today = new Date().toISOString().split('T')[0];
    
    const totalScans = scans.length;
    const todayScans = scans.filter(s => s.scan_date === today).length;
    const foundOrders = scans.filter(s => s.order_number && s.order_number !== 'null').length;
    const notFoundOrders = totalScans - foundOrders;
    
    document.getElementById('totalScans').textContent = totalScans;
    document.getElementById('todayScans').textContent = todayScans;
    document.getElementById('foundOrders').textContent = foundOrders;
    document.getElementById('notFoundOrders').textContent = notFoundOrders;
}

// Filter table
function filterTable() {
    const searchTerm = document.getElementById('searchFilter').value.toLowerCase().trim();
    
    if (!searchTerm) {
        displayScans(scansCache);
        return;
    }
    
    const filtered = scansCache.filter(scan => {
        return (scan.tracking_id || '').toLowerCase().includes(searchTerm) ||
               (scan.order_number || '').toLowerCase().includes(searchTerm) ||
               (scan.seller_name || '').toLowerCase().includes(searchTerm);
    });
    
    displayScans(filtered);
}

// Delete scan
async function deleteScan(id) {
    if (!confirm('Are you sure you want to delete this scan?')) {
        return;
    }
    
    try {
        const response = await fetchWithAuth(`${API_BASE}/return-scans/${id}`, {
            method: 'DELETE'
        });
        
        if (response && response.ok) {
            await loadScans();
        } else {
            alert('Failed to delete scan');
        }
    } catch (error) {
        console.error('Error deleting scan:', error);
        alert('Error: ' + error.message);
    }
}

// Clear today's scans
async function clearTodayScans() {
    const today = new Date().toISOString().split('T')[0];
    
    if (!confirm(`Are you sure you want to clear ALL scans for today (${today})? This cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetchWithAuth(`${API_BASE}/return-scans/clear/${today}`, {
            method: 'DELETE'
        });
        
        if (response && response.ok) {
            const data = await response.json();
            alert(`✅ Cleared ${data.deleted} scans`);
            await loadScans();
        } else {
            alert('Failed to clear scans');
        }
    } catch (error) {
        console.error('Error clearing scans:', error);
        alert('Error: ' + error.message);
    }
}

// Export to Excel
function exportToExcel() {
    if (scansCache.length === 0) {
        alert('No scans to export');
        return;
    }
    
    if (typeof XLSX === 'undefined') {
        alert('Excel library not loaded. Please refresh the page.');
        return;
    }
    
    const headers = [
        'Tracking ID', 'Order Number', 'Seller Name', 'Customer Name', 
        'Status', 'Scan Date', 'Scan Time', 'Scanned By'
    ];
    
    const data = scansCache.map(scan => [
        scan.tracking_id || '-',
        scan.order_number || '-',
        scan.seller_name || 'Unknown',
        scan.customer_name || '-',
        scan.order_number ? 'Found' : 'Not Found',
        scan.scan_date || '-',
        scan.scan_time || '-',
        scan.scanned_by || '-'
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws['!cols'] = [
        { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 20 },
        { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 15 }
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Return Scans');
    
    const dateFilter = document.getElementById('dateFilter').value || 'All';
    XLSX.writeFile(wb, `Return_Scans_${dateFilter}.xlsx`);
}

// Escape HTML
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




