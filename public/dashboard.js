// Dashboard Management
let charts = {};

// Load dashboard on page load
window.addEventListener('DOMContentLoaded', async () => {
    await loadSellers();
    await loadDashboard();
});

// Load sellers for filter
async function loadSellers() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (user.role === 'admin') {
        const response = await fetchWithAuth(`${API_BASE}/sellers`);
        if (response) {
            const sellers = await response.json();
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
        }
    } else {
        const sellerFilter = document.getElementById('sellerFilter');
        if (sellerFilter) sellerFilter.style.display = 'none';
    }
}

// Load dashboard data (optimized - parallel loading)
async function loadDashboard() {
    const sellerFilter = document.getElementById('sellerFilter')?.value || '';
    let url = `${API_BASE}/dashboard/stats`;
    if (sellerFilter) url += `?seller_name=${sellerFilter}`;
    
    try {
        // Load all data in parallel for faster loading
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const requests = [
            fetchWithAuth(url),
            fetchWithAuth(`${API_BASE}/dashboard/top-products?limit=10${sellerFilter ? `&seller_name=${sellerFilter}` : ''}`),
            fetchWithAuth(`${API_BASE}/dashboard/top-cities?limit=10${sellerFilter ? `&seller_name=${sellerFilter}` : ''}`),
            fetchWithAuth(`${API_BASE}/dashboard/sales-trends?period=day`)
        ];
        
        // Add seller stats request for admin
        if (user.role === 'admin') {
            requests.push(fetchWithAuth(`${API_BASE}/dashboard/seller-stats`));
        }
        
        const responses = await Promise.all(requests);
        
        // Process stats
        if (responses[0]) {
            const stats = await responses[0].json();
            console.log('Dashboard stats:', stats);
            displayStats(stats);
            
            // Load delivered/returns chart with same stats
            renderDeliveredReturnsChart(stats.total_delivered || 0, stats.total_returns || 0);
        }
        
        // Process other data
        if (responses[1]) {
            const products = await responses[1].json();
            renderTopProductsChart(products);
        }
        
        if (responses[2]) {
            const cities = await responses[2].json();
            renderCitySalesChart(cities);
        }
        
        if (responses[3]) {
            const trends = await responses[3].json();
            renderSalesTrendsChart(trends);
        }
        
        // Process top sellers (only for admin)
        if (user.role === 'admin' && responses[4]) {
            const sellers = await responses[4].json();
            renderTopSellersChart(sellers);
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Display stats
function displayStats(stats) {
    if (!stats) {
        console.error('No stats data received');
        return;
    }
    
    const totalOrdersEl = document.getElementById('totalOrders');
    const totalPendingEl = document.getElementById('totalPending');
    const totalDeliveredEl = document.getElementById('totalDelivered');
    const totalReturnsEl = document.getElementById('totalReturns');
    const totalPaidEl = document.getElementById('totalPaid');
    
    const totalOrders = stats.total_orders || 0;
    const totalDelivered = stats.total_delivered || 0;
    const totalReturns = stats.total_returns || 0;
    const totalPending = totalOrders - totalDelivered - totalReturns;
    
    if (totalOrdersEl) totalOrdersEl.textContent = totalOrders;
    if (totalPendingEl) totalPendingEl.textContent = totalPending;
    if (totalDeliveredEl) totalDeliveredEl.textContent = totalDelivered;
    if (totalReturnsEl) totalReturnsEl.textContent = totalReturns;
    if (totalPaidEl) totalPaidEl.textContent = stats.total_paid || 0;
    
    const financials = stats.financials || {};
    document.getElementById('totalSellerPrice').textContent = 
        parseFloat(financials.total_seller_price || 0).toFixed(2);
    document.getElementById('totalShipperPrice').textContent = 
        parseFloat(financials.total_shipper_price || 0).toFixed(2);
    document.getElementById('totalDC').textContent = 
        parseFloat(financials.total_dc || 0).toFixed(2);
    document.getElementById('totalProfit').textContent = 
        parseFloat(financials.total_profit || 0).toFixed(2);
}

// Load top products (now handled in loadDashboard for parallel loading)
async function loadTopProducts(sellerFilter = '') {
    let url = `${API_BASE}/dashboard/top-products?limit=10`;
    if (sellerFilter) url += `&seller_name=${sellerFilter}`;
    
    const response = await fetchWithAuth(url);
    if (response) {
        const products = await response.json();
        renderTopProductsChart(products);
    }
}

// Render top products chart
function renderTopProductsChart(products) {
    const ctx = document.getElementById('topProductsChart');
    if (!ctx) return;
    
    if (charts.topProducts) {
        charts.topProducts.destroy();
    }
    
    // Group products by lowercase name to handle case-insensitive
    const productMap = {};
    products.forEach(p => {
        const key = p.name.toLowerCase();
        if (!productMap[key]) {
            productMap[key] = { name: p.name.toUpperCase(), count: 0 };
        }
        productMap[key].count += p.count;
    });
    
    const groupedProducts = Object.values(productMap)
        .sort((a, b) => b.count - a.count);
    
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(102, 126, 234, 0.9)');
    gradient.addColorStop(0.5, 'rgba(118, 75, 162, 0.7)');
    gradient.addColorStop(1, 'rgba(102, 126, 234, 0.3)');
    
    charts.topProducts = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: groupedProducts.map(p => p.name),
            datasets: [{
                label: 'Quantity Sold',
                data: groupedProducts.map(p => p.count),
                backgroundColor: gradient,
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            },
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Render city sales chart (vertical line chart with points)
function renderCitySalesChart(cities) {
    const ctx = document.getElementById('citySalesChart');
    if (!ctx) return;
    
    if (charts.citySales) {
        charts.citySales.destroy();
    }
    
    // Normalize city names
    const normalizedCities = cities.map(c => {
        const city = c.city.toLowerCase();
        if (city.includes('isl') || city.includes('islamabad')) return 'Islamabad';
        if (city.includes('lhr') || city.includes('lahore')) return 'Lahore';
        if (city.includes('khi') || city.includes('karachi')) return 'Karachi';
        return c.city;
    });
    
    // Sort by count for better visualization
    const sortedData = normalizedCities.map((city, index) => ({
        city: city,
        count: cities[index].count
    })).sort((a, b) => b.count - a.count);
    
    const lineGradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
    lineGradient.addColorStop(0, 'rgba(102, 126, 234, 0.4)');
    lineGradient.addColorStop(1, 'rgba(102, 126, 234, 0.05)');
    
    charts.citySales = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedData.map(c => c.city),
            datasets: [{
                label: 'Sales',
                data: sortedData.map(c => c.count),
                borderColor: 'rgba(102, 126, 234, 1)',
                backgroundColor: lineGradient,
                tension: 0.4,
                fill: true,
                borderWidth: 3,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: 'rgba(102, 126, 234, 1)',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointHoverBackgroundColor: 'rgba(118, 75, 162, 1)',
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Sales: ${context.parsed.y} orders`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Sales'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Cities'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Render top sellers chart
function renderTopSellersChart(sellers) {
    const ctx = document.getElementById('topSellersChart');
    if (!ctx) return;
    
    if (charts.topSellers) {
        charts.topSellers.destroy();
    }
    
    // Sort by total orders and take top 10
    const topSellers = sellers
        .sort((a, b) => b.total_orders - a.total_orders)
        .slice(0, 10);
    
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(118, 75, 162, 0.9)');
    gradient.addColorStop(0.5, 'rgba(102, 126, 234, 0.7)');
    gradient.addColorStop(1, 'rgba(118, 75, 162, 0.3)');
    
    charts.topSellers = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topSellers.map(s => s.seller_name),
            datasets: [{
                label: 'Total Orders',
                data: topSellers.map(s => s.total_orders),
                backgroundColor: gradient,
                borderColor: 'rgba(118, 75, 162, 1)',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const seller = topSellers[context.dataIndex];
                            return `Delivered: ${seller.delivered} | Returns: ${seller.returns}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Orders'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Sellers'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Load delivered vs returns (now handled in loadDashboard for parallel loading)
async function loadDeliveredReturns(sellerFilter = '') {
    let url = `${API_BASE}/dashboard/stats`;
    if (sellerFilter) url += `?seller_name=${sellerFilter}`;
    
    const response = await fetchWithAuth(url);
    if (response) {
        const stats = await response.json();
        renderDeliveredReturnsChart(stats.total_delivered || 0, stats.total_returns || 0);
    }
}

// Render delivered vs returns chart
function renderDeliveredReturnsChart(delivered, returns) {
    const ctx = document.getElementById('deliveredReturnsChart');
    if (!ctx) return;
    
    if (charts.deliveredReturns) {
        charts.deliveredReturns.destroy();
    }
    
    const deliveredGradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
    deliveredGradient.addColorStop(0, 'rgba(39, 174, 96, 0.9)');
    deliveredGradient.addColorStop(1, 'rgba(39, 174, 96, 0.3)');
    
    const returnsGradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
    returnsGradient.addColorStop(0, 'rgba(231, 76, 60, 0.9)');
    returnsGradient.addColorStop(1, 'rgba(231, 76, 60, 0.3)');
    
    charts.deliveredReturns = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Delivered', 'Returns'],
            datasets: [{
                label: 'Orders',
                data: [delivered, returns],
                backgroundColor: [deliveredGradient, returnsGradient],
                borderColor: ['rgba(39, 174, 96, 1)', 'rgba(231, 76, 60, 1)'],
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            },
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Load sales trends
async function loadSalesTrends() {
    const period = document.getElementById('trendPeriod')?.value || 'day';
    const response = await fetchWithAuth(`${API_BASE}/dashboard/sales-trends?period=${period}`);
    if (response) {
        const trends = await response.json();
        renderSalesTrendsChart(trends);
    }
}

// Render sales trends chart
function renderSalesTrendsChart(trends) {
    const ctx = document.getElementById('salesTrendsChart');
    if (!ctx) return;
    
    if (charts.salesTrends) {
        charts.salesTrends.destroy();
    }
    
    const lineGradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
    lineGradient.addColorStop(0, 'rgba(102, 126, 234, 0.4)');
    lineGradient.addColorStop(1, 'rgba(102, 126, 234, 0.05)');
    
    charts.salesTrends = new Chart(ctx, {
        type: 'line',
        data: {
            labels: trends.map(t => t.period).reverse(),
            datasets: [{
                label: 'Orders',
                data: trends.map(t => t.count).reverse(),
                borderColor: 'rgba(102, 126, 234, 1)',
                backgroundColor: lineGradient,
                tension: 0.5,
                fill: true,
                borderWidth: 3,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: 'rgba(102, 126, 234, 1)',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointHoverBackgroundColor: 'rgba(118, 75, 162, 1)',
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            },
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

