from flask import session, send_file
import requests
from datetime import datetime, timedelta
import os
import json
import pandas as pd
from io import BytesIO
import base64
import traceback

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
        admin_id = user.get('id') or user.get('admin_id')
        
        if admin_id:
            try:
                # Use the correct profile endpoint with type=admin query parameter
                response = requests.get(f'http://localhost:3000/api/profile?id={admin_id}&type=admin')
                
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
                all_users_response = requests.get('http://localhost:3000/api/users/count')
                if all_users_response.status_code == 200:
                    all_users_count = all_users_response.json().get('count', 0)
            except Exception as e:
                print(f"Error fetching all users count: {str(e)}")
            
            try:
                # Get new users (registered this week)
                new_users_response = requests.get(f'http://localhost:3000/api/users/count/new?since={one_week_ago.strftime("%Y-%m-%d")}')
                if new_users_response.status_code == 200:
                    new_users_count = new_users_response.json().get('count', 0)
            except Exception as e:
                print(f"Error fetching new users count: {str(e)}")
            
            try:
                # Get pending users
                pending_users_response = requests.get('http://localhost:3000/api/approval/pending')
                if pending_users_response.status_code == 200:
                    pending_users = pending_users_response.json()
            except Exception as e:
                print(f"Error fetching pending users: {str(e)}")
            
            try:
                # Get all users to count approved users
                all_users_list_response = requests.get('http://localhost:3000/api/users')
                if all_users_list_response.status_code == 200:
                    all_users_list = all_users_list_response.json()
                    all_users_count = len(all_users_list)
                    approved_users = [u for u in all_users_list if u.get('status') == 'approved' or u.get('is_approved') == True]
                    approved_users_count = len(approved_users)
            except Exception as e:
                print(f"Error fetching all users list: {str(e)}")
                
                # Try alternate endpoint for approved users
                try:
                    approved_users_response = requests.get('http://localhost:3000/api/users/approved')
                    if approved_users_response.status_code == 200:
                        approved_users = approved_users_response.json()
                        approved_users_count = len(approved_users)
                except Exception as e:
                    print(f"Error fetching approved users: {str(e)}")
            
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
                        response = requests.get(f'http://localhost:3000/api/history/approval/admin/{user_id}')
                    else:
                        response = requests.get('http://localhost:3000/api/history/approval')
                    
                    if response.status_code == 200:
                        history_data = response.json()
                except Exception as e:
                    print(f"Error fetching admin history data: {str(e)}")
            else:
                # Regular user history view - filtered by user ID
                try:
                    if user_id:
                        response = requests.get(f'http://localhost:3000/api/history/approval/user/{user_id}')
                        
                        if response.status_code == 200:
                            history_data = response.json()
                except Exception as e:
                    print(f"Error fetching user history data: {str(e)}")
            
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
                test_response = requests.get('http://localhost:3000/api/sensor/sensor-data/fire', timeout=5)
                print(f"Test API connection status: {test_response.status_code}")
                if test_response.status_code == 200:
                    print("Node.js API server is accessible")
                else:
                    print(f"Node.js API server returned error: {test_response.text}")
            except Exception as e:
                print(f"Error connecting to Node.js API server: {str(e)}")
            
            # Fetch fire sensor data
            try:
                fire_api_url = f'http://localhost:3000/api/sensor/sensor-data/fire/paginated?page={page}&pageSize={pageSize}' + \
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
                    fallback_url = 'http://localhost:3000/api/sensor/sensor-data/fire'
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
                sensor_data['fireSensorData'] = {
                    'data': [],
                    'pagination': {'total': 0, 'page': page, 'pageSize': pageSize, 'totalPages': 0},
                    'error': f"Error fetching fire sensor data: {str(e)}"
                }
            
            # Fetch smoke sensor data
            try:
                smoke_api_url = f'http://localhost:3000/api/sensor/sensor-data/smoke/paginated?page={page}&pageSize={pageSize}' + \
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
                    fallback_url = 'http://localhost:3000/api/sensor/sensor-data/smoke'
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
                sensor_data['smokeSensorData'] = {
                    'data': [],
                    'pagination': {'total': 0, 'page': page, 'pageSize': pageSize, 'totalPages': 0},
                    'error': f"Error fetching smoke sensor data: {str(e)}"
                }
            
            # Fetch DHT11 sensor data
            try:
                dht11_api_url = f'http://localhost:3000/api/sensor/sensor-data/dht11/paginated?page={page}&pageSize={pageSize}' + \
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
                    fallback_url = 'http://localhost:3000/api/sensor/sensor-data/dht11'
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
                sensor_data['dht11Data'] = {
                    'data': [],
                    'pagination': {'total': 0, 'page': page, 'pageSize': pageSize, 'totalPages': 0},
                    'error': f"Error fetching DHT11 sensor data: {str(e)}"
                }
            
            # Fetch sensor locations for filtering
            try:
                locations_api_url = 'http://localhost:3000/api/sensor/sensor-data/locations'
                print(f"Requesting sensor locations from: {locations_api_url}")
                locations_response = requests.get(locations_api_url, timeout=5)
                print(f"Locations API response status: {locations_response.status_code}")
                
                if locations_response.status_code == 200:
                    sensor_data['locations'] = locations_response.json()
                    print(f"Sensor locations received")
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
                        
                        sensor_data['locations'] = {
                            'fireLocations': fire_locations,
                            'smokeLocations': smoke_locations,
                            'dht11Locations': dht11_locations
                        }
                        print(f"Generated locations from sensor data")
                    except Exception as e:
                        print(f"Error generating locations from sensor data: {str(e)}")
                        sensor_data['locations'] = {
                            'fireLocations': [],
                            'smokeLocations': [],
                            'dht11Locations': []
                        }
            except Exception as e:
                print(f"Error fetching sensor locations: {str(e)}")
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
            socketio.emit('sensor_data', {
                'success': False,
                'error': f"Error fetching sensor data: {str(e)}"
            })

    @socketio.on('export_sensor_data')
    def handle_export_sensor_data(data):
        try:
            print(f"Received export sensor data request with parameters: {data}")
            # Get parameters from request data
            location = data.get('location')
            status = data.get('status')
            
            # Initialize response data
            sensor_data = {}
            
            # Fetch fire sensor data
            try:
                fire_url = 'http://localhost:3000/api/sensor/sensor-data/fire'
                if location:
                    fire_url += f'?location={location}'
                if status:
                    fire_url += f'{"&" if location else "?"}status={status}'
                
                print(f"Fetching fire sensor data from: {fire_url}")
                fire_response = requests.get(fire_url)
                if fire_response.status_code == 200:
                    fire_data = fire_response.json()
                    print(f"Fire sensor data sample (first item): {fire_data[0] if fire_data else 'No data'}")
                    sensor_data['fireSensorData'] = {
                        'data': fire_data,
                        'pagination': {
                            'total': len(fire_data),
                            'page': 1,
                            'pageSize': len(fire_data),
                            'totalPages': 1
                        }
                    }
            except Exception as e:
                print(f"Error fetching fire sensor data for export: {str(e)}")
                traceback.print_exc()
                sensor_data['fireSensorData'] = {'data': [], 'pagination': {'total': 0, 'page': 1, 'pageSize': 0, 'totalPages': 0}}
            
            # Fetch smoke sensor data
            try:
                smoke_url = 'http://localhost:3000/api/sensor/sensor-data/smoke'
                if location:
                    smoke_url += f'?location={location}'
                if status:
                    smoke_url += f'{"&" if location else "?"}status={status}'
                
                print(f"Fetching smoke sensor data from: {smoke_url}")
                smoke_response = requests.get(smoke_url)
                if smoke_response.status_code == 200:
                    smoke_data = smoke_response.json()
                    print(f"Smoke sensor data sample (first item): {smoke_data[0] if smoke_data else 'No data'}")
                    sensor_data['smokeSensorData'] = {
                        'data': smoke_data,
                        'pagination': {
                            'total': len(smoke_data),
                            'page': 1,
                            'pageSize': len(smoke_data),
                            'totalPages': 1
                        }
                    }
            except Exception as e:
                print(f"Error fetching smoke sensor data for export: {str(e)}")
                traceback.print_exc()
                sensor_data['smokeSensorData'] = {'data': [], 'pagination': {'total': 0, 'page': 1, 'pageSize': 0, 'totalPages': 0}}
            
            # Fetch DHT11 sensor data
            try:
                dht11_url = 'http://localhost:3000/api/sensor/sensor-data/dht11'
                if location:
                    dht11_url += f'?location={location}'
                if status:
                    dht11_url += f'{"&" if location else "?"}status={status}'
                
                print(f"Fetching DHT11 sensor data from: {dht11_url}")
                dht11_response = requests.get(dht11_url)
                if dht11_response.status_code == 200:
                    dht11_data = dht11_response.json()
                    print(f"DHT11 sensor data sample (first item): {dht11_data[0] if dht11_data else 'No data'}")
                    sensor_data['dht11Data'] = {
                        'data': dht11_data,
                        'pagination': {
                            'total': len(dht11_data),
                            'page': 1,
                            'pageSize': len(dht11_data),
                            'totalPages': 1
                        }
                    }
            except Exception as e:
                print(f"Error fetching DHT11 sensor data for export: {str(e)}")
                traceback.print_exc()
                sensor_data['dht11Data'] = {'data': [], 'pagination': {'total': 0, 'page': 1, 'pageSize': 0, 'totalPages': 0}}
            
            try:
                # Extract data for each sensor type
                fire_data = sensor_data.get('fireSensorData', {}).get('data', [])
                smoke_data = sensor_data.get('smokeSensorData', {}).get('data', [])
                dht11_data = sensor_data.get('dht11Data', {}).get('data', [])
                
                # Debug the structure of the first item in each data set
                if fire_data:
                    print(f"Fire data keys: {fire_data[0].keys()}")
                if smoke_data:
                    print(f"Smoke data keys: {smoke_data[0].keys()}")
                if dht11_data:
                    print(f"DHT11 data keys: {dht11_data[0].keys()}")
                
                # Create simple DataFrames with only the data we need
                fire_rows = []
                for item in fire_data:
                    # Debug each item's structure
                    print(f"Processing fire item: {item}")
                    fire_rows.append({
                        'Sensor ID': item.get('fire_id', ''),
                        'Location': item.get('fire_loc', ''),
                        'Status': item.get('fire_status', ''),
                        'Timestamp': item.get('fire_timestamp', '')
                    })
                
                smoke_rows = []
                for item in smoke_data:
                    # Debug each item's structure
                    print(f"Processing smoke item: {item}")
                    smoke_rows.append({
                        'Sensor ID': item.get('smoke_id', ''),
                        'Location': item.get('smoke_loc', ''),
                        'Status': item.get('smoke_status', ''),
                        'Timestamp': item.get('smoke_timestamp', '')
                    })
                
                dht11_rows = []
                for item in dht11_data:
                    # Debug each item's structure
                    print(f"Processing DHT11 item: {item}")
                    # Check if temperature and humidity fields exist in the API response
                    temperature = ''
                    humidity = ''
                    # Try to find temperature and humidity fields with different possible names
                    if 'temperature' in item:
                        temperature = item['temperature']
                    elif 'dht11_temperature' in item:
                        temperature = item['dht11_temperature']
                    
                    if 'humidity' in item:
                        humidity = item['humidity']
                    elif 'dht11_humidity' in item:
                        humidity = item['dht11_humidity']
                    
                    dht11_rows.append({
                        'Sensor ID': item.get('dht11_id', ''),
                        'Location': item.get('dht11_loc', ''),
                        'Status': item.get('dht11_status', ''),
                        'Timestamp': item.get('dht11_timestamp', '')
                    })
                
                # Create DataFrames from the extracted data
                fire_df = pd.DataFrame(fire_rows)
                smoke_df = pd.DataFrame(smoke_rows)
                dht11_df = pd.DataFrame(dht11_rows)
                
                # Debug the DataFrames
                print(f"Fire DataFrame columns: {fire_df.columns.tolist()}")
                print(f"Fire DataFrame sample:\n{fire_df.head()}")
                
                print(f"Smoke DataFrame columns: {smoke_df.columns.tolist()}")
                print(f"Smoke DataFrame sample:\n{smoke_df.head()}")
                
                print(f"DHT11 DataFrame columns: {dht11_df.columns.tolist()}")
                print(f"DHT11 DataFrame sample:\n{dht11_df.head()}")
                
                # Generate filename with timestamp
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"sensor_data_export_{timestamp}.xlsx"
                
                # Create a BytesIO object to save the Excel file
                excel_file = BytesIO()
                
                # Create Excel writer
                with pd.ExcelWriter(excel_file, engine='xlsxwriter') as writer:
                    # Write each DataFrame to a different sheet
                    if not fire_df.empty:
                        fire_df.to_excel(writer, sheet_name='Flame Detectors', index=False)
                    else:
                        pd.DataFrame(columns=['Sensor ID', 'Location', 'Status', 'Timestamp']).to_excel(
                            writer, sheet_name='Flame Detectors', index=False)
                    
                    if not smoke_df.empty:
                        smoke_df.to_excel(writer, sheet_name='Smoke Detectors', index=False)
                    else:
                        pd.DataFrame(columns=['Sensor ID', 'Location', 'Status', 'Timestamp']).to_excel(
                            writer, sheet_name='Smoke Detectors', index=False)
                    
                    if not dht11_df.empty:
                        dht11_df.to_excel(writer, sheet_name='Temperature Sensors', index=False)
                    else:
                        pd.DataFrame(columns=['Sensor ID', 'Location', 'Temperature', 'Humidity', 'Status', 'Timestamp']).to_excel(
                            writer, sheet_name='Temperature Sensors', index=False)
                
                # Get the Excel data
                excel_file.seek(0)
                
                # Convert to base64 for direct download
                excel_base64 = base64.b64encode(excel_file.getvalue()).decode('utf-8')
                data_url = f"data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,{excel_base64}"
                
                # Emit success response with data URL
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
            print(f"Error exporting sensor data: {str(e)}")
            traceback.print_exc()
            socketio.emit('export_sensor_data_response', {
                'success': False,
                'error': f"Error exporting sensor data: {str(e)}"
            })

    @socketio.on('request_alert_logs')
    def handle_alert_logs_request(data):
        try:
            # Mock alert logs for now - in a real application, you would fetch this from a database
            alert_logs = [
                {
                    'id': 1,
                    'type': 'fire',
                    'level': 'high',
                    'message': 'Potential fire detected in Area A',
                    'timestamp': (datetime.now() - timedelta(minutes=30)).strftime('%Y-%m-%d %H:%M:%S')
                },
                {
                    'id': 2,
                    'type': 'smoke',
                    'level': 'medium',
                    'message': 'Elevated smoke levels in Area B',
                    'timestamp': (datetime.now() - timedelta(hours=2)).strftime('%Y-%m-%d %H:%M:%S')
                }
            ]
            
            # Emit alert logs to the client
            socketio.emit('alert_logs', {
                'success': True,
                'logs': alert_logs
            })
        except Exception as e:
            socketio.emit('alert_logs', {
                'success': False,
                'error': f"Error fetching alert logs: {str(e)}"
            })
