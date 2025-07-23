document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let socket;
    let currentPage = 1;
    let pageSize = 10;
    let currentAlertId = null;
    let allAlertLogs = [];
    let searchTerm = '';
    let searchField = 'location';
    let statusFilterValue = '';
    
    const notyf = new Notyf({
        duration: 3000,
        position: {
            x: 'right',
            y: 'top',
        },
        types: [
            {
                type: 'warning',
                background: '#FFC107',
                icon: {
                    className: 'fas fa-exclamation-triangle',
                    tagName: 'span',
                    color: '#fff'
                },
                dismissible: false
            }
        ]
    });
    
    // Initialize the page
    init();
    
    // Main initialization function
    function init() {
        console.log('Initializing alert logs page');
        
        // Initialize Socket.IO connection
        initSocketConnection();
        
        // Set up event listeners
        setupEventListeners();
        
        // Set up direct handlers for modal and dropdown
        setupDirectHandlers();
    }
    
    // Set up direct handlers for modal and dropdown functionality
    function setupDirectHandlers() {
        console.log('Setting up direct handlers');
        
        // Location checked confirmation checkbox
        const locationCheckedConfirmation = document.getElementById('locationCheckedConfirmation');
        if (locationCheckedConfirmation) {
            locationCheckedConfirmation.addEventListener('change', function() {
                const confirmButton = document.getElementById('confirmResolveBtn');
                if (confirmButton) {
                    confirmButton.disabled = !this.checked;
                }
            });
            console.log('Added location checked confirmation change listener');
        } else {
            console.error('Location checked confirmation checkbox not found');
        }
        
        // Confirm resolve button
        const confirmResolveBtn = document.getElementById('confirmResolveBtn');
        if (confirmResolveBtn) {
            confirmResolveBtn.addEventListener('click', function() {
                if (currentAlertId) {
                    resolveAlert(currentAlertId);
                }
            });
            console.log('Added confirm resolve button click listener');
        } else {
            console.error('Confirm resolve button not found');
        }
        
        // Debug the status filter options
        const statusFilterOptions = document.querySelectorAll('.status-filter-option');
        console.log(`Found ${statusFilterOptions.length} status filter options:`, statusFilterOptions);
        
        // Add window level function for debugging
        window.applyStatusFilter = function(status) {
            console.log(`Status filter applied: "${status}"`);
            
            // Update the status filter value
            statusFilterValue = status;
            
            // Update the dropdown button text
            const statusFilterText = document.querySelector('.current-status-filter');
            if (statusFilterText) {
                statusFilterText.textContent = status || 'All';
            }
            
            // Update the checkmark in the dropdown
            updateStatusFilterCheckmark(status);
            
            // Reset to first page
            currentPage = 1;
            
            // If we have cached logs, filter them client-side
            if (allAlertLogs && allAlertLogs.length > 0) {
                filterAndDisplayLogs();
            } else {
                // Otherwise fetch from server with the filter
                fetchAlertLogs();
            }
        };
    }
    
    // Apply status filter
    function applyStatusFilter(status) {
        console.log(`Applying status filter: ${status || 'All'}`);
        
        // Update the status filter value
        statusFilterValue = status || '';
        
        // Update the dropdown button text
        const statusFilterText = document.querySelector('.current-status-filter');
        if (statusFilterText) {
            statusFilterText.textContent = status || 'All';
        }
        
        // Update the checkmark in the dropdown
        updateStatusFilterCheckmark(status);
        
        // Reset to first page
        currentPage = 1;
        
        // If we have cached logs, filter them client-side
        if (allAlertLogs && allAlertLogs.length > 0) {
            filterAndDisplayLogs();
        } else {
            // Otherwise fetch from server with the filter
            fetchAlertLogs();
        }
    }
    
    // Update status filter dropdown checkmark
    function updateStatusFilterCheckmark(status) {
        // Remove checkmark from all options
        document.querySelectorAll('.status-filter-option .status-checkmark').forEach(function(checkmark) {
            checkmark.innerHTML = '';
        });
        
        // Add checkmark to selected option
        const selectedOption = document.querySelector(`.status-filter-option[data-status="${status || ''}"]`);
        if (selectedOption) {
            const checkmark = selectedOption.querySelector('.status-checkmark');
            if (checkmark) {
                checkmark.innerHTML = '<svg class="icon icon-xs" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>';
            }
        }
    }

    // API base URL from config.js
    const API_BASE_URL = typeof API_CONFIG !== 'undefined' ? API_CONFIG.BASE_URL : 'http://127.0.0.1:3000';
    console.log('Using API base URL:', API_BASE_URL);
    
    // Set up event listeners
    function setupEventListeners() {
        console.log('Setting up event listeners');
        
        // Search button click
        const searchButton = document.getElementById('search-button');
        if (searchButton) {
            searchButton.addEventListener('click', performSearch);
            console.log('Added search button click listener');
        }
        
        // Search input enter key
        const searchInput = document.getElementById('alert-search-input');
        if (searchInput) {
            searchInput.addEventListener('keyup', function(event) {
                if (event.key === 'Enter') {
                    performSearch();
                }
            });
            console.log('Added search input keyup listener');
        }
        
        // Search field selector change
        const searchFieldSelector = document.getElementById('search-field-selector');
        if (searchFieldSelector) {
            searchFieldSelector.addEventListener('change', function() {
                // Update search field
                searchField = this.value;
                console.log(`Search field changed to: ${searchField}`);
                
                // Update placeholder based on selected field
                if (searchInput) {
                    switch (searchField) {
                        case 'location':
                            searchInput.placeholder = 'Search by location...';
                            break;
                        case 'id':
                            searchInput.placeholder = 'Search by alert ID...';
                            break;
                        case 'date':
                            searchInput.placeholder = 'Search by date (YYYY-MM-DD)...';
                            break;
                        default:
                            searchInput.placeholder = 'Search';
                    }
                }
            });
            console.log('Added search field selector change listener');
        }
        
        // Status filter dropdown options
        const statusFilterOptions = document.querySelectorAll('.status-filter-option');
        if (statusFilterOptions.length > 0) {
            statusFilterOptions.forEach(option => {
                option.addEventListener('click', function(e) {
                    e.preventDefault();
                    
                    // Get the status value from data attribute
                    const status = this.getAttribute('data-status');
                    console.log(`Status filter selected: "${status}"`);
                    
                    // Update the status filter value
                    statusFilterValue = status;
                    
                    // Update the dropdown button text
                    const statusFilterText = document.querySelector('.current-status-filter');
                    if (statusFilterText) {
                        statusFilterText.textContent = status || 'All';
                    }
                    
                    // Update the checkmark
                    updateStatusFilterCheckmark(status);
                    
                    // Reset to first page
                    currentPage = 1;
                    
                    // Apply the filter
                    applyStatusFilter(status);
                });
            });
            console.log('Added status filter option click listeners');
        } else {
            console.error('Status filter options not found in the DOM');
        }
        
        // Refresh button click
        const refreshButton = document.getElementById('refresh-alert-logs');
        if (refreshButton) {
            refreshButton.addEventListener('click', function() {
                console.log('Refresh button clicked');
                clearSearchAndFilters();
                fetchAlertLogs();

            });
            console.log('Added refresh button click listener');
        } else {
            console.error('Refresh button not found in the DOM');
        }
        
        // Pagination buttons
        document.querySelectorAll('.page-link').forEach(function(button) {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                const page = this.getAttribute('data-page');
                if (page) {
                    goToPage(parseInt(page));
                }
            });
        });
    }
    
    // Function to apply status filter
    function applyStatusFilter(status) {
        console.log(`Applying status filter: "${status}"`);
        
        // Update global status filter value
        statusFilterValue = status;
        
        // If we have cached logs, filter them client-side
        if (allAlertLogs && allAlertLogs.length > 0) {
            filterAndDisplayLogs();
        } else {
            // Otherwise fetch from server with the filter
            fetchAlertLogs();
        }
    }
    
    // Helper function to update the checkmark in status filter dropdown
    function updateStatusFilterCheckmark(selectedStatus) {
        console.log(`Updating status filter checkmark for: "${selectedStatus}"`);
        
        // Get all status filter options
        const statusFilterOptions = document.querySelectorAll('.status-filter-option');
        
        // Remove checkmark from all options
        statusFilterOptions.forEach(option => {
            // Find any existing checkmark SVG and remove it
            const existingCheckmark = option.querySelector('svg.icon-xxs');
            if (existingCheckmark && existingCheckmark.classList.contains('icon-xxs')) {
                existingCheckmark.remove();
            }
        });
        
        // Find the selected option and add checkmark
        statusFilterOptions.forEach(option => {
            const status = option.getAttribute('data-status') || '';
            if (status === selectedStatus) {
                // Only add checkmark if it doesn't already have one
                if (!option.querySelector('svg.icon-xxs')) {
                    // Create SVG checkmark element
                    const checkmarkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    checkmarkSvg.setAttribute('class', 'icon icon-xxs ms-auto');
                    checkmarkSvg.setAttribute('fill', 'currentColor');
                    checkmarkSvg.setAttribute('viewBox', '0 0 20 20');
                    checkmarkSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                    
                    // Create path element
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('fill-rule', 'evenodd');
                    path.setAttribute('d', 'M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z');
                    path.setAttribute('clip-rule', 'evenodd');
                    
                    // Append path to SVG
                    checkmarkSvg.appendChild(path);
                    
                    // Append SVG to option
                    option.appendChild(checkmarkSvg);
                }
            }
        });
    }

    // Clear search and filters
    function clearSearchAndFilters() {
        console.log('Clearing search and filters');
        
        // Clear search input
        const searchInput = document.getElementById('alert-search-input');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Reset search term and field
        searchTerm = '';
        searchField = 'location';
        
        // Reset status filter
        statusFilterValue = '';
        
        // Update status filter text
        const filterText = document.querySelector('.current-status-filter');
        if (filterText) {
            filterText.textContent = 'All';
        }
        
        // Update status filter checkmark
        updateStatusFilterCheckmark('');
        
        console.log('Search and filters cleared');
    }
    
    // Helper function to perform search
    function performSearch() {
        const searchInput = document.getElementById('alert-search-input');
        const searchFieldSelector = document.getElementById('search-field-selector');
        
        if (searchInput && searchFieldSelector) {
            searchTerm = searchInput.value.trim();
            searchField = searchFieldSelector.value;
            
            console.log(`Performing client-side search for: "${searchTerm}" in field: "${searchField}"`);
            
            // Apply client-side filtering on the current data
            filterAndDisplayLogs();
        } else {
            console.error('Search input or field selector not found in the DOM');
        }
    }
    
    // Filter logs based on search term and field
    function filterAndDisplayLogs() {
        if (!allAlertLogs || allAlertLogs.length === 0) {
            console.log('No logs to filter');
            return;
        }
        
        console.log(`Filtering ${allAlertLogs.length} logs with search term: "${searchTerm}" in field: "${searchField}"`);
        
        let filteredLogs = allAlertLogs;
        
        // Apply status filter if set
        if (statusFilterValue) {
            filteredLogs = filteredLogs.filter(log => {
                const status = log.status || log.alert_status || '';
                return status.toLowerCase() === statusFilterValue.toLowerCase();
            });
            console.log(`After status filter (${statusFilterValue}): ${filteredLogs.length} logs`);
        }
        
        // Apply search filter if set
        if (searchTerm) {
            filteredLogs = filteredLogs.filter(log => {
                const term = searchTerm.toLowerCase();
                
                // Search in different fields based on searchField
                if (searchField === 'location') {
                    const location = (log.fire_loc || log.location || log.smoke_loc || log.dht11_loc || '').toLowerCase();
                    return location.includes(term);
                } 
                else if (searchField === 'id') {
                    const id = String(log.alert_log_id || '').toLowerCase();
                    return id.includes(term);
                }
                else if (searchField === 'date') {
                    const date = (log.formatted_date || '').toLowerCase();
                    return date.includes(term);
                }
                
                return false;
            });
            console.log(`After search filter: ${filteredLogs.length} logs`);
        }
        
        // Calculate pagination for filtered results
        const totalItems = filteredLogs.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        
        // Adjust current page if it's out of bounds
        if (currentPage > totalPages) {
            currentPage = 1;
        }
        
        // Get current page of data
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, totalItems);
        const currentPageData = filteredLogs.slice(startIndex, endIndex);
        
        console.log(`Displaying page ${currentPage} (${startIndex}-${endIndex}) of ${totalItems} filtered logs`);
        
        // Update the table with filtered data
        updateTable(currentPageData, {
            total: totalItems,
            page: currentPage,
            pageSize: pageSize,
            totalPages: totalPages
        });
    }
    
    // Socket.IO Connection
    function initSocketConnection() {
        console.log('Initializing Socket.IO connection');
        
        try {
            // Connect to Socket.IO server
            socket = io();
            
            // Connection events
            socket.on('connect', function() {
                console.log('Socket.IO connected');
                
                // Set up event handlers for socket events
                setupSocketEventHandlers();
                
                // Fetch alert logs once connected
                fetchAlertLogs();
            });
            
            socket.on('connect_error', function(error) {
                console.error('Socket.IO connection error:', error);
                
                // Fallback to direct API call after connection error
                fallbackToDirectAPI();
            });
            
            socket.on('disconnect', function() {
                console.log('Socket.IO disconnected');
            });
            
            socket.on('error', function(error) {
                console.error('Socket.IO error:', error);
            });
        } catch (error) {
            console.error('Error initializing Socket.IO:', error);
            
            // Fallback to direct API call
            fallbackToDirectAPI();
        }
    }
    
    // Fetch Alert Logs via Socket.IO
    function fetchAlertLogs() {
        console.log('Fetching alert logs via Socket.IO...');
        showLoading(true);
        
        if (socket && socket.connected) {
            console.log('Socket is connected, emitting request_alert_logs event');
            
            // Prepare request data
            const requestData = {
                page: currentPage,
                pageSize: pageSize,
                filters: {}
            };
            
            // Add status filter if set
            if (statusFilterValue) {
                requestData.filters.status = statusFilterValue;
            }
            
            // Add search parameters if set
            if (searchTerm) {
                requestData.filters.search = {
                    term: searchTerm,
                    field: searchField
                };
            }
            
            // Emit event to request alert logs
            socket.emit('request_alert_logs', requestData);
        } else {
            console.warn('Socket not connected, using REST API fallback');
            fallbackToDirectAPI();
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
    function updateTable(logs, pagination) {
        console.log(`Updating table with ${logs.length} logs`);

        const tableBody = document.getElementById('alertLogsTableBody');
        if (!tableBody) {
            console.error('Alert logs table body not found');
            return;
        }

        // Clear existing rows
        tableBody.innerHTML = '';

        if (logs.length === 0) {
            // No logs to display
            const emptyRow = document.createElement('tr');
            const emptyCell = document.createElement('td');
            emptyCell.colSpan = 10;
            emptyCell.className = 'text-center';
            emptyCell.textContent = 'No alert logs found';
            emptyRow.appendChild(emptyCell);
            tableBody.appendChild(emptyRow);
        } else {
            // Add logs to table
            logs.forEach(log => {
                const row = document.createElement('tr');
                
                // Action column (first column)
                const actionCell = document.createElement('td');
                const status = log.status || log.alert_status || '';
                if (status.toLowerCase() === 'active') {
                    // For active alerts, show resolve button
                    const resolveButton = document.createElement('button');
                    resolveButton.className = 'btn btn-sm btn-danger resolve-alert-btn';
                    resolveButton.textContent = 'Resolve';
                    resolveButton.dataset.alertId = log.alert_log_id;
                    resolveButton.addEventListener('click', function() {
                        showResolveModal(log.alert_log_id);
                    });
                    actionCell.appendChild(resolveButton);
                } else {
                    // For resolved alerts, show details button
                    const detailsButton = document.createElement('button');
                    detailsButton.className = 'btn btn-sm btn-outline-secondary';
                    detailsButton.textContent = 'Resolved';
                    detailsButton.dataset.alertId = log.alert_log_id;
                    actionCell.appendChild(detailsButton);
                }
                row.appendChild(actionCell);
                
                // Alert ID
                const idCell = document.createElement('td');
                idCell.style.fontWeight = 'bold';
                idCell.textContent = '#FD-' + log.alert_log_id || '';
                row.appendChild(idCell);
                
                // Camera
                const cameraCell = document.createElement('td');
                cameraCell.textContent = log.camera_id || log.camera || 'Camera 1';
                row.appendChild(cameraCell);
                
                // Location
                const locationCell = document.createElement('td');
                locationCell.textContent = log.fire_loc || log.location || log.smoke_loc || log.dht11_loc || '';
                row.appendChild(locationCell);
                
                // Time
                const timeCell = document.createElement('td');
                timeCell.textContent = log.formatted_time || '';
                row.appendChild(timeCell);
                
                // Date
                const dateCell = document.createElement('td');
                dateCell.textContent = log.formatted_date || '';
                row.appendChild(dateCell);
                
                // Fire Status
                const fireStatusCell = document.createElement('td');
                const fireStatus = log.fire_status || 'Unknown';
                const fireBadgeClass = fireStatus === 'Detected' ? 'bg-danger' : 'bg-success';
                fireStatusCell.innerHTML = `<span class="badge ${fireBadgeClass}">${fireStatus}</span>`;
                row.appendChild(fireStatusCell);
                
                // Smoke Status
                const smokeStatusCell = document.createElement('td');
                const smokeStatus = log.smoke_status || 'Unknown';
                const smokeBadgeClass = smokeStatus === 'Detected' ? 'bg-warning' : 'bg-success';
                smokeStatusCell.innerHTML = `<span class="badge ${smokeBadgeClass}">${smokeStatus}</span>`;
                row.appendChild(smokeStatusCell);
                
                // Temperature Status
                const tempStatusCell = document.createElement('td');
                const tempStatus = log.dht11_status || 'Normal';
                const tempBadgeClass = tempStatus === 'High Temp' ? 'bg-warning' : 'bg-success';
                tempStatusCell.innerHTML = `<span class="badge ${tempBadgeClass}">${tempStatus}</span>`;
                row.appendChild(tempStatusCell);
                
                // Alert Status
                const statusCell = document.createElement('td');
                const alertStatus = status || 'Unknown';
                const alertBadgeClass = alertStatus.toLowerCase() === 'active' ? 'bg-danger' : 'bg-success';
                statusCell.innerHTML = `<span class="badge ${alertBadgeClass}">${alertStatus}</span>`;
                row.appendChild(statusCell);
                
                tableBody.appendChild(row);
            });
        }
        
        // Update pagination
        updatePagination(pagination);
        
        // Update pagination info text
        updatePaginationInfo(pagination);
    }
    
    // Update pagination
    function updatePagination(pagination) {
        const paginationElement = document.querySelector('.pagination');
        if (!paginationElement) return;
        
        const totalPages = pagination.totalPages || 1;
        const currentPage = pagination.page || 1;
        
        console.log(`Updating pagination: page ${currentPage} of ${totalPages}`);
        
        // Clear existing pagination
        paginationElement.innerHTML = '';
        
        // Don't show pagination if there's only one page
        if (totalPages <= 1) return;
        
        // Previous button
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
        
        const prevLink = document.createElement('a');
        prevLink.className = 'page-link';
        prevLink.href = '#';
        prevLink.setAttribute('aria-label', 'Previous');
        prevLink.innerHTML = '<span aria-hidden="true">&laquo;</span>';
        
        if (currentPage > 1) {
            prevLink.addEventListener('click', function(e) {
                e.preventDefault();
                goToPage(currentPage - 1);
            });
        }
        
        prevLi.appendChild(prevLink);
        paginationElement.appendChild(prevLi);
        
        // Page numbers
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        
        // Adjust start page if we're near the end
        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageLi = document.createElement('li');
            pageLi.className = `page-item ${i === currentPage ? 'active' : ''}`;
            
            const pageLink = document.createElement('a');
            pageLink.className = 'page-link';
            pageLink.href = '#';
            pageLink.textContent = i;
            
            if (i !== currentPage) {
                pageLink.addEventListener('click', function(e) {
                    e.preventDefault();
                    goToPage(i);
                });
            }
            
            pageLi.appendChild(pageLink);
            paginationElement.appendChild(pageLi);
        }
        
        // Next button
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
        
        const nextLink = document.createElement('a');
        nextLink.className = 'page-link';
        nextLink.href = '#';
        nextLink.setAttribute('aria-label', 'Next');
        nextLink.innerHTML = '<span aria-hidden="true">&raquo;</span>';
        
        if (currentPage < totalPages) {
            nextLink.addEventListener('click', function(e) {
                e.preventDefault();
                goToPage(currentPage + 1);
            });
        }
        
        nextLi.appendChild(nextLink);
        paginationElement.appendChild(nextLi);
    }
    
    // Update pagination info text
    function updatePaginationInfo(pagination) {
        const paginationInfoElement = document.querySelector('.pagination-info');
        if (!paginationInfoElement) return;
        
        const total = pagination.total || 0;
        const currentPage = pagination.page || 1;
        const pageSize = pagination.pageSize || 10;
        
        const start = total > 0 ? (currentPage - 1) * pageSize + 1 : 0;
        const end = Math.min(start + pageSize - 1, total);
        
        paginationInfoElement.innerHTML = `Showing <b>${start}-${end}</b> out of <b>${total}</b> entries`;
    }
    
    // Go to a specific page
    function goToPage(page) {
        console.log(`Going to page ${page}`);
        currentPage = page;
        
        // If we have search term or status filter, use client-side filtering
        if (searchTerm || statusFilterValue) {
            filterAndDisplayLogs();
        } else {
            // Otherwise fetch from server
            fetchAlertLogs();
        }
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
    
    // Socket.IO event handlers
    function setupSocketEventHandlers() {
        if (!socket) return;
        
        // Listen for fire alert logs
        socket.on('fire_alert_logs', function(data) {
            console.log('Received fire_alert_logs event:', data);
            
            if (data.success) {
                // Store all logs for client-side filtering
                allAlertLogs = data.logs || [];
                console.log(`Stored ${allAlertLogs.length} logs for client-side filtering`);
                
                // Apply filtering if search term is set
                if (searchTerm) {
                    filterAndDisplayLogs();
                } else {
                    updateTable(data.logs, data.pagination);
                }
            } else {
                console.error('Error fetching alert logs:', data.error);
                showError(data.error || 'Failed to fetch alert logs');
            }
            
            showLoading(false);
        });
        
        // Listen for alert status changes
        socket.on('alert_status_changed', function(data) {
            console.log('Received alert_status_changed event:', data);
            
            // Update the status in the allAlertLogs array
            if (allAlertLogs && allAlertLogs.length > 0) {
                const alertId = data.alert_id;
                const newStatus = data.new_status;
                
                // Find the alert in the array and update its status
                for (let i = 0; i < allAlertLogs.length; i++) {
                    if (allAlertLogs[i].alert_log_id == alertId) {
                        console.log(`Updating status of alert #${alertId} to ${newStatus}`);
                        allAlertLogs[i].status = newStatus;
                        allAlertLogs[i].alert_status = newStatus;
                        break;
                    }
                }
                
                // Re-apply any filtering and update the table
                if (searchTerm || statusFilterValue) {
                    filterAndDisplayLogs();
                } else {
                    // Refresh from server if no filters are applied
                    fetchAlertLogs();
                }
            }
        });
    }

    // Resolve Alert
    function resolveAlert(alertId) {
        console.log(`Resolving alert ID: ${alertId}`);
        
        if (!alertId) {
            console.error('No alert ID provided');
            return;
        }
        
        showLoading(true);
        
        // Use Socket.IO if connected
        if (socket && socket.connected) {
            console.log('Resolving alert via Socket.IO');
            socket.emit('resolve_alert', { alertId: alertId });
            
            // Listen for response
            socket.once('alert_resolved', function(response) {
                console.log('Received alert_resolved event:', response);
                showLoading(false);
                
                if (response.success) {
                    // Close the modal
                    const modal = bootstrap.Modal.getInstance(document.getElementById('resolveAlertModal'));
                    if (modal) {
                        modal.hide();
                    }
                    
                    // Show success message
                    notyf.success({
                        message: response.message || `Alert #${alertId} has been resolved successfully`,
                        duration: 5000,
                        position: {
                            x: 'center',
                            y: 'top'
                        }
                    });
                    
                    // Update the status in the allAlertLogs array
                    if (allAlertLogs && allAlertLogs.length > 0) {
                        for (let i = 0; i < allAlertLogs.length; i++) {
                            if (allAlertLogs[i].alert_log_id == alertId) {
                                console.log(`Locally updating status of alert #${alertId} to Resolved`);
                                allAlertLogs[i].status = 'Resolved';
                                allAlertLogs[i].alert_status = 'Resolved';
                                break;
                            }
                        }
                    }
                    
                    // Refresh the alert logs
                    if (searchTerm || statusFilterValue) {
                        // If we have filters, just update the current view
                        filterAndDisplayLogs();
                    } else {
                        // Otherwise fetch fresh data
                        fetchAlertLogs();
                    }
                } else {
                    // Show error message
                    notyf.error({
                        message: response.error || `Failed to resolve alert: ${response.error || 'Unknown error'}`,
                        duration: 5000
                    });
                }
            });
        } else {
            // Fallback to direct API call
            console.log('Socket not connected, using REST API fallback');
            const apiUrl = `${API_BASE_URL}/api/fire-alert/logs/${alertId}/status`;
            
            fetch(apiUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
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
                console.log('Alert resolution response:', data);
                showLoading(false);
                
                // Close the modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('resolveAlertModal'));
                if (modal) {
                    modal.hide();
                }

                
                // Update the status in the allAlertLogs array
                if (allAlertLogs && allAlertLogs.length > 0) {
                    for (let i = 0; i <allAlertLogs.length; i++) {
                        if (allAlertLogs[i].alert_log_id == alertId) {
                            console.log(`Locally updating status of alert #${alertId} to Resolved`);
                            allAlertLogs[i].status = 'Resolved';
                            allAlertLogs[i].alert_status = 'Resolved';
                            break;
                        }
                    }
                }
                
                // Refresh the alert logs
                if (searchTerm || statusFilterValue) {
                    // If we have filters, just update the current view
                    filterAndDisplayLogs();
                } else {
                    // Otherwise fetch fresh data
                    fetchAlertLogs();
                }
            })
            .catch(error => {
                console.error('Error resolving alert:', error);
                showLoading(false);
                
                // Show error message
                notyf.error({
                    message: `Failed to resolve alert #${alertId}: ${error.message}`,
                    duration: 5000
                });
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
