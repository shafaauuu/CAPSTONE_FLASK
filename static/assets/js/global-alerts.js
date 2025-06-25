/**
 * Global Fire Alert Notification System
 * Shows fire alerts on any page and provides navigation to alert logs
 */

// Initialize socket connection if not already initialized
let globalSocket;
if (typeof socket === 'undefined') {
    console.log('Initializing global socket connection for alerts');
    globalSocket = io();
} else {
    console.log('Using existing socket connection for global alerts');
    globalSocket = socket;
}

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

// Maximum number of alerts to show at once
const MAX_VISIBLE_ALERTS = 3;
let activeAlerts = [];

// Function to check for active fire alerts
function checkGlobalFireAlerts() {
    globalSocket.emit('check_active_fire_alerts');
}

// Function to create alert message with or without button based on current page
function createAlertMessage(location, cameraId) {
    const isOnAlertLogsPage = window.location.pathname.includes('/alert-logs');

    let alertMessage = `
        <div class="d-flex align-items-center justify-content-between">
            <div>
                FIRE ALERT! Fire detected in ${location} (Camera ${cameraId}). Immediate action required.
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
    console.log('Global active fire alert status:', data);
    
    if (data.active) {
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
});

// Handle fire detection alerts (new detections) globally
globalSocket.on('fire_detection_alert', function(data) {
    console.log('Global fire detection alert:', data);
    
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
});

// Check for active fire alerts when the page loads
document.addEventListener('DOMContentLoaded', function() {
    checkGlobalFireAlerts();
    
    // Check for new fire alerts every 1 second
    setInterval(checkGlobalFireAlerts, 1000);
});
