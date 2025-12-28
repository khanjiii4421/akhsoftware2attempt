// Employee Management
// API_BASE is defined in auth.js (loaded before this file)
let currentTab = 'employees';
let employeesCache = [];

// Setup form event listeners
function setupFormListeners() {
    const employeeForm = document.getElementById('employeeForm');
    if (employeeForm) {
        employeeForm.addEventListener('submit', handleEmployeeSubmit);
    }
    
    const leaveForm = document.getElementById('leaveForm');
    if (leaveForm) {
        leaveForm.addEventListener('submit', handleLeaveSubmit);
    }
    
    const shortLeaveForm = document.getElementById('shortLeaveForm');
    if (shortLeaveForm) {
        shortLeaveForm.addEventListener('submit', handleShortLeaveSubmit);
    }
}

// Load on page load
window.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Initializing employees page...');
        setupFormListeners();
        
        // Load employees first (most important)
        await loadEmployees();
        
        // Load other data in background (non-blocking)
        Promise.all([
            loadAttendance(),
            loadLeaves(),
            loadShortLeaves()
        ]).catch(err => console.error('Error loading secondary data:', err));
        
        populateEmployeeDropdowns();
        console.log('Page initialized successfully');
    } catch (error) {
        console.error('Error initializing page:', error);
        alert('Error loading page: ' + error.message);
    }
});

// Charts storage
let employeeCharts = {};

// Show tab
function showTab(tabName) {
    try {
        currentTab = tabName;
        
        // Hide all tabs
        const dashboardTab = document.getElementById('dashboardTab');
        const employeesTab = document.getElementById('employeesTab');
        const attendanceTab = document.getElementById('attendanceTab');
        const leavesTab = document.getElementById('leavesTab');
        const shortLeavesTab = document.getElementById('shortLeavesTab');
        
        if (dashboardTab) dashboardTab.style.display = 'none';
        if (employeesTab) employeesTab.style.display = 'none';
        if (attendanceTab) attendanceTab.style.display = 'none';
        if (leavesTab) leavesTab.style.display = 'none';
        if (shortLeavesTab) shortLeavesTab.style.display = 'none';
        
        // Reset button styles
        const tabDashboard = document.getElementById('tabDashboard');
        const tabEmployees = document.getElementById('tabEmployees');
        const tabAttendance = document.getElementById('tabAttendance');
        const tabLeaves = document.getElementById('tabLeaves');
        const tabShortLeaves = document.getElementById('tabShortLeaves');
        
        const tabs = [tabDashboard, tabEmployees, tabAttendance, tabLeaves, tabShortLeaves];
        tabs.forEach(tab => {
            if (tab) {
                tab.style.background = '#e0e0e0';
                tab.style.color = '#000';
            }
        });
        
        // Show selected tab
        if (tabName === 'dashboard' && dashboardTab && tabDashboard) {
            dashboardTab.style.display = 'block';
            tabDashboard.style.background = '#667eea';
            tabDashboard.style.color = 'white';
            loadDashboard();
        } else if (tabName === 'employees' && employeesTab && tabEmployees) {
            employeesTab.style.display = 'block';
            tabEmployees.style.background = '#667eea';
            tabEmployees.style.color = 'white';
        } else if (tabName === 'attendance' && attendanceTab && tabAttendance) {
            attendanceTab.style.display = 'block';
            tabAttendance.style.background = '#667eea';
            tabAttendance.style.color = 'white';
            loadAttendance();
        } else if (tabName === 'leaves' && leavesTab && tabLeaves) {
            leavesTab.style.display = 'block';
            tabLeaves.style.background = '#667eea';
            tabLeaves.style.color = 'white';
            loadLeaves();
        } else if (tabName === 'short-leaves' && shortLeavesTab && tabShortLeaves) {
            shortLeavesTab.style.display = 'block';
            tabShortLeaves.style.background = '#667eea';
            tabShortLeaves.style.color = 'white';
            loadShortLeaves();
        }
    } catch (error) {
        console.error('Error in showTab:', error);
        alert('Error switching tab: ' + error.message);
    }
}

// Load employees with timeout
async function loadEmployees() {
    const tbody = document.getElementById('employeesTableBody');
    if (!tbody) return;
    
    // Set timeout to prevent infinite loading
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout. Server may be slow or not responding.')), 10000)
    );
    
    try {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">Loading employees...</td></tr>';
        
        const fetchPromise = fetchWithAuth(`${API_BASE}/employees`);
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (!response) {
            throw new Error('No response from server. Please check if server is running.');
        }
        
        if (response.ok) {
            const employees = await response.json();
            employeesCache = employees || [];
            displayEmployees(employeesCache);
            populateEmployeeDropdowns();
        } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || `Server error (${response.status})`);
        }
    } catch (error) {
        console.error('Error loading employees:', error);
        if (tbody) {
            const errorMsg = error.message || 'Failed to load employees. Please check if server is running and refresh the page.';
            tbody.innerHTML = `<tr><td colspan="7" style="padding: 20px; text-align: center; color: #dc3545;">
                <strong>Error:</strong> ${errorMsg}<br>
                <button onclick="loadEmployees()" style="margin-top: 10px; padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">Retry</button>
            </td></tr>`;
        }
    }
}

// Display employees
function displayEmployees(employees) {
    const tbody = document.getElementById('employeesTableBody');
    if (!tbody) return;
    
    if (!employees || employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">No employees found</td></tr>';
        return;
    }
    
    tbody.innerHTML = employees.map(emp => {
        const statusColor = emp.status === 'active' ? '#4caf50' : '#999';
        return `
            <tr>
                <td>${escapeHtml(emp.employee_id)}</td>
                <td>${escapeHtml(emp.name)}</td>
                <td>${escapeHtml(emp.phone || '-')}</td>
                <td>${escapeHtml(emp.designation || '-')}</td>
                <td>${escapeHtml(emp.department || '-')}</td>
                <td><span style="padding: 4px 8px; background: ${statusColor}; color: white; border-radius: 4px; font-size: 12px;">${emp.status || 'active'}</span></td>
                <td>
                    <button onclick="editEmployee('${emp.employee_id}')" style="padding: 5px 10px; font-size: 11px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer; margin-right: 5px;">Edit</button>
                    <button onclick="registerFingerprintForEmployee('${emp.employee_id}', '${escapeHtml(emp.name)}')" style="padding: 5px 10px; font-size: 11px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer; margin-right: 5px;">Fingerprint</button>
                    <button onclick="deleteEmployee('${emp.employee_id}')" style="padding: 5px 10px; font-size: 11px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer;">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Search employees
function searchEmployees() {
    const query = document.getElementById('employeeSearch').value.toLowerCase();
    if (!query) {
        displayEmployees(employeesCache);
        return;
    }
    
    const filtered = employeesCache.filter(emp => 
        emp.employee_id.toLowerCase().includes(query) ||
        emp.name.toLowerCase().includes(query) ||
        (emp.phone && emp.phone.includes(query)) ||
        (emp.designation && emp.designation.toLowerCase().includes(query)) ||
        (emp.department && emp.department.toLowerCase().includes(query))
    );
    displayEmployees(filtered);
}

// Populate employee dropdowns
function populateEmployeeDropdowns() {
    const dropdowns = [
        'leaveEmployeeId',
        'shortLeaveEmployeeId',
        'attendanceEmployeeFilter',
        'leaveEmployeeFilter'
    ];
    
    dropdowns.forEach(dropdownId => {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            const currentValue = dropdown.value;
            dropdown.innerHTML = dropdownId.includes('Filter') ? '<option value="">All Employees</option>' : '<option value="">Select Employee</option>';
            
            employeesCache.filter(emp => emp.status === 'active').forEach(emp => {
                const option = document.createElement('option');
                option.value = emp.employee_id;
                option.textContent = `${emp.employee_id} - ${emp.name}`;
                dropdown.appendChild(option);
            });
            
            if (currentValue) {
                dropdown.value = currentValue;
            }
        }
    });
}

// Open add employee modal
function openAddEmployeeModal() {
    try {
        const modal = document.getElementById('employeeModal');
        if (!modal) {
            console.error('Employee modal not found');
            alert('Error: Employee modal not found. Please refresh the page.');
            return;
        }
        document.getElementById('employeeId').value = '';
        document.getElementById('employeeForm').reset();
        document.getElementById('employeeModalTitle').textContent = 'Add Employee';
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error opening employee modal:', error);
        alert('Error opening modal: ' + error.message);
    }
}

// Close employee modal
function closeEmployeeModal() {
    document.getElementById('employeeModal').style.display = 'none';
}

// Edit employee
function editEmployee(employeeId) {
    const employee = employeesCache.find(e => e.employee_id === employeeId);
    if (!employee) return;
    
    document.getElementById('employeeId').value = employee.id;
    document.getElementById('employeeIdInput').value = employee.employee_id;
    document.getElementById('employeeName').value = employee.name;
    document.getElementById('employeePhone').value = employee.phone || '';
    document.getElementById('employeeEmail').value = employee.email || '';
    document.getElementById('employeeDesignation').value = employee.designation || '';
    document.getElementById('employeeDepartment').value = employee.department || '';
    document.getElementById('employeeSalary').value = employee.salary || '';
    document.getElementById('employeeJoinDate').value = employee.join_date || '';
    document.getElementById('employeeStatus').value = employee.status || 'active';
    
    document.getElementById('employeeModalTitle').textContent = 'Edit Employee';
    document.getElementById('employeeModal').style.display = 'block';
}

// Save employee
async function handleEmployeeSubmit(e) {
    e.preventDefault();
    
    const employeeData = {
        employee_id: document.getElementById('employeeIdInput').value,
        name: document.getElementById('employeeName').value,
        phone: document.getElementById('employeePhone').value || null,
        email: document.getElementById('employeeEmail').value || null,
        designation: document.getElementById('employeeDesignation').value || null,
        department: document.getElementById('employeeDepartment').value || null,
        salary: document.getElementById('employeeSalary').value || null,
        join_date: document.getElementById('employeeJoinDate').value || null,
        status: document.getElementById('employeeStatus').value
    };
    
    const employeeId = document.getElementById('employeeId').value;
    let response;
    
    try {
        if (employeeId) {
            // Update
            response = await fetchWithAuth(`${API_BASE}/employees/${employeeId}`, {
                method: 'PUT',
                body: JSON.stringify(employeeData)
            });
        } else {
            // Create
            response = await fetchWithAuth(`${API_BASE}/employees`, {
                method: 'POST',
                body: JSON.stringify(employeeData)
            });
        }
        
        if (response && response.ok) {
            alert('Employee saved successfully');
            closeEmployeeModal();
            loadEmployees();
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to save employee');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Delete employee
async function deleteEmployee(employeeId) {
    if (!confirm(`Are you sure you want to delete employee ${employeeId}?`)) return;
    
    try {
        const response = await fetchWithAuth(`${API_BASE}/employees/${employeeId}`, {
            method: 'DELETE'
        });
        
        if (response && response.ok) {
            alert('Employee deleted successfully');
            loadEmployees();
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to delete employee');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Register fingerprint for employee
async function registerFingerprintForEmployee(employeeId, employeeName) {
    document.getElementById('fingerprintEmployeeId').value = employeeId;
    document.getElementById('fingerprintEmployeeName').value = employeeName;
    document.getElementById('fingerprintData').value = '';
    document.getElementById('fingerprintStatus').style.display = 'none';
    document.getElementById('fingerprintModal').style.display = 'block';
    
    // Check if fingerprint sensor is supported
    if (typeof isFingerprintSensorSupported === 'function' && isFingerprintSensorSupported()) {
        // Check if built-in sensor is available
        if (typeof isBuiltInSensorAvailable === 'function') {
            const hasBuiltIn = await isBuiltInSensorAvailable();
            if (hasBuiltIn) {
                updateFingerprintSensorStatus('✅ Built-in fingerprint sensor detected (Windows Hello). Ready to scan!');
            } else {
                updateFingerprintSensorStatus('Ready to scan with external sensor. Click "Scan Fingerprint" button.');
            }
        } else {
            updateFingerprintSensorStatus('Ready to scan. Click "Scan Fingerprint" button.');
        }
    } else {
        updateFingerprintSensorStatus('⚠️ Fingerprint sensor not supported. You can manually enter fingerprint data.');
    }
}

// Close fingerprint modal
function closeFingerprintModal() {
    document.getElementById('fingerprintModal').style.display = 'none';
}

// Scan fingerprint using sensor
async function scanFingerprintForRegistration() {
    const statusDiv = document.getElementById('fingerprintStatus');
    const employeeId = document.getElementById('fingerprintEmployeeId').value;
    const employeeName = document.getElementById('fingerprintEmployeeName').value;
    
    if (typeof scanFingerprint !== 'function') {
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = '<div style="padding: 10px; background: #fff3cd; color: #856404; border-radius: 5px;">⚠️ Fingerprint sensor module not loaded. Please refresh the page.</div>';
        return;
    }
    
    try {
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = '<div style="padding: 10px; background: #e3f2fd; color: #1565c0; border-radius: 5px;">📡 Scanning fingerprint... Place finger on sensor (built-in or external).</div>';
        
        // Pass employee info for built-in sensor
        const fingerprintData = await scanFingerprint(employeeId, employeeName);
        
        if (fingerprintData) {
            document.getElementById('fingerprintData').value = fingerprintData;
            statusDiv.innerHTML = '<div style="padding: 10px; background: #e8f5e9; color: #2e7d32; border-radius: 5px;">✅ Fingerprint captured successfully! Click "Register Fingerprint" to save.</div>';
        }
    } catch (error) {
        statusDiv.innerHTML = `<div style="padding: 10px; background: #ffebee; color: #c62828; border-radius: 5px;">❌ Error: ${error.message}</div>`;
    }
}

// Register fingerprint
async function registerFingerprint() {
    const employeeId = document.getElementById('fingerprintEmployeeId').value;
    const fingerprintData = document.getElementById('fingerprintData').value.trim();
    const statusDiv = document.getElementById('fingerprintStatus');
    
    if (!fingerprintData) {
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = '<div style="padding: 10px; background: #ffebee; color: #c62828; border-radius: 5px;">Please scan fingerprint or enter fingerprint data</div>';
        return;
    }
    
    try {
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = '<div style="padding: 10px; background: #e3f2fd; color: #1565c0; border-radius: 5px;">⏳ Registering fingerprint...</div>';
        
        const response = await fetchWithAuth(`${API_BASE}/employees/${employeeId}/fingerprint`, {
            method: 'POST',
            body: JSON.stringify({ fingerprint_data: fingerprintData })
        });
        
        if (response && response.ok) {
            statusDiv.innerHTML = '<div style="padding: 10px; background: #e8f5e9; color: #2e7d32; border-radius: 5px;">✅ Fingerprint registered successfully! Each fingerprint is unique and cannot be duplicated.</div>';
            document.getElementById('fingerprintData').value = '';
            setTimeout(() => {
                closeFingerprintModal();
            }, 2000);
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to register fingerprint');
        }
    } catch (error) {
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = `<div style="padding: 10px; background: #ffebee; color: #c62828; border-radius: 5px;">❌ Error: ${error.message}</div>`;
    }
}

// Update fingerprint sensor status
function updateFingerprintSensorStatus(message) {
    const statusDiv = document.getElementById('fingerprintStatus');
    if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = `<div style="padding: 10px; background: #e3f2fd; color: #1565c0; border-radius: 5px;">${message}</div>`;
    }
}

// Open Check-In Modal
function openCheckInModal() {
    try {
        const modal = document.getElementById('checkInModal');
        if (!modal) {
            console.error('Check-In modal not found');
            alert('Error: Check-In modal not found. Please refresh the page.');
            return;
        }
        document.getElementById('checkInInput').value = '';
        document.getElementById('checkInStatus').style.display = 'none';
        modal.style.display = 'block';
        setTimeout(() => {
            const input = document.getElementById('checkInInput');
            if (input) input.focus();
        }, 100);
    } catch (error) {
        console.error('Error opening check-in modal:', error);
        alert('Error opening modal: ' + error.message);
    }
}

// Close Check-In Modal
function closeCheckInModal() {
    document.getElementById('checkInModal').style.display = 'none';
    document.getElementById('checkInInput').value = '';
    document.getElementById('checkInStatus').style.display = 'none';
}

// Removed fingerprint scanning for check-in - now only uses Employee ID

// Process Check-In (Only Employee ID)
async function processCheckIn() {
    const input = document.getElementById('checkInInput').value.trim();
    const statusDiv = document.getElementById('checkInStatus');
    
    if (!input) {
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = '<div style="padding: 10px; background: #ffebee; color: #c62828; border-radius: 5px;">Please enter employee ID</div>';
        return;
    }
    
    try {
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = '<div style="padding: 10px; background: #e3f2fd; color: #1565c0; border-radius: 5px;">⏳ Processing check-in...</div>';
        
        // Only use employee ID for check-in
        const response = await fetchWithAuth(`${API_BASE}/attendance/mark`, {
            method: 'POST',
            body: JSON.stringify({ 
                employee_id: input,
                attendance_type: 'check-in'
            })
        });
        
        if (response && response.ok) {
            const data = await response.json();
            
            statusDiv.style.display = 'block';
            statusDiv.innerHTML = `
                <div style="padding: 15px; background: #e8f5e9; color: #2e7d32; border-radius: 10px; border: 2px solid #4caf50;">
                    <div style="font-size: 18px; font-weight: 700; margin-bottom: 10px;">
                        ✅ CHECK-IN SUCCESSFUL
                    </div>
                    <div style="font-size: 14px;">
                        <strong>Employee:</strong> ${data.employee_name || input}<br>
                        <strong>Check-In Time:</strong> ${data.check_in_time || data.time || new Date().toLocaleTimeString()}<br>
                        <strong>Date:</strong> ${data.attendance_date || new Date().toLocaleDateString()}
                    </div>
                </div>
            `;
            
            document.getElementById('checkInInput').value = '';
            
            setTimeout(() => {
                document.getElementById('checkInInput').focus();
            }, 500);
            
            // Reload attendance and dashboard if on those tabs
            if (currentTab === 'attendance') {
                loadAttendance();
            }
            if (currentTab === 'dashboard') {
                loadDashboard();
            }
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to mark check-in');
        }
    } catch (error) {
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = `<div style="padding: 10px; background: #ffebee; color: #c62828; border-radius: 5px;">Error: ${error.message}</div>`;
    }
}

// Open Check-Out Modal
function openCheckOutModal() {
    try {
        const modal = document.getElementById('checkOutModal');
        if (!modal) {
            console.error('Check-Out modal not found');
            alert('Error: Check-Out modal not found. Please refresh the page.');
            return;
        }
        document.getElementById('checkOutInput').value = '';
        document.getElementById('checkOutStatus').style.display = 'none';
        modal.style.display = 'block';
        setTimeout(() => {
            const input = document.getElementById('checkOutInput');
            if (input) input.focus();
        }, 100);
    } catch (error) {
        console.error('Error opening check-out modal:', error);
        alert('Error opening modal: ' + error.message);
    }
}

// Close Check-Out Modal
function closeCheckOutModal() {
    document.getElementById('checkOutModal').style.display = 'none';
    document.getElementById('checkOutInput').value = '';
    document.getElementById('checkOutStatus').style.display = 'none';
}

// Removed fingerprint scanning for check-out - now only uses Employee ID

// Process Check-Out (Only Employee ID)
async function processCheckOut() {
    const input = document.getElementById('checkOutInput').value.trim();
    const statusDiv = document.getElementById('checkOutStatus');
    
    if (!input) {
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = '<div style="padding: 10px; background: #ffebee; color: #c62828; border-radius: 5px;">Please enter employee ID</div>';
        return;
    }
    
    try {
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = '<div style="padding: 10px; background: #e3f2fd; color: #1565c0; border-radius: 5px;">⏳ Processing check-out...</div>';
        
        // Only use employee ID for check-out
        const response = await fetchWithAuth(`${API_BASE}/attendance/mark`, {
            method: 'POST',
            body: JSON.stringify({ 
                employee_id: input,
                attendance_type: 'check-out'
            })
        });
        
        if (response && response.ok) {
            const data = await response.json();
            
            statusDiv.style.display = 'block';
            statusDiv.innerHTML = `
                <div style="padding: 15px; background: #fff3e0; color: #e65100; border-radius: 10px; border: 2px solid #ff9800;">
                    <div style="font-size: 18px; font-weight: 700; margin-bottom: 10px;">
                        🚪 CHECK-OUT SUCCESSFUL
                    </div>
                    <div style="font-size: 14px;">
                        <strong>Employee:</strong> ${data.employee_name || input}<br>
                        <strong>Check-Out Time:</strong> ${data.check_out_time || data.time || new Date().toLocaleTimeString()}<br>
                        <strong>Date:</strong> ${data.attendance_date || new Date().toLocaleDateString()}<br>
                        ${data.total_hours ? `<strong>Total Hours Today:</strong> ${parseFloat(data.total_hours).toFixed(2)} hrs` : ''}
                    </div>
                </div>
            `;
            
            document.getElementById('checkOutInput').value = '';
            
            setTimeout(() => {
                document.getElementById('checkOutInput').focus();
            }, 500);
            
            // Reload attendance and dashboard if on those tabs
            if (currentTab === 'attendance') {
                loadAttendance();
            }
            if (currentTab === 'dashboard') {
                loadDashboard();
            }
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to mark check-out');
        }
    } catch (error) {
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = `<div style="padding: 10px; background: #ffebee; color: #c62828; border-radius: 5px;">Error: ${error.message}</div>`;
    }
}

// Load attendance
async function loadAttendance() {
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;
    
    const dateFilter = document.getElementById('attendanceDateFilter')?.value || new Date().toISOString().split('T')[0];
    const employeeFilter = document.getElementById('attendanceEmployeeFilter')?.value || '';
    
    let url = `${API_BASE}/attendance?date=${dateFilter}`;
    if (employeeFilter) url += `&employee_id=${employeeFilter}`;
    
    try {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">Loading attendance...</td></tr>';
        const response = await fetchWithAuth(url);
        if (response && response.ok) {
            const attendance = await response.json();
            displayAttendance(attendance || []);
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to load attendance');
        }
    } catch (error) {
        console.error('Error loading attendance:', error);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" class="loading">Error: ${error.message || 'Failed to load attendance'}</td></tr>`;
        }
    }
}

// Display attendance
function displayAttendance(attendance) {
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;
    
    if (!attendance || attendance.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No attendance records found</td></tr>';
        return;
    }
    
    tbody.innerHTML = attendance.map(record => {
        const statusColor = record.status === 'present' ? '#4caf50' : record.status === 'absent' ? '#dc3545' : '#ff9800';
        return `
            <tr>
                <td>${record.attendance_date}</td>
                <td>${escapeHtml(record.employee_id)}</td>
                <td>${escapeHtml(record.employee_name || '-')}</td>
                <td>${record.check_in_time || '-'}</td>
                <td>${record.check_out_time || '-'}</td>
                <td>${parseFloat(record.total_hours || 0).toFixed(2)} hrs</td>
                <td><span style="padding: 4px 8px; background: ${statusColor}; color: white; border-radius: 4px; font-size: 12px;">${record.status || 'present'}</span></td>
                <td>
                    <button onclick="editAttendance(${record.id})" style="padding: 5px 10px; font-size: 11px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">Edit</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Load leaves
async function loadLeaves() {
    const tbody = document.getElementById('leavesTableBody');
    if (!tbody) return;
    
    const statusFilter = document.getElementById('leaveStatusFilter')?.value || '';
    const employeeFilter = document.getElementById('leaveEmployeeFilter')?.value || '';
    
    let url = `${API_BASE}/leaves`;
    const params = [];
    if (statusFilter) params.push(`status=${statusFilter}`);
    if (employeeFilter) params.push(`employee_id=${employeeFilter}`);
    if (params.length > 0) url += '?' + params.join('&');
    
    try {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">Loading leaves...</td></tr>';
        const response = await fetchWithAuth(url);
        if (response && response.ok) {
            const leaves = await response.json();
            displayLeaves(leaves || []);
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to load leaves');
        }
    } catch (error) {
        console.error('Error loading leaves:', error);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" class="loading">Error: ${error.message || 'Failed to load leaves'}</td></tr>`;
        }
    }
}

// Display leaves
function displayLeaves(leaves) {
    const tbody = document.getElementById('leavesTableBody');
    if (!tbody) return;
    
    if (!leaves || leaves.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No leave records found</td></tr>';
        return;
    }
    
    tbody.innerHTML = leaves.map(leave => {
        const statusColor = leave.status === 'approved' ? '#4caf50' : leave.status === 'rejected' ? '#dc3545' : '#ff9800';
        return `
            <tr>
                <td>${escapeHtml(leave.employee_id)}</td>
                <td>${escapeHtml(leave.employee_name || '-')}</td>
                <td>${escapeHtml(leave.leave_type)}</td>
                <td>${leave.start_date}</td>
                <td>${leave.end_date}</td>
                <td>${leave.total_days} days</td>
                <td><span style="padding: 4px 8px; background: ${statusColor}; color: white; border-radius: 4px; font-size: 12px;">${leave.status}</span></td>
                <td>
                    ${leave.status === 'pending' ? 
                        `<button onclick="approveLeave(${leave.id})" style="padding: 5px 10px; font-size: 11px; background: #4caf50; color: white; border: none; border-radius: 3px; cursor: pointer; margin-right: 5px;">Approve</button>
                         <button onclick="rejectLeave(${leave.id})" style="padding: 5px 10px; font-size: 11px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer;">Reject</button>` :
                        '<span style="color: #999;">-</span>'
                    }
                </td>
            </tr>
        `;
    }).join('');
}

// Load short leaves
async function loadShortLeaves() {
    const tbody = document.getElementById('shortLeavesTableBody');
    if (!tbody) return;
    
    const dateFilter = document.getElementById('shortLeaveDateFilter')?.value || '';
    const statusFilter = document.getElementById('shortLeaveStatusFilter')?.value || '';
    
    let url = `${API_BASE}/short-leaves`;
    const params = [];
    if (dateFilter) params.push(`date=${dateFilter}`);
    if (statusFilter) params.push(`status=${statusFilter}`);
    if (params.length > 0) url += '?' + params.join('&');
    
    try {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">Loading short leaves...</td></tr>';
        const response = await fetchWithAuth(url);
        if (response && response.ok) {
            const shortLeaves = await response.json();
            displayShortLeaves(shortLeaves || []);
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to load short leaves');
        }
    } catch (error) {
        console.error('Error loading short leaves:', error);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" class="loading">Error: ${error.message || 'Failed to load short leaves'}</td></tr>`;
        }
    }
}

// Display short leaves
function displayShortLeaves(shortLeaves) {
    const tbody = document.getElementById('shortLeavesTableBody');
    if (!tbody) return;
    
    if (!shortLeaves || shortLeaves.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No short leave records found</td></tr>';
        return;
    }
    
    tbody.innerHTML = shortLeaves.map(leave => {
        const statusColor = leave.status === 'approved' ? '#4caf50' : leave.status === 'rejected' ? '#dc3545' : '#ff9800';
        return `
            <tr>
                <td>${leave.leave_date}</td>
                <td>${escapeHtml(leave.employee_id)}</td>
                <td>${escapeHtml(leave.employee_name || '-')}</td>
                <td>${leave.leave_time}</td>
                <td>${leave.return_time || '-'}</td>
                <td>${parseFloat(leave.duration_hours || 0).toFixed(2)} hrs</td>
                <td><span style="padding: 4px 8px; background: ${statusColor}; color: white; border-radius: 4px; font-size: 12px;">${leave.status}</span></td>
                <td>
                    ${leave.status === 'pending' ? 
                        `<button onclick="approveShortLeave(${leave.id})" style="padding: 5px 10px; font-size: 11px; background: #4caf50; color: white; border: none; border-radius: 3px; cursor: pointer; margin-right: 5px;">Approve</button>
                         <button onclick="rejectShortLeave(${leave.id})" style="padding: 5px 10px; font-size: 11px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer;">Reject</button>` :
                        '<span style="color: #999;">-</span>'
                    }
                </td>
            </tr>
        `;
    }).join('');
}

// Open leave modal
function openLeaveModal() {
    try {
        const modal = document.getElementById('leaveModal');
        if (!modal) {
            console.error('Leave modal not found');
            alert('Error: Leave modal not found. Please refresh the page.');
            return;
        }
        document.getElementById('leaveId').value = '';
        document.getElementById('leaveForm').reset();
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error opening leave modal:', error);
        alert('Error opening modal: ' + error.message);
    }
}

// Close leave modal
function closeLeaveModal() {
    document.getElementById('leaveModal').style.display = 'none';
}

// Calculate leave days
function calculateLeaveDays() {
    const startDate = document.getElementById('leaveStartDate').value;
    const endDate = document.getElementById('leaveEndDate').value;
    
    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end day
        document.getElementById('leaveTotalDays').value = diffDays;
    }
}

// Save leave
async function handleLeaveSubmit(e) {
    e.preventDefault();
    
    const leaveData = {
        employee_id: document.getElementById('leaveEmployeeId').value,
        leave_type: document.getElementById('leaveType').value,
        start_date: document.getElementById('leaveStartDate').value,
        end_date: document.getElementById('leaveEndDate').value,
        total_days: parseInt(document.getElementById('leaveTotalDays').value),
        reason: document.getElementById('leaveReason').value || null
    };
    
    try {
        const response = await fetchWithAuth(`${API_BASE}/leaves`, {
            method: 'POST',
            body: JSON.stringify(leaveData)
        });
        
        if (response && response.ok) {
            alert('Leave applied successfully');
            closeLeaveModal();
            loadLeaves();
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to apply leave');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Open short leave modal
function openShortLeaveModal() {
    try {
        const modal = document.getElementById('shortLeaveModal');
        if (!modal) {
            console.error('Short leave modal not found');
            alert('Error: Short leave modal not found. Please refresh the page.');
            return;
        }
        document.getElementById('shortLeaveId').value = '';
        document.getElementById('shortLeaveForm').reset();
        document.getElementById('shortLeaveDate').value = new Date().toISOString().split('T')[0];
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error opening short leave modal:', error);
        alert('Error opening modal: ' + error.message);
    }
}

// Close short leave modal
function closeShortLeaveModal() {
    document.getElementById('shortLeaveModal').style.display = 'none';
}

// Calculate short leave duration
function calculateShortLeaveDuration() {
    const leaveTime = document.getElementById('shortLeaveTime').value;
    const returnTime = document.getElementById('shortLeaveReturnTime').value;
    
    if (leaveTime && returnTime) {
        const [leaveHour, leaveMin] = leaveTime.split(':').map(Number);
        const [returnHour, returnMin] = returnTime.split(':').map(Number);
        
        const leaveMinutes = leaveHour * 60 + leaveMin;
        const returnMinutes = returnHour * 60 + returnMin;
        
        let diffMinutes = returnMinutes - leaveMinutes;
        if (diffMinutes < 0) {
            diffMinutes += 24 * 60; // Next day
        }
        
        const hours = diffMinutes / 60;
        document.getElementById('shortLeaveDuration').value = hours.toFixed(2);
    }
}

// Save short leave
async function handleShortLeaveSubmit(e) {
    e.preventDefault();
    
    const shortLeaveData = {
        employee_id: document.getElementById('shortLeaveEmployeeId').value,
        leave_date: document.getElementById('shortLeaveDate').value,
        leave_time: document.getElementById('shortLeaveTime').value,
        return_time: document.getElementById('shortLeaveReturnTime').value || null,
        duration_hours: parseFloat(document.getElementById('shortLeaveDuration').value || 0),
        reason: document.getElementById('shortLeaveReason').value || null
    };
    
    try {
        const response = await fetchWithAuth(`${API_BASE}/short-leaves`, {
            method: 'POST',
            body: JSON.stringify(shortLeaveData)
        });
        
        if (response && response.ok) {
            alert('Short leave applied successfully');
            closeShortLeaveModal();
            loadShortLeaves();
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to apply short leave');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Approve leave
async function approveLeave(leaveId) {
    try {
        const response = await fetchWithAuth(`${API_BASE}/leaves/${leaveId}/approve`, {
            method: 'POST'
        });
        
        if (response && response.ok) {
            alert('Leave approved successfully');
            loadLeaves();
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to approve leave');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Reject leave
async function rejectLeave(leaveId) {
    if (!confirm('Are you sure you want to reject this leave?')) return;
    
    try {
        const response = await fetchWithAuth(`${API_BASE}/leaves/${leaveId}/reject`, {
            method: 'POST'
        });
        
        if (response && response.ok) {
            alert('Leave rejected');
            loadLeaves();
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to reject leave');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Approve short leave
async function approveShortLeave(leaveId) {
    try {
        const response = await fetchWithAuth(`${API_BASE}/short-leaves/${leaveId}/approve`, {
            method: 'POST'
        });
        
        if (response && response.ok) {
            alert('Short leave approved successfully');
            loadShortLeaves();
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to approve short leave');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Reject short leave
async function rejectShortLeave(leaveId) {
    if (!confirm('Are you sure you want to reject this short leave?')) return;
    
    try {
        const response = await fetchWithAuth(`${API_BASE}/short-leaves/${leaveId}/reject`, {
            method: 'POST'
        });
        
        if (response && response.ok) {
            alert('Short leave rejected');
            loadShortLeaves();
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to reject short leave');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Edit attendance
function editAttendance(attendanceId) {
    // TODO: Implement edit attendance modal
    alert('Edit attendance feature - Coming soon');
}

// Helper function
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load dashboard data
async function loadDashboard() {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Load all data in parallel
        const [employeesRes, attendanceRes, leavesRes] = await Promise.all([
            fetchWithAuth(`${API_BASE}/employees`),
            fetchWithAuth(`${API_BASE}/attendance?date=${today}`),
            fetchWithAuth(`${API_BASE}/leaves?status=approved`)
        ]);
        
        let employees = [];
        let attendance = [];
        let leaves = [];
        
        if (employeesRes && employeesRes.ok) {
            employees = await employeesRes.json() || [];
        }
        if (attendanceRes && attendanceRes.ok) {
            attendance = await attendanceRes.json() || [];
        }
        if (leavesRes && leavesRes.ok) {
            leaves = await leavesRes.json() || [];
        }
        
        // Update stats
        updateDashboardStats(employees, attendance, leaves, today);
        
        // Load and render charts
        await loadAttendanceTrend();
        await loadLeaveStatusChart(leaves);
        await loadMonthlyAttendance();
        await loadDepartmentAttendance(employees, attendance);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Update dashboard statistics
function updateDashboardStats(employees, attendance, leaves, today) {
    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => e.status === 'active').length;
    
    // Count present (checked in today)
    const presentToday = attendance.filter(a => a.check_in_time && (!a.check_out_time || a.status === 'present')).length;
    
    // Count on leave today
    const onLeaveToday = leaves.filter(l => {
        const start = new Date(l.start_date);
        const end = new Date(l.end_date);
        const todayDate = new Date(today);
        return todayDate >= start && todayDate <= end;
    }).length;
    
    // Count absent (active employees not present and not on leave)
    const absentToday = activeEmployees - presentToday - onLeaveToday;
    
    const totalEl = document.getElementById('statTotalEmployees');
    const presentEl = document.getElementById('statPresentToday');
    const leaveEl = document.getElementById('statOnLeave');
    const absentEl = document.getElementById('statAbsentToday');
    
    if (totalEl) totalEl.textContent = totalEmployees;
    if (presentEl) presentEl.textContent = presentToday;
    if (leaveEl) leaveEl.textContent = onLeaveToday;
    if (absentEl) absentEl.textContent = Math.max(0, absentToday);
}

// Load attendance trend (last 7 days)
async function loadAttendanceTrend() {
    try {
        const dates = [];
        const presentData = [];
        const absentData = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            dates.push(date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
            
            const response = await fetchWithAuth(`${API_BASE}/attendance?date=${dateStr}`);
            if (response && response.ok) {
                const data = await response.json() || [];
                const present = data.filter(a => a.status === 'present' || a.check_in_time).length;
                const absent = data.filter(a => a.status === 'absent').length;
                presentData.push(present);
                absentData.push(absent);
            } else {
                presentData.push(0);
                absentData.push(0);
            }
        }
        
        renderAttendanceTrendChart(dates, presentData, absentData);
    } catch (error) {
        console.error('Error loading attendance trend:', error);
    }
}

// Render attendance trend chart
function renderAttendanceTrendChart(labels, presentData, absentData) {
    const ctx = document.getElementById('attendanceTrendChart');
    if (!ctx || typeof Chart === 'undefined') return;
    
    if (employeeCharts.attendanceTrend) {
        employeeCharts.attendanceTrend.destroy();
    }
    
    employeeCharts.attendanceTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Present',
                data: presentData,
                borderColor: 'rgba(76, 175, 80, 1)',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.4,
                fill: true
            }, {
                label: 'Absent',
                data: absentData,
                borderColor: 'rgba(220, 53, 69, 1)',
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Load leave status chart
function loadLeaveStatusChart(leaves) {
    const pending = leaves.filter(l => l.status === 'pending').length;
    const approved = leaves.filter(l => l.status === 'approved').length;
    const rejected = leaves.filter(l => l.status === 'rejected').length;
    
    renderLeaveStatusChart(pending, approved, rejected);
}

// Render leave status chart
function renderLeaveStatusChart(pending, approved, rejected) {
    const ctx = document.getElementById('leaveStatusChart');
    if (!ctx || typeof Chart === 'undefined') return;
    
    if (employeeCharts.leaveStatus) {
        employeeCharts.leaveStatus.destroy();
    }
    
    employeeCharts.leaveStatus = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Pending', 'Approved', 'Rejected'],
            datasets: [{
                data: [pending, approved, rejected],
                backgroundColor: [
                    'rgba(255, 152, 0, 0.8)',
                    'rgba(76, 175, 80, 0.8)',
                    'rgba(220, 53, 69, 0.8)'
                ],
                borderColor: [
                    'rgba(255, 152, 0, 1)',
                    'rgba(76, 175, 80, 1)',
                    'rgba(220, 53, 69, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom'
                }
            }
        }
    });
}

// Load monthly attendance
async function loadMonthlyAttendance() {
    try {
        const month = new Date().getMonth();
        const year = new Date().getFullYear();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const labels = [];
        const data = [];
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            labels.push(day);
            
            const response = await fetchWithAuth(`${API_BASE}/attendance?date=${dateStr}`);
            if (response && response.ok) {
                const attendanceData = await response.json() || [];
                const present = attendanceData.filter(a => a.status === 'present' || a.check_in_time).length;
                data.push(present);
            } else {
                data.push(0);
            }
        }
        
        renderMonthlyAttendanceChart(labels, data);
    } catch (error) {
        console.error('Error loading monthly attendance:', error);
    }
}

// Render monthly attendance chart
function renderMonthlyAttendanceChart(labels, data) {
    const ctx = document.getElementById('monthlyAttendanceChart');
    if (!ctx || typeof Chart === 'undefined') return;
    
    if (employeeCharts.monthlyAttendance) {
        employeeCharts.monthlyAttendance.destroy();
    }
    
    employeeCharts.monthlyAttendance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Present Employees',
                data: data,
                backgroundColor: 'rgba(102, 126, 234, 0.6)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Load department attendance
function loadDepartmentAttendance(employees, attendance) {
    const departmentMap = {};
    
    employees.forEach(emp => {
        const dept = emp.department || 'Unassigned';
        if (!departmentMap[dept]) {
            departmentMap[dept] = { total: 0, present: 0 };
        }
        departmentMap[dept].total++;
    });
    
    attendance.forEach(att => {
        const emp = employees.find(e => e.employee_id === att.employee_id);
        if (emp) {
            const dept = emp.department || 'Unassigned';
            if (departmentMap[dept] && (att.status === 'present' || att.check_in_time)) {
                departmentMap[dept].present++;
            }
        }
    });
    
    const labels = Object.keys(departmentMap);
    const presentData = labels.map(dept => departmentMap[dept].present);
    const totalData = labels.map(dept => departmentMap[dept].total);
    
    renderDepartmentAttendanceChart(labels, presentData, totalData);
}

// Render department attendance chart
function renderDepartmentAttendanceChart(labels, presentData, totalData) {
    const ctx = document.getElementById('departmentAttendanceChart');
    if (!ctx || typeof Chart === 'undefined') return;
    
    if (employeeCharts.departmentAttendance) {
        employeeCharts.departmentAttendance.destroy();
    }
    
    employeeCharts.departmentAttendance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Present',
                data: presentData,
                backgroundColor: 'rgba(76, 175, 80, 0.6)',
                borderColor: 'rgba(76, 175, 80, 1)',
                borderWidth: 1
            }, {
                label: 'Total',
                data: totalData,
                backgroundColor: 'rgba(102, 126, 234, 0.6)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}


