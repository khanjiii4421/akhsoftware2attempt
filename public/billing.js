let currentBillData = null;
let currentSellerName = '';

// Load sellers on page load
async function loadSellers() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            return;
        }

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        const sellerSelect = document.getElementById('sellerSelect');
        if (!sellerSelect) {
            console.error('Seller select element not found');
            return;
        }

        sellerSelect.innerHTML = '<option value="">Loading...</option>';
        sellerSelect.disabled = true;

        if (user.role === 'admin') {
            const apiBase = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'http://localhost:3000/api';
            const response = await fetch(`${apiBase}/sellers`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load sellers');
            }

            const sellers = await response.json();
            sellerSelect.innerHTML = '<option value="">Select Seller</option>';
            sellers.forEach(seller => {
                const option = document.createElement('option');
                option.value = seller.username;
                option.textContent = seller.username;
                sellerSelect.appendChild(option);
            });
            sellerSelect.disabled = false;
        } else {
            // For sellers, only show their own name
            sellerSelect.innerHTML = '<option value="">Select Seller</option>';
            const option = document.createElement('option');
            option.value = user.username;
            option.textContent = user.username;
            sellerSelect.appendChild(option);
            sellerSelect.value = user.username;
            sellerSelect.disabled = false;
            // Don't auto-load bill, wait for user to click Generate Bill
        }
    } catch (error) {
        console.error('Error loading sellers:', error);
        const sellerSelect = document.getElementById('sellerSelect');
        if (sellerSelect) {
            sellerSelect.innerHTML = '<option value="">Error loading sellers</option>';
            sellerSelect.disabled = false;
        }
        alert('Error loading sellers: ' + error.message);
    }
}

// Handle seller change
function onSellerChange() {
    const sellerSelect = document.getElementById('sellerSelect');
    const sellerName = sellerSelect ? sellerSelect.value : '';
    const billNumberContainer = document.getElementById('billNumberContainer');
    const billNumberInput = document.getElementById('billNumber');
    
    if (sellerName) {
        if (billNumberContainer) {
            billNumberContainer.style.display = 'flex';
        }
        if (billNumberInput) {
            billNumberInput.value = ''; // Clear previous bill number
            billNumberInput.focus();
        }
        // Hide previous bill data
        document.getElementById('billSummary').style.display = 'none';
        document.getElementById('billTable').style.display = 'none';
        document.getElementById('noBillMessage').style.display = 'block';
    } else {
        if (billNumberContainer) {
            billNumberContainer.style.display = 'none';
        }
        document.getElementById('billSummary').style.display = 'none';
        document.getElementById('billTable').style.display = 'none';
        document.getElementById('noBillMessage').style.display = 'block';
    }
}

// Load bill for selected seller
async function loadBill() {
    const sellerSelect = document.getElementById('sellerSelect');
    const sellerName = sellerSelect ? sellerSelect.value : '';
    const billNumberInput = document.getElementById('billNumber');
    const billNumber = billNumberInput ? billNumberInput.value.trim() : '';

    if (!sellerName) {
        document.getElementById('billSummary').style.display = 'none';
        document.getElementById('billTable').style.display = 'none';
        document.getElementById('noBillMessage').style.display = 'block';
        return;
    }

    currentSellerName = sellerName;

    // Show loading state
    const generateBtn = document.querySelector('#billNumberContainer button');
    if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.textContent = 'Loading...';
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Not authenticated');
        }

        const apiBase = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'http://localhost:3000/api';
        const response = await fetch(`${apiBase}/billing/generate-bill`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                seller_name: sellerName,
                bill_number: billNumber || null
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to load bill' }));
            const errorMessage = errorData.error || 'Failed to load bill';
            
            // If no orders found, show message and hide bill display
            if (errorMessage.includes('No unpaid orders') || errorMessage.includes('empty bill')) {
                document.getElementById('billTable').style.display = 'none';
                document.getElementById('billSummary').style.display = 'none';
                document.getElementById('noBillMessage').style.display = 'block';
                document.getElementById('noBillMessage').innerHTML = '<p style="font-size: 18px; color: #e74c3c;">⚠️ ' + errorMessage + '</p>';
                currentBillData = null;
                return;
            }
            
            throw new Error(errorMessage);
        }

        const data = await response.json();
        currentBillData = data;

        displayBill(data);
        displaySummary(data.summary, data.bill_number, data.saved);
        
        if (data.saved && billNumber) {
            alert('Bill saved successfully with bill number: ' + billNumber);
        }
    } catch (error) {
        console.error('Error loading bill:', error);
        alert('Error loading bill: ' + error.message);
    } finally {
        // Reset button state
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate Bill';
        }
    }
}

// Display bill data (optimized for fast rendering)
function displayBill(data) {
    const tbody = document.getElementById('billTableBody');
    const billTable = document.getElementById('billTable');
    const noBillMessage = document.getElementById('noBillMessage');

    // Show loading state
    tbody.innerHTML = '<tr><td colspan="10" class="loading">Loading bill data...</td></tr>';

    if (data.orders.length === 0) {
        billTable.style.display = 'none';
        noBillMessage.style.display = 'block';
        noBillMessage.innerHTML = '<p style="font-size: 18px; color: #666;">No unpaid orders found for this seller</p>';
        return;
    }

    // Use requestAnimationFrame for smooth rendering
    requestAnimationFrame(() => {
        billTable.style.display = 'table';
        noBillMessage.style.display = 'none';

        // Build HTML string first (much faster than DOM manipulation)
        const rowsHTML = data.orders.map(order => {
            const profit = order.adjusted_profit !== undefined ? order.adjusted_profit : order.profit;
            const dc = order.adjusted_dc !== undefined ? order.adjusted_dc : order.dc;
            const profitColor = profit < 0 ? '#e74c3c' : '#333';
            const dcColor = dc < 0 ? '#e74c3c' : '#333';
            const profitWeight = profit < 0 ? 'bold' : 'normal';
            const dcWeight = dc < 0 ? 'bold' : 'normal';
            
            return `
                <tr class="status-${order.status}">
                    <td>${escapeHtml(order.order_number)}</td>
                    <td>${escapeHtml(order.seller_name)}</td>
                    <td>${escapeHtml(order.customer_name)}</td>
                    <td>${escapeHtml(order.products)}</td>
                    <td>${parseFloat(order.seller_price || 0).toFixed(2)}</td>
                    <td style="color: ${dcColor}; font-weight: ${dcWeight};">${parseFloat(dc || 0).toFixed(2)}</td>
                    <td>${parseFloat(order.shipper_price || 0).toFixed(2)}</td>
                    <td style="color: ${profitColor}; font-weight: ${profitWeight};">${parseFloat(profit || 0).toFixed(2)}</td>
                    <td>${escapeHtml(order.tracking_id || '-')}</td>
                    <td>
                        <span class="status-badge status-${order.status}">${order.status.toUpperCase()}</span>
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

// Display summary
function displaySummary(summary, billNumber, saved) {
    document.getElementById('summaryTotalOrders').textContent = summary.total_orders;
    document.getElementById('summaryDelivered').textContent = summary.total_delivered;
    document.getElementById('summaryReturns').textContent = summary.total_returns;
    document.getElementById('summaryProfit').textContent = parseFloat(summary.total_profit).toFixed(2);
    document.getElementById('summaryDeliveredRatio').textContent = summary.delivered_ratio + '%';
    document.getElementById('summaryReturnRatio').textContent = summary.return_ratio + '%';
    
    // Display bill number if saved
    const billNumberDisplay = document.getElementById('billNumberDisplay');
    if (billNumber && saved) {
        billNumberDisplay.textContent = `Bill #: ${billNumber} ✓`;
        billNumberDisplay.style.color = '#4caf50';
    } else if (billNumber) {
        billNumberDisplay.textContent = `Bill #: ${billNumber}`;
        billNumberDisplay.style.color = '#667eea';
    } else {
        billNumberDisplay.textContent = '';
    }
    
    document.getElementById('billSummary').style.display = 'block';
}

// Export to PDF
function exportToPDF() {
    if (!currentBillData) {
        alert('No bill data to export');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Color scheme
    const primaryColor = [67, 126, 234]; // Blue
    const successColor = [76, 175, 80]; // Green
    const dangerColor = [231, 76, 60]; // Red
    const darkColor = [44, 62, 80]; // Dark Blue
    const lightGray = [236, 240, 241]; // Light Gray
    const headerColor = [52, 73, 94]; // Dark Gray
    
    // Helper function to convert RGB to hex
    const rgbToHex = (r, g, b) => {
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    };
    
    // Header with gradient background
    doc.setFillColor(...headerColor);
    doc.rect(0, 0, 210, 35, 'F');
    
    // Logo area (text-based logo)
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('ADNAN', 20, 15);
    doc.setFontSize(18);
    doc.text('KHADDAR HOUSE', 20, 23);
    
    // Decorative line
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    doc.line(20, 28, 80, 28);
    
    // Bill Statement title
    doc.setFontSize(16);
    doc.text('BILL STATEMENT', 150, 20, { align: 'right' });
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
    
    // Seller Info Box with background
    let yPos = 45;
    doc.setFillColor(...lightGray);
    doc.roundedRect(20, yPos, 170, 25, 3, 3, 'F');
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...darkColor);
    doc.text('Seller Information', 25, yPos + 7);
    
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Seller: ${currentBillData.seller_name}`, 25, yPos + 13);
    
    if (currentBillData.bill_number) {
        doc.text(`Bill Number: ${currentBillData.bill_number}`, 25, yPos + 19);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 120, yPos + 13);
    } else {
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 25, yPos + 19);
    }
    
    yPos += 35;
    
    // Summary Section with colored boxes
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...darkColor);
    doc.text('Summary', 20, yPos);
    
    yPos += 8;
    
    // Summary boxes
    const boxWidth = 55;
    const boxHeight = 20;
    const boxSpacing = 5;
    let xPos = 20;
    
    // Total Orders Box
    doc.setFillColor(...primaryColor);
    doc.roundedRect(xPos, yPos, boxWidth, boxHeight, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('Total Orders', xPos + 2, yPos + 7);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(currentBillData.summary.total_orders.toString(), xPos + 2, yPos + 15);
    
    xPos += boxWidth + boxSpacing;
    
    // Delivered Box
    doc.setFillColor(...successColor);
    doc.roundedRect(xPos, yPos, boxWidth, boxHeight, 3, 3, 'F');
    doc.text('Delivered', xPos + 2, yPos + 7);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(currentBillData.summary.total_delivered.toString(), xPos + 2, yPos + 15);
    
    xPos += boxWidth + boxSpacing;
    
    // Returns Box
    doc.setFillColor(...dangerColor);
    doc.roundedRect(xPos, yPos, boxWidth, boxHeight, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('Returns', xPos + 2, yPos + 7);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(currentBillData.summary.total_returns.toString(), xPos + 2, yPos + 15);
    
    yPos += 25;
    
    // Profit Highlight Box (Larger and prominent)
    const profitValue = parseFloat(currentBillData.summary.total_profit);
    const profitColor = profitValue >= 0 ? successColor : dangerColor;
    
    doc.setFillColor(...profitColor);
    doc.roundedRect(20, yPos, 90, 25, 5, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text('Total Profit', 25, yPos + 10);
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Rs. ' + profitValue.toFixed(2), 25, yPos + 20);
    
    // Ratios
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Delivered Ratio: ${currentBillData.summary.delivered_ratio}%`, 120, yPos + 8);
    doc.text(`Return Ratio: ${currentBillData.summary.return_ratio}%`, 120, yPos + 16);
    
    yPos += 35;
    
    // Table headers with colored background
    doc.setFillColor(...primaryColor);
    doc.roundedRect(20, yPos - 5, 170, 8, 2, 2, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('Order #', 22, yPos);
    doc.text('Customer', 50, yPos);
    doc.text('Product', 90, yPos);
    doc.text('Price', 120, yPos);
    doc.text('DC', 140, yPos);
    doc.text('Profit', 160, yPos);
    doc.text('Status', 180, yPos);
    
    yPos += 3;
    doc.setDrawColor(200, 200, 200);
    doc.line(20, yPos, 190, yPos);
    yPos += 5;
    
    // Table rows with alternating colors and highlighted profit
    let rowCount = 0;
    currentBillData.orders.forEach(order => {
        if (yPos > 270) {
            doc.addPage();
            yPos = 20;
            // Redraw header on new page
            doc.setFillColor(...headerColor);
            doc.rect(0, 0, 210, 35, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(24);
            doc.setFont(undefined, 'bold');
            doc.text('ADNAN', 20, 15);
            doc.setFontSize(18);
            doc.text('KHADDAR HOUSE', 20, 23);
            doc.setDrawColor(255, 255, 255);
            doc.line(20, 28, 80, 28);
            doc.setTextColor(0, 0, 0);
            yPos = 20;
        }
        
        // Alternating row colors
        if (rowCount % 2 === 0) {
            doc.setFillColor(250, 250, 250);
            doc.rect(20, yPos - 4, 170, 6, 'F');
        }
        
        const profit = order.adjusted_profit !== undefined ? order.adjusted_profit : order.profit;
        const dc = order.adjusted_dc !== undefined ? order.adjusted_dc : order.dc;
        
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(order.order_number.substring(0, 10), 22, yPos);
        doc.text(order.customer_name.substring(0, 15), 50, yPos);
        doc.text(order.products.substring(0, 15), 90, yPos);
        doc.text(parseFloat(order.seller_price || 0).toFixed(2), 120, yPos);
        
        // DC color based on value
        if (dc < 0) {
            doc.setTextColor(...dangerColor);
        } else {
            doc.setTextColor(0, 0, 0);
        }
        doc.text(parseFloat(dc || 0).toFixed(2), 140, yPos);
        
        // Profit highlighted with color and bold
        const profitColor = profit >= 0 ? successColor : dangerColor;
        doc.setTextColor(...profitColor);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(9);
        doc.text('Rs. ' + parseFloat(profit || 0).toFixed(2), 160, yPos);
        
        // Status with color
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        if (order.status === 'delivered') {
            doc.setTextColor(...successColor);
        } else if (order.status === 'return') {
            doc.setTextColor(...dangerColor);
        } else {
            doc.setTextColor(0, 0, 0);
        }
        doc.text(order.status.toUpperCase(), 180, yPos);
        
        yPos += 7;
        rowCount++;
    });
    
    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
        doc.text('Adnan Khaddar House - Bill Statement', 105, 290, { align: 'center' });
    }
    
    // Save PDF
    doc.save(`Bill_${currentBillData.seller_name}_${new Date().toISOString().split('T')[0]}.pdf`);
}

// Export to Excel
function exportToXLS() {
    if (!currentBillData) {
        alert('No bill data to export');
        return;
    }

    // Prepare data
    const wsData = [
        ['Bill Statement'],
        ['Seller:', currentBillData.seller_name],
    ];
    
    if (currentBillData.bill_number) {
        wsData.push(['Bill Number:', currentBillData.bill_number]);
    }
    
    wsData.push(['Date:', new Date().toLocaleDateString()]);
    wsData.push([]);
    wsData.push(['Summary']);
    wsData.push(['Total Orders', currentBillData.summary.total_orders]);
    wsData.push(['Delivered', currentBillData.summary.total_delivered]);
    wsData.push(['Returns', currentBillData.summary.total_returns]);
    wsData.push(['Total Profit', parseFloat(currentBillData.summary.total_profit).toFixed(2)]);
    wsData.push(['Delivered Ratio', currentBillData.summary.delivered_ratio + '%']);
    wsData.push(['Return Ratio', currentBillData.summary.return_ratio + '%']);
    wsData.push([]);
    wsData.push(['Order #', 'Seller', 'Customer', 'Product', 'Seller Price', 'DC', 'Shipper Price', 'Profit', 'Tracking ID', 'Status']);

    currentBillData.orders.forEach(order => {
        const profit = order.adjusted_profit !== undefined ? order.adjusted_profit : order.profit;
        const dc = order.adjusted_dc !== undefined ? order.adjusted_dc : order.dc;
        
        wsData.push([
            order.order_number,
            order.seller_name,
            order.customer_name,
            order.products,
            parseFloat(order.seller_price || 0).toFixed(2),
            parseFloat(dc || 0).toFixed(2),
            parseFloat(order.shipper_price || 0).toFixed(2),
            parseFloat(profit || 0).toFixed(2),
            order.tracking_id || '-',
            order.status.toUpperCase()
        ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Bill');
    XLSX.writeFile(wb, `Bill_${currentBillData.seller_name}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Mark orders as paid
async function markAsPaid() {
    if (!currentBillData || currentBillData.orders.length === 0) {
        alert('No orders to mark as paid');
        return;
    }

    if (!confirm(`Are you sure you want to mark ${currentBillData.orders.length} orders as paid?`)) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const orderIds = currentBillData.orders.map(o => o.id);
        
        const apiBase = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'http://localhost:3000/api';
        const response = await fetch(`${apiBase}/billing/mark-paid`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                seller_name: currentSellerName,
                order_ids: orderIds
            })
        });

        if (!response.ok) {
            throw new Error('Failed to mark orders as paid');
        }

        const data = await response.json();
        alert(data.message);
        loadBill(); // Reload bill
    } catch (error) {
        console.error('Error marking orders as paid:', error);
        alert('Error marking orders as paid: ' + error.message);
    }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    loadSellers();
});

