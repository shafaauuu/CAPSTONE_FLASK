// Socket.IO client implementation
const socket = io();

// Connection status handlers
socket.on('connect', function() {
    console.log('Connected to server');
});

socket.on('disconnect', function() {
    console.log('Disconnected from server');
});

// Admin data handlers
function requestAdminData() {
    socket.emit('request_admin_data', {});
}

socket.on('admin_data', function(data) {
    if (data.success) {
        console.log('Admin data received:', data.profile);
        // Update UI with admin data
        updateAdminProfileUI(data.profile);
    } else {
        console.error('Error fetching admin data:', data.error);
    }
});

function updateAdminProfileUI(profile) {
    // Update admin name
    const adminNameElements = document.querySelectorAll('.admin-name');
    adminNameElements.forEach(el => {
        el.textContent = profile.name;
    });

    // Update other profile fields if they exist
    if (document.getElementById('profile-email')) {
        document.getElementById('profile-email').textContent = profile.email;
    }
    if (document.getElementById('profile-department')) {
        document.getElementById('profile-department').textContent = profile.department_name;
    }
    if (document.getElementById('profile-division')) {
        document.getElementById('profile-division').textContent = profile.division_name;
    }
    if (document.getElementById('profile-role')) {
        document.getElementById('profile-role').textContent = profile.role_name;
    }
    if (document.getElementById('profile-plant')) {
        document.getElementById('profile-plant').textContent = profile.plant_name;
    }
}

// Dashboard stats handlers
function requestDashboardStats() {
    socket.emit('request_dashboard_stats', {});
}

socket.on('dashboard_stats', function(data) {
    if (data.success) {
        console.log('Dashboard stats received:', data);
        // Update UI with dashboard stats
        updateDashboardUI(data);
    } else {
        console.error('Error fetching dashboard stats:', data.error);
    }
});

function updateDashboardUI(data) {
    // Update date range
    if (document.getElementById('date-range')) {
        document.getElementById('date-range').textContent = data.date_range;
    }

    // Update user counts
    if (document.getElementById('all-users-count')) {
        document.getElementById('all-users-count').textContent = data.all_users_count;
    }
    if (document.getElementById('new-users-count')) {
        document.getElementById('new-users-count').textContent = data.new_users_count;
    }
    if (document.getElementById('pending-users-count')) {
        document.getElementById('pending-users-count').textContent = data.pending_users_count;
    }
    if (document.getElementById('approved-users-count')) {
        document.getElementById('approved-users-count').textContent = data.approved_users_count;
    }

    // Update pending users table if it exists
    if (document.getElementById('pending-users-table')) {
        updatePendingUsersTable(data.pending_users);
    }
}

function updatePendingUsersTable(pendingUsers) {
    const tableBody = document.getElementById('pending-users-table').querySelector('tbody');
    tableBody.innerHTML = '';

    if (pendingUsers.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="5" class="text-center">No pending users</td>';
        tableBody.appendChild(row);
        return;
    }

    pendingUsers.forEach((user, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${user.name || 'N/A'}</td>
            <td>${user.email || 'N/A'}</td>
            <td>${new Date(user.created_at).toLocaleString() || 'N/A'}</td>
            <td>
                <button class="btn btn-sm btn-success approve-user" data-id="${user.id}">Approve</button>
                <button class="btn btn-sm btn-danger reject-user" data-id="${user.id}">Reject</button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    // Add event listeners for approve/reject buttons
    document.querySelectorAll('.approve-user').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.getAttribute('data-id');
            approveUser(userId);
        });
    });

    document.querySelectorAll('.reject-user').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.getAttribute('data-id');
            rejectUser(userId);
        });
    });
}

// History data handlers
function requestHistoryData(userType = 'user', userId = null) {
    socket.emit('request_history_data', {
        user_type: userType,
        user_id: userId
    });
}

socket.on('history_data', function(data) {
    if (data.success) {
        console.log('History data received:', data.history);
        // Update UI with history data
        updateHistoryUI(data.history);
    } else {
        console.error('Error fetching history data:', data.error);
    }
});

function updateHistoryUI(historyData) {
    // Update history table if it exists
    if (document.getElementById('history-table')) {
        const tableBody = document.getElementById('history-table').querySelector('tbody');
        tableBody.innerHTML = '';

        if (historyData.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="5" class="text-center">No history data</td>';
            tableBody.appendChild(row);
            return;
        }

        historyData.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${item.user_name || 'N/A'}</td>
                <td>${item.admin_name || 'N/A'}</td>
                <td>${item.status || 'N/A'}</td>
                <td>${new Date(item.created_at).toLocaleString() || 'N/A'}</td>
            `;
            tableBody.appendChild(row);
        });
    }
}

// Sensor data handlers
function requestSensorData(page = 1, pageSize = 10, location = null, status = null) {
    socket.emit('request_sensor_data', {
        page: page,
        pageSize: pageSize,
        location: location,
        status: status
    });
}

socket.on('sensor_data', function(data) {
    if (data.success) {
        console.log('Sensor data received:', data.data);
        // Update UI with sensor data
        updateSensorUI(data.data);
    } else {
        console.error('Error fetching sensor data:', data.error);
    }
});

function updateSensorUI(sensorData) {
    console.log('Updating sensor UI with data:', sensorData);
    
    // Update fire sensor table
    if (document.getElementById('fire-sensor-table')) {
        updateFireSensorTable(sensorData.fireSensorData);
    }
    
    // Update smoke sensor table
    if (document.getElementById('smoke-sensor-table')) {
        updateSmokeSensorTable(sensorData.smokeSensorData);
    }
    
    // Update DHT11 sensor table
    if (document.getElementById('dht11-sensor-table')) {
        updateDHT11SensorTable(sensorData.dht11Data);
    }
    
    // Update location filter dropdowns
    if (sensorData.locations) {
        updateLocationFilters(sensorData.locations);
    }
    
    // Update sensor overview cards
    updateSensorOverviewCards(sensorData);
}

function updateFireSensorTable(fireData) {
    if (!fireData || !fireData.data) return;
    
    const tableBody = document.getElementById('fire-sensor-table').querySelector('tbody');
    tableBody.innerHTML = '';
    
    if (fireData.data.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="5" class="text-center">No fire sensor data available</td>';
        tableBody.appendChild(row);
        return;
    }
    
    fireData.data.forEach((sensor) => {
        const row = document.createElement('tr');
        const statusClass = sensor.fire_status === 'Detected' ? 'text-danger' : 'text-success';
        const statusIndicator = sensor.fire_status === 'Detected' ? 'status-danger' : 'status-active';
        
        row.innerHTML = `
            <td><a href="#" class="text-primary fw-bold">FIRE-${sensor.fire_id.toString().padStart(3, '0')}</a></td>
            <td class="fw-bold">${sensor.fire_loc || 'N/A'}</td>
            <td>
                <div class="d-flex align-items-center">
                    <span class="status-indicator ${statusIndicator}"></span>
                    <span class="fw-bold ${statusClass}">${sensor.fire_status || 'N/A'}</span>
                </div>
            </td>
            <td>${new Date(sensor.fire_timestamp).toLocaleString() || 'N/A'}</td>
        `;
        tableBody.appendChild(row);
    });
    
    // Update pagination
    updatePagination('fire-sensor-pagination', fireData.pagination);
}

function updateSmokeSensorTable(smokeData) {
    if (!smokeData || !smokeData.data) return;
    
    const tableBody = document.getElementById('smoke-sensor-table').querySelector('tbody');
    tableBody.innerHTML = '';
    
    if (smokeData.data.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="5" class="text-center">No smoke sensor data available</td>';
        tableBody.appendChild(row);
        return;
    }
    
    smokeData.data.forEach((sensor) => {
        const row = document.createElement('tr');
        const statusClass = sensor.smoke_status === 'Detected' ? 'text-danger' : 'text-success';
        const statusIndicator = sensor.smoke_status === 'Detected' ? 'status-danger' : 'status-active';
        
        row.innerHTML = `
            <td><a href="#" class="text-primary fw-bold">SMOKE-${sensor.smoke_id.toString().padStart(3, '0')}</a></td>
            <td class="fw-bold">${sensor.smoke_loc || 'N/A'}</td>
            <td>
                <div class="d-flex align-items-center">
                    <span class="status-indicator ${statusIndicator}"></span>
                    <span class="fw-bold ${statusClass}">${sensor.smoke_status || 'N/A'}</span>
                </div>
            </td>
            <td>${new Date(sensor.smoke_timestamp).toLocaleString() || 'N/A'}</td>
        `;
        tableBody.appendChild(row);
    });
    
    // Update pagination
    updatePagination('smoke-sensor-pagination', smokeData.pagination);
}

function updateDHT11SensorTable(dht11Data) {
    if (!dht11Data || !dht11Data.data) return;
    
    const tableBody = document.getElementById('dht11-sensor-table').querySelector('tbody');
    tableBody.innerHTML = '';
    
    if (dht11Data.data.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="5" class="text-center">No temperature sensor data available</td>';
        tableBody.appendChild(row);
        return;
    }
    
    dht11Data.data.forEach((sensor) => {
        const row = document.createElement('tr');
        let statusClass = 'text-success';
        let statusIndicator = 'status-active';
        
        if (sensor.dht11_status === 'High Temp') {
            statusClass = 'text-danger';
            statusIndicator = 'status-danger';
        } else if (sensor.dht11_status === 'Warning') {
            statusClass = 'text-warning';
            statusIndicator = 'status-warning';
        }
        
        row.innerHTML = `
            <td><a href="#" class="text-primary fw-bold">TEMP-${sensor.dht11_id.toString().padStart(3, '0')}</a></td>
            <td class="fw-bold">${sensor.dht11_loc || 'N/A'}</td>
            <td>
                <div class="d-flex align-items-center">
                    <span class="status-indicator ${statusIndicator}"></span>
                    <span class="fw-bold ${statusClass}">${sensor.dht11_status || 'N/A'}</span>
                </div>
            </td>
            <td>${new Date(sensor.dht11_timestamp).toLocaleString() || 'N/A'}</td>
        `;
        tableBody.appendChild(row);
    });
    
    // Update pagination
    updatePagination('dht11-sensor-pagination', dht11Data.pagination);
}

function updatePagination(paginationId, pagination) {
    if (!pagination) return;
    
    const paginationElement = document.getElementById(paginationId);
    if (!paginationElement) return;
    
    paginationElement.innerHTML = '';
    
    // Previous button
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${pagination.page <= 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `<a class="page-link" href="#" data-page="${pagination.page - 1}">Previous</a>`;
    paginationElement.appendChild(prevLi);
    
    // Page numbers
    const startPage = Math.max(1, pagination.page - 2);
    const endPage = Math.min(pagination.totalPages, pagination.page + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageLi = document.createElement('li');
        pageLi.className = `page-item ${i === pagination.page ? 'active' : ''}`;
        pageLi.innerHTML = `<a class="page-link" href="#" data-page="${i}">${i}</a>`;
        paginationElement.appendChild(pageLi);
    }
    
    // Next button
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${pagination.page >= pagination.totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `<a class="page-link" href="#" data-page="${pagination.page + 1}">Next</a>`;
    paginationElement.appendChild(nextLi);
    
    // Add event listeners to pagination links
    paginationElement.querySelectorAll('.page-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = parseInt(this.getAttribute('data-page'));
            
            // Get current filter values
            const locationFilter = document.getElementById('location-filter') ? 
                document.getElementById('location-filter').value : null;
            const statusFilter = document.getElementById('status-filter') ? 
                document.getElementById('status-filter').value : null;
            
            // Request new data with updated page
            requestSensorData(page, pagination.pageSize, locationFilter, statusFilter);
        });
    });
}

function updateLocationFilters(locations) {
    console.log('Updating location filters with:', locations);
    
    // Get the dropdown menu for locations
    const locationDropdown = document.querySelector('ul[aria-labelledby="locationFilterDropdown"]');
    
    if (locationDropdown) {
        // Keep the first option (All Locations)
        const allLocationsItem = locationDropdown.querySelector('.location-filter[data-location=""]');
        
        // Clear existing location options except the "All Locations" option
        locationDropdown.querySelectorAll('.location-filter:not([data-location=""])').forEach(item => item.remove());
        
        // Create a set to store unique locations
        const uniqueLocations = new Set();
        
        // Add all locations from different sensor types
        if (locations.fireLocations) {
            locations.fireLocations.forEach(loc => uniqueLocations.add(loc));
        }
        
        if (locations.smokeLocations) {
            locations.smokeLocations.forEach(loc => uniqueLocations.add(loc));
        }
        
        if (locations.dht11Locations) {
            locations.dht11Locations.forEach(loc => uniqueLocations.add(loc));
        }
        
        // Add locations to dropdown
        uniqueLocations.forEach(loc => {
            if (loc && loc.trim() !== '') {
                const li = document.createElement('li');
                li.innerHTML = `<a class="dropdown-item location-filter" href="#" data-location="${loc}"><i class="fas fa-map-marker-alt me-2"></i>${loc}</a>`;
                locationDropdown.appendChild(li);
                
                // Add click event handler for the new location item
                const anchor = li.querySelector('a');
                anchor.addEventListener('click', function(e) {
                    e.preventDefault();
                    const location = this.getAttribute('data-location');
                    const locationText = location || 'All Locations';

                    // Update active class
                    document.querySelectorAll('.location-filter').forEach(el => el.classList.remove('active'));
                    this.classList.add('active');

                    // Update button text
                    document.getElementById('current-location-filter').textContent = locationText;

                    // Get current status filter
                    const status = document.getElementById('current-status-filter').textContent === 'All Statuses' ? '' : document.getElementById('current-status-filter').textContent;
                    const pageSize = parseInt(document.getElementById('current-page-size').textContent);

                    console.log('Filtering by location:', location);
                    requestSensorData(1, pageSize, location, status);
                });
            }
        });
        
        console.log(`Added ${uniqueLocations.size} locations to dropdown`);
    } else {
        console.warn('Location dropdown not found in the DOM');
    }
}

function updateSensorOverviewCards(sensorData) {
    // Update fire sensor overview
    if (sensorData.fireSensorData && document.getElementById('fire-sensor-count')) {
        const total = sensorData.fireSensorData.pagination ? sensorData.fireSensorData.pagination.total : 0;
        document.getElementById('fire-sensor-count').textContent = total;
        
        // Count detected fires
        if (sensorData.fireSensorData.data) {
            const detected = sensorData.fireSensorData.data.filter(s => s.fire_status === 'Detected').length;
            if (document.getElementById('fire-detected-count')) {
                document.getElementById('fire-detected-count').textContent = detected;
            }
            if (document.getElementById('fire-normal-count')) {
                document.getElementById('fire-normal-count').textContent = total - detected;
            }
        }
    }
    
    // Update smoke sensor overview
    if (sensorData.smokeSensorData && document.getElementById('smoke-sensor-count')) {
        const total = sensorData.smokeSensorData.pagination ? sensorData.smokeSensorData.pagination.total : 0;
        document.getElementById('smoke-sensor-count').textContent = total;
        
        // Count detected smoke
        if (sensorData.smokeSensorData.data) {
            const detected = sensorData.smokeSensorData.data.filter(s => s.smoke_status === 'Detected').length;
            if (document.getElementById('smoke-detected-count')) {
                document.getElementById('smoke-detected-count').textContent = detected;
            }
            if (document.getElementById('smoke-normal-count')) {
                document.getElementById('smoke-normal-count').textContent = total - detected;
            }
        }
    }
    
    // Update DHT11 sensor overview
    if (sensorData.dht11Data && document.getElementById('dht11-sensor-count')) {
        const total = sensorData.dht11Data.pagination ? sensorData.dht11Data.pagination.total : 0;
        document.getElementById('dht11-sensor-count').textContent = total;
        
        // Count high temperature alerts
        if (sensorData.dht11Data.data) {
            const highTemp = sensorData.dht11Data.data.filter(s => s.dht11_status === 'High Temp').length;
            const warning = sensorData.dht11Data.data.filter(s => s.dht11_status === 'Warning').length;
            
            if (document.getElementById('dht11-high-count')) {
                document.getElementById('dht11-high-count').textContent = highTemp;
            }
            if (document.getElementById('dht11-warning-count')) {
                document.getElementById('dht11-warning-count').textContent = warning;
            }
            if (document.getElementById('dht11-normal-count')) {
                document.getElementById('dht11-normal-count').textContent = total - highTemp - warning;
            }
        }
    }
}

// Alert logs handlers
function requestAlertLogs() {
    socket.emit('request_alert_logs', {});
}

socket.on('alert_logs', function(data) {
    if (data.success) {
        console.log('Alert logs received:', data.logs);
        // Update UI with alert logs
        updateAlertLogsUI(data.logs);
    } else {
        console.error('Error fetching alert logs:', data.error);
    }
});

function updateAlertLogsUI(alertLogs) {
    // Update alert logs container if it exists
    if (document.getElementById('alert-logs-container')) {
        const logsContainer = document.getElementById('alert-logs-container');
        logsContainer.innerHTML = '';

        if (alertLogs.length === 0) {
            logsContainer.innerHTML = '<div class="alert alert-info">No alert logs found</div>';
            return;
        }

        alertLogs.forEach(log => {
            const alertClass = log.level === 'high' ? 'alert-danger' :
                log.level === 'medium' ? 'alert-warning' : 'alert-info';

            const alertElement = document.createElement('div');
            alertElement.className = `alert ${alertClass}`;
            alertElement.innerHTML = `
                <strong>${log.type.toUpperCase()}</strong>: ${log.message}
                <small class="d-block mt-1">Time: ${log.timestamp}</small>
            `;
            logsContainer.appendChild(alertElement);
        });
    }
}

// Helper functions for user approval
function approveUser(userId) {
    fetch(`/api/users/${userId}/approve`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Refresh dashboard stats
                requestDashboardStats();
            } else {
                console.error('Error approving user:', data.error);
            }
        })
        .catch(error => {
            console.error('Error approving user:', error);
        });
}

function rejectUser(userId) {
    fetch(`/api/users/${userId}/reject`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Refresh dashboard stats
                requestDashboardStats();
            } else {
                console.error('Error rejecting user:', data.error);
            }
        })
        .catch(error => {
            console.error('Error rejecting user:', error);
        });
}

// Auto-update data at intervals
function setupAutoRefresh() {
    // Set different intervals for different types of data
    const dashboardRefreshInterval = 30000; // 30 seconds
    const sensorRefreshInterval = 5000;     // 5 seconds
    const alertLogsRefreshInterval = 10000; // 10 seconds

    // Check current page to determine which data to refresh
    const currentPath = window.location.pathname;

    if (currentPath.includes('/dashboard') || currentPath.includes('/dashboard-admin')) {
        // Dashboard page - refresh dashboard stats and admin data
        requestAdminData();
        requestDashboardStats();
        setInterval(requestDashboardStats, dashboardRefreshInterval);
    } else if (currentPath.includes('/history')) {
        // History page - fetch history data
        requestHistoryData();
    } else if (currentPath.includes('/data-sensor')) {
        // Sensor data page - refresh sensor data
        requestSensorData();
        setInterval(requestSensorData, sensorRefreshInterval);
    } else if (currentPath.includes('/alert-logs')) {
        // Alert logs page - refresh alert logs
        requestAlertLogs();
        setInterval(requestAlertLogs, alertLogsRefreshInterval);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Setup Socket.IO event handlers
    setupAutoRefresh();
});
