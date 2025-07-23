document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let socket;
    let currentPage = 1;
    let pageSize = 10;
    let statusFilterValue = '';
    let currentAlertId = null;
    let searchTerm = ''; // Global variable for search
    let searchField = 'location'; // Default search field
    
    const API_BASE_URL = window.API_BASE_URL;
    
    // Initialize the page
    init();
    
    window.applyStatusFilter = function(status) {
        console.log(`Applying status filter from global function: ${status || 'All'}`);
        statusFilterValue = status;
        currentPage = 1; // Reset to first page when changing filter
        fetchAlertLogs();
    };
    
    function init() {
        console.log('Initializing alert logs page...');
        
        // Initialize Socket.IO connection
        initSocketConnection();
        
        // Set up event listeners
        setupEventListeners();
        
        // Initialize Bootstrap components
        initBootstrapComponents();
        
        // Initialize the checkbox and confirm button in the modal
        initModal();
        
        // Initial fetch of alert logs
        fetchAlertLogs();
    }
    
    // Initialize Bootstrap components
    function initBootstrapComponents() {
        console.log('Initializing Bootstrap components...');
        
        // Initialize all dropdowns
        const dropdownElementList = [].slice.call(document.querySelectorAll('[data-bs-toggle="dropdown"]'));
        dropdownElementList.forEach(function(dropdownToggleEl) {
            console.log('Initializing dropdown:', dropdownToggleEl);
            try {
                new bootstrap.Dropdown(dropdownToggleEl);
            } catch (error) {
                console.error('Error initializing dropdown:', error);
            }
        });
    }
    
    // Initialize modal functionality
    function initModal() {
        console.log('Initializing modal functionality');
        
        // Get modal elements
        const checkbox = document.getElementById('locationCheckedConfirmation');
        const confirmBtn = document.getElementById('confirmResolveBtn');
        
        // Set up checkbox handler
        if (checkbox) {
            checkbox.addEventListener('change', function() {
                console.log('Checkbox changed:', this.checked);
                if (confirmBtn) {
                    confirmBtn.disabled = !this.checked;
                    console.log('Confirm button disabled:', confirmBtn.disabled);
                }
            });
            console.log('Added checkbox handler');
        } else {
            console.error('Checkbox element not found');
        }
        
        // Make sure confirm button is initially disabled
        if (confirmBtn) {
            confirmBtn.disabled = true;
            console.log('Confirm button initially disabled');
        } else {
            console.error('Confirm button element not found');
        }
    }
    
    // Set up event listeners
    function setupEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refresh-alert-logs');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function() {
                console.log('Refresh button clicked');
                fetchAlertLogs();
            });
        }
        
        // Status filter options
        const statusFilterOptions = document.querySelectorAll('.status-filter-option');
        console.log(`Found ${statusFilterOptions.length} status filter options`);
        
        statusFilterOptions.forEach(option => {
            option.addEventListener('click', function(e) {
                e.preventDefault();
                const status = this.getAttribute('data-status');
                console.log(`Filtering by status: ${status || 'All'}`);
                statusFilterValue = status;
                
                // Update the dropdown button text
                const filterText = document.querySelector('.current-status-filter');
                if (filterText) {
                    filterText.textContent = status || 'All';
                }
                
                // Update the checkmark position
                statusFilterOptions.forEach(opt => {
                    // Remove checkmark from all options
                    const checkIcon = opt.querySelector('svg');
                    if (checkIcon) {
                        opt.removeChild(checkIcon);
                    }
                });
                
                // Add checkmark to the selected option
                const selectedOption = document.querySelector(`.status-filter-option[data-status="${status}"]`) || 
                                      document.querySelector('.status-filter-option[data-status=""]');
                if (selectedOption && !selectedOption.querySelector('svg')) {
                    const checkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    checkSvg.classList.add('icon', 'icon-xxs', 'ms-auto');
                    checkSvg.setAttribute('fill', 'currentColor');
                    checkSvg.setAttribute('viewBox', '0 0 20 20');
                    checkSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                    
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('fill-rule', 'evenodd');
                    path.setAttribute('d', 'M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z');
                    path.setAttribute('clip-rule', 'evenodd');
                    
                    checkSvg.appendChild(path);
                    selectedOption.appendChild(checkSvg);
                }
                
                // Reset to first page when changing filter
                currentPage = 1;
                
                // Fetch logs with the new filter
                fetchAlertLogs();
            });
        });
        
        // Search input - handle Enter key
        const searchInput = document.getElementById('alert-search-input');
        if (searchInput) {
            console.log('Setting up search input event listener');
            searchInput.addEventListener('keyup', function(e) {
                // Trigger search on Enter key
                if (e.key === 'Enter') {
                    performSearch();
                }
            });
            
            // Add a click event to the search icon/button
            const searchIcon = searchInput.previousElementSibling;
            if (searchIcon) {
                searchIcon.style.cursor = 'pointer';
                searchIcon.addEventListener('click', function() {
                    performSearch();
                });
            }
        }
        
        // Search button
        const searchButton = document.getElementById('search-button');
        if (searchButton) {
            console.log('Setting up search button event listener');
            searchButton.addEventListener('click', function() {
                performSearch();
            });
        }
        
        // Search field selector
        const searchFieldSelector = document.getElementById('search-field-selector');
        if (searchFieldSelector) {
            searchFieldSelector.addEventListener('change', function() {
                searchField = this.value;
                console.log(`Search field changed to: ${searchField}`);
            });
        }
        
        // Status filter
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', function() {
                statusFilterValue = this.value;
                currentPage = 1; // Reset to first page when filtering
                console.log(`Filtering by status: ${statusFilterValue}`);
                fetchAlertLogs();
            });
        }
        
        // Search form
        const searchForm = document.getElementById('search-form');
        if (searchForm) {
            searchForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const searchInput = document.getElementById('search-input');
                if (searchInput) {
                    const searchTerm = searchInput.value.trim();
                    console.log(`Searching for: ${searchTerm}`);
                    // Add search functionality here
                    // For now, just refresh the logs
                    fetchAlertLogs();
                }
            });
        }
    }
    
    // Helper function to perform search
    function performSearch() {
        const searchInput = document.getElementById('alert-search-input');
        const searchFieldSelector = document.getElementById('search-field-selector');
        
        if (searchInput && searchFieldSelector) {
            searchTerm = searchInput.value.trim();
            searchField = searchFieldSelector.value;
            
            console.log(`Performing search for: "${searchTerm}" in field: "${searchField}"`);
            
            // Reset to first page when searching
            currentPage = 1;
            
            // Fetch logs with the search parameters
            fetchAlertLogs();
            
            // Show a notification that search is being performed
            notyf.open({
                type: 'info',
                message: `Searching for "${searchTerm}" in ${searchField}...`,
                duration: 3000
            });
        } else {
            console.error('Search input or field selector not found in the DOM');
        }
    }
    
    // Socket.IO Connection
    function initSocketConnection() {
        try {
            console.log('Initializing Socket.IO connection...');
            socket = io();
            
            socket.on('connect', function() {
                console.log('Socket.IO connected successfully');
                fetchAlertLogs();
            });
            
            socket.on('connect_error', function(error) {
                console.error('Socket.IO connection error:', error);
                fallbackToDirectAPI();
            });
            
            socket.on('fire_alert_logs', handleFireAlertLogsResponse);
            
            socket.on('resolve_alert_response', function(data) {
                console.log('Received resolve_alert_response:', data);
                if (data.success) {
                    notyf.success(data.message || `Alert #${data.alert_id} has been resolved successfully`);
                    // Refresh the alert logs after successful resolution
                    setTimeout(fetchAlertLogs, 1000);
                } else {
                    notyf.error(data.error || `Failed to resolve alert: ${data.error || 'Unknown error'}`);
                }
            });
            
        } catch (error) {
            console.error('Error initializing Socket.IO:', error);
            fallbackToDirectAPI();
        }
    }
    
    // Fetch Alert Logs via Socket.IO
    function fetchAlertLogs() {
        showLoading(true);
        
        console.log('Fetching alert logs with status filter:', statusFilterValue);
        if (searchTerm) {
            console.log('Search parameters:', { term: searchTerm, field: searchField });
        }
        
        if (socket && socket.connected) {
            console.log('Fetching alert logs via Socket.IO...');
            
            // Prepare request parameters
            const requestData = {
                page: currentPage,
                pageSize: pageSize,
                filters: {}
            };
            
            // Add status filter if set
            if (statusFilterValue) {
                requestData.filters.status = statusFilterValue;
                console.log(`Adding status filter: ${statusFilterValue}`);
            }
            
            // Add search parameters if set
            if (searchTerm) {
                requestData.filters.search = {
                    term: searchTerm,
                    field: searchField
                };
                console.log(`Adding search filter: ${searchTerm} in field: ${searchField}`);
                console.log('Full request data:', JSON.stringify(requestData));
            }
            
            console.log('Emitting request_alert_logs event with data:', JSON.stringify(requestData));
            socket.emit('request_alert_logs', requestData);
            
            // Set up a timeout for response
            setTimeout(function() {
                // If we haven't received a response after 5 seconds, fall back to direct API
                const loadingIndicator = document.querySelector('.loading-indicator');
                if (loadingIndicator && loadingIndicator.style.display !== 'none') {
                    console.warn('Socket.IO response timeout, falling back to direct API');
                    fallbackToDirectAPI();
                }
            }, 5000);
        } else {
            console.log('Socket.IO not connected, falling back to direct API...');
            fallbackToDirectAPI();
        }
    }
    
    // Handle the response from Socket.IO for fire alert logs
    function handleFireAlertLogsResponse(data) {
        console.log('Received fire_alert_logs response:', data);
        showLoading(false);
        
        if (data.success) {
            updateTable(data.logs);
            updatePagination(data.pagination);
        } else {
            console.error('Error fetching alert logs:', data.error);
            showNotification('error', `Failed to fetch alert logs: ${data.error}`);
        }
    }

    // Fallback to direct API call if Socket.IO fails
    function fallbackToDirectAPI() {
        console.log('Using fallback direct API call...');

        // Build API URL
        let apiUrl = `${API_BASE_URL}/api/fire-alert/logs?page=${currentPage}&pageSize=${pageSize}`;

        // Add status filter if set
        if (statusFilterValue) {
            apiUrl += `&status=${statusFilterValue}`;
        }

        // Add search parameters if set
        if (searchTerm) {
            apiUrl += `&searchTerm=${encodeURIComponent(searchTerm)}&searchField=${searchField}`;
            console.log(`Adding search filter to direct API: ${searchTerm} in field: ${searchField}`);
        }

        console.log(`Fallback API URL: ${apiUrl}`);

        // Make API request
        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Received data from direct API:', data);
                updateTable(data.data || [], data.pagination || {});
                showLoading(false);
            })
            .catch(error => {
                console.error('Error fetching data from direct API:', error);
                showError('Failed to load alert logs. Please try again later.');
                showLoading(false);
            });
    }

    // Show or hide loading indicator
    function showLoading(show) {
        console.log(`${show ? 'Showing' : 'Hiding'} loading indicator`);
        const loadingIndicator = document.querySelector('.loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = show ? 'table-row' : 'none';
        } else {
            console.error('Loading indicator element not found');
        }
    }

    // Update table with alert logs data
    function updateTable(logs) {
        console.log(`Updating table with ${logs.length} logs`);

        const tableBody = document.getElementById('alertLogsTableBody');
        if (!tableBody) {
            console.error('Table body element not found');
            return;
        }

        // Clear existing rows except loading indicator
        const rows = tableBody.querySelectorAll('tr:not(.loading-indicator)');
        rows.forEach(row => row.remove());

        // Hide loading indicator
        const loadingIndicator = tableBody.querySelector('.loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }

        if (!logs || logs.length === 0) {
            // Display a message when no logs are available
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="10" class="text-center">No alert logs available</td>';
            tableBody.appendChild(emptyRow);
            return;
        }

        // Add rows for each log
        logs.forEach(log => {
            const row = document.createElement('tr');

            // Determine if the alert is active and should show a resolve button
            let actionButton = '';
            const isActive = (log.status === 'Active' || log.alert_status === 'Active');

            if (isActive) {
                actionButton = `
                    <button class="btn btn-sm btn-danger resolve-alert-btn" data-alert-id="${log.alert_log_id}">
                        Resolve
                    </button>
                `;
            } else {
                actionButton = `
                    <button class="btn btn-sm btn-outline-secondary" disabled>
                        Resolved
                    </button>
                `;
            }

            // Get location from appropriate field
            const location = log.location || log.fire_loc || log.smoke_loc || log.dht11_loc || 'Unknown';

            // Get camera ID from appropriate field with better fallbacks
            const cameraId = log.camera_id || log.camera || (log.detection ? log.detection.camera_id : '') || 'Camera 1';

            // Get formatted time and date with fallbacks
            let formattedTime = log.formatted_time || '';
            let formattedDate = log.formatted_date || '';

            // If no formatted time/date but we have a timestamp, try to format it
            if ((!formattedTime || !formattedDate) && log.created_at) {
                try {
                    const timestamp = log.created_at;
                    const dt = new Date(timestamp);
                    if (!formattedTime) {
                        formattedTime = dt.toTimeString().split(' ')[0];
                    }
                    if (!formattedDate) {
                        formattedDate = dt.toISOString().split('T')[0];
                    }
                } catch (e) {
                    console.error('Error formatting timestamp:', e);
                }
            }

            // Format the row HTML
            row.innerHTML = `
                <td>${actionButton}</td>
                <td style="font-weight: bold">#FD-${log.alert_log_id || ''}</td>
                <td>${cameraId}</td>
                <td>${location}</td>
                <td>${formattedTime}</td>
                <td>${formattedDate}</td>
                <td>
                    <span class="badge bg-${log.fire_status === 'Detected' ? 'danger' : 'success'}">
                        ${log.fire_status || 'Unknown'}
                    </span>
                </td>
                <td>
                    <span class="badge bg-${log.smoke_status === 'Detected' ? 'warning' : 'success'}">
                        ${log.smoke_status || 'Unknown'}
                    </span>
                </td>
                <td>
                    <span class="badge bg-${log.dht11_status === 'High Temp' ? 'warning' : 'success'}">
                        ${log.dht11_status || 'Unknown'}
                    </span>
                </td>
                <td>
                    <span class="badge bg-${isActive ? 'danger' : 'success'}">
                        ${isActive ? 'Active' : 'Resolved'}
                    </span>
                </td>
            `;

            tableBody.appendChild(row);
        });

        // Add event listeners to resolve buttons
        document.querySelectorAll('.resolve-alert-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const alertId = this.getAttribute('data-alert-id');
                if (alertId) {
                    console.log(`Resolve button clicked for alert ID: ${alertId}`);
                    showResolveModal(alertId);
                }
            });
        });
    }
    
    // Update pagination controls
    function updatePagination(pagination) {
        if (!pagination) return;
        
        const paginationContainer = document.querySelector('.card-footer');
        if (!paginationContainer) return;
        
        // Clear existing pagination
        paginationContainer.innerHTML = '';
        
        // Create wrapper for pagination elements
        const paginationWrapper = document.createElement('div');
        paginationWrapper.className = 'd-flex flex-column flex-lg-row align-items-center justify-content-between';
        
        // Create pagination navigation
        const paginationNav = document.createElement('nav');
        paginationNav.setAttribute('aria-label', 'Page navigation');
        
        const paginationList = document.createElement('ul');
        paginationList.className = 'pagination mb-0';
        
        // Previous button
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${pagination.page === 1 ? 'disabled' : ''}`;
        prevLi.innerHTML = `
            <a class="page-link" href="#" aria-label="Previous" ${pagination.page === 1 ? 'tabindex="-1"' : ''}>
                <span aria-hidden="true">&laquo;</span>
            </a>
        `;
        if (pagination.page > 1) {
            prevLi.querySelector('a').addEventListener('click', function(e) {
                e.preventDefault();
                currentPage--;
                fetchAlertLogs();
            });
        }
        paginationList.appendChild(prevLi);
        
        // Page numbers
        const totalPages = pagination.totalPages || 1;
        let currentPage = pagination.page || 1;
        
        for (let i = 1; i <= totalPages; i++) {
            const pageLi = document.createElement('li');
            pageLi.className = `page-item ${i === currentPage ? 'active' : ''}`;
            pageLi.innerHTML = `
                <a class="page-link" href="#">${i}</a>
            `;
            
            if (i !== currentPage) {
                pageLi.querySelector('a').addEventListener('click', function(e) {
                    e.preventDefault();
                    currentPage = i;
                    fetchAlertLogs();
                });
            }
            
            paginationList.appendChild(pageLi);
        }
        
        // Next button
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
        nextLi.innerHTML = `
            <a class="page-link" href="#" aria-label="Next" ${currentPage === totalPages ? 'tabindex="-1"' : ''}>
                <span aria-hidden="true">&raquo;</span>
            </a>
        `;
        if (currentPage < totalPages) {
            nextLi.querySelector('a').addEventListener('click', function(e) {
                e.preventDefault();
                currentPage++;
                fetchAlertLogs();
            });
        }
        paginationList.appendChild(nextLi);
        
        // Add pagination list to nav
        paginationNav.appendChild(paginationList);
        
        // Add pagination nav to the left side of the wrapper
        paginationWrapper.appendChild(paginationNav);
        
        // Add pagination info text to the right side of the wrapper
        const start = (currentPage - 1) * pageSize + 1;
        const end = Math.min(start + pageSize - 1, pagination.total);
        const total = pagination.total;
        
        const paginationInfo = document.createElement('div');
        paginationInfo.className = 'fw-normal small mt-4 mt-lg-0 pagination-info';
        paginationInfo.innerHTML = `Showing <b>${total > 0 ? start : 0}-${end}</b> out of <b>${total}</b> entries`;
        
        // Add the pagination info to the right side of the wrapper
        paginationWrapper.appendChild(paginationInfo);
        
        // Add the wrapper to the pagination container
        paginationContainer.appendChild(paginationWrapper);
    }
    
    // Show resolve confirmation modal
    function showResolveModal(alertId) {
        console.log(`Showing resolve modal for alert ID: ${alertId}`);
        
        // Get the modal element
        const modal = document.getElementById('resolveAlertModal');
        if (!modal) {
            console.error('Resolve alert modal not found in the DOM');
            return;
        }
        
        // Store the current alert ID being resolved
        currentAlertId = alertId;
        console.log(`Set currentAlertId to: ${currentAlertId}`);
        
        // Set up the checkbox and confirm button directly
        const checkbox = document.getElementById('locationCheckedConfirmation');
        const confirmBtn = document.getElementById('confirmResolveBtn');
        
        // Reset the checkbox state
        if (checkbox) {
            checkbox.checked = false;
            
            // Remove any existing event listeners
            checkbox.removeEventListener('change', checkboxChangeHandler);
            
            // Add fresh event listener
            checkbox.addEventListener('change', checkboxChangeHandler);
            console.log('Added change event listener to checkbox');
        } else {
            console.error('Checkbox not found in the DOM');
        }
        
        // Make sure the confirm button is disabled initially
        if (confirmBtn) {
            confirmBtn.disabled = true;
            
            // Remove any existing event listeners
            confirmBtn.removeEventListener('click', confirmClickHandler);
            
            // Add fresh event listener
            confirmBtn.addEventListener('click', confirmClickHandler);
            console.log('Added click event listener to confirm button');
        } else {
            console.error('Confirm button not found in the DOM');
        }
        
        // Show the modal using Bootstrap 5 API
        try {
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
            console.log('Modal shown successfully');
        } catch (error) {
            console.error('Error showing modal:', error);
            // Fallback for showing modal
            try {
                $(modal).modal('show');
                console.log('Modal shown using jQuery fallback');
            } catch (jqError) {
                console.error('jQuery fallback also failed:', jqError);
            }
        }
    }
    
    // Checkbox change handler
    function checkboxChangeHandler() {
        const confirmBtn = document.getElementById('confirmResolveBtn');
        if (confirmBtn) {
            confirmBtn.disabled = !this.checked;
            console.log(`Checkbox changed, confirm button disabled: ${confirmBtn.disabled}`);
        }
    }
    
    // Confirm button click handler
    function confirmClickHandler() {
        console.log(`Confirm button clicked for alert ID: ${currentAlertId}`);
        
        // Get the modal element
        const modal = document.getElementById('resolveAlertModal');
        
        // Resolve the alert
        resolveAlert(currentAlertId);
        
        // Hide the modal using Bootstrap 5 API
        if (modal) {
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) {
                bsModal.hide();
            } else {
                // Fallback for hiding modal
                console.warn('Bootstrap modal instance not found, using jQuery fallback');
                $(modal).modal('hide');
            }
        }
    }
    
    // Resolve Alert
    function resolveAlert(alertId) {
        console.log(`Resolving alert with ID: ${alertId}`);
        
        if (!alertId) {
            console.error('Cannot resolve alert: No alert ID provided');
            notyf.error('Error: Cannot resolve alert without an ID');
            return;
        }
        
        // Show loading notification
        notyf.open({
            type: 'info',
            message: 'Processing alert resolution...'
        });
        
        if (socket && socket.connected) {
            console.log(`Emitting resolve_fire_alert event with ID: ${alertId}`);
            socket.emit('resolve_fire_alert', { alert_id: alertId });
            
            // Set up one-time listener for the response
            socket.once('resolve_alert_response', function(response) {
                console.log('Received resolve_alert_response:', response);
                
                if (response.success) {
                    notyf.success(response.message || `Alert #${alertId} has been resolved successfully`);
                    // Refresh the alert logs to show updated status
                    fetchAlertLogs();
                } else {
                    notyf.error(response.error || `Failed to resolve alert #${alertId}`);
                }
            });
        } else {
            // Fallback to direct API call
            console.log('Socket not connected, using REST API fallback');
            const apiUrl = `${API_BASE_URL}/api/fire-alert/logs/${alertId}/status`;
            
            fetch(apiUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'Resolved' })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Alert resolved successfully via REST API:', data);
                notyf.success(`Alert #${alertId} has been resolved successfully`);
                // Refresh the alert logs
                fetchAlertLogs();
            })
            .catch(error => {
                console.error('Error resolving alert via REST API:', error);
                notyf.error(`Failed to resolve alert: ${error.message}`);
            });
        }
    }
    
    // Show notification
    function showNotification(type, message) {
        if (window.notyf) {
            window.notyf.open({
                type: type,
                message: message
            });
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
});
