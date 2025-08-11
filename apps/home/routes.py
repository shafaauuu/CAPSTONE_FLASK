from flask import render_template, request, session, flash, redirect, url_for, jsonify, Response, send_file
import requests
import traceback
from datetime import datetime, timedelta
import os
import json
from io import BytesIO
import base64

from apps.home import blueprint
from apps.authentication.routes import login_required
from jinja2 import TemplateNotFound
from apps.config import Config

# Use API_BASE_URL from Config class
API_BASE_URL = Config.API_BASE_URL

# Import fire detector
from fire_detector import initialize_detector, generate_frames

@blueprint.route('/index')
@login_required
def index():
    user = session.get('user', {})
    
    # Ensure user data has necessary fields
    user_id = None
    user_email = None
    user_name = None
    
    # Try to get user ID from various possible keys
    for id_key in ['id', 'user_id', 'admin_id', 'npk', 'ID']:
        if id_key in user and user[id_key]:
            user_id = user[id_key]
            break
            
    # Try to get user email from various possible keys
    for email_key in ['email', 'user_email', 'admin_email', 'mail']:
        if email_key in user and user[email_key]:
            user_email = user[email_key]
            break
            
    # Try to get user name from various possible keys
    for name_key in ['name', 'user_name', 'admin_name', 'username', 'full_name', 'display_name']:
        if name_key in user and user[name_key]:
            user_name = user[name_key]
            break
    
    # Fallback to session values if not found in user dictionary
    if not user_id:
        user_id = session.get('id') or session.get('user_id') or session.get('admin_id') or 'N/A'
    if not user_email:
        user_email = session.get('email') or session.get('user_email') or 'N/A'
    if not user_name:
        user_name = session.get('name') or session.get('user_name') or session.get('username') or 'User'
    
    # Ensure npk, email, and name are in the user dictionary
    user['npk'] = user_id
    user['email'] = user_email
    user['name'] = user_name
    
    # Create a basic profile object for the template
    profile_data = {
        'npk': user_id,
        'email': user_email,
        'name': user_name,
        'department_name': 'N/A',
        'division_name': 'N/A',
        'role_name': user.get('type', 'User'),
        'plant_name': 'N/A',
        'created_at': user.get('created_at', 'N/A')
    }
    
    return render_template('home/index.html',
                           segment='index',
                           user=user,
                           profile=profile_data)

@blueprint.route('/dashboard_admin')
@login_required
def dashboard_admin_redirect():
    return redirect(url_for('home_blueprint.dashboard_admin'))

@blueprint.route('/dashboard-admin')
@login_required
def dashboard_admin():
    # Get user data from session
    user = session.get('user', {})
    
    # Get admin ID for API calls
    admin_id = user.get('id') or user.get('admin_id')
    
    if admin_id:
        try:
            # Use the correct profile endpoint with type=admin query parameter
            response = requests.get(f'{API_BASE_URL}/api/profile?id={admin_id}&type=admin')
            
            if response.status_code == 200:
                admin_data = response.json()
                print("Admin data from API:", admin_data)
                
                # Update user data with fetched admin information
                if admin_data.get('admin_name'):
                    user['name'] = admin_data.get('admin_name')
                    print(f"Updated username to '{user['name']}' from admin_name")
                
                # Save updated user data back to session
                session['user'] = user
                print("Updated user data in session:", user)
            else:
                print(f"Failed to fetch admin data: Status code {response.status_code}")
                # Fallback to Admin 1 if API fails
                user['name'] = "Admin 1"
                session['user'] = user
        except Exception as e:
            print(f"Error fetching admin data: {str(e)}")
            # Fallback to Admin 1 if exception
            user['name'] = "Admin 1"
            session['user'] = user
    else:
        # No admin ID, fallback to Admin 1
        user['name'] = "Admin 1"
        session['user'] = user
    
    # Create a basic profile object for the template
    profile_data = {
        'npk': user.get('id') or user.get('npk') or user.get('admin_id'),
        'email': user.get('email'),
        'name': user.get('name'),
        'department_name': admin_data.get('department_name') if 'admin_data' in locals() and admin_data.get('department_name') else 'N/A',
        'division_name': admin_data.get('division_name') if 'admin_data' in locals() and admin_data.get('division_name') else 'N/A',
        'role_name': admin_data.get('role_name') if 'admin_data' in locals() and admin_data.get('role_name') else 'Admin',
        'plant_name': admin_data.get('plant_name') if 'admin_data' in locals() and admin_data.get('plant_name') else 'N/A',
        'created_at': user.get('created_at', 'N/A')
    }
    
    # Get real data for dashboard
    try:
        # Calculate date range (current week instead of current month)
        today = datetime.now()
        one_week_ago = today - timedelta(days=7)
        date_range = f"{one_week_ago.strftime('%b %d')} - {today.strftime('%b %d')}"
        
        import requests
        
        try:
            # Get all users count
            all_users_response = requests.get(f'{API_BASE_URL}/api/users/count')
            if all_users_response.status_code == 200:
                all_users_count = all_users_response.json().get('count', 0)
                print(f"API response for all users: {all_users_response.json()}")
            else:
                print(f"Failed to get all users count. Status: {all_users_response.status_code}")
                all_users_count = 0
            
            # Get new users (registered this week instead of this month)
            new_users_response = requests.get(f'{API_BASE_URL}/api/users/count/new?since={one_week_ago.strftime("%Y-%m-%d")}')
            if new_users_response.status_code == 200:
                new_users_count = new_users_response.json().get('count', 0)
                print(f"API response for new users (past week): {new_users_response.json()}")
            else:
                print(f"Failed to get new users count. Status: {new_users_response.status_code}")
                new_users_count = 0
            
            # Get remaining users to approve
            pending_users_response = requests.get(f'{API_BASE_URL}/api/approval/pending')
            if pending_users_response.status_code == 200:
                pending_users = pending_users_response.json()
                print(f"API received {len(pending_users)} pending users")
            else:
                print(f"Failed to get pending users. Status: {pending_users_response.status_code}")
                pending_users = []
            pending_users_count = len(pending_users)
            
            # Try to get a direct count of ALL users (regardless of status)
            try:
                # Try to get all users directly first
                all_users_list_response = requests.get(f'{API_BASE_URL}/api/users')
                if all_users_list_response.status_code == 200:
                    all_users_list = all_users_list_response.json()
                    direct_all_users_count = len(all_users_list)
                    print(f"Directly fetched ALL users count: {direct_all_users_count}")
                    
                    # This is the most reliable count, so use it
                    all_users_count = direct_all_users_count
                    
                    # Also count approved users while we're at it
                    approved_users = [u for u in all_users_list if u.get('status') == 'approved' or u.get('is_approved') == True]
                    approved_users_count = len(approved_users)
                    print(f"Counted {approved_users_count} approved users from all users list")
                else:
                    print(f"Failed to get all users list. Status: {all_users_list_response.status_code}")
                    
                    # Continue with our existing approved users fetch if this fails
                    # Get approved users
                    try:
                        # Try the standard endpoint first
                        approved_users_response = requests.get(f'{API_BASE_URL}/api/users/approved')
                        if approved_users_response.status_code == 200:
                            approved_users = approved_users_response.json()
                            approved_users_count = len(approved_users)
                            print(f"API received {approved_users_count} approved users")
                        else:
                            print(f"Failed to get approved users. Status: {approved_users_response.status_code}")
                            approved_users_count = 0
                    except Exception as e:
                        print(f"Error fetching approved users: {e}")
                        approved_users_count = 0
                        
                    # Calculate total users as the sum of pending and approved users
                    calculated_total = pending_users_count + approved_users_count
                    print(f"Calculated total: {calculated_total} (pending: {pending_users_count} + approved: {approved_users_count})")
                    
                    # Hard-override the all_users_count with our calculation
                    all_users_count = calculated_total
            except Exception as e:
                print(f"Error trying to fetch all users directly: {e}")
                # Fall back to previously calculated values
                pass
            
            print(f"Final all_users_count: {all_users_count}")
            
            # Calculate activation rate (approved users / total signups)
            activation_rate = (approved_users_count / all_users_count * 100) if all_users_count > 0 else 0
            
            # Get newest users for the table (this will be loaded via JavaScript)
            newest_users = pending_users[:5] if pending_users else []

            if all_users_count < 10:
                print("Using sample data for demonstration purposes, but keeping actual pending count")
                # Keep the actual pending_users_count from the API
                actual_pending = pending_users_count
                
                # Only adjust the total and approved counts
                all_users_count = actual_pending + 10  # Add 10 approved users to the actual pending count
                approved_users_count = 10
                
                # Also provide sample data for new users if it's zero
                if new_users_count == 0:
                    new_users_count = 3  # Show at least 3 new users for demo purposes
                    print(f"Setting new_users_count to {new_users_count} for demonstration")
                
                activation_rate = (approved_users_count / all_users_count * 100) if all_users_count > 0 else 0
                
                # Ensure we keep the original pending count
                pending_users_count = actual_pending
                
                print(f"Final counts: all={all_users_count}, pending={pending_users_count}, approved={approved_users_count}, new={new_users_count}")
            
            dashboard_data = {
                'all_users_count': all_users_count,
                'new_users_count': new_users_count,
                'pending_users_count': pending_users_count,
                'approved_users_count': approved_users_count,  # Add this for debugging
                'activation_rate': round(activation_rate, 2),
                'date_range': date_range,
                'newest_users': newest_users
            }
            
            print(f"Final dashboard data: {dashboard_data}")
        
        except Exception as e:
            print(f"Error fetching dashboard data: {e}")
            # Fallback to default values if API calls fail
            dashboard_data = {
                'all_users_count': 0,
                'new_users_count': 0,
                'pending_users_count': 0,
                'activation_rate': 0,
                'date_range': 'N/A',
                'newest_users': []
            }
        
        # Check if this is an AJAX request
        is_ajax = request.args.get('ajax', 'false') == 'true'
        
        if is_ajax:
            # Return JSON response for AJAX requests
            return jsonify(dashboard_data)
        
        # Return normal HTML template for non-AJAX requests
        return render_template('home/dashboard_admin.html',
                              segment='admin',
                              user=user,
                              profile=profile_data,
                              dashboard=dashboard_data)

    except Exception as e:
        print(f"Error in dashboard_admin route: {str(e)}")
        return render_template('home/page-500.html', msg=str(e)), 500

@blueprint.route('/dashboard')
@login_required
def dashboard():
    user = session.get('user', {})
    
    # Ensure user data has necessary fields
    user_id = None
    user_email = None
    user_name = None
    
    # Try to get user ID from various possible keys
    for id_key in ['id', 'user_id', 'admin_id', 'npk', 'ID']:
        if id_key in user and user[id_key]:
            user_id = user[id_key]
            break
            
    # Try to get user email from various possible keys
    for email_key in ['email', 'user_email', 'admin_email', 'mail']:
        if email_key in user and user[email_key]:
            user_email = user[email_key]
            break
            
    # Try to get user name from various possible keys
    for name_key in ['name', 'user_name', 'admin_name', 'username', 'full_name', 'display_name']:
        if name_key in user and user[name_key]:
            user_name = user[name_key]
            break
    
    # Fallback to session values if not found in user dictionary
    if not user_id:
        user_id = session.get('id') or session.get('user_id') or session.get('admin_id') or 'N/A'
    if not user_email:
        user_email = session.get('email') or session.get('user_email') or 'N/A'
    if not user_name:
        user_name = session.get('name') or session.get('user_name') or session.get('username') or 'User'
    
    # Ensure npk, email, and name are in the user dictionary
    user['npk'] = user_id
    user['email'] = user_email
    user['name'] = user_name
    
    # Create a basic profile object for the template
    profile_data = {
        'npk': user_id,
        'email': user_email,
        'name': user_name,
        'department_name': 'N/A',
        'division_name': 'N/A',
        'role_name': user.get('type', 'User'),
        'plant_name': 'N/A',
        'created_at': user.get('created_at', 'N/A')
    }
    
    return render_template('home/dashboard.html',
                           segment='dashboard',
                           user=user,
                           profile=profile_data)

@blueprint.route('/data_sensor')
@login_required
def data_sensor():
    user = session.get('user', {})
    
    # Ensure user data has necessary fields
    user_id = None
    user_email = None
    user_name = None
    
    # Try to get user ID from various possible keys
    for id_key in ['id', 'user_id', 'admin_id', 'npk', 'ID']:
        if id_key in user and user[id_key]:
            user_id = user[id_key]
            break
            
    # Try to get user email from various possible keys
    for email_key in ['email', 'user_email', 'admin_email', 'mail']:
        if email_key in user and user[email_key]:
            user_email = user[email_key]
            break
            
    # Try to get user name from various possible keys
    for name_key in ['name', 'user_name', 'admin_name', 'username', 'full_name', 'display_name']:
        if name_key in user and user[name_key]:
            user_name = user[name_key]
            break
    
    # Fallback to session values if not found in user dictionary
    if not user_id:
        user_id = session.get('id') or session.get('user_id') or session.get('admin_id') or 'N/A'
    if not user_email:
        user_email = session.get('email') or session.get('user_email') or 'N/A'
    if not user_name:
        user_name = session.get('name') or session.get('user_name') or session.get('username') or 'User'
    
    # Ensure npk, email, and name are in the user dictionary
    user['npk'] = user_id
    user['email'] = user_email
    user['name'] = user_name
    
    # Create a basic profile object for the template
    profile_data = {
        'npk': user_id,
        'email': user_email,
        'name': user_name,
        'department_name': 'N/A',
        'division_name': 'N/A',
        'role_name': user.get('type', 'User'),
        'plant_name': 'N/A',
        'created_at': user.get('created_at', 'N/A')
    }
    
    return render_template('home/data_sensor.html',
                           segment='data_sensor',
                           user=user,
                           profile=profile_data)

@blueprint.route('/alert-logs')
@login_required
def alert_logs():
    user = session.get('user', {})
    
    # Ensure user data has necessary fields
    user_id = None
    user_email = None
    user_name = None
    
    # Try to get user ID from various possible keys
    for id_key in ['id', 'user_id', 'admin_id', 'npk', 'ID']:
        if id_key in user and user[id_key]:
            user_id = user[id_key]
            break
            
    # Try to get user email from various possible keys
    for email_key in ['email', 'user_email', 'admin_email', 'mail']:
        if email_key in user and user[email_key]:
            user_email = user[email_key]
            break
            
    # Try to get user name from various possible keys
    for name_key in ['name', 'user_name', 'admin_name', 'username', 'full_name', 'display_name']:
        if name_key in user and user[name_key]:
            user_name = user[name_key]
            break
    
    # Fallback to session values if not found in user dictionary
    if not user_id:
        user_id = session.get('id') or session.get('user_id') or session.get('admin_id') or 'N/A'
    if not user_email:
        user_email = session.get('email') or session.get('user_email') or 'N/A'
    if not user_name:
        user_name = session.get('name') or session.get('user_name') or session.get('username') or 'User'
    
    # Ensure npk, email, and name are in the user dictionary
    user['npk'] = user_id
    user['email'] = user_email
    user['name'] = user_name
    
    # Create a basic profile object for the template
    profile_data = {
        'npk': user_id,
        'email': user_email,
        'name': user_name,
        'department_name': 'N/A',
        'division_name': 'N/A',
        'role_name': user.get('type', 'User'),
        'plant_name': 'N/A',
        'created_at': user.get('created_at', 'N/A')
    }
    
    return render_template('home/alert-logs.html',
                           segment='alert-logs',
                           user=user,
                           profile=profile_data)

@blueprint.route('/settings')
@login_required
def profile():
    try:
        # Debugging setup
        import sys
        import traceback

        print("==== STARTING SETTINGS PAGE RENDER ====")
        user = session.get('user', {})
        print("User session data:", user)

        # Check if the user data exists
        if not user:
            print("No user data found in session")
            flash('No user data found. Please log in again.', 'danger')
            return redirect(url_for('authentication_blueprint.login'))

        # Print the entire user dictionary to debug
        print("Complete user dictionary:", user)
        
        # Determine user ID and other info - More comprehensive approach
        user_id = None
        user_name = None
        user_email = None
        
        # Try all possible session keys for user ID
        for id_key in ['id', 'user_id', 'admin_id', 'npk', 'ID']:
            if id_key in user and user[id_key]:
                user_id = user[id_key]
                print(f"Found user ID in key '{id_key}': {user_id}")
                break
                
        # Try all possible session keys for user name
        for name_key in ['name', 'user_name', 'admin_name', 'username', 'full_name', 'display_name']:
            if name_key in user and user[name_key]:
                user_name = user[name_key]
                print(f"Found user name in key '{name_key}': {user_name}")
                break
                
        # Try all possible session keys for user email
        for email_key in ['email', 'user_email', 'admin_email', 'mail']:
            if email_key in user and user[email_key]:
                user_email = user[email_key]
                print(f"Found user email in key '{email_key}': {user_email}")
                break
        
        # Fallback to direct session values if not found in user dictionary
        if not user_id:
            user_id = session.get('id') or session.get('user_id') or session.get('admin_id') or 'N/A'
        if not user_name:
            user_name = session.get('name') or session.get('user_name') or session.get('username') or 'User'
        if not user_email:
            user_email = session.get('email') or session.get('user_email') or 'N/A'

        if not user_id or user_id == 'N/A':
            print("No user ID found in session")
            flash('User ID not found. Please log in again.', 'danger')
            return redirect(url_for('authentication_blueprint.login'))

        # Set user type (default to 'user')
        user_type = user.get('type', 'user')

        # Authorization token setup
        token = user.get('token')
        headers = {'Authorization': f'Bearer {token}'} if token else {}
        if not token:
            print("Warning: No auth token found in session")

        # Default fallback profile
        default_profile = {
            'department_name': 'N/A',
            'division_name': 'N/A',
            'role_name': user.get('type', 'User'),
            'plant_name': 'N/A',
            'created_at': user.get('created_at', 'N/A'),
            'npk': user_id,
            'name': user_name,
            'email': user_email
        }

        profile_data = default_profile  # Initialize with default

        # Try to fetch profile data from API
        try:
            api_url = f'{API_BASE_URL}/api/profile'
            params = {'id': user_id, 'type': user_type}
            print(f"Requesting profile: {api_url}, params: {params}, headers: {{'Authorization': 'Bearer ***' if token else 'None'}}")

            response = requests.get(api_url, params=params, headers=headers, timeout=3)
            print("API response status:", response.status_code)
            print("API response body:", response.text)

            if response.status_code < 400:
                try:
                    api_profile = response.json()
                    if isinstance(api_profile, dict):
                        # Merge API profile with default, keeping default values if API doesn't provide them
                        profile_data = {**default_profile, **api_profile}
                        print("Using API profile data")
                    else:
                        print("API returned non-dict profile data:", api_profile)
                except Exception as json_error:
                    print("Error parsing API response:", str(json_error))
            else:
                print("API returned error status:", response.status_code)
        except Exception as api_error:
            print("Error fetching profile from API:", str(api_error))
            
        # Fetch dropdown data from API for form population
        try:
            # Get plants
            plants_response = requests.get(f'{API_BASE_URL}/api/lookup/plants')
            plants_data = plants_response.json().get('data', []) if plants_response.status_code == 200 else []
            
            # Get departments
            departments_response = requests.get(f'{API_BASE_URL}/api/lookup/departments')
            departments_data = departments_response.json().get('data', []) if departments_response.status_code == 200 else []
            
            # Get divisions
            divisions_response = requests.get(f'{API_BASE_URL}/api/lookup/divisions')
            divisions_data = divisions_response.json().get('data', []) if divisions_response.status_code == 200 else []
            
            # Get roles
            roles_response = requests.get(f'{API_BASE_URL}/api/lookup/roles')
            roles_data = roles_response.json().get('data', []) if roles_response.status_code == 200 else []
            
            # Add dropdown data to profile data
            profile_data['plants'] = plants_data
            profile_data['departments'] = departments_data
            profile_data['divisions'] = divisions_data
            profile_data['roles'] = roles_data
            
        except requests.exceptions.RequestException as e:
            print("Error fetching dropdown data:", str(e))
            # Continue without dropdown data

        # Prepare user data for the template
        user = {}
        user['name'] = profile_data['name']
        user['npk'] = profile_data['npk']
        user['email'] = profile_data['email']
        
        print("Final user data for template:", user)

        try:
            print("About to render template...")
            rendered = render_template(
                'home/settings.html',
                segment='settings',
                user=user,
                profile=profile_data
            )
            print("Template rendered successfully")
            return rendered
        except Exception as template_error:
            print("ERROR RENDERING TEMPLATE:")
            traceback.print_exc(file=sys.stdout)
            error_msg = f"Template rendering error: {str(template_error)}"
            return render_template('home/page-500.html', msg=error_msg), 500

    except Exception as e:
        print("UNEXPECTED ERROR IN PROFILE ROUTE:")
        traceback.print_exc(file=sys.stdout)
        error_msg = f"Unexpected error: {str(e)}"
        return render_template('home/page-500.html', msg=error_msg), 500

@blueprint.route('/reset-password')
@login_required
def reset_password():
    # Get user info from session - use the same approach as in the profile route
    user_session = session.get('user', {})
    
    # Initialize user dictionary
    user = {}
    
    # Try to get user name from various possible keys in the user dictionary
    user_name = None
    for name_key in ['name', 'user_name', 'admin_name', 'username', 'full_name', 'display_name']:
        if name_key in user_session and user_session[name_key]:
            user_name = user_session[name_key]
            break
    
    # Fallback to direct session values if not found in user dictionary
    if not user_name:
        user_name = session.get('name') or session.get('user_name') or session.get('username') or 'User'
    
    # Set user data
    user['name'] = user_name
    user['role'] = user_session.get('type') or session.get('role', 'user')
    user['npk'] = user_session.get('id') or session.get('npk') or session.get('user_id') or session.get('admin_id', 'N/A')
    user['email'] = user_session.get('email') or session.get('email') or session.get('user_email', 'N/A')

    # Get profile data from API
    api_url = API_BASE_URL + '/api/profile'
    if user['role'] == 'admin':
        api_url += '/admin/' + str(user['npk'])
    else:
        api_url += '/user/' + str(user['npk'])

    params = {}
    headers = {}
    token = user_session.get('token') or session.get('token')
    if token:
        headers = {'Authorization': f'Bearer {token}'}

    try:
        response = requests.get(api_url, params=params, headers=headers, timeout=3)
        if response.status_code == 200:
            profile_data = response.json().get('data', {})
        else:
            profile_data = {}
    except Exception as e:
        print(f"Error fetching profile data: {str(e)}")
        profile_data = {}

    # Ensure we have the user data in profile_data
    profile_data['name'] = user['name']
    profile_data['npk'] = user['npk']
    profile_data['email'] = user['email']
    profile_data['role'] = user['role']

    return render_template('home/page-reset-password.html', 
                          segment='reset-password',
                          user=user,
                          profile=profile_data)

# Admin routes for user approval management
@blueprint.route('/admin/users/pending')
@login_required
def admin_pending_users():
    return render_template('home/users.html', segment='admin_pending_users')

@blueprint.route('/admin/users/approved')
@login_required
def admin_approved_users():
    return render_template('home/users.html', segment='admin_approved_users')

# User management route - direct access to the users page
@blueprint.route('/users')
@login_required
def users():
    return render_template('home/users.html', segment='users')

@blueprint.route('/history')
@login_required
def history():
    # Get user information from session
    user = session.get('user', {})
    
    # Ensure user data has necessary fields
    user_id = None
    user_email = None
    user_name = None
    
    # Try to get user ID from various possible keys
    for id_key in ['id', 'user_id', 'admin_id', 'npk', 'ID']:
        if id_key in user and user[id_key]:
            user_id = user[id_key]
            break
            
    # Try to get user email from various possible keys
    for email_key in ['email', 'user_email', 'admin_email', 'mail']:
        if email_key in user and user[email_key]:
            user_email = user[email_key]
            break
            
    # Try to get user name from various possible keys
    for name_key in ['name', 'user_name', 'admin_name', 'username', 'full_name', 'display_name']:
        if name_key in user and user[name_key]:
            user_name = user[name_key]
            break
    
    # Fallback to session values if not found in user dictionary
    if not user_id:
        user_id = session.get('id') or session.get('user_id') or session.get('admin_id') or 'N/A'
    if not user_email:
        user_email = session.get('email') or session.get('user_email') or 'N/A'
    if not user_name:
        user_name = session.get('name') or session.get('user_name') or session.get('username') or 'User'
    
    # For history page, prepare the user data
    user_data = {
        'id': user_id if user_id is not None else 'N/A',
        'email': user_email if user_email is not None else 'N/A',
        'name': user_name if user_name is not None else 'User',
        'is_admin': bool(user.get('type') == 'admin' or user.get('role') == 'admin')
    }
    
    return render_template('home/history.html', 
                           segment='history',
                           user=user_data)

@blueprint.route('/detections')
@login_required
def detections():
    """
    Render the detections page for viewing all camera detection events
    """
    print("Checking login, session user:", session.get('user'))
    
    # Get user information from session
    user = session.get('user', {})
    
    # Initialize variables
    user_id = None
    user_email = None
    user_name = None
    
    # Try to get user ID from various possible keys
    for id_key in ['id', 'user_id', 'admin_id', 'npk', 'ID']:
        if id_key in user and user[id_key]:
            user_id = user[id_key]
            break
            
    # Try to get user email from various possible keys
    for email_key in ['email', 'user_email', 'admin_email', 'mail']:
        if email_key in user and user[email_key]:
            user_email = user[email_key]
            break
            
    # Try to get user name from various possible keys
    for name_key in ['name', 'user_name', 'admin_name', 'username', 'full_name', 'display_name']:
        if name_key in user and user[name_key]:
            user_name = user[name_key]
            break
    
    # Fallback to session values if not found in user dictionary
    if not user_id:
        user_id = session.get('id') or session.get('user_id') or session.get('admin_id') or 'N/A'
    if not user_email:
        user_email = session.get('email') or session.get('user_email') or 'N/A'
    if not user_name:
        user_name = session.get('name') or session.get('user_name') or session.get('username') or 'User'
    
    # Create a user object that matches what the template expects
    user_obj = {
        'id': user_id,
        'email': user_email,
        'name': user_name,
        'role': session.get('role', 'user')
    }
    
    # Prepare data for the template
    context = {
        'segment': 'detections',
        'user': user_obj,  # Add the complete user object
        'user_id': user_id,
        'user_email': user_email,
        'user_name': user_name,
        'page_title': 'Camera Detections'
    }
    
    return render_template('home/detections.html', **context)

# API proxy routes to connect to Node.js backend
@blueprint.route('/api/history', methods=['GET'])
@login_required
def api_history():
    try:
        # Your Node.js backend URL - update this with your actual backend URL
        backend_url = f'{API_BASE_URL}/api/history'
        response = requests.get(backend_url)
        return response.json(), response.status_code
    except Exception as e:
        print(f"Error in API proxy /api/history: {str(e)}")
        return {"error": str(e)}, 500

@blueprint.route('/api/history/approval', methods=['GET'])
@login_required
def api_history_approval():
    try:
        # Node.js backend URL
        backend_url = f'{API_BASE_URL}/api/history/approval'
        response = requests.get(backend_url)
        return response.json(), response.status_code
    except Exception as e:
        print(f"Error in API proxy /api/history/approval: {str(e)}")
        return {"error": str(e)}, 500

@blueprint.route('/api/history/approval/admin/<admin_id>', methods=['GET'])
@login_required
def api_history_approval_admin(admin_id):
    try:
        #  Node.js backend URL
        backend_url = f'{API_BASE_URL}/api/history/approval/admin/{admin_id}'
        response = requests.get(backend_url)
        return response.json(), response.status_code
    except Exception as e:
        print(f"Error in API proxy /api/history/approval/admin/{admin_id}: {str(e)}")
        return {"error": str(e)}, 500

@blueprint.route('/api/history/approval/user/<user_id>', methods=['GET'])
@login_required
def api_history_approval_user(user_id):
    try:
        # Node.js backend URL
        backend_url = f'{API_BASE_URL}/api/history/approval/user/{user_id}'
        response = requests.get(backend_url)
        return response.json(), response.status_code
    except Exception as e:
        print(f"Error in API proxy /api/history/approval/user/{user_id}: {str(e)}")
        return {"error": str(e)}, 500

@blueprint.route('/search')
@login_required
def search():
    user = session.get('user', {})
    query = request.args.get('q', '')
    
    # Ensure user data has necessary fields (reusing code pattern from other routes)
    user_id = None
    user_email = None
    user_name = None
    
    # Try to get user ID from various possible keys
    for id_key in ['id', 'user_id', 'admin_id', 'npk', 'ID']:
        if id_key in user and user[id_key]:
            user_id = user[id_key]
            break
            
    # Try to get user email from various possible keys
    for email_key in ['email', 'user_email', 'admin_email', 'mail']:
        if email_key in user and user[email_key]:
            user_email = user[email_key]
            break
            
    # Try to get user name from various possible keys
    for name_key in ['name', 'user_name', 'admin_name', 'username', 'full_name', 'display_name']:
        if name_key in user and user[name_key]:
            user_name = user[name_key]
            break
    
    # Fallback to session values if not found in user dictionary
    if not user_id:
        user_id = session.get('id') or session.get('user_id') or session.get('admin_id') or 'N/A'
    if not user_email:
        user_email = session.get('email') or session.get('user_email') or 'N/A'
    if not user_name:
        user_name = session.get('name') or session.get('user_name') or session.get('username') or 'User'
    
    # Ensure npk, email, and name are in the user dictionary
    user['npk'] = user_id
    user['email'] = user_email
    user['name'] = user_name
    
    # Create a basic profile object for the template
    profile_data = {
        'npk': user_id,
        'email': user_email,
        'name': user_name,
        'department_name': 'N/A',
        'division_name': 'N/A',
        'role_name': user.get('type', 'User'),
        'plant_name': 'N/A',
        'created_at': user.get('created_at', 'N/A')
    }
    
    # Initialize search results
    search_results = []
    
    # Only search if a query is provided
    if query:
        try:
            # Use the unified search endpoint from the Node.js backend
            response = requests.get(f'{API_BASE_URL}/api/search', params={'q': query})
            
            if response.status_code == 200:
                search_data = response.json()
                
                # Extract the results from the response
                if 'results' in search_data:
                    search_results = search_data['results']
                    # The results are already in the correct format from the backend
                else:
                    # Handle case where results might be directly in the response
                    search_results = search_data
                    
            else:
                flash(f"Error during search: Server returned status {response.status_code}", "error")
                
        except Exception as e:
            error_message = str(e)
            print(f"Error during search: {error_message}")
            flash(f"Error during search: {error_message}", "error")
            traceback.print_exc()
    
    return render_template('home/search_results.html',
                           segment='search',
                           user=user,
                           profile=profile_data,
                           query=query,
                           results=search_results)

@blueprint.route('/video_feed')
@login_required
def video_feed():
    """Video streaming route. Put this in the src attribute of an img tag"""
    # Get camera source from request args, default to 0 (webcam)
    camera_source = request.args.get('camera', '0')
    
    # If camera_source is a number, convert to int
    if camera_source.isdigit():
        camera_source = int(camera_source)
    
    return Response(
        generate_frames(camera_source=camera_source),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )

@blueprint.route('/download/sensor_data/<filename>')
@login_required
def download_sensor_data(filename):
    try:
        # Get the base64 encoded data from session
        if 'excel_exports' in session and filename in session['excel_exports']:
            excel_data_base64 = session['excel_exports'][filename]
            
            # Decode base64 to binary
            excel_data = base64.b64decode(excel_data_base64)
            
            # Create BytesIO object
            excel_file = BytesIO(excel_data)
            excel_file.seek(0)
            
            # Send the file to the client
            return send_file(
                excel_file,
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                as_attachment=True,
                download_name=filename
            )
        else:
            flash('Export file not found or expired. Please try exporting again.', 'error')
            return redirect(url_for('home_blueprint.data_sensor'))
    except Exception as e:
        print(f"Error downloading sensor data export: {str(e)}")
        traceback.print_exc()
        flash('Error downloading export file. Please try again.', 'error')
        return redirect(url_for('home_blueprint.data_sensor'))

@blueprint.route('/initialize_fire_detector')
@login_required
def init_fire_detector():
    """Initialize the fire detector model"""
    try:
        # Setup model directory
        model_dir = os.path.join(os.path.abspath(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'models', 'fire_detector')
        os.makedirs(model_dir, exist_ok=True)
        
        # Path to the model file
        model_path = os.path.join(model_dir, 'best.pt')
        
        # Check if model exists
        if not os.path.exists(model_path):
            return jsonify({
                'status': 'error',
                'message': f'Model file not found at {model_path}. Please upload your model file.'
            }), 404
        
        # Initialize the detector
        detector = initialize_detector(model_path=model_path)
        
        # Return success
        return jsonify({
            'status': 'success',
            'message': 'Fire detector initialized successfully'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Failed to initialize fire detector: {str(e)}',
            'error': traceback.format_exc()
        }), 500

# API proxy for profile update
@blueprint.route('/api/profile/user/<user_id>', methods=['PUT'])
@login_required
def api_profile_update_user(user_id):
    try:
        # Get the request data
        data = request.json
        
        # Get token from session
        token = session.get('token')
        headers = {'Authorization': f'Bearer {token}'} if token else {}
        headers['Content-Type'] = 'application/json'
        
        # Forward the request to the backend API
        api_url = f'{API_BASE_URL}/api/profile/user/{user_id}'
        print(f"Forwarding profile update to: {api_url}")
        print(f"Request data: {data}")
        
        response = requests.put(api_url, json=data, headers=headers)
        
        # Return the response from the backend API
        return jsonify(response.json()), response.status_code
    except Exception as e:
        print("Error in profile update:", str(e))
        return jsonify({"error": str(e)}), 500

# API proxy for admin profile update
@blueprint.route('/api/profile/admin/<admin_id>', methods=['PUT'])
@login_required
def api_profile_update_admin(admin_id):
    try:
        # Get the request data
        data = request.json
        
        # Get token from session
        token = session.get('token')
        headers = {'Authorization': f'Bearer {token}'} if token else {}
        headers['Content-Type'] = 'application/json'
        
        # Forward the request to the backend API
        api_url = f'{API_BASE_URL}/api/profile/admin/{admin_id}'
        print(f"Forwarding admin profile update to: {api_url}")
        print(f"Request data: {data}")
        
        response = requests.put(api_url, json=data, headers=headers)
        
        # Return the response from the backend API
        return jsonify(response.json()), response.status_code
    except Exception as e:
        print("Error in admin profile update:", str(e))
        return jsonify({"error": str(e)}), 500

# Camera Detection API endpoints
@blueprint.route('/api/camera-detection', methods=['POST'])
def api_camera_detection_create():
    """
    Endpoint to receive fire detection data from fire_detector.py
    and forward it to the actual backend API
    """
    try:
        # Get data from request
        data = request.json
        
        if not data:
            return jsonify({
                'success': False,
                'message': 'No data provided'
            }), 400
            
        # Extract required fields
        image = data.get('image')
        confidence = data.get('confidence')
        location = data.get('location')
        timestamp = data.get('timestamp')
        
        if not location:
            return jsonify({
                'success': False,
                'message': 'Camera location is required'
            }), 400
            
        if not image:
            return jsonify({
                'success': False,
                'message': 'Image data is required'
            }), 400
            
        print(f"Received fire detection from {location} with confidence {confidence}")
        
        # Format the payload for the backend API
        payload = {
            'imageData': image,  # This is already base64 encoded from fire_detector.py
            'cameraLocation': location,
            'confidenceScore': confidence,
            'timestamp': timestamp or datetime.now().isoformat()
        }
        
        # Forward the request to the actual backend API
        response = requests.post(
            f"{API_BASE_URL}/api/camera-detection",
            json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        # Check response
        if response.status_code == 200:
            print('Successfully stored fire detection in database')
            response_data = response.json()
            return jsonify({
                'success': True,
                'message': 'Fire detection recorded successfully',
                'detectionId': response_data.get('detectionId') or response_data.get('detection_id'),
                'imagePath': response_data.get('imagePath') or response_data.get('image_path')
            })
        else:
            print(f"Error from backend API: {response.status_code} - {response.text}")
            return jsonify({
                'success': False,
                'error': f"Backend API error: {response.text}"
            }), response.status_code
            
    except Exception as e:
        print(f"Exception in api_camera_detection_create: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@blueprint.route('/api/camera-detection/active', methods=['GET'])
def api_camera_detection_active():
    """
    Endpoint to get active camera detections
    """
    try:
        # Get query parameters
        limit = request.args.get('limit', 10, type=int)
        
        # Forward the request to the actual API endpoint
        response = requests.get(
            f"{API_BASE_URL}/api/camera-detection/active?limit={limit}",
            timeout=10
        )
        
        if response.status_code == 200:
            # Ensure all items have detection_status set to Active
            data = response.json()
            if isinstance(data, list):
                for item in data:
                    item['detection_status'] = 'Active'
            return jsonify(data)
        else:
            return jsonify({
                'success': False,
                'error': f"Backend API error: {response.text}"
            }), response.status_code
            
    except Exception as e:
        print(f"Exception in api_camera_detection_active: {str(e)}")
        traceback.print_exc()
        return jsonify([])

@blueprint.route('/api/camera-detection/recent', methods=['GET'])
def api_camera_detection_recent():
    """
    Endpoint to get recent camera detections
    """
    try:
        # Get query parameters
        limit = request.args.get('limit', 20, type=int)
        
        # Forward the request to the actual API endpoint
        response = requests.get(
            f"{API_BASE_URL}/api/camera-detection/recent?limit={limit}",
            timeout=10
        )
        
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({
                'success': False,
                'error': f"Backend API error: {response.text}"
            }), response.status_code
            
    except Exception as e:
        print(f"Exception in api_camera_detection_recent: {str(e)}")
        traceback.print_exc()
        return jsonify([])

@blueprint.route('/api/camera-detection/locations', methods=['GET'])
def api_camera_detection_locations():
    """
    Endpoint to get camera detection locations
    """
    try:
        # Forward the request to get recent detections to extract locations
        response = requests.get(
            f"{API_BASE_URL}/api/camera-detection/recent?limit=50",
            timeout=10
        )
        
        if response.status_code == 200:
            detections = response.json()
            
            # Extract unique locations
            location_set = set()
            if isinstance(detections, list):
                for detection in detections:
                    if detection.get('camera_location'):
                        location_set.add(detection['camera_location'])
            
            # Convert to list
            locations = list(location_set)
            
            # If no locations found, return sample ones
            if not locations:
                return jsonify([
                    "Main Building",
                    "Warehouse A",
                    "Office Floor 1",
                    "Office Floor 2",
                    "Parking Lot",
                    "Cafeteria"
                ])
            else:
                return jsonify(locations)
        else:
            # Return sample locations as fallback
            return jsonify([
                "Main Building",
                "Warehouse A",
                "Office Floor 1",
                "Office Floor 2",
                "Parking Lot",
                "Cafeteria"
            ])
            
    except Exception as e:
        print(f"Exception in api_camera_detection_locations: {str(e)}")
        traceback.print_exc()
        # Return sample locations as fallback
        return jsonify([
            "Main Building",
            "Warehouse A",
            "Office Floor 1",
            "Office Floor 2",
            "Parking Lot",
            "Cafeteria"
        ])

@blueprint.route('/api/camera-detection/id/<detection_id>', methods=['GET'])
def api_camera_detection_details(detection_id):
    """
    Endpoint to get details of a specific camera detection
    """
    try:
        # Forward the request to the actual API endpoint
        response = requests.get(
            f"{API_BASE_URL}/api/camera-detection/id/{detection_id}",
            timeout=10
        )
        
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({
                'success': False,
                'error': f"Backend API error: {response.text}"
            }), response.status_code
            
    except Exception as e:
        print(f"Exception in api_camera_detection_details: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@blueprint.route('/api/profile/user/<user_id>/reset-password', methods=['PUT'])
@login_required
def api_profile_reset_password_user(user_id):
    """
    Proxy endpoint to forward password reset requests to the backend API
    """
    try:
        # Get the request data
        data = request.json
        
        # Get token from session
        token = session.get('token')
        headers = {'Authorization': f'Bearer {token}'} if token else {}
        headers['Content-Type'] = 'application/json'
        
        # Forward the request to the actual backend API
        api_url = f"{API_BASE_URL}/api/profile/user/{user_id}/reset-password"
        print(f"Forwarding password reset to: {api_url}")
        print(f"Request data: {data}")
        
        # Make the request to the backend API
        response = requests.put(api_url, json=data, headers=headers)
        
        # Return the response from the backend API
        return jsonify(response.json()), response.status_code
        
    except Exception as e:
        print(f"Error in password reset proxy: {str(e)}")
        return jsonify({'success': False, 'message': f'Error: {str(e)}'}), 500

@blueprint.route('/api/profile/admin/<admin_id>/reset-password', methods=['PUT'])
@login_required
def api_profile_reset_password_admin(admin_id):
    """
    Proxy endpoint to forward admin password reset requests to the backend API
    """
    try:
        # Get the request data
        data = request.json
        
        # Get token from session
        token = session.get('token')
        headers = {'Authorization': f'Bearer {token}'} if token else {}
        headers['Content-Type'] = 'application/json'
        
        # Forward the request to the actual backend API
        api_url = f"{API_BASE_URL}/api/profile/admin/{admin_id}/reset-password"
        print(f"Forwarding admin password reset to: {api_url}")
        print(f"Request data: {data}")
        
        # Make the request to the backend API
        response = requests.put(api_url, json=data, headers=headers)
        
        # Return the response from the backend API
        return jsonify(response.json()), response.status_code
        
    except Exception as e:
        print(f"Error in admin password reset proxy: {str(e)}")
        return jsonify({'success': False, 'message': f'Error: {str(e)}'}), 500

@blueprint.route('/api/sensor/sensor-data/all')
def api_sensor_data_all():
    """
    Endpoint to get all sensor data (fire, smoke, dht11) for export
    """
    try:
        # Get query parameters
        page_size = request.args.get('pageSize', '1000')  # Default to 1000 for exports
        location = request.args.get('location', '')
        status = request.args.get('status', '')
        
        print(f"Fetching all sensor data for export with pageSize={page_size}, location={location}, status={status}")
        
        # Initialize response data
        all_sensor_data = {}
        
        # Fetch fire sensor data - try non-paginated endpoint first for exports
        try:
            # For exports, try to get all data without pagination first
            fire_api_url = f'{API_BASE_URL}/api/sensor/sensor-data/fire'
            if location or status:
                # If filters are applied, use the paginated endpoint with filters
                fire_api_url = f'{API_BASE_URL}/api/sensor/sensor-data/fire/paginated?pageSize={page_size}'
                if location:
                    fire_api_url += f'&location={location}'
                if status:
                    fire_api_url += f'&status={status}'
            
            print(f"Fetching fire sensor data from: {fire_api_url}")
            fire_response = requests.get(fire_api_url, timeout=10)
            
            if fire_response.status_code == 200:
                fire_data = fire_response.json()
                
                # Handle both paginated and non-paginated responses
                if isinstance(fire_data, dict) and 'data' in fire_data:
                    # Paginated response
                    all_sensor_data['fireSensorData'] = fire_data
                else:
                    # Non-paginated response (array)
                    all_sensor_data['fireSensorData'] = {
                        'data': fire_data,
                        'pagination': {
                            'total': len(fire_data),
                            'page': 1,
                            'pageSize': int(page_size),
                            'totalPages': 1
                        }
                    }
                print(f"Retrieved {len(all_sensor_data['fireSensorData']['data'])} fire sensor records")
            else:
                print(f"Fire sensor API request failed with status code: {fire_response.status_code}")
                all_sensor_data['fireSensorData'] = {
                    'data': [],
                    'pagination': {'total': 0, 'page': 1, 'pageSize': int(page_size), 'totalPages': 0}
                }
        except Exception as e:
            print(f"Error fetching fire sensor data: {str(e)}")
            all_sensor_data['fireSensorData'] = {
                'data': [],
                'pagination': {'total': 0, 'page': 1, 'pageSize': int(page_size), 'totalPages': 0}
            }
        
        # Fetch smoke sensor data - try non-paginated endpoint first for exports
        try:
            # For exports, try to get all data without pagination first
            smoke_api_url = f'{API_BASE_URL}/api/sensor/sensor-data/smoke'
            if location or status:
                # If filters are applied, use the paginated endpoint with filters
                smoke_api_url = f'{API_BASE_URL}/api/sensor/sensor-data/smoke/paginated?pageSize={page_size}'
                if location:
                    smoke_api_url += f'&location={location}'
                if status:
                    smoke_api_url += f'&status={status}'
            
            print(f"Fetching smoke sensor data from: {smoke_api_url}")
            smoke_response = requests.get(smoke_api_url, timeout=10)
            
            if smoke_response.status_code == 200:
                smoke_data = smoke_response.json()
                
                # Handle both paginated and non-paginated responses
                if isinstance(smoke_data, dict) and 'data' in smoke_data:
                    # Paginated response
                    all_sensor_data['smokeSensorData'] = smoke_data
                else:
                    # Non-paginated response (array)
                    all_sensor_data['smokeSensorData'] = {
                        'data': smoke_data,
                        'pagination': {
                            'total': len(smoke_data),
                            'page': 1,
                            'pageSize': int(page_size),
                            'totalPages': 1
                        }
                    }
                print(f"Retrieved {len(all_sensor_data['smokeSensorData']['data'])} smoke sensor records")
            else:
                print(f"Smoke sensor API request failed with status code: {smoke_response.status_code}")
                all_sensor_data['smokeSensorData'] = {
                    'data': [],
                    'pagination': {'total': 0, 'page': 1, 'pageSize': int(page_size), 'totalPages': 0}
                }
        except Exception as e:
            print(f"Error fetching smoke sensor data: {str(e)}")
            all_sensor_data['smokeSensorData'] = {
                'data': [],
                'pagination': {'total': 0, 'page': 1, 'pageSize': int(page_size), 'totalPages': 0}
            }
        
        # Fetch DHT11 sensor data (not-paginated))
        try:
            # For exports, try to get all data without pagination first
            dht11_api_url = f'{API_BASE_URL}/api/sensor/sensor-data/dht11'
            if location or status:
                # If filters are applied, use the paginated endpoint with filters
                dht11_api_url = f'{API_BASE_URL}/api/sensor/sensor-data/dht11/paginated?pageSize={page_size}'
                if location:
                    dht11_api_url += f'&location={location}'
                if status:
                    dht11_api_url += f'&status={status}'
            
            print(f"Fetching DHT11 sensor data from: {dht11_api_url}")
            dht11_response = requests.get(dht11_api_url, timeout=10)
            
            if dht11_response.status_code == 200:
                dht11_data = dht11_response.json()
                
                # Handle both paginated and non-paginated responses
                if isinstance(dht11_data, dict) and 'data' in dht11_data:
                    # Paginated response
                    all_sensor_data['dht11Data'] = dht11_data
                else:
                    # Non-paginated response (array)
                    all_sensor_data['dht11Data'] = {
                        'data': dht11_data,
                        'pagination': {
                            'total': len(dht11_data),
                            'page': 1,
                            'pageSize': int(page_size),
                            'totalPages': 1
                        }
                    }
                print(f"Retrieved {len(all_sensor_data['dht11Data']['data'])} DHT11 sensor records")
            else:
                print(f"DHT11 sensor API request failed with status code: {dht11_response.status_code}")
                all_sensor_data['dht11Data'] = {
                    'data': [],
                    'pagination': {'total': 0, 'page': 1, 'pageSize': int(page_size), 'totalPages': 0}
                }
        except Exception as e:
            print(f"Error fetching DHT11 sensor data: {str(e)}")
            all_sensor_data['dht11Data'] = {
                'data': [],
                'pagination': {'total': 0, 'page': 1, 'pageSize': int(page_size), 'totalPages': 0}
            }
            
        print(f"Returning combined sensor data with: {len(all_sensor_data['fireSensorData']['data'])} fire records, {len(all_sensor_data['smokeSensorData']['data'])} smoke records, {len(all_sensor_data['dht11Data']['data'])} DHT11 records")
        return jsonify(all_sensor_data)
    except Exception as e:
        print(f"Error in api_sensor_data_all: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@blueprint.route('/<template>')
@login_required
def route_template(template):

    try:

        if not template.endswith('.html'):
            template += '.html'

        # Detect the current page
        segment = get_segment(request)

        # Serve the file (if exists) from app/templates/home/FILE.html
        user = session.get('user', {})
        user_id = None
        user_email = None
        user_name = None
        
        # Try to get user ID from various possible keys
        for id_key in ['id', 'user_id', 'admin_id', 'npk', 'ID']:
            if id_key in user and user[id_key]:
                user_id = user[id_key]
                break
                
        # Try to get user email from various possible keys
        for email_key in ['email', 'user_email', 'admin_email', 'mail']:
            if email_key in user and user[email_key]:
                user_email = user[email_key]
                break
                
        # Try to get user name from various possible keys
        for name_key in ['name', 'user_name', 'admin_name', 'username', 'full_name', 'display_name']:
            if name_key in user and user[name_key]:
                user_name = user[name_key]
                break
        
        # Fallback to session values if not found in user dictionary
        if not user_id:
            user_id = session.get('id') or session.get('user_id') or session.get('admin_id') or 'N/A'
        if not user_email:
            user_email = session.get('email') or session.get('user_email') or 'N/A'
        if not user_name:
            user_name = session.get('name') or session.get('user_name') or session.get('username') or 'User'
        
        # Ensure npk, email, and name are in the user dictionary
        user['npk'] = user_id
        user['email'] = user_email
        user['name'] = user_name
        
        return render_template("home/" + template, segment=segment, user=user)

    except TemplateNotFound:
        return render_template('home/page-404.html'), 404

    except:
        return render_template('home/page-500.html'), 500


# Helper - Extract current page name from request
def get_segment(request):

    try:

        segment = request.path.split('/')[-1]

        if segment == '':
            segment = 'index'

        return segment

    except:
        return None

@blueprint.route('/page-lock')
def page_lock():
    # Get user data from session
    user = session.get('user', {})
    
    # If no user in session, redirect to login
    if not user:
        return redirect(url_for('authentication_blueprint.login'))
    
    return render_template('home/page-lock.html', user=user)

@blueprint.route('/unlock', methods=['POST'])
def unlock():
    password = request.form.get('password', '')
    
    # Get user data from session
    user = session.get('user', {})
    
    # If no user in session, redirect to login
    if not user:
        return redirect(url_for('authentication_blueprint.login'))
    
    try:
        # Get user ID and type
        user_id = user.get('id')
        user_type = user.get('type', 'user')
        
        # Prepare payload for authentication
        payload = {
            'login_id': user_id,
            'password': password
        }
        
        # Call the API to verify credentials
        response = requests.post(f'{API_BASE_URL}/api/login', json=payload)
        
        if response.status_code == 200 and response.json().get('success'):
            # Get the response data
            response_data = response.json()
            
            # Check for role_id in the response data
            role_id = response_data.get('data', {}).get('role_id')
            
            # Password is correct, redirect to dashboard based on role
            if role_id == 2 or user_type == 'admin':
                return redirect(url_for('home_blueprint.dashboard_admin'))
            else:
                return redirect(url_for('home_blueprint.index'))
        else:
            # Password is incorrect, stay on lock screen with error
            flash('Incorrect password. Please try again.', 'danger')
            return render_template('home/page-lock.html', user=user, error=True)
            
    except Exception as e:
        flash(f'Error during unlock: {str(e)}', 'danger')
        return render_template('home/page-lock.html', user=user, error=True)

# Route to display instructions for installing required packages
@blueprint.route('/install-instructions')
def install_instructions():
    """
    Display instructions for installing required packages for the application
    """
    return render_template('home/install_instructions.html',
                           segment='install_instructions',
                           required_packages=[
                               {'name': 'pandas', 'purpose': 'Data manipulation and analysis'},
                               {'name': 'xlsxwriter', 'purpose': 'Excel file creation for exports'},
                               {'name': 'flask-socketio', 'purpose': 'Real-time communication'},
                               {'name': 'python-socketio', 'purpose': 'Socket.IO client'},
                               {'name': 'python-engineio', 'purpose': 'Engine.IO client'}
                           ])
