import os
import eventlet
# Monkey patch is required for eventlet to work with standard library calls
eventlet.monkey_patch()

from flask_socketio import SocketIO
from flask_minify import Minify
from sys import exit

from apps.config import config_dict
from apps import create_app

# WARNING: Don't run with debug turned on in production!
DEBUG = (os.getenv('DEBUG', 'False') == 'True')

# The configuration
get_config_mode = 'Debug' if DEBUG else 'Production'

try:
    # Load the configuration using the default values
    app_config = config_dict[get_config_mode.capitalize()]
except KeyError:
    exit('Error: Invalid <config_mode>. Expected values [Debug, Production] ')

app = create_app(app_config)

# Initialize Socket.IO with the Flask app - using eventlet for async operations
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

if not DEBUG:
    Minify(app=app, html=True, js=False, cssless=False)
    
if DEBUG:
    app.logger.info(f'DEBUG            = {DEBUG}')
    app.logger.info(f'Page Compression = {("FALSE" if DEBUG else "TRUE")}')
    app.logger.info(f'DBMS             = {app_config.SQLALCHEMY_DATABASE_URI}')

# Import Socket.IO event handlers after app and socketio are created to avoid circular imports
from apps.home.socket_events import register_socket_events
register_socket_events(socketio)

if __name__ == "__main__":
    socketio.run(app, debug=DEBUG, host='0.0.0.0', port=5001)
