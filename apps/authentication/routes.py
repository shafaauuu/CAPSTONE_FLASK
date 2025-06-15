from functools import wraps

from flask import render_template, redirect, request, url_for, session
import requests
from flask_login import (
    current_user,
    login_user,
    logout_user
)

from flask_dance.contrib.github import github
from flask_dance.contrib.google import google

from apps import db, login_manager
from apps.authentication import blueprint
from apps.authentication.forms import LoginForm, CreateAccountForm
from apps.authentication.models import Users
from apps.config import Config
from apps.authentication.util import verify_pass

@blueprint.route('/')
def route_default():
    return redirect(url_for('authentication_blueprint.login'))

# Login & Registration

@blueprint.route("/github")
def login_github():
    """ Github login """
    if not github.authorized:
        return redirect(url_for("github.login"))

    res = github.get("/user")
    return redirect(url_for('home_blueprint.index'))


@blueprint.route("/google")
def login_google():
    """ Google login """
    if not google.authorized:
        return redirect(url_for("google.login"))

    res = google.get("/oauth2/v1/userinfo")
    return redirect(url_for('home_blueprint.index'))

@blueprint.route('/login', methods=['GET', 'POST'])
def login():
    login_form = LoginForm(request.form)

    if request.method == 'POST' and 'login' in request.form:
        login_id = request.form.get('login_id', '').strip()
        password = request.form.get('password', '').strip()

        if not login_id or not password:
            return render_template('accounts/login.html',
                                   msg='Please enter User ID/Admin ID and password',
                                   form=login_form)

        try:
            payload = {
                'login_id': login_id,
                'password': password
            }

            response = requests.post('http://127.0.0.1:3000/api/login', json=payload)

            # Check for approval status - 403 response
            if response.status_code == 403:
                error_data = response.json()
                return render_template('accounts/login.html',
                                   msg=error_data.get('message', 'Account pending approval. Please contact administrator.'),
                                   form=login_form)
                                   
            response.raise_for_status()
            data = response.json()
            
            print("API login response:", data)  # Debug print

            if data.get('success'):
                # Save user info & role in session
                user_data = data.get('user', {})
                role = data.get('role')
                
                print("User data from login API:", user_data)  # Debug print
                
                # Make sure user_data contains id and type
                if 'id' not in user_data:
                    # Extract ID based on role
                    if role == 'admin':
                        user_data['id'] = user_data.get('admin_id')
                        user_data['type'] = 'admin'
                    else:
                        user_data['id'] = user_data.get('user_id')
                        user_data['type'] = 'user'
                
                # If we still don't have an ID, set it from login_id
                if not user_data.get('id'):
                    user_data['id'] = login_id
                
                # Ensure user has a name for display in navigation
                if not user_data.get('name'):
                    # Try to find a name in various possible fields
                    if user_data.get('user_name'):
                        user_data['name'] = user_data.get('user_name')
                    elif user_data.get('username'):
                        user_data['name'] = user_data.get('username')
                    elif user_data.get('full_name'):
                        user_data['name'] = user_data.get('full_name')
                    elif user_data.get('login_id'):
                        user_data['name'] = user_data.get('login_id')
                    else:
                        # Use the login ID from the form as a last resort
                        user_data['name'] = login_id
                
                print(f"Final user data to store in session: {user_data}")  # Debug print
                
                # Store complete user data in session
                session['user'] = user_data
                session['role'] = role
                
                print("Session after login:", session)  # Debug print

                # Redirect based on role
                if session['role'] == 'admin':
                    return redirect(url_for('home_blueprint.dashboard_admin'))
                elif session['role'] == 'user':
                    return redirect(url_for('home_blueprint.index'))
                else:
                    return render_template('accounts/login.html',
                                           msg='Unauthorized role',
                                           form=login_form)

            return render_template('accounts/login.html',
                                   msg='Wrong ID or password',
                                   form=login_form)

        except requests.exceptions.RequestException as e:
            return render_template('accounts/login.html',
                                   msg='Error connecting to login service: ' + str(e),
                                   form=login_form)

    # Check if user is already logged in by checking session
    if session.get('user'):
        return redirect(url_for('home_blueprint.index'))

    return render_template('accounts/login.html', form=login_form)

@blueprint.route('/register', methods=['GET', 'POST'])
def register():
    create_account_form = CreateAccountForm(request.form)
    
    # Fetch dropdown data from API for form population
    try:
        # Get plants
        plants_response = requests.get('http://127.0.0.1:3000/api/lookup/plants')
        plants_data = plants_response.json().get('data', []) if plants_response.status_code == 200 else []
        
        # Get departments
        departments_response = requests.get('http://127.0.0.1:3000/api/lookup/departments')
        departments_data = departments_response.json().get('data', []) if departments_response.status_code == 200 else []
        
        # Get divisions
        divisions_response = requests.get('http://127.0.0.1:3000/api/lookup/divisions')
        divisions_data = divisions_response.json().get('data', []) if divisions_response.status_code == 200 else []
        
        # Get roles
        roles_response = requests.get('http://127.0.0.1:3000/api/lookup/roles')
        roles_data = roles_response.json().get('data', []) if roles_response.status_code == 200 else []
        
        # Populate form choices
        create_account_form.plant.choices = [(str(p['plant_id']), p['plant_name']) for p in plants_data]
        create_account_form.department.choices = [(str(d['department_id']), d['department_name']) for d in departments_data]
        create_account_form.division.choices = [(str(d['division_id']), d['division_name']) for d in divisions_data]
        create_account_form.role.choices = [(str(r['role_id']), r['role_name']) for r in roles_data]
        
    except requests.exceptions.RequestException as e:
        # Handle API connection error
        return render_template('accounts/register.html',
                               msg='Error connecting to lookup service: ' + str(e),
                               success=False,
                               form=create_account_form)
    
    # On form submission
    if 'register' in request.form:
        npk = request.form.get('npk', '').strip()
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '').strip()
        plant_id = request.form.get('plant')
        department_id = request.form.get('department')
        division_id = request.form.get('division')
        role_id = request.form.get('role')
        
        # Validate required fields
        if not npk or not name or not email or not password:
            return render_template('accounts/register.html',
                                   msg='NPK/ID, name, email, and password are required',
                                   success=False,
                                   form=create_account_form)
        
        try:
            # Determine if this is a user or admin registration based on role
            is_admin = False
            for role in roles_data:
                if str(role['role_id']) == role_id and 'admin' in role['role_name'].lower():
                    is_admin = True
                    break
            
            # Prepare payload
            if is_admin:
                payload = {
                    'admin_id': npk,
                    'admin_name': name,
                    'admin_email': email,
                    'admin_password': password,
                    'plant_id': plant_id,
                    'department_id': department_id,
                    'division_id': division_id,
                    'role_id': role_id
                }
                endpoint = 'http://127.0.0.1:3000/api/register/admin'
            else:
                payload = {
                    'user_id': npk,
                    'user_name': name,
                    'user_email': email,
                    'user_password': password,
                    'plant_id': plant_id,
                    'department_id': department_id,
                    'division_id': division_id,
                    'role_id': role_id
                }
                endpoint = 'http://127.0.0.1:3000/api/register/user'
            
            # Make API call
            response = requests.post(endpoint, json=payload)
            
            # Check if the response can be parsed as JSON
            try:
                data = response.json()
                
                if not response.ok:
                    return render_template('accounts/register.html',
                                          msg=data.get('message', 'Registration failed'),
                                          success=False,
                                          form=create_account_form)
                
                return render_template('accounts/register.html',
                                      msg=data.get('message', 'Registration successful'),
                                      success=True,
                                      form=create_account_form)
            except ValueError:
                # This handles the case when the response is not valid JSON
                error_msg = f"Server returned status {response.status_code}: {response.text}"
                print("API Error:", error_msg)  # For debugging
                
                return render_template('accounts/register.html',
                                      msg=f"Registration failed: {error_msg}",
                                      success=False,
                                      form=create_account_form)
                                  
        except requests.exceptions.RequestException as e:
            return render_template('accounts/register.html',
                                  msg='Error connecting to registration service: ' + str(e),
                                  success=False,
                                  form=create_account_form)
    
    # GET request or form not submitted
    return render_template('accounts/register.html', form=create_account_form)

@blueprint.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('authentication_blueprint.login'))

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        print("Checking login, session user:", session.get('user'))
        if 'user' not in session:
            print("User not in session, redirecting to login")
            return redirect(url_for('authentication_blueprint.login'))
        return f(*args, **kwargs)
    return decorated_function

# Errors

@login_manager.unauthorized_handler
def unauthorized_handler():
    return render_template('home/page-403.html'), 403


@blueprint.errorhandler(403)
def access_forbidden(error):
    return render_template('home/page-403.html'), 403


@blueprint.errorhandler(404)
def not_found_error(error):
    return render_template('home/page-404.html'), 404


@blueprint.errorhandler(500)
def internal_error(error):
    return render_template('home/page-500.html'), 500


@blueprint.context_processor
def has_github():
    return {'has_github': bool(Config.GITHUB_ID) and bool(Config.GITHUB_SECRET)}

@blueprint.context_processor
def has_google():
    return {'has_google': bool(Config.GOOGLE_ID) and bool(Config.GOOGLE_SECRET)}
