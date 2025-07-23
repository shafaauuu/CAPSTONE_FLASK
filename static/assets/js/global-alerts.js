/**
 * Global Fire Alert Notification System
 * Shows fire alerts on any page and provides navigation to alert logs
 */

// Check if user is authenticated and has role 'user' (1) before initializing alerts
let shouldShowAlerts = false;

// Function to check if user is authenticated and has the correct role
function checkUserAuthAndRole() {
    // Try to get user info from the page
    const userRoleElement = document.getElementById('user-role-data');
    if (userRoleElement) {
        const userRole = userRoleElement.getAttribute('data-role');
        const isAuthenticated = userRoleElement.getAttribute('data-authenticated') === 'true';
        
        // Only show alerts if user is authenticated and has role 'user' (1)
        shouldShowAlerts = isAuthenticated && userRole === 'user';
        console.log('ALERT DEBUG: User authentication status:', isAuthenticated, 'User role:', userRole, 'Show alerts:', shouldShowAlerts);
        console.log('ALERT DEBUG: Current page:', window.location.pathname);
    } else {
        // If element not found, default to not showing alerts
        shouldShowAlerts = false;
        console.log('ALERT DEBUG: User role element not found, alerts disabled');
        console.log('ALERT DEBUG: Document body:', document.body.innerHTML.substring(0, 500));
    }
    return shouldShowAlerts;
}

// Initialize socket connection for global alerts
let globalSocket;

// Check if there's already a socket connection from socket-client.js
if (typeof socket !== 'undefined' && socket) {
    console.log('ALERT DEBUG: Using existing socket connection for global alerts on page:', window.location.pathname, 'Socket ID:', socket.id);
    globalSocket = socket;
} else {
    // Create a new socket connection if one doesn't exist
    console.log('ALERT DEBUG: Creating new socket connection for global alerts on page:', window.location.pathname);
    try {
        globalSocket = io();
        console.log('ALERT DEBUG: New socket connection created successfully with ID:', globalSocket.id);
    } catch (error) {
        console.error('ALERT DEBUG: Error creating socket connection:', error);
    }
}

// Add connection event handlers for debugging
globalSocket.on('connect', function() {
    console.log('ALERT DEBUG: Global socket connected with ID:', globalSocket.id);
    
    // Check for active fire alerts immediately after connecting
    if (shouldShowAlerts) {
        console.log('ALERT DEBUG: Checking for active fire alerts after connection');
        setTimeout(checkGlobalFireAlerts, 1000); // Small delay to ensure connection is fully established
    }
});

globalSocket.on('connect_error', function(error) {
    console.error('ALERT DEBUG: Global socket connection error:', error);
});

const globalNotyf = new Notyf({
    duration: 3000,
    position: {
        x: 'right',
        y: 'top'
    },
    types: [
        {
            type: 'critical',
            background: '#dc3545',
            icon: {
                className: 'fas fa-fire',
                tagName: 'span'
            }
        }
    ],
    ripple: false,
    dismissible: true,
    stacking: true
});

// Initialize a separate Notyf instance for success notifications
const successNotyf = new Notyf({
    duration: 3000,
    position: {
        x: 'center',  // Position success notifications in the center
        y: 'top'
    },
    types: [
        {
            type: 'success',
            background: '#28a745',
            icon: {
                className: 'fas fa-check-circle',
                tagName: 'span'
            }
        }
    ],
    ripple: false,
    dismissible: true,
    stacking: true
});

// Add CSS for styling notifications
const notyfStyle = document.createElement('style');
notyfStyle.textContent = `
    @keyframes pulse-fire-alert {
        0% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(1.03); }
        100% { opacity: 1; transform: scale(1); }
    }
    .fire-alert-pulse {
        animation: pulse-fire-alert 2s infinite;
        border-left: 4px solid #ff3d00;
    }
    .notyf__toast--critical {
        box-shadow: 0 4px 12px rgba(220, 53, 69, 0.6);
        margin-bottom: 10px !important;
    }
    .notyf__toast--success {
        box-shadow: 0 4px 12px rgba(40, 167, 69, 0.6);
        margin-bottom: 10px !important;
    }
    .notyf__toast {
        transition: all 0.3s ease-in-out;
    }
    .notyf {
        padding-top: 10px;
        padding-bottom: 10px;
    }
    .notyf__wrapper {
        padding-top: 5px;
        padding-bottom: 5px;
    }
    
    /* Override any conflicting styles */
    #successNotyfContainer .notyf__ripple {
        background-color: #28a745;
    }
    #fireNotyfContainer .notyf__ripple {
        background-color: #dc3545;
    }
    
    /* Create separate containers for different notification types */
    #fireNotyfContainer {
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 9999;
    }
    #successNotyfContainer {
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9998;
    }
`;
document.head.appendChild(notyfStyle);

const MAX_VISIBLE_ALERTS = 3;
let activeAlerts = [];

// Function to check for active fire alerts
function checkGlobalFireAlerts() {
    // Only check for alerts if user is authenticated and has the correct role
    if (shouldShowAlerts) {
        // Special handling for index page which might have multiple socket connections
        const isIndexPage = window.location.pathname === '/index' || window.location.pathname === '/';
        
        console.log('ALERT DEBUG: Checking for active fire alerts on page:', window.location.pathname, 
                    'Is index page:', isIndexPage);
        
        // Ensure we're using the right socket for the current page
        if (isIndexPage && typeof socket !== 'undefined' && socket) {
            console.log('ALERT DEBUG: Using main socket for index page alert check');
            socket.emit('check_active_fire_alerts');
        } else {
            console.log('ALERT DEBUG: Using global socket for alert check');
            globalSocket.emit('check_active_fire_alerts');
        }
    } else {
        console.log('ALERT DEBUG: Not checking for alerts, shouldShowAlerts is false');
    }
}

// Function to create alert message with or without button based on current page
function createAlertMessage(location, cameraId) {
    const isOnAlertLogsPage = window.location.pathname.includes('/alert-log');

    let alertMessage = `
        <div class="d-flex align-items-center justify-content-between">
            <div>
                FIRE ALERT! Fire detected in ${location}. Immediate action required.
            </div>`;

    if (!isOnAlertLogsPage) {
        alertMessage += `
            <button class="btn btn-sm btn-danger ms-3 text-white" onclick="window.location.href='/alert-logs'">
                <i class="fas fa-arrow-right me-1"></i> View & Resolve
            </button>`;
    }

    alertMessage += `</div>`;

    return alertMessage;
}

// Function to show a new alert and manage the flow
function showAlert(message) {
    // Only show alerts if user is authenticated and has the correct role
    if (!shouldShowAlerts) {
        console.log('Alert suppressed - user not authenticated or not a regular user');
        return;
    }
    
    // Create the new alert
    const alertId = globalNotyf.open({
        type: 'critical',
        message: message
    });

    // Add to our tracking array
    activeAlerts.push(alertId);

    // Add pulsing effect
    setTimeout(() => {
        const notyfElement = document.querySelector(`.notyf__toast[data-notyf-id="${alertId}"]`);
        if (notyfElement) {
            notyfElement.classList.add('fire-alert-pulse');

            // Ensure proper spacing between alerts
            const index = activeAlerts.indexOf(alertId);
            if (index > 0) {
                notyfElement.style.marginTop = '10px';
            }
        }
    }, 100);
    
    // If we have more than MAX_VISIBLE_ALERTS, remove the oldest one
    if (activeAlerts.length > MAX_VISIBLE_ALERTS) {
        const oldestAlertId = activeAlerts.shift();
        globalNotyf.dismiss(oldestAlertId);
    }
}

// Function to show success notifications (separate from fire alerts)
function showSuccessNotification(message) {
    // Only show notifications if user is authenticated and has the correct role
    if (!shouldShowAlerts) {
        console.log('Success notification suppressed - user not authenticated or not a regular user');
        return;
    }
    
    successNotyf.open({
        type: 'success',
        message: message
    });
}

// Override the global window.markAlertAsResolved function to use our success notification
const originalMarkAlertAsResolved = window.markAlertAsResolved;
if (originalMarkAlertAsResolved) {
    window.markAlertAsResolved = function(alertId) {
        // Call the original function
        originalMarkAlertAsResolved(alertId);
        
        // We don't need to do anything else here as the success notification
        // will be handled by the alert-logs.js file, but in a different position
    };
}

// Handle active fire alert notifications globally
globalSocket.on('active_fire_alert', function(data) {
    console.log('ALERT DEBUG: Received active_fire_alert event on globalSocket:', data, 'on page:', window.location.pathname);
    handleFireAlertEvent(data);
});

// If we're on the index page, also listen for events on the main socket
if (window.location.pathname === '/index' || window.location.pathname === '/') {
    if (typeof socket !== 'undefined' && socket) {
        console.log('ALERT DEBUG: Adding fire alert event handlers to main socket on index page');
        
        // Add event handlers to the main socket as well
        socket.on('active_fire_alert', function(data) {
            console.log('ALERT DEBUG: Received active_fire_alert event on main socket:', data);
            handleFireAlertEvent(data);
        });
        
        socket.on('fire_detection_alert', function(data) {
            console.log('ALERT DEBUG: Received fire_detection_alert event on main socket:', data);
            handleFireDetectionEvent(data);
        });
    }
}

// Common handler function for fire alert events
function handleFireAlertEvent(data) {
    // Only process alerts if user is authenticated and has the correct role
    if (!shouldShowAlerts) {
        console.log('ALERT DEBUG: Active fire alert suppressed - user not authenticated or not a regular user');
        return;
    }
    
    // Check if there's an active alert to display
    if (data.active && data.count > 0) {
        // Get the most recent active alert from the data
        const activeAlert = data.alert || {};
        
        // Extract location information - check all possible fields
        let location = 'Unknown';
        if (activeAlert.fire_loc) location = activeAlert.fire_loc;
        else if (activeAlert.smoke_loc) location = activeAlert.smoke_loc;
        else if (activeAlert.dht11_loc) location = activeAlert.dht11_loc;
        else if (activeAlert.location) location = activeAlert.location;
        else if (activeAlert.area) location = activeAlert.area;
        else if (activeAlert.zone) location = activeAlert.zone;
        else if (data.location) location = data.location;
        else if (data.fire_loc) location = data.fire_loc;
        else if (data.area) location = data.area;
        else if (data.zone) location = data.zone;
        
        // Extract camera information - check all possible fields
        let cameraId = 'Unknown';
        if (activeAlert.camera_id) cameraId = activeAlert.camera_id;
        else if (data.camera_id) cameraId = data.camera_id;
        else if (data.camera && typeof data.camera === 'object') {
            if (data.camera.id) cameraId = data.camera.id;
            else if (data.camera.camera_id) cameraId = data.camera.camera_id;
        } else if (data.camera && typeof data.camera === 'string') {
            cameraId = data.camera;
        }
        
        // Create alert message with or without button based on current page
        const alertMessage = createAlertMessage(location, cameraId);
        
        // Show the alert with our new flow management
        showAlert(alertMessage);
    }
}

// Handle fire detection alerts (new detections) globally
globalSocket.on('fire_detection_alert', function(data) {
    console.log('ALERT DEBUG: Received fire_detection_alert event on globalSocket:', data, 'on page:', window.location.pathname);
    handleFireDetectionEvent(data);
});

// Common handler function for fire detection events
function handleFireDetectionEvent(data) {
    // Only process alerts if user is authenticated and has the correct role
    if (!shouldShowAlerts) {
        console.log('ALERT DEBUG: Fire detection alert suppressed - user not authenticated or not a regular user');
        return;
    }
    
    // Extract location information
    let location = 'Unknown';
    if (data.fire_loc) location = data.fire_loc;
    else if (data.smoke_loc) location = data.smoke_loc;
    else if (data.dht11_loc) location = data.dht11_loc;
    else if (data.location) location = data.location;
    else if (data.area) location = data.area;
    else if (data.zone) location = data.zone;
    
    // Extract camera information
    let cameraId = 'Unknown';
    if (data.camera_id) cameraId = data.camera_id;
    else if (data.camera && typeof data.camera === 'object') {
        if (data.camera.id) cameraId = data.camera.id;
        else if (data.camera.camera_id) cameraId = data.camera.camera_id;
    } else if (data.camera && typeof data.camera === 'string') {
        cameraId = data.camera;
    }
    
    // Create alert message with or without button based on current page
    const alertMessage = createAlertMessage(location, cameraId);
    
    // Show the alert with our new flow management
    showAlert(alertMessage);
}

// Check for active fire alerts when the page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('ALERT DEBUG: DOMContentLoaded event fired on page:', window.location.pathname);
    
    // Check if user is authenticated and has the correct role
    const shouldShow = checkUserAuthAndRole();
    console.log('ALERT DEBUG: Initial shouldShowAlerts value:', shouldShow);
    
    // Only proceed with alert checks if user is authenticated and has the correct role
    if (shouldShow) {
        console.log('ALERT DEBUG: Setting up alert checking interval');
        
        // Initial check with a slight delay to ensure everything is loaded
        setTimeout(function() {
            console.log('ALERT DEBUG: Running initial alert check');
            checkGlobalFireAlerts();
            
            // Check for new fire alerts every 3 seconds
            // Use a named interval so we can clear it if needed
            window.globalAlertInterval = setInterval(function() {
                console.log('ALERT DEBUG: Running scheduled alert check on page:', window.location.pathname);
                checkGlobalFireAlerts();
            }, 3000);
        }, 2000); // Longer delay to ensure socket is fully established
    } else {
        console.log('ALERT DEBUG: Global alerts disabled - user not authenticated or not a regular user');
    }
});
