from flask import session, request
import requests
import json
import traceback
from datetime import datetime, timedelta
import os
import time
import io
import base64
from apps.config import Config

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False
    print("WARNING: pandas resolved not installed. Export functionality will not work.")

# Try to import xlsxwriter with proper error handling
try:
    import xlsxwriter
    HAS_XLSXWRITER = True
except ImportError:
    HAS_XLSXWRITER = False
    print("WARNING: xlsxwriter not installed. Excel export functionality will not work.")

# API configuration - use centralized config
API_BASE_URL = Config.API_BASE_URL

def register_socket_events(socketio):
    @socketio.on('connect')
    def handle_connect():
        print('Client connected')
        
    @socketio.on('disconnect')
    def handle_disconnect():
        print('Client disconnected')

    @socketio.on('request_admin_data')
    def handle_admin_data_request(data):
        user = session.get('user', {})
        admin_id = user.get('id') or user.get('npk') or user.get('admin_id')
        
        if admin_id:
            try:
                # Use the correct profile endpoint with type=admin query parameter
                response = requests.get(f'{API_BASE_URL}/api/profile?id={admin_id}&type=admin')
                
                if response.status_code == 200:
                    admin_data = response.json()
                    # Update user data with fetched admin information
                    if admin_data.get('admin_name'):
                        user['name'] = admin_data.get('admin_name')
                    
                    # Save updated user data back to session
                    session['user'] = user
                    
                    # Create profile data and emit back to client
                    profile_data = {
                        'npk': user.get('id') or user.get('npk') or user.get('admin_id'),
                        'email': user.get('email'),
                        'name': user.get('name'),
                        'department_name': admin_data.get('department_name', 'N/A'),
                        'division_name': admin_data.get('division_name', 'N/A'),
                        'role_name': admin_data.get('role_name', 'Admin'),
                        'plant_name': admin_data.get('plant_name', 'N/A'),
                        'created_at': user.get('created_at', 'N/A')
                    }
                    
                    socketio.emit('admin_data', {'success': True, 'profile': profile_data})
                else:
                    # Fallback to Admin 1 if API fails
                    user['name'] = "Admin 1"
                    session['user'] = user
                    socketio.emit('admin_data', {'success': False, 'error': f"Failed to fetch admin data: Status code {response.status_code}"})
            except Exception as e:
                # Fallback to Admin 1 if exception
                user['name'] = "Admin 1"
                session['user'] = user
                socketio.emit('admin_data', {'success': False, 'error': f"Error fetching admin data: {str(e)}"})
        else:
            # No admin ID, fallback to Admin 1
            user['name'] = "Admin 1"
            session['user'] = user
            socketio.emit('admin_data', {'success': False, 'error': "No admin ID found"})

    @socketio.on('request_dashboard_stats')
    def handle_dashboard_stats_request(data):
        try:
            # Calculate date range (current week)
            today = datetime.now()
            one_week_ago = today - timedelta(days=7)
            date_range = f"{one_week_ago.strftime('%b %d')} - {today.strftime('%b %d')}"
            
            # Initialize default values
            all_users_count = 0
            new_users_count = 0
            pending_users = []
            approved_users_count = 0
            
            try:
                # Get all users count
                all_users_response = requests.get(f'{API_BASE_URL}/api/users/count')
                if all_users_response.status_code == 200:
                    all_users_count = all_users_response.json().get('count', 0)
            except Exception as e:
                print(f"Error fetching all users count: {str(e)}")
                print(f"Error type: {type(e).__name__}")
                print(f"Error details: {traceback.format_exc()}")
            
            try:
                # Get new users (registered this week)
                new_users_response = requests.get(f'{API_BASE_URL}/api/users/count/new?since={one_week_ago.strftime("%Y-%m-%d")}')
                if new_users_response.status_code == 200:
                    new_users_count = new_users_response.json().get('count', 0)
            except Exception as e:
                print(f"Error fetching new users count: {str(e)}")
                print(f"Error type: {type(e).__name__}")
                print(f"Error details: {traceback.format_exc()}")
            
            try:
                # Get pending users
                pending_users_response = requests.get(f'{API_BASE_URL}/api/approval/pending')
                if pending_users_response.status_code == 200:
                    pending_users = pending_users_response.json()
            except Exception as e:
                print(f"Error fetching pending users: {str(e)}")
                print(f"Error type: {type(e).__name__}")
                print(f"Error details: {traceback.format_exc()}")
            
            try:
                # Get all users to count approved users
                all_users_list_response = requests.get(f'{API_BASE_URL}/api/users')
                if all_users_list_response.status_code == 200:
                    all_users_list = all_users_list_response.json()
                    all_users_count = len(all_users_list)
                    approved_users = [u for u in all_users_list if u.get('status') == 'approved' or u.get('is_approved') == True]
                    approved_users_count = len(approved_users)
            except Exception as e:
                print(f"Error fetching all users list: {str(e)}")
                print(f"Error type: {type(e).__name__}")
                print(f"Error details: {traceback.format_exc()}")
                
                # Try alternate endpoint for approved users
                try:
                    approved_users_response = requests.get(f'{API_BASE_URL}/api/users/approved')
                    if approved_users_response.status_code == 200:
                        approved_users = approved_users_response.json()
                        approved_users_count = len(approved_users)
                except Exception as e:
                    print(f"Error fetching approved users: {str(e)}")
                    print(f"Error type: {type(e).__name__}")
                    print(f"Error details: {traceback.format_exc()}")
            
            # Emit dashboard stats to the client
            socketio.emit('dashboard_stats', {
                'success': True,
                'date_range': date_range,
                'all_users_count': all_users_count,
                'new_users_count': new_users_count,
                'pending_users_count': len(pending_users),
                'pending_users': pending_users,
                'approved_users_count': approved_users_count
            })
        except Exception as e:
            socketio.emit('dashboard_stats', {
                'success': False,
                'error': f"Error fetching dashboard stats: {str(e)}"
            })

    @socketio.on('request_history_data')
    def handle_history_data_request(data):
        try:
            # Get user ID from data or session
            user_id = data.get('user_id')
            if not user_id:
                user = session.get('user', {})
                user_id = user.get('id') or user.get('npk') or user.get('admin_id')
            
            # Initialize history data
            history_data = []
            
            # Determine user type (admin or regular user)
            user_type = data.get('user_type', 'user')
            
            if user_type == 'admin':
                # Admin history view - all approvals or filtered by admin ID
                try:
                    if user_id:
                        response = requests.get(f'{API_BASE_URL}/api/history/approval/admin/{user_id}')
                    else:
                        response = requests.get(f'{API_BASE_URL}/api/history/approval')
                    
                    if response.status_code == 200:
                        history_data = response.json()
                except Exception as e:
                    print(f"Error fetching admin history data: {str(e)}")
                    print(f"Error type: {type(e).__name__}")
                    print(f"Error details: {traceback.format_exc()}")
            else:
                # Regular user history view - filtered by user ID
                try:
                    if user_id:
                        response = requests.get(f'{API_BASE_URL}/api/history/approval/user/{user_id}')
                        
                        if response.status_code == 200:
                            history_data = response.json()
                except Exception as e:
                    print(f"Error fetching user history data: {str(e)}")
                    print(f"Error type: {type(e).__name__}")
                    print(f"Error details: {traceback.format_exc()}")
            
            # Emit history data to the client
            socketio.emit('history_data', {
                'success': True,
                'history': history_data
            })
        except Exception as e:
            socketio.emit('history_data', {
                'success': False,
                'error': f"Error fetching history data: {str(e)}"
            })

    @socketio.on('request_sensor_data')
    def handle_sensor_data_request(data):
        try:
            print(f"Received sensor data request with parameters: {data}")
            # Get parameters from request data
            page = data.get('page', 1)
            pageSize = data.get('pageSize', 10)
            location = data.get('location')
            status = data.get('status')
            
            # Initialize response data
            sensor_data = {}
            
            # Test if the Node.js server is accessible
            try:
                # Try with direct IP instead of localhost
                test_response = requests.get(f'{API_BASE_URL}/api/sensor/sensor-data/fire', timeout=10)
                print(f"Test API connection status: {test_response.status_code}")
                if test_response.status_code == 200:
                    print("Node.js API server is accessible")
                else:
                    print(f"Node.js API server returned error: {test_response.text}")
            except Exception as e:
                print(f"Error connecting to Node.js API server: {str(e)}")
                print(f"Error type: {type(e).__name__}")
                print(f"Error details: {traceback.format_exc()}")
            
            # Fetch fire sensor data
            try:
                fire_api_url = f'{API_BASE_URL}/api/sensor/sensor-data/fire/paginated?page={page}&pageSize={pageSize}' + \
                              (f'&location={location}' if location else '') + \
                              (f'&status={status}' if status else '')
                print(f"Requesting fire sensor data from: {fire_api_url}")
                fire_response = requests.get(fire_api_url, timeout=5)
                print(f"Fire sensor API response status: {fire_response.status_code}")
                
                if fire_response.status_code == 200:
                    sensor_data['fireSensorData'] = fire_response.json()
                    print(f"Fire sensor data received: {len(sensor_data['fireSensorData'].get('data', []))} records")
                else:
                    print(f"Fire sensor API error: {fire_response.text}")
                    # Try the non-paginated endpoint as fallback
                    fallback_url = f'{API_BASE_URL}/api/sensor/sensor-data/fire'
                    print(f"Trying fallback URL: {fallback_url}")
                    fallback_response = requests.get(fallback_url, timeout=5)
                    
                    if fallback_response.status_code == 200:
                        # Convert regular response to paginated format
                        data_list = fallback_response.json()
                        sensor_data['fireSensorData'] = {
                            'data': data_list[:int(pageSize)],
                            'pagination': {
                                'total': len(data_list),
                                'page': int(page),
                                'pageSize': int(pageSize),
                                'totalPages': max(1, (len(data_list) + int(pageSize) - 1) // int(pageSize))
                            }
                        }
                        print(f"Fire sensor data received from fallback: {len(data_list)} records")
                    else:
                        print(f"Fallback API error: {fallback_response.text}")
                        sensor_data['fireSensorData'] = {
                            'data': [],
                            'pagination': {'total': 0, 'page': page, 'pageSize': pageSize, 'totalPages': 0},
                            'error': f"Failed to fetch fire sensor data: Status {fire_response.status_code}"
                        }
            except Exception as e:
                print(f"Error fetching fire sensor data: {str(e)}")
                print(f"Error type: {type(e).__name__}")
                print(f"Error details: {traceback.format_exc()}")
                sensor_data['fireSensorData'] = {
                    'data': [],
                    'pagination': {'total': 0, 'page': page, 'pageSize': pageSize, 'totalPages': 0},
                    'error': f"Error fetching fire sensor data: {str(e)}"
                }
            
            # Fetch smoke sensor data
            try:
                smoke_api_url = f'{API_BASE_URL}/api/sensor/sensor-data/smoke/paginated?page={page}&pageSize={pageSize}' + \
                               (f'&location={location}' if location else '') + \
                               (f'&status={status}' if status else '')
                print(f"Requesting smoke sensor data from: {smoke_api_url}")
                smoke_response = requests.get(smoke_api_url, timeout=5)
                print(f"Smoke sensor API response status: {smoke_response.status_code}")
                
                if smoke_response.status_code == 200:
                    sensor_data['smokeSensorData'] = smoke_response.json()
                    print(f"Smoke sensor data received: {len(sensor_data['smokeSensorData'].get('data', []))} records")
                else:
                    print(f"Smoke sensor API error: {smoke_response.text}")
                    # Try the non-paginated endpoint as fallback
                    fallback_url = f'{API_BASE_URL}/api/sensor/sensor-data/smoke'
                    print(f"Trying fallback URL: {fallback_url}")
                    fallback_response = requests.get(fallback_url, timeout=5)
                    
                    if fallback_response.status_code == 200:
                        # Convert regular response to paginated format
                        data_list = fallback_response.json()
                        sensor_data['smokeSensorData'] = {
                            'data': data_list[:int(pageSize)],
                            'pagination': {
                                'total': len(data_list),
                                'page': int(page),
                                'pageSize': int(pageSize),
                                'totalPages': max(1, (len(data_list) + int(pageSize) - 1) // int(pageSize))
                            }
                        }
                        print(f"Smoke sensor data received from fallback: {len(data_list)} records")
                    else:
                        print(f"Fallback API error: {fallback_response.text}")
                        sensor_data['smokeSensorData'] = {
                            'data': [],
                            'pagination': {'total': 0, 'page': page, 'pageSize': pageSize, 'totalPages': 0},
                            'error': f"Failed to fetch smoke sensor data: Status {smoke_response.status_code}"
                        }
            except Exception as e:
                print(f"Error fetching smoke sensor data: {str(e)}")
                print(f"Error type: {type(e).__name__}")
                print(f"Error details: {traceback.format_exc()}")
                sensor_data['smokeSensorData'] = {
                    'data': [],
                    'pagination': {'total': 0, 'page': page, 'pageSize': pageSize, 'totalPages': 0},
                    'error': f"Error fetching smoke sensor data: {str(e)}"
                }
            
            # Fetch DHT11 sensor data
            try:
                dht11_api_url = f'{API_BASE_URL}/api/sensor/sensor-data/dht11/paginated?page={page}&pageSize={pageSize}' + \
                               (f'&location={location}' if location else '') + \
                               (f'&status={status}' if status else '')
                print(f"Requesting DHT11 sensor data from: {dht11_api_url}")
                dht11_response = requests.get(dht11_api_url, timeout=5)
                print(f"DHT11 sensor API response status: {dht11_response.status_code}")
                
                if dht11_response.status_code == 200:
                    sensor_data['dht11Data'] = dht11_response.json()
                    print(f"DHT11 sensor data received: {len(sensor_data['dht11Data'].get('data', []))} records")
                else:
                    print(f"DHT11 sensor API error: {dht11_response.text}")
                    # Try the non-paginated endpoint as fallback
                    fallback_url = f'{API_BASE_URL}/api/sensor/sensor-data/dht11'
                    print(f"Trying fallback URL: {fallback_url}")
                    fallback_response = requests.get(fallback_url, timeout=5)
                    
                    if fallback_response.status_code == 200:
                        # Convert regular response to paginated format
                        data_list = fallback_response.json()
                        sensor_data['dht11Data'] = {
                            'data': data_list[:int(pageSize)],
                            'pagination': {
                                'total': len(data_list),
                                'page': int(page),
                                'pageSize': int(pageSize),
                                'totalPages': max(1, (len(data_list) + int(pageSize) - 1) // int(pageSize))
                            }
                        }
                        print(f"DHT11 sensor data received from fallback: {len(data_list)} records")
                    else:
                        print(f"Fallback API error: {fallback_response.text}")
                        sensor_data['dht11Data'] = {
                            'data': [],
                            'pagination': {'total': 0, 'page': page, 'pageSize': pageSize, 'totalPages': 0},
                            'error': f"Failed to fetch DHT11 sensor data: Status {dht11_response.status_code}"
                        }
            except Exception as e:
                print(f"Error fetching DHT11 sensor data: {str(e)}")
                print(f"Error type: {type(e).__name__}")
                print(f"Error details: {traceback.format_exc()}")
                sensor_data['dht11Data'] = {
                    'data': [],
                    'pagination': {'total': 0, 'page': page, 'pageSize': pageSize, 'totalPages': 0},
                    'error': f"Error fetching DHT11 sensor data: {str(e)}"
                }
            
            # Fetch sensor locations for filtering
            try:
                locations_api_url = f'{API_BASE_URL}/api/sensor/sensor-data/locations'
                print(f"Requesting sensor locations from: {locations_api_url}")
                locations_response = requests.get(locations_api_url, timeout=5)
                print(f"Locations API response status: {locations_response.status_code}")
                
                if locations_response.status_code == 200:
                    locations_data = locations_response.json()
                    print(f"Sensor locations received: {locations_data}")
                    
                    # Handle both array and object formats
                    if isinstance(locations_data, list):
                        # If API returns a simple array of locations, convert to the expected format
                        sensor_data['locations'] = {
                            'fireLocations': locations_data,
                            'smokeLocations': locations_data,
                            'dht11Locations': locations_data
                        }
                        print(f"Converted array of locations to object format")
                    else:
                        # Use the object format as is
                        sensor_data['locations'] = locations_data
                        print(f"Using object format for locations")
                else:
                    print(f"Locations API error: {locations_response.text}")
                    # Try to get locations from the individual sensor data endpoints
                    try:
                        fire_data = sensor_data.get('fireSensorData', {}).get('data', [])
                        smoke_data = sensor_data.get('smokeSensorData', {}).get('data', [])
                        dht11_data = sensor_data.get('dht11Data', {}).get('data', [])
                        
                        fire_locations = list(set([item.get('fire_loc') for item in fire_data if item.get('fire_loc')]))
                        smoke_locations = list(set([item.get('smoke_loc') for item in smoke_data if item.get('smoke_loc')]))
                        dht11_locations = list(set([item.get('dht11_loc') for item in dht11_data if item.get('dht11_loc')]))
                        
                        # Combine all locations into a single list to ensure we have all unique locations
                        all_locations = list(set(fire_locations + smoke_locations + dht11_locations))
                        
                        sensor_data['locations'] = {
                            'fireLocations': fire_locations,
                            'smokeLocations': smoke_locations,
                            'dht11Locations': dht11_locations,
                            # Add the combined list for compatibility with array format
                            'allLocations': all_locations
                        }
                        print(f"Generated locations from sensor data: {all_locations}")
                    except Exception as e:
                        print(f"Error generating locations from sensor data: {str(e)}")
                        print(f"Error type: {type(e).__name__}")
                        print(f"Error details: {traceback.format_exc()}")
                        sensor_data['locations'] = {
                            'fireLocations': [],
                            'smokeLocations': [],
                            'dht11Locations': []
                        }
            except Exception as e:
                print(f"Error fetching sensor locations: {str(e)}")
                print(f"Error type: {type(e).__name__}")
                print(f"Error details: {traceback.format_exc()}")
                sensor_data['locations'] = {
                    'fireLocations': [],
                    'smokeLocations': [],
                    'dht11Locations': []
                }
            
            # Emit sensor data to the client
            print(f"Emitting sensor data to client")
            socketio.emit('sensor_data', {
                'success': True,
                'data': sensor_data
            })
            print(f"Sensor data emitted successfully")
        except Exception as e:
            print(f"Error in handle_sensor_data_request: {str(e)}")
            print(f"Error type: {type(e).__name__}")
            print(f"Error details: {traceback.format_exc()}")
            socketio.emit('sensor_data', {
                'success': False,
                'error': f"Error fetching sensor data: {str(e)}"
            })

    @socketio.on('export_sensor_data')
    def handle_export_sensor_data(data):
        try:
            # Check if pandas and xlsxwriter are installed
            if not HAS_PANDAS or not HAS_XLSXWRITER:
                socketio.emit('export_sensor_data_response', {
                    'success': False,
                    'error': "Required libraries not installed: pandas and/or xlsxwriter. Please install them using 'pip install pandas xlsxwriter'."
                })
                return
            
            location = data.get('location', '')
            status = data.get('status', '')
            
            # Instead of using the combined endpoint, directly fetch from individual endpoints
            # This bypasses the issue with the combined endpoint returning empty data
            
            # Initialize data containers
            fire_data = []
            smoke_data = []
            dht11_data = []
            
            # Fetch fire sensor data directly
            try:
                # Try non-paginated endpoint first for exports
                fire_api_url = f'{API_BASE_URL}/api/sensor/sensor-data/fire'
                print(f"Fetching fire sensor data from: {fire_api_url}")
                fire_response = requests.get(fire_api_url, timeout=10)
                
                if fire_response.status_code == 200:
                    fire_data = fire_response.json()
                    if not fire_data and (location or status):
                        # If filters are applied and no data, try paginated endpoint
                        paginated_url = f'{API_BASE_URL}/api/sensor/sensor-data/fire/paginated?pageSize=1000'
                        if location:
                            paginated_url += f'&location={location}'
                        if status:
                            paginated_url += f'&status={status}'
                        
                        print(f"No data from non-paginated endpoint, trying: {paginated_url}")
                        paginated_response = requests.get(paginated_url, timeout=10)
                        
                        if paginated_response.status_code == 200:
                            paginated_data = paginated_response.json()
                            if isinstance(paginated_data, dict) and 'data' in paginated_data:
                                fire_data = paginated_data['data']
                    
                    # Apply filters manually if needed
                    if fire_data and (location or status):
                        filtered_data = []
                        for item in fire_data:
                            matches_location = True
                            matches_status = True
                            
                            if location and 'fire_loc' in item:
                                matches_location = item['fire_loc'] == location
                            
                            if status and 'fire_status' in item:
                                matches_status = item['fire_status'] == status
                            
                            if matches_location and matches_status:
                                filtered_data.append(item)
                        
                        fire_data = filtered_data
                
                print(f"Retrieved {len(fire_data)} fire sensor records for export")
            except Exception as e:
                print(f"Error fetching fire sensor data: {str(e)}")
                fire_data = []
            
            # Fetch smoke sensor data directly
            try:
                # Try non-paginated endpoint first for exports
                smoke_api_url = f'{API_BASE_URL}/api/sensor/sensor-data/smoke'
                print(f"Fetching smoke sensor data from: {smoke_api_url}")
                smoke_response = requests.get(smoke_api_url, timeout=10)
                
                if smoke_response.status_code == 200:
                    smoke_data = smoke_response.json()
                    if not smoke_data and (location or status):
                        # If filters are applied and no data, try paginated endpoint
                        paginated_url = f'{API_BASE_URL}/api/sensor/sensor-data/smoke/paginated?pageSize=1000'
                        if location:
                            paginated_url += f'&location={location}'
                        if status:
                            paginated_url += f'&status={status}'
                        
                        print(f"No data from non-paginated endpoint, trying: {paginated_url}")
                        paginated_response = requests.get(paginated_url, timeout=10)
                        
                        if paginated_response.status_code == 200:
                            paginated_data = paginated_response.json()
                            if isinstance(paginated_data, dict) and 'data' in paginated_data:
                                smoke_data = paginated_data['data']
                    
                    # Apply filters manually if needed
                    if smoke_data and (location or status):
                        filtered_data = []
                        for item in smoke_data:
                            matches_location = True
                            matches_status = True
                            
                            if location and 'smoke_loc' in item:
                                matches_location = item['smoke_loc'] == location
                            
                            if status and 'smoke_status' in item:
                                matches_status = item['smoke_status'] == status
                            
                            if matches_location and matches_status:
                                filtered_data.append(item)
                        
                        smoke_data = filtered_data
                
                print(f"Retrieved {len(smoke_data)} smoke sensor records for export")
            except Exception as e:
                print(f"Error fetching smoke sensor data: {str(e)}")
                smoke_data = []
            
            # Fetch DHT11 sensor data directly
            try:
                # Try non-paginated endpoint first for exports
                dht11_api_url = f'{API_BASE_URL}/api/sensor/sensor-data/dht11'
                print(f"Fetching DHT11 sensor data from: {dht11_api_url}")
                dht11_response = requests.get(dht11_api_url, timeout=10)
                
                if dht11_response.status_code == 200:
                    dht11_data = dht11_response.json()
                    if not dht11_data and (location or status):
                        # If filters are applied and no data, try paginated endpoint
                        paginated_url = f'{API_BASE_URL}/api/sensor/sensor-data/dht11/paginated?pageSize=1000'
                        if location:
                            paginated_url += f'&location={location}'
                        if status:
                            paginated_url += f'&status={status}'
                        
                        print(f"No data from non-paginated endpoint, trying: {paginated_url}")
                        paginated_response = requests.get(paginated_url, timeout=10)
                        
                        if paginated_response.status_code == 200:
                            paginated_data = paginated_response.json()
                            if isinstance(paginated_data, dict) and 'data' in paginated_data:
                                dht11_data = paginated_data['data']
                    
                    # Apply filters manually if needed
                    if dht11_data and (location or status):
                        filtered_data = []
                        for item in dht11_data:
                            matches_location = True
                            matches_status = True
                            
                            if location and 'dht11_loc' in item:
                                matches_location = item['dht11_loc'] == location
                            
                            if status and 'dht11_status' in item:
                                matches_status = item['dht11_status'] == status
                            
                            if matches_location and matches_status:
                                filtered_data.append(item)
                        
                        dht11_data = filtered_data
                
                print(f"Retrieved {len(dht11_data)} DHT11 sensor records for export")
            except Exception as e:
                print(f"Error fetching DHT11 sensor data: {str(e)}")
                dht11_data = []
            
            print(f"Total data for export: {len(fire_data)} fire records, {len(smoke_data)} smoke records, {len(dht11_data)} temperature records")
            
            try:
                # Create DataFrames for each sensor type
                fire_df = pd.DataFrame(fire_data) if fire_data else pd.DataFrame()
                smoke_df = pd.DataFrame(smoke_data) if smoke_data else pd.DataFrame()
                dht11_df = pd.DataFrame(dht11_data) if dht11_data else pd.DataFrame()
                
                # Create a BytesIO object to save the Excel file
                output = io.BytesIO()
                
                # Create Excel writer
                with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
                    # Write each DataFrame to a different sheet
                    if not fire_df.empty:
                        fire_df.to_excel(writer, sheet_name='Fire Sensors', index=False)
                    else:
                        # Create empty sheet with headers
                        pd.DataFrame(columns=['id', 'fire_id', 'fire_loc', 'fire_status', 'fire_value', 'created_at']).to_excel(
                            writer, sheet_name='Fire Sensors', index=False
                        )
                    
                    if not smoke_df.empty:
                        smoke_df.to_excel(writer, sheet_name='Smoke Sensors', index=False)
                    else:
                        # Create empty sheet with headers
                        pd.DataFrame(columns=['id', 'smoke_id', 'smoke_loc', 'smoke_status', 'smoke_value', 'created_at']).to_excel(
                            writer, sheet_name='Smoke Sensors', index=False
                        )
                    
                    if not dht11_df.empty:
                        dht11_df.to_excel(writer, sheet_name='Temperature Sensors', index=False)
                    else:
                        # Create empty sheet with headers
                        pd.DataFrame(columns=['id', 'dht11_id', 'dht11_loc', 'dht11_status', 'temperature', 'humidity', 'created_at']).to_excel(
                            writer, sheet_name='Temperature Sensors', index=False
                        )
                
                # Get the value of the BytesIO buffer
                excel_data = output.getvalue()
                
                # Encode the Excel file as base64
                encoded_excel = base64.b64encode(excel_data).decode('utf-8')
                
                # Create a data URL for the Excel file
                data_url = f"data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,{encoded_excel}"
                
                # Generate filename with timestamp
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f"sensor_data_export_{timestamp}.xlsx"
                
                print(f"Excel export successful, sending response with filename: {filename}")
                
                # Send the data URL back to the client
                socketio.emit('export_sensor_data_response', {
                    'success': True,
                    'filename': filename,
                    'data_url': data_url
                })
            except Exception as e:
                print(f"Error creating Excel file: {str(e)}")
                traceback.print_exc()
                socketio.emit('export_sensor_data_response', {
                    'success': False,
                    'error': f"Error creating Excel file: {str(e)}"
                })
        except Exception as e:
            print(f"Error in export sensor data: {str(e)}")
            traceback.print_exc()
            socketio.emit('export_sensor_data_response', {
                'success': False,
                'error': f"Error creating Excel file: {str(e)}"
            })

    @socketio.on('request_alert_logs')
    def handle_request_alert_logs(data):
        """
        Handle request for fire alert logs with pagination and filtering
        """
        try:
            print(f"Received request_alert_logs with data: {data}")
            
            # Extract pagination parameters
            page = data.get('page', 1)
            page_size = data.get('pageSize', 10)
            filters = data.get('filters', {})
            
            # Extract status filter if provided
            status_filter = filters.get('status', '')
            
            # Extract search parameters if provided
            search_params = filters.get('search', {})
            search_term = search_params.get('term', '')
            search_field = search_params.get('field', 'location')
            
            # Build API URL with query parameters
            api_url = f'{API_BASE_URL}/api/fire-alert/logs?page={page}&pageSize={page_size}'
            
            # Add status filter if provided
            if status_filter:
                api_url += f'&status={status_filter}'
                
            # Add search parameters if provided
            if search_term:
                api_url += f'&searchTerm={search_term}&searchField={search_field}'
                print(f"Adding search filter: {search_term} in field: {search_field}")
                
            print(f"Fetching alert logs from API: {api_url}")
            
            # Make API request
            response = requests.get(api_url)
            
            if response.status_code == 200:
                api_data = response.json()
                logs = api_data.get('data', [])
                pagination = api_data.get('pagination', {})
                
                print(f"Retrieved {len(logs)} alert logs from API")
                
                # If the API doesn't support search or returned no results with search params,
                # implement client-side filtering
                if search_term and len(logs) == 0:
                    print(f"No results found with search parameters, trying client-side filtering")
                    
                    # Make a new request without search parameters to get all data
                    base_url = f'{API_BASE_URL}/api/fire-alert/logs?page=1&pageSize=100'
                    if status_filter:
                        base_url += f'&status={status_filter}'
                        
                    base_response = requests.get(base_url)
                    
                    if base_response.status_code == 200:
                        base_data = base_response.json()
                        all_logs = base_data.get('data', [])
                        
                        # Apply client-side filtering
                        filtered_logs = []
                        for log in all_logs:
                            # Convert search term and field value to lowercase for case-insensitive comparison
                            term_lower = search_term.lower()
                            
                            # Handle different search fields
                            if search_field == 'location':
                                field_value = str(log.get('location', '') or log.get('fire_loc', '') or 
                                                log.get('smoke_loc', '') or log.get('dht11_loc', '')).lower()
                                if term_lower in field_value:
                                    filtered_logs.append(log)
                                    
                            elif search_field == 'id':
                                # Check if search term is in alert_log_id
                                alert_id = str(log.get('alert_log_id', '')).lower()
                                if term_lower in alert_id:
                                    filtered_logs.append(log)
                                    
                            elif search_field == 'date':
                                # Check if search term is in formatted_date or created_at
                                date_value = str(log.get('formatted_date', '') or log.get('created_at', '')).lower()
                                if term_lower in date_value:
                                    filtered_logs.append(log)
                        
                        # Update logs and pagination
                        logs = filtered_logs
                        
                        # Calculate new pagination values
                        total_items = len(filtered_logs)
                        total_pages = max(1, (total_items + page_size - 1) // page_size)
                        
                        # Get the current page of results
                        start_idx = (page - 1) * page_size
                        end_idx = min(start_idx + page_size, total_items)
                        logs = filtered_logs[start_idx:end_idx]
                        
                        pagination = {
                            'total': total_items,
                            'page': page,
                            'pageSize': page_size,
                            'totalPages': total_pages
                        }
                        
                        print(f"Client-side filtering found {total_items} results, showing page {page} with {len(logs)} items")
                
                # Process each log to ensure proper field mapping
                for log in logs:
                    # Debug log data
                    print(f"Processing log: {log}")
                    
                    # Map backend alert_status to frontend status field
                    if 'alert_status' in log:
                        log['status'] = log['alert_status']
                    
                    # Ensure camera_id is properly set
                    if 'camera_id' not in log or not log['camera_id']:
                        # Try to get camera ID from other fields
                        camera_id = log.get('camera', log.get('camera_name', ''))
                        if not camera_id and 'detection' in log:
                            # Try to get camera from detection object if present
                            camera_id = log['detection'].get('camera_id', '')
                        log['camera_id'] = camera_id or 'Camera 1'  # Default to Camera 1 if not found
                    
                    # Format date and time for display
                    timestamp = None
                    # Try different timestamp fields
                    for field in ['created_at', 'timestamp', 'alert_timestamp', 'detection_time']:
                        if field in log and log[field]:
                            timestamp = log[field]
                            break
                    
                    if timestamp:
                        try:
                            # Parse the timestamp
                            if isinstance(timestamp, str):
                                from datetime import datetime
                                # Handle different timestamp formats
                                if 'T' in timestamp:
                                    # ISO format
                                    dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                                elif ' ' in timestamp:
                                    # Space-separated format
                                    dt = datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S')
                                else:
                                    # Try simple format
                                    dt = datetime.strptime(timestamp, '%Y-%m-%d')
                                
                                log['formatted_date'] = dt.strftime('%Y-%m-%d')
                                log['formatted_time'] = dt.strftime('%H:%M:%S')
                                print(f"Formatted timestamp: {log['formatted_date']} {log['formatted_time']}")
                        except Exception as e:
                            print(f"Error parsing timestamp: {e}")
                            # Fallback to raw values
                            log['formatted_date'] = timestamp.split('T')[0] if 'T' in timestamp else timestamp
                            log['formatted_time'] = timestamp.split('T')[1].split('.')[0] if 'T' in timestamp else ''
                    else:
                        # No timestamp found, use current time as fallback
                        from datetime import datetime
                        now = datetime.now()
                        log['formatted_date'] = now.strftime('%Y-%m-%d')
                        log['formatted_time'] = now.strftime('%H:%M:%S')
                        print(f"No timestamp found, using current time: {log['formatted_date']} {log['formatted_time']}")
                
                # Send response to client
                socketio.emit('fire_alert_logs', {
                    'success': True,
                    'logs': logs,
                    'pagination': pagination
                })
                print(f"Emitted fire_alert_logs event with {len(logs)} logs")
            else:
                print(f"API error: {response.status_code}, {response.text[:100]}")
                socketio.emit('fire_alert_logs', {
                    'success': False,
                    'error': f"API error: {response.status_code}"
                })
        
        except Exception as e:
            print(f"Error in handle_request_alert_logs: {str(e)}")
            socketio.emit('fire_alert_logs', {
                'success': False,
                'error': str(e)
            })

    @socketio.on('check_active_fire_alerts')
    def handle_check_active_fire_alerts():
        try:
            # Get dashboard data which includes active alerts count
            api_url = f'{API_BASE_URL}/api/fire-alert/dashboard'
            
            response = requests.get(api_url)
            if response.status_code == 200:
                dashboard_data = response.json()
                active_alerts = dashboard_data.get('activeAlerts', 0)
                latest_alerts = dashboard_data.get('latestAlerts', [])
                
                # If there are active alerts, send them to the client
                if active_alerts > 0 and latest_alerts:
                    # Format the latest active alert for display
                    latest_alert = latest_alerts[0]
                    
                    # Get location information
                    location = ''
                    if latest_alert.get('fire_loc'):
                        location = latest_alert.get('fire_loc')
                    elif latest_alert.get('smoke_loc'):
                        location = latest_alert.get('smoke_loc')
                    elif latest_alert.get('dht11_loc'):
                        location = latest_alert.get('dht11_loc')
                    
                    socketio.emit('active_fire_alert', {
                        'active': True,
                        'count': active_alerts,
                        'alert_id': latest_alert.get('alert_log_id', ''),
                        'location': location,
                        'message': f"FIRE IS DETECTED! Fire detected in {location}. Immediate action required."
                    })
                else:
                    socketio.emit('active_fire_alert', {
                        'active': False,
                        'count': 0
                    })
            else:
                print(f"Failed to fetch fire alert dashboard: {response.status_code}")
        except Exception as e:
            print(f"Error checking active fire alerts: {str(e)}")
            traceback.print_exc()

    @socketio.on('request_camera_detections')
    def handle_camera_detections_request(data):
        try:
            print(f"Received camera detection request with parameters: {data}")
            # Get parameters from request data
            limit = data.get('limit', 20)
            status = data.get('status')
            
            # Convert empty string status to None for proper handling
            if status == "":
                status = None
                
            # Initialize response data
            detections = []
            
            try:
                # Determine which endpoint to use based on status
                if status == 'Active':
                    # For Active status, use the active endpoint
                    api_url = f'{API_BASE_URL}/api/camera-detection/active?limit={limit}'
                else:
                    api_url = f'{API_BASE_URL}/api/camera-detection/recent?limit={limit}'
                
                print(f"Making API request to: {api_url}")
                
                # Add timeout to prevent long waits
                response = requests.get(api_url, timeout=5)
                print(f"API response status: {response.status_code}")
                
                if response.status_code == 200:
                    # Get the response data
                    detections = response.json()
                    
                    # If the response is not a list, check if it's in a data property
                    if not isinstance(detections, list) and isinstance(detections, dict):
                        detections = detections.get('data', [])
                    
                    # Ensure detections is a list
                    if not isinstance(detections, list):
                        detections = []
                    
                    # Format the data for the client
                    for detection in detections:
                        # Ensure detection_timestamp exists
                        if 'detection_timestamp' not in detection and 'created_at' in detection:
                            detection['detection_timestamp'] = detection['created_at']
                        
                        # Ensure detection_status exists and set correctly
                        if 'detection_status' not in detection:
                            # For active endpoint, all items are Active
                            if status == 'Active' or api_url.endswith('/active'):
                                detection['detection_status'] = 'Active'
                            else:
                                detection['detection_status'] = 'Resolved'
                        
                        # Ensure image_path is properly formatted
                        if 'image_path' in detection and detection['image_path']:
                            if detection['image_path'].startswith('/uploads'):
                                detection['image_path'] = f"http://127.0.0.1:3000{detection['image_path']}"
                    
                    # Apply server-side filtering for Resolved status
                    if status == 'Resolved':
                        detections = [d for d in detections if d.get('detection_status') == 'Resolved']
                    
                    print(f"Successfully retrieved {len(detections)} camera detections")
                else:
                    print(f"API returned non-200 status: {response.status_code}")
                    print(f"Response content: {response.text[:100]}...")
                    socketio.emit('camera_detections', [])
                    return
                    
            except requests.exceptions.RequestException as e:
                print(f"Request exception: {str(e)}")
                socketio.emit('camera_detections', [])
                return
            
            # Emit the data to the client
            socketio.emit('camera_detections', detections)
            
        except Exception as e:
            print(f"Error in handle_camera_detections_request: {str(e)}")
            socketio.emit('camera_detections', [])

    @socketio.on('resolve_fire_alert')
    def handle_resolve_fire_alert(data):
        try:
            alert_id = data.get('alert_id')  # Using alert_id as in the frontend
            
            if not alert_id:
                socketio.emit('resolve_alert_response', {
                    'success': False,
                    'alert_id': alert_id,
                    'error': 'Alert ID is required'
                })
                return
            
            print(f"Resolving fire alert with ID: {alert_id}")
            
            # Call the API to update the alert status
            api_url = f'{API_BASE_URL}/api/fire-alert/logs/{alert_id}/status'
            print(f"Making PUT request to: {api_url}")
            
            # Log the request payload for debugging
            request_payload = {'status': 'Resolved'}
            print(f"Request payload: {request_payload}")
            
            response = requests.put(
                api_url, 
                json=request_payload,
                headers={'Content-Type': 'application/json'}
            )
            
            print(f"Response status code: {response.status_code}")
            print(f"Response content: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"Alert {alert_id} successfully resolved: {result}")
                
                socketio.emit('resolve_alert_response', {
                    'success': True,
                    'alert_id': alert_id,
                    'message': f"Alert #{alert_id} has been "
                })
                
                # Also emit an event to update active fire alerts count
                socketio.emit('active_fire_alert', {
                    'hasActiveAlert': False,
                    'count': 0
                })
            else:
                error_message = f"Failed to resolve alert: HTTP {response.status_code}"
                print(error_message)
                print(f"Response content: {response.text}")
                socketio.emit('resolve_alert_response', {
                    'success': False,
                    'alert_id': alert_id,
                    'error': error_message
                })
        except Exception as e:
            print(f"Error resolving fire alert: {str(e)}")
            traceback.print_exc()
            socketio.emit('resolve_alert_response', {
                'success': False,
                'alert_id': data.get('alert_id'),
                'error': str(e)
            })
