/**
 * Global Fire Alert Notification System
 * Shows fire alerts on any page and provides navigation to alert logs
 */

// Check if user is authenticated and has role 'user' (1) before initializing alerts
let shouldShowAlerts = false;

// Audio element for fire alarm sound
let alarmSound;
let isAlarmPlaying = false;

// Initialize alarm sound
function initializeAlarmSound() {
    alarmSound = new Audio('/static/assets/audio/fire-alarm.mp3');
    alarmSound.loop = true;
    
    // Add event listeners to handle audio playback state
    alarmSound.addEventListener('play', function() {
        isAlarmPlaying = true;
        console.log('ALERT DEBUG: Alarm sound started playing');
    });
    
    alarmSound.addEventListener('pause', function() {
        isAlarmPlaying = false;
        console.log('ALERT DEBUG: Alarm sound paused');
    });
    
    alarmSound.addEventListener('ended', function() {
        isAlarmPlaying = false;
        console.log('ALERT DEBUG: Alarm sound ended');
    });
    
    alarmSound.addEventListener('error', function(e) {
        console.error('ALERT DEBUG: Error loading alarm sound:', e);
    });
}

// Function to play alarm sound
function playAlarmSound() {
    if (alarmSound && !isAlarmPlaying) {
        console.log('ALERT DEBUG: Playing alarm sound');
        
        try {
            // Force autoplay by setting volume to 0 first, then playing, then restoring volume
            // This is a common workaround for autoplay restrictions
            const originalVolume = alarmSound.volume;
            alarmSound.volume = 0;
            
            const playPromise = alarmSound.play();
            
            if (playPromise !== undefined) {
                playPromise.then(_ => {
                    // Playback started successfully, restore volume gradually
                    isAlarmPlaying = true;
                    
                    // Gradually increase volume to avoid sudden loud sound
                    let vol = 0;
                    const volumeInterval = setInterval(() => {
                        vol += 0.1;
                        if (vol >= originalVolume) {
                            vol = originalVolume;
                            clearInterval(volumeInterval);
                        }
                        alarmSound.volume = vol;
                    }, 100);
                })
                .catch(error => {
                    // Auto-play was still prevented despite our workaround
                    console.error('ALERT DEBUG: Autoplay still prevented:', error);
                    
                    // Try again with user interaction simulation
                    document.addEventListener('click', function tryPlayOnUserInteraction() {
                        alarmSound.play().then(() => {
                            isAlarmPlaying = true;
                            alarmSound.volume = originalVolume;
                            document.removeEventListener('click', tryPlayOnUserInteraction);
                        });
                    }, { once: true });
                });
            }
        } catch (error) {
            console.error('ALERT DEBUG: Error playing alarm sound:', error);
        }
    }
}

// Function to stop alarm sound
function stopAlarmSound() {
    if (alarmSound && isAlarmPlaying) {
        console.log('ALERT DEBUG: Stopping alarm sound');
        alarmSound.pause();
        alarmSound.currentTime = 0;
        isAlarmPlaying = false;
        
        // Clear any active fire alert data to stop pulsing alerts
        window.activeFireAlertData = null;
        
        // Clear the pulse interval if it exists
        if (alertPulseInterval) {
            clearInterval(alertPulseInterval);
            alertPulseInterval = null;
        }
    }
}

// Expose stopAlarmSound globally so it can be called from other files
window.stopAlarmSound = stopAlarmSound;

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
    
    /* Sound control button styles */
    .sound-control {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: #343a40;
        color: white;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 9997;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        transition: all 0.3s ease;
    }
    .sound-control:hover {
        transform: scale(1.1);
    }
    .sound-control.muted {
        background-color: #6c757d;
    }
`;
document.head.appendChild(notyfStyle);

const MAX_VISIBLE_ALERTS = 3;
let activeAlerts = [];
let alertInterval;
let alertPulseInterval;
let lastAlertTime = 0;

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
function createAlertMessage(location, cameraId, alertId) {
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
    } else if (alertId) {
        // If we're on the alert logs page and have an alert ID, add a resolve button
        alertMessage += `
            <button class="btn btn-sm btn-success ms-3 text-white resolve-alert-btn" data-alert-id="${alertId}" onclick="resolveAlertAndStopSound(${alertId})">
                <i class="fas fa-check me-1"></i> Resolve
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
        message: message,
        duration: 0 // Don't auto-dismiss
    });

    // Add to our tracking array
    activeAlerts.push(alertId);

    // Play alarm sound when showing an alert
    playAlarmSound();

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

    // Return the notification object
    return alertId;
}

// Function to show success notifications (separate from fire alerts)
function showSuccessNotification(message) {
    // Only show notifications if user is authenticated and has the correct role
    if (!shouldShowAlerts) {
        console.log('Success notification suppressed - user not authenticated or not a regular user');
        return;
    }
    
    // Stop alarm sound when showing a success notification
    stopAlarmSound();
    
    successNotyf.open({
        type: 'success',
        message: message
    });
}

// Function to resolve alert and stop sound
function resolveAlertAndStopSound(alertId) {
    // Stop the alarm sound
    stopAlarmSound();
    
    // If there's an original markAlertAsResolved function, call it
    if (typeof originalMarkAlertAsResolved === 'function') {
        originalMarkAlertAsResolved(alertId);
    }
    
    // Show success notification
    showSuccessNotification('Alert has been resolved successfully.');
}

// Add the function to the global scope so it can be called from HTML
window.resolveAlertAndStopSound = resolveAlertAndStopSound;

// Override the global window.markAlertAsResolved function to use our success notification
const originalMarkAlertAsResolved = window.markAlertAsResolved;
if (originalMarkAlertAsResolved) {
    window.markAlertAsResolved = function(alertId) {
        // Call the original function
        originalMarkAlertAsResolved(alertId);
        
        // Stop the alarm sound when an alert is resolved
        stopAlarmSound();
        
        // Show success notification
        showSuccessNotification('Alert has been resolved successfully.');
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
        
        // Get alert ID if available
        const alertId = activeAlert.id || null;
        
        // Create alert message with or without button based on current page
        const alertMessage = createAlertMessage(location, cameraId, alertId);
        
        // Store the alert data for pulsing alerts
        window.activeFireAlertData = {
            message: alertMessage,
            location: location,
            cameraId: cameraId,
            alertId: alertId
        };
        
        // Show the alert with our new flow management
        showAlert(alertMessage);
        
        // Start pulsing alerts if not already started
        startPulsingAlerts();
    }
}

// Function to start pulsing alerts every 2 seconds
function startPulsingAlerts() {
    // Clear any existing interval
    if (alertPulseInterval) {
        clearInterval(alertPulseInterval);
    }
    
    // Set up new interval to show alerts every 2 seconds
    alertPulseInterval = setInterval(() => {
        // Only pulse if we have active alert data
        if (window.activeFireAlertData) {
            const now = Date.now();
            // Only show a new alert every 2 seconds
            if (now - lastAlertTime >= 2000) {
                showAlert(window.activeFireAlertData.message);
                lastAlertTime = now;
            }
        } else {
            // No active alerts, stop pulsing
            clearInterval(alertPulseInterval);
            alertPulseInterval = null;
        }
    }, 2000);
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
    checkUserAuthAndRole();
    
    // Initialize alarm sound
    initializeAlarmSound();
    
    // Only proceed with alert checks if user is authenticated and has the correct role
    if (shouldShowAlerts) {
        console.log('ALERT DEBUG: Setting up alert checking interval');
        
        // Initial check with a slight delay to ensure everything is loaded
        setTimeout(function() {
            console.log('ALERT DEBUG: Running initial alert check');
            checkGlobalFireAlerts();
            
            // Check for new fire alerts every 3 seconds
            // Use a named interval so we can clear it if needed
            alertInterval = setInterval(function() {
                console.log('ALERT DEBUG: Running scheduled alert check on page:', window.location.pathname);
                checkGlobalFireAlerts();
            }, 3000);
        }, 2000); // Longer delay to ensure socket is fully established
    } else {
        console.log('ALERT DEBUG: Global alerts disabled - user not authenticated or not a regular user');
    }
});

// Function to add sound control button
function addSoundControlButton() {
    const soundControl = document.createElement('div');
    soundControl.className = 'sound-control';
    soundControl.innerHTML = '<i class="fas fa-volume-up"></i>';
    soundControl.title = 'Toggle alert sound';
    
    let isMuted = false;
    
    soundControl.addEventListener('click', function() {
        if (isMuted) {
            // Unmute
            isMuted = false;
            soundControl.innerHTML = '<i class="fas fa-volume-up"></i>';
            soundControl.classList.remove('muted');
            // If there are active alerts, play the sound
            if (activeAlerts.length > 0) {
                playAlarmSound();
            }
        } else {
            // Mute
            isMuted = true;
            soundControl.innerHTML = '<i class="fas fa-volume-mute"></i>';
            soundControl.classList.add('muted');
            stopAlarmSound();
        }
    });
    
    document.body.appendChild(soundControl);
}
