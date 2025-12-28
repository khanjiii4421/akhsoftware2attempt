// Sellers Management
let sellersCache = [];
let currentSellerId = null;

// Load sellers on page load
window.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role !== 'admin') {
        window.location.href = 'orders.html';
    }
    await loadSellers();
});

// Load sellers
async function loadSellers() {
    const response = await fetchWithAuth(`${API_BASE}/sellers`);
    if (response) {
        const sellers = await response.json();
        sellersCache = sellers;
        displaySellers(sellers);
    }
}

// Display sellers in table
function displaySellers(sellers) {
    const tbody = document.getElementById('sellersTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (sellers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">No sellers found</td></tr>';
        return;
    }
    
    sellers.forEach(seller => {
        const row = document.createElement('tr');
        const blockedUntil = seller.blocked_until ? new Date(seller.blocked_until) : null;
        const isBlocked = seller.is_blocked === 1 && blockedUntil && blockedUntil > new Date();
        
        row.innerHTML = `
            <td>${seller.id}</td>
            <td>${seller.username}</td>
            <td>${seller.role}</td>
            <td><span class="status-badge ${isBlocked ? 'status-cancel' : 'status-delivered'}">${isBlocked ? 'Blocked' : 'Active'}</span></td>
            <td>${blockedUntil ? blockedUntil.toLocaleString() : '-'}</td>
            <td>${new Date(seller.created_at).toLocaleString()}</td>
            <td class="action-buttons">
                ${isBlocked ? 
                    `<button onclick="unblockSeller(${seller.id})" class="btn-success" style="padding: 5px 10px; font-size: 11px;">Unblock</button>` :
                    `<button onclick="openBlockSellerModal(${seller.id})" class="btn-danger" style="padding: 5px 10px; font-size: 11px;">Block</button>`
                }
                <button onclick="deleteAllOrdersForSeller('${seller.username}')" class="btn-warning" style="padding: 5px 10px; font-size: 11px; background-color: #f39c12; color: white; border: none; border-radius: 3px; cursor: pointer;">Delete All Orders</button>
                <button onclick="deleteSeller(${seller.id})" class="btn-danger" style="padding: 5px 10px; font-size: 11px;">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Open add seller modal
function openAddSellerModal() {
    document.getElementById('sellerForm').reset();
    document.getElementById('sellerModal').style.display = 'block';
}

// Close seller modal
function closeSellerModal() {
    document.getElementById('sellerModal').style.display = 'none';
}

// Save seller
document.getElementById('sellerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const sellerData = {
        username: document.getElementById('sellerUsername').value,
        password: document.getElementById('sellerPassword').value
    };
    
    const response = await fetchWithAuth(`${API_BASE}/create-seller`, {
        method: 'POST',
        body: JSON.stringify(sellerData)
    });
    
    if (response) {
        const data = await response.json();
        if (response.ok) {
            alert('Seller created successfully');
            closeSellerModal();
            loadSellers();
        } else {
            alert(data.error || 'Failed to create seller');
        }
    }
});

// Open block seller modal
function openBlockSellerModal(sellerId) {
    currentSellerId = sellerId;
    document.getElementById('blockHours').value = 24;
    document.getElementById('blockSellerModal').style.display = 'block';
}

// Close block seller modal
function closeBlockSellerModal() {
    document.getElementById('blockSellerModal').style.display = 'none';
    currentSellerId = null;
}

// Process block seller
async function processBlockSeller() {
    const hours = parseInt(document.getElementById('blockHours').value);
    if (!hours || hours < 1) {
        alert('Please enter valid hours');
        return;
    }
    
    const response = await fetchWithAuth(`${API_BASE}/block-seller`, {
        method: 'POST',
        body: JSON.stringify({ sellerId: currentSellerId, hours })
    });
    
    if (response) {
        const data = await response.json();
        if (response.ok) {
            alert('Seller blocked successfully');
            closeBlockSellerModal();
            loadSellers();
        } else {
            alert(data.error || 'Failed to block seller');
        }
    }
}

// Unblock seller
async function unblockSeller(sellerId) {
    if (!confirm('Are you sure you want to unblock this seller?')) return;
    
    const response = await fetchWithAuth(`${API_BASE}/unblock-seller`, {
        method: 'POST',
        body: JSON.stringify({ sellerId })
    });
    
    if (response) {
        const data = await response.json();
        if (response.ok) {
            alert('Seller unblocked successfully');
            loadSellers();
        } else {
            alert(data.error || 'Failed to unblock seller');
        }
    }
}

// Delete all orders for seller
async function deleteAllOrdersForSeller(sellerUsername) {
    if (!confirm(`Are you sure you want to delete ALL orders for seller "${sellerUsername}"? This action cannot be undone!`)) return;
    
    if (!confirm('This will permanently delete all orders. Are you absolutely sure?')) return;
    
    try {
        const response = await fetchWithAuth(`${API_BASE}/orders/delete-all-for-seller?seller_name=${encodeURIComponent(sellerUsername)}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response) {
            const data = await response.json();
            if (response.ok) {
                alert(`✅ Success! ${data.message || `All orders for seller "${sellerUsername}" deleted successfully.`}\n\nDeleted ${data.deleted_count || 0} orders.`);
            } else {
                // Handle different error cases
                if (response.status === 404) {
                    alert(`ℹ️ ${data.error || `No orders found for seller "${sellerUsername}"`}`);
                } else {
                    alert(`❌ Error: ${data.error || 'Failed to delete orders'}`);
                }
            }
        } else {
            alert('❌ Failed to connect to server');
        }
    } catch (error) {
        console.error('Error deleting orders:', error);
        alert('❌ Error deleting orders: ' + error.message);
    }
}

// Delete seller
async function deleteSeller(sellerId) {
    if (!confirm('Are you sure you want to delete this seller? This action cannot be undone.')) return;
    
    const response = await fetchWithAuth(`${API_BASE}/delete-seller/${sellerId}`, {
        method: 'DELETE'
    });
    
    if (response) {
        const data = await response.json();
        if (response.ok) {
            alert('Seller deleted successfully');
            loadSellers();
        } else {
            alert(data.error || 'Failed to delete seller');
        }
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

