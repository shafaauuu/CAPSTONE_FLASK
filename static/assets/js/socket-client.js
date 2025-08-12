const API_BASE_URL = API_CONFIG.BASE_URL;
console.log('Using API base URL:', API_BASE_URL);

// Initialize Socket.IO connection
let socket = io();

// Connection status handlers
socket.on('connect', function() {
    console.log('Socket.IO connected with ID:', socket.id);
    
    // Initialize data requests based on current page
    const currentPath = window.location.pathname;
    console.log('Current path:', currentPath);
    
    if (currentPath === '/' || currentPath.includes('/dashboard')) {
        console.log('On dashboard page, initializing dashboard data requests');

        // Request camera detections immediately
        console.log('Requesting initial camera detections immediately');
        requestCameraDetections(10);
        
        // Also set up a delayed request as backup
        setTimeout(() => {
            console.log('Requesting camera detections again after delay');
            requestCameraDetections(10);
        }, 2000); // Delay to ensure socket is fully established
        
        requestDashboardStats();
        setInterval(requestDashboardStats, 30000);
        // Refresh camera detections periodically
        setInterval(() => requestCameraDetections(10), 30000); // Every 30 seconds
    } else if (currentPath.includes('/history')) {
        // History page - fetch history data
        requestHistoryData();
    } else if (currentPath.includes('/data-sensor')) {
        // Sensor data page - refresh sensor data
        requestSensorData();
        setInterval(requestSensorData, 5000);
    } else if (currentPath.includes('/alert-logs')) {
        // Alert logs page is now handled by alert-logs.js
        console.log('Alert logs page detected - functionality handled by alert-logs.js');
    } else if (currentPath.includes('/detections')) {
        // Detections page - fetch camera detections with larger limit
        console.log('On detections page, initializing detections data requests');
        requestCameraDetections(20);
        // Refresh detections periodically
        setInterval(() => requestCameraDetections(20), 30000); // Every 30 seconds
    }
});

socket.on('disconnect', function() {
    console.log('Socket.IO disconnected');
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
    
    // dropdown
    const locationDropdown = document.querySelector('ul[aria-labelledby="locationFilterDropdown"]');
    
    if (locationDropdown) {
        // Keep the first option (All Locations)
        const allLocationsItem = locationDropdown.querySelector('.location-filter[data-location=""]');
        
        // Clear existing location options except the "All Locations" option
        locationDropdown.querySelectorAll('.location-filter:not([data-location=""])').forEach(item => item.remove());
        
        // Create a set to store unique locations
        const uniqueLocations = new Set();
        
        // Handle both array and object formats
        if (Array.isArray(locations)) {
            // If locations is a direct array (from API)
            locations.forEach(loc => uniqueLocations.add(loc));
            console.log(`Added ${locations.length} locations from array`);
        } else {
            // Add all locations from different sensor types
            if (locations.allLocations) {
                // If we have a pre-combined list
                locations.allLocations.forEach(loc => uniqueLocations.add(loc));
                console.log(`Added ${locations.allLocations.length} locations from allLocations`);
            } else {
                // Otherwise combine from individual sensor types
                if (locations.fireLocations) {
                    locations.fireLocations.forEach(loc => uniqueLocations.add(loc));
                }
                
                if (locations.smokeLocations) {
                    locations.smokeLocations.forEach(loc => uniqueLocations.add(loc));
                }
                
                if (locations.dht11Locations) {
                    locations.dht11Locations.forEach(loc => uniqueLocations.add(loc));
                }
            }
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

// Camera detection handlers
function requestCameraDetections(limit = 5, status = null, location = null) {
    console.log(`Requesting camera detections with limit=${limit}, status=${status}, location=${location}`);
    socket.emit('request_camera_detections', {
        limit: limit,
        status: status,
        location: location
    });
    
    // Set a timeout to fall back to direct API call if socket doesn't respond
    setTimeout(() => {
        if (document.querySelector('.alert-history .spinner-border') || 
            (document.getElementById('detectionsTableBody') && 
             document.getElementById('detectionsTableBody').querySelector('.spinner-border'))) {
            console.log('Socket did not respond in time, falling back to direct API call');
            fetchCameraDetectionsDirectly(limit, status, location);
        }
    }, 5000);
}

// Fallback function to fetch camera detections directly from API
function fetchCameraDetectionsDirectly(limit = 5, status = null, location = null) {
    console.log('Fetching camera detections directly from API');
    
    // Determine which endpoint to call based on parameters
    let apiUrl = '';
    if (status) {
        // For active detections
        apiUrl = `${API_BASE_URL}/api/camera-detection/active?limit=${limit}`;
    } else {
        // For recent detections
        apiUrl = `${API_BASE_URL}/api/camera-detection/recent?limit=${limit}`;
    }
    
    // Add location filter if provided
    if (location) {
        apiUrl += `&location=${encodeURIComponent(location)}`;
    }
    
    console.log(`Making direct API request to: ${apiUrl}`);
    
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`API returned status: ${response.status}`);
            }
            return response.json();
        })
        .then(detections => {
            console.log(`Received ${detections.length} detections from direct API call`);
            
            // Format timestamps for display
            detections.forEach(detection => {
                if ('detection_timestamp' in detection && detection['detection_timestamp']) {
                    try {
                        // Handle different timestamp formats
                        const timestamp_str = detection['detection_timestamp'];
                        let timestamp;
                        
                        if ('Z' in timestamp_str) {
                            timestamp = new Date(timestamp_str);
                        } else if ('T' in timestamp_str) {
                            timestamp = new Date(timestamp_str);
                        } else {
                            // Try to parse as a standard format
                            timestamp = new Date(timestamp_str);
                        }
                        
                        detection['formatted_time'] = timestamp.toLocaleString();
                    } catch (e) {
                        detection['formatted_time'] = detection['detection_timestamp'];
                        console.error(`Error formatting timestamp: ${e}`);
                    }
                }
            });
            
            // Update UI with detections
            updateCameraDetectionsUI(detections);
        })
        .catch(error => {
            console.error('Error fetching camera detections directly:', error);
            
            // Show error message in UI
            const alertHistory = document.querySelector('.alert-history');
            if (alertHistory) {
                alertHistory.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Error loading detection data: ${error.message}
                    </div>
                `;
            }
            
            const detectionsTableBody = document.getElementById('detectionsTableBody');
            if (detectionsTableBody) {
                detectionsTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center">
                            <div class="alert alert-danger">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                Error loading detection data: ${error.message}
                            </div>
                        </td>
                    </tr>
                `;
            }
        });
}

// Variable to track which view is being updated
let currentDetectionView = 'dashboard';

socket.on('camera_detections', function(data) {
    if (data.success) {
        console.log(`Received ${data.detections.length} camera detections from socket`);
        
        // Check which view to update based on current page
        if (currentDetectionView === 'modal') {
            // Update the modal table
            updateDetectionsModalTable(data.detections);
        } else if (currentDetectionView === 'detections') {
            // Update the detections page table
            updateDetectionsTable(data.detections);
        } else {
            // Update the dashboard view
            updateCameraDetectionsUI(data.detections);
        }
    } else {
        console.error('Error fetching camera detections:', data.error);
        
        // Show error message in UI based on current view
        if (currentDetectionView === 'modal') {
            const tableBody = document.getElementById('allDetectionsTableBody');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center">
                            <div class="alert alert-danger">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                Error loading detection data: ${data.error}
                            </div>
                        </td>
                    </tr>
                `;
            }
        } else if (currentDetectionView === 'detections') {
            const tableBody = document.getElementById('detectionsTableBody');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center">
                            <div class="alert alert-danger">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                Error loading detection data: ${data.error}
                            </div>
                        </td>
                    </tr>
                `;
            }
        } else {
            const alertHistory = document.querySelector('.alert-history');
            if (alertHistory) {
                alertHistory.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Error loading detection data: ${data.error}
                    </div>
                `;
            }
        }
    }
});

function updateCameraDetectionsUI(detections) {
    // Update recent alerts section in dashboard
    const alertHistoryContainer = document.querySelector('.alert-history');
    if (alertHistoryContainer) {
        alertHistoryContainer.innerHTML = '';
        
        if (!detections || detections.length === 0) {
            alertHistoryContainer.innerHTML = '<div class="text-center py-3">No recent detections</div>';
            return;
        }
        
        console.log('Updating UI with detections:', detections);
        
        detections.forEach(detection => {
            const confidenceScore = parseFloat(detection.confidence_score) || 0;
            const confidenceClass = confidenceScore > 0.7 ? 'danger' : (confidenceScore > 0.4 ? 'warning' : 'success');
            const confidenceText = confidenceScore > 0.7 ? 'High' : (confidenceScore > 0.4 ? 'Medium' : 'Low');
            
            // Handle image path - ensure it's properly formatted for the frontend
            let imagePath = detection.image_path || '';
            // If the path starts with /uploads, prepend the API base URL
            if (imagePath.startsWith('/uploads')) {
                imagePath = `${API_BASE_URL}${imagePath}`;
            }
            
            const alertItem = document.createElement('div');
            alertItem.className = 'd-flex mt-2 mb-3 pb-3 border-bottom';
            alertItem.innerHTML = `
                <div class="icon-shape icon-sm icon-shape-${confidenceClass} rounded me-3">
                    <span class="fas fa-fire"></span>
                </div>
                <div class="d-block">
                    <div class="d-flex align-items-center mb-1">
                        <h5 class="mb-0 me-2">Fire Detected</h5>
                        <span class="badge bg-${confidenceClass} text-white">${confidenceText}</span>
                    </div>
                    <div class="small text-gray">
                        <span class="fas fa-clock me-1"></span>
                        ${detection.formatted_time || 'Unknown time'}
                    </div>
                    <div class="small text-gray">
                        <span class="fas fa-map-marker-alt me-1"></span>
                        ${detection.camera_location || 'Unknown location'}
                    </div>
                    ${imagePath ? `<div class="mt-2">
                        <a href="#" class="view-detection" data-id="${detection.detection_id}">
                            <img src="${imagePath}" class="img-fluid rounded" style="max-height: 80px;" alt="Detection Image">
                        </a>
                    </div>` : ''}
                </div>
            `;
            
            alertHistoryContainer.appendChild(alertItem);
        });
        
        // Add event listeners for detection image clicks
        document.querySelectorAll('.view-detection').forEach(link => {
            link.addEventListener('click', function() {
                const detectionId = this.getAttribute('data-id');
                viewDetectionDetails(detectionId);
            });
        });
    }
    
    // Update fire status indicator based on detections
    updateFireStatusIndicator(detections);
}

function updateDetectionsModalTable(detections) {
    const tableBody = document.getElementById('allDetectionsTableBody');
    if (tableBody) {
        tableBody.innerHTML = '';
        
        if (!detections || detections.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No detections found</td></tr>';
            return;
        }
        
        detections.forEach(detection => {
            const confidenceScore = parseFloat(detection.confidence_score) || 0;
            const confidenceClass = confidenceScore > 0.7 ? 'danger' : (confidenceScore > 0.4 ? 'warning' : 'success');
            const confidenceText = confidenceScore > 0.7 ? 'High' : (confidenceScore > 0.4 ? 'Medium' : 'Low');
            
            // Handle image path - ensure it's properly formatted for the frontend
            let imagePath = detection.image_path || '';
            // If the path starts with /uploads, prepend the API base URL
            if (imagePath.startsWith('/uploads')) {
                imagePath = `${API_BASE_URL}${imagePath}`;
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${detection.detection_id}</td>
                <td>
                    ${imagePath ? `
                        <a href="#" class="view-detection-modal" data-id="${detection.detection_id}">
                            <img src="${imagePath}" class="img-fluid rounded" style="max-height: 50px;" alt="Detection Image">
                        </a>
                    ` : 'No image'}
                </td>
                <td>${detection.camera_location || 'Unknown'}</td>
                <td>
                    <span class="badge bg-${confidenceClass} text-white">
                        ${(confidenceScore * 100).toFixed(0)}% (${confidenceText})
                    </span>
                </td>
                <td>${detection.formatted_time || 'Unknown'}</td>
                <td>
                    <span class="badge ${detection.detection_status === 'Active' ? 'bg-warning' : 'bg-success'}">
                        ${detection.detection_status || 'Unknown'}
                    </span>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Add event listeners for detection image clicks in modal
        document.querySelectorAll('.view-detection-modal').forEach(link => {
            link.addEventListener('click', function() {
                const detectionId = this.getAttribute('data-id');
                viewDetectionDetails(detectionId);
            });
        });
    }
}

function viewDetectionDetails(detectionId) {
    // Instead of redirecting, show the details in a modal
    console.log(`Viewing detection details for ID: ${detectionId}`);
    
    // Show the modal
    const detailsModal = new bootstrap.Modal(document.getElementById('detectionDetailsModal'));
    detailsModal.show();
    
    // Reset modal content and show loading state
    document.getElementById('detectionImageContainer').innerHTML = `
        <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2">Loading detection image...</p>
    `;
    document.getElementById('detailDetectionId').textContent = detectionId;
    document.getElementById('detailLocation').textContent = '-';
    document.getElementById('detailTime').textContent = '-';
    document.getElementById('detailConfidence').textContent = '-';
    document.getElementById('detailStatus').textContent = '-';
    document.getElementById('detailRiskLevel').textContent = '-';
    
    // Fetch detection details from API
    fetchDetectionDetails(detectionId);
}

// Function to fetch detection details from API
function fetchDetectionDetails(detectionId) {
    fetch(`${API_BASE_URL}/api/camera-detection/${detectionId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`API returned status: ${response.status}`);
            }
            return response.json();
        })
        .then(detection => {
            console.log('Detection details received:', detection);
            updateDetectionDetailsModal(detection);
        })
        .catch(error => {
            console.error('Error fetching detection details:', error);
            document.getElementById('detectionImageContainer').innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Error loading detection details: ${error.message}
                </div>
            `;
        });
}

// Function to update the detection details modal with data
function updateDetectionDetailsModal(detection) {
    // Handle image path - ensure it's properly formatted for the frontend
    let imagePath = detection.image_path || '';
    // If the path starts with /uploads, prepend the API base URL
    if (imagePath.startsWith('/uploads')) {
        imagePath = `${API_BASE_URL}${imagePath}`;
    }
    
    // Update image container
    if (imagePath) {
        document.getElementById('detectionImageContainer').innerHTML = `
            <img src="${imagePath}" class="img-fluid rounded" alt="Detection Image">
            <p class="mt-2 text-muted">Captured at ${detection.formatted_time || detection.detection_timestamp || 'Unknown time'}</p>
        `;
    } else {
        document.getElementById('detectionImageContainer').innerHTML = `
            <div class="alert alert-warning">
                <i class="fas fa-image me-2"></i>
                No image available for this detection
            </div>
        `;
    }
    
    // Update detection details
    document.getElementById('detailDetectionId').textContent = detection.detection_id || '-';
    document.getElementById('detailLocation').textContent = detection.camera_location || '-';
    document.getElementById('detailTime').textContent = detection.formatted_time || detection.detection_timestamp || '-';
    
    // Calculate confidence level
    const confidenceScore = parseFloat(detection.confidence_score) || 0;
    const confidenceClass = confidenceScore > 0.7 ? 'danger' : (confidenceScore > 0.4 ? 'warning' : 'success');
    const confidenceText = confidenceScore > 0.7 ? 'High' : (confidenceScore > 0.4 ? 'Medium' : 'Low');
    
    document.getElementById('detailConfidence').innerHTML = `
        <span class="badge bg-${confidenceClass} text-white">
            ${(confidenceScore * 100).toFixed(0)}% (${confidenceText})
        </span>
    `;
    
    document.getElementById('detailStatus').innerHTML = `
        <span class="badge ${detection.detection_status === 'Active' ? 'bg-warning' : 'bg-success'}">
            ${detection.detection_status || 'Unknown'}
        </span>
    `;
    
    document.getElementById('detailRiskLevel').innerHTML = `
        <span class="badge bg-${confidenceClass} text-white">
            ${confidenceText} Risk
        </span>
    `;
    
    // Set up the "Mark as Resolved" button
    const resolveButton = document.getElementById('markAsResolvedBtn');
    if (detection.detection_status === 'Active') {
        resolveButton.style.display = 'block';
        resolveButton.onclick = () => markDetectionAsResolved(detection.detection_id);
    } else {
        resolveButton.style.display = 'none';
    }
}

// detection as resolved
function markDetectionAsResolved(detectionId) {
    fetch(`${API_BASE_URL}/api/camera-detection/${detectionId}/resolve`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`API returned status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Detection marked as resolved:', data);
        // Show success message
        document.getElementById('detailStatus').innerHTML = `
            <span class="badge bg-success">Resolved</span>
        `;
        // Hide the resolve button
        document.getElementById('markAsResolvedBtn').style.display = 'none';
        // Refresh the detections list
        requestCameraDetections(10);
    })
    .catch(error => {
        console.error('Error marking detection as resolved:', error);
        alert(`Error: ${error.message}`);
    });
}

function updateFireStatusIndicator(detections) {
    const fireStatus = document.querySelector('.fire-status');
    if (!fireStatus || detections.length === 0) return;
    
    // Check if there are any active detections
    const activeDetections = detections.filter(d => d.detection_status === 'Active');
    
    if (activeDetections.length > 0) {
        // Sort by confidence score to get the highest risk detection
        activeDetections.sort((a, b) => parseFloat(b.confidence_score) - parseFloat(a.confidence_score));
        const highestRisk = activeDetections[0];
        const confidenceScore = parseFloat(highestRisk.confidence_score) || 0;
        
        if (confidenceScore > 0.7) {
            // High risk fire detected
            fireStatus.className = 'fire-status status-danger';
            fireStatus.innerHTML = `<h5 class="mb-0 blink">
                <span class="fas fa-fire me-2"></span>
                Fire Status: FIRE DETECTED!
            </h5>`;
        } else if (confidenceScore > 0.4) {
            // Medium risk - warning
            fireStatus.className = 'fire-status status-warning';
            fireStatus.innerHTML = `<h5 class="mb-0">
                <span class="fas fa-exclamation-triangle me-2"></span>
                Fire Status: Warning: Checking
            </h5>`;
        } else {
            // Low risk but still active
            fireStatus.className = 'fire-status status-warning';
            fireStatus.innerHTML = `<h5 class="mb-0">
                <span class="fas fa-exclamation-triangle me-2"></span>
                Fire Status: Possible Detection
            </h5>`;
        }
    } else {
        // No active detections - normal status
        fireStatus.className = 'fire-status status-safe';
        fireStatus.innerHTML = `<h5 class="mb-0">
            <span class="fas fa-fire-extinguisher me-2"></span>
            Fire Status: Normal
        </h5>`;
    }
}

function updateDetectionsTable(detections) {
    console.log('Updating detections table with', detections.length, 'detections');
    
    // Set the current view to detections page
    currentDetectionView = 'detections';
    
    const tableBody = document.getElementById('detectionsTableBody');
    if (!tableBody) {
        console.error('Detections table body not found');
        return;
    }
    
    // Clear loading state
    tableBody.innerHTML = '';
    
    if (detections.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        No detections found
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Update the table with detection data
    detections.forEach((detection, index) => {
        // Determine status badge class
        let statusBadgeClass = 'badge-soft-warning';
        if (detection.status === 'resolved') {
            statusBadgeClass = 'badge-soft-success';
        } else if (detection.status === 'active') {
            statusBadgeClass = 'badge-soft-danger';
        }
        
        // Determine risk level badge class
        let riskBadgeClass = 'badge-soft-warning';
        let riskText = 'Medium';
        
        if (detection.confidence && detection.confidence > 0.8) {
            riskBadgeClass = 'badge-soft-danger';
            riskText = 'High';
        } else if (detection.confidence && detection.confidence < 0.5) {
            riskBadgeClass = 'badge-soft-success';
            riskText = 'Low';
        }
        
        // Format the timestamp
        let formattedTime = detection.formatted_time || 'Unknown';
        
        // Create image HTML with fallback
        let imageHtml = '';
        if (detection.image_url) {
            imageHtml = `
                <img src="${detection.image_url}" alt="Detection Image" 
                     class="img-thumbnail detection-thumbnail" 
                     onerror="this.onerror=null; this.src='';">
            `;
        } else {
            imageHtml = `
                <img src="" alt="No Image Available" 
                     class="img-thumbnail detection-thumbnail">
            `;
        }
        
        // Create action buttons based on status
        let actionButtons = `
            <button type="button" class="btn btn-sm btn-primary view-detection" 
                    data-detection-id="${detection.id || index}">
                <i class="fas fa-eye"></i> View
            </button>
        `;
        
        if (detection.status !== 'resolved') {
            actionButtons += `
                <button type="button" class="btn btn-sm btn-success ms-1 resolve-detection" 
                        data-detection-id="${detection.id || index}">
                    <i class="fas fa-check"></i> Resolve
                </button>
            `;
        }
        
        // Create table row
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${imageHtml}</td>
            <td>
                <span class="fw-medium">${detection.location || 'Unknown'}</span>
                <br>
                <small class="text-muted">${formattedTime}</small>
            </td>
            <td>
                <span class="badge ${statusBadgeClass}">
                    ${detection.status || 'Unknown'}
                </span>
            </td>
            <td>
                <span class="badge ${riskBadgeClass}">
                    ${riskText}
                </span>
                <br>
                <small>${(detection.confidence * 100).toFixed(1)}%</small>
            </td>
            <td>${detection.analysis || 'No analysis available'}</td>
            <td>${actionButtons}</td>
        `;
        
        // Add data attributes for filtering
        row.dataset.detectionId = detection.id || index;
        row.dataset.status = detection.status || 'unknown';
        row.dataset.location = detection.location || 'unknown';
        
        tableBody.appendChild(row);
    });
    
    // Add event listeners to the buttons
    addDetectionButtonEventListeners();
}

function addDetectionButtonEventListeners() {
    // View detection buttons
    document.querySelectorAll('.view-detection').forEach(button => {
        button.addEventListener('click', function() {
            const detectionId = this.getAttribute('data-detection-id');
            viewDetectionDetails(detectionId);
        });
    });
    
    // Resolve detection buttons
    document.querySelectorAll('.resolve-detection').forEach(button => {
        button.addEventListener('click', function() {
            const detectionId = this.getAttribute('data-detection-id');
            resolveDetection(detectionId);
        });
    });
}

// Event listener for detection filters on the detections page
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the detections page
    if (window.location.pathname.includes('/detections')) {
        console.log('Setting up detections page event listeners');
        
        // Set the current view to detections page
        currentDetectionView = 'detections';
        
        // Status filter
        const statusFilter = document.getElementById('detectionStatusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', function() {
                const status = this.value;
                const limit = document.getElementById('detectionLimitFilter')?.value || 20;
                const location = document.getElementById('detectionLocationFilter')?.value || null;
                
                console.log(`Filtering detections by status: ${status}, limit: ${limit}, location: ${location}`);
                
                // Show loading state
                const tableBody = document.getElementById('detectionsTableBody');
                if (tableBody) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="7" class="text-center">
                                <div class="spinner-border text-primary" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                                <p class="mt-2">Loading detection data...</p>
                            </td>
                        </tr>
                    `;
                }
                
                // Request filtered detections
                requestCameraDetections(limit, status, location);
            });
        }
        
        // Location filter
        const locationFilter = document.getElementById('detectionLocationFilter');
        if (locationFilter) {
            locationFilter.addEventListener('change', function() {
                const location = this.value;
                const status = document.getElementById('detectionStatusFilter')?.value || null;
                const limit = document.getElementById('detectionLimitFilter')?.value || 20;
                
                console.log(`Filtering detections by location: ${location}, status: ${status}, limit: ${limit}`);
                
                // Show loading state
                const tableBody = document.getElementById('detectionsTableBody');
                if (tableBody) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="7" class="text-center">
                                <div class="spinner-border text-primary" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                                <p class="mt-2">Loading detection data...</p>
                            </td>
                        </tr>
                    `;
                }
                
                // Request filtered detections
                requestCameraDetections(limit, status, location);
            });
        }
        
        // Limit filter
        const limitFilter = document.getElementById('detectionLimitFilter');
        if (limitFilter) {
            limitFilter.addEventListener('change', function() {
                const limit = this.value;
                const status = document.getElementById('detectionStatusFilter')?.value || null;
                const location = document.getElementById('detectionLocationFilter')?.value || null;
                
                console.log(`Filtering detections by limit: ${limit}, status: ${status}, location: ${location}`);
                
                // Show loading state
                const tableBody = document.getElementById('detectionsTableBody');
                if (tableBody) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="7" class="text-center">
                                <div class="spinner-border text-primary" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                                <p class="mt-2">Loading detection data...</p>
                            </td>
                        </tr>
                    `;
                }
                
                // Request filtered detections
                requestCameraDetections(limit, status, location);
            });
        }
        
        // Refresh button
        const refreshButton = document.getElementById('refreshDetectionsBtn');
        if (refreshButton) {
            refreshButton.addEventListener('click', function() {
                const status = document.getElementById('detectionStatusFilter')?.value || null;
                const location = document.getElementById('detectionLocationFilter')?.value || null;
                const limit = document.getElementById('detectionLimitFilter')?.value || 20;
                
                console.log(`Refreshing detections with status: ${status}, location: ${location}, limit: ${limit}`);
                
                // Show loading state
                const tableBody = document.getElementById('detectionsTableBody');
                if (tableBody) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="7" class="text-center">
                                <div class="spinner-border text-primary" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                                <p class="mt-2">Loading detection data...</p>
                            </td>
                        </tr>
                    `;
                }
                
                // Request filtered detections
                requestCameraDetections(limit, status, location);
            });
        }
    }
});

// Auto-update data at intervals
function setupAutoRefresh() {
    const dashboardRefreshInterval = 30000; // 30 seconds
    const sensorRefreshInterval = 5000;     // 5 seconds
    const alertLogsRefreshInterval = 10000; // 10 seconds

    // Check current page to determine which data to refresh
    const currentPath = window.location.pathname;

    if (currentPath.includes('/dashboard') || currentPath.includes('/dashboard-admin')) {
        // Dashboard page - refresh dashboard stats and admin data
        requestAdminData();
        requestDashboardStats();
        requestCameraDetections(5);
        setInterval(requestDashboardStats, dashboardRefreshInterval);
    } else if (currentPath.includes('/history')) {
        // History page - fetch history data
        requestHistoryData();
    } else if (currentPath.includes('/data-sensor')) {
        // Sensor data page - refresh sensor data
        requestSensorData();
        setInterval(requestSensorData, sensorRefreshInterval);
    } else if (currentPath.includes('/alert-logs')) {
        // Alert logs page is now handled by alert-logs.js
        console.log('Alert logs page detected - functionality handled by alert-logs.js');
    } else if (currentPath.includes('/detections')) {
        // Detections page - fetch camera detections with larger limit
        console.log('On detections page, initializing detections data requests');
        requestCameraDetections(20);
        // Refresh detections periodically
        setInterval(() => requestCameraDetections(20), 30000); // Every 30 seconds
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM content loaded, initializing Socket.IO event handlers');
    
    // Setup Socket.IO event handlers
    setupAutoRefresh();
    
    // Request initial data if on relevant pages
    const currentPath = window.location.pathname;
    
    if (currentPath.includes('/dashboard')) {
        console.log('On dashboard page, requesting initial data');
        requestAdminData();
        requestDashboardStats();
        
        // Add a small delay to ensure socket connection is established
        setTimeout(() => {
            console.log('Requesting camera detections after delay');
            requestCameraDetections(5);
        }, 500);
    }
});

// Initialize modal event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Handle modal open event
    const allDetectionsModal = document.getElementById('allDetectionsModal');
    if (allDetectionsModal) {
        allDetectionsModal.addEventListener('show.bs.modal', function() {
            console.log('Detection modal opened, requesting data');
            currentDetectionView = 'modal';
            
            // Get current filter values
            const limit = document.getElementById('detectionLimitFilter').value || 10;
            const status = document.getElementById('detectionStatusFilter').value || null;
            
            // Request data for the modal
            requestCameraDetections(limit, status);
        });
        
        allDetectionsModal.addEventListener('hidden.bs.modal', function() {
            currentDetectionView = 'dashboard';
        });
    }
    
    // Handle filter changes in the modal
    const statusFilter = document.getElementById('detectionStatusFilter');
    const limitFilter = document.getElementById('detectionLimitFilter');
    
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            const limit = limitFilter.value || 10;
            const status = this.value || null;
            
            currentDetectionView = 'modal';
            requestCameraDetections(limit, status);
        });
    }
    
    if (limitFilter) {
        limitFilter.addEventListener('change', function() {
            const limit = this.value || 10;
            const status = statusFilter.value || null;
            
            currentDetectionView = 'modal';
            requestCameraDetections(limit, status);
        });
    }
});

// Helper functions for user approval
function approveUser(userId) {
    fetch(`${API_BASE_URL}/api/users/${userId}/approve`, {
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
    fetch(`${API_BASE_URL}/api/users/${userId}/reject`, {
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
