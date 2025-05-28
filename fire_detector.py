import cv2
import numpy as np
from pathlib import Path
import time
import requests
import base64
from flask import Response
from ultralytics import YOLO

class FireDetector:
    def __init__(self, model_path="models/fire_detector/best.pt", conf_threshold=0.5, 
                 backend_url="http://localhost:3000/api/camera-detection", camera_location="Main Camera"):
        """
        Initialize the Fire Detection model using YOLOv8
        
        Args:
            model_path: Path to the trained YOLO model
            conf_threshold: Confidence threshold for detections
            backend_url: URL of the Node.js backend API endpoint
            camera_location: The location identifier for the camera
        """
        self.conf_threshold = conf_threshold
        self.backend_url = backend_url
        self.camera_location = camera_location
        self.last_alert_time = 0
        self.alert_cooldown = 30  # seconds between alerts to avoid flooding the backend
        
        # Load the model using ultralytics YOLO directly
        try:
            self.model = YOLO(model_path)
            print("Fire detection model loaded successfully!")
        except Exception as e:
            print(f"Error loading model: {e}")
            self.model = None
    
    def detect_fire(self, frame):
        """
        Detect fire in a single frame
        
        Args:
            frame: OpenCV image frame
        
        Returns:
            processed_frame: Frame with bounding boxes
            has_fire: Boolean indicating if fire was detected
        """
        if self.model is None:
            return frame, False
            
        # Perform detection
        results = self.model(frame, conf=self.conf_threshold)
        
        # Get annotated frame directly using plot()
        annotated_frame = results[0].plot()
        
        # Check if fire is detected in any of the results
        has_fire = False
        confidence_score = 0.0
        
        for r in results:
            if len(r.boxes) > 0:  # If any detection boxes exist
                for box in r.boxes:
                    cls = int(box.cls[0])
                    cls_name = r.names[cls]
                    conf = float(box.conf[0])
                    if 'fire' in cls_name.lower():
                        has_fire = True
                        # Use the highest confidence score if multiple detections
                        confidence_score = max(confidence_score, conf)
        
        return annotated_frame, has_fire, confidence_score

    def send_alert_to_backend(self, frame, confidence_score):
        """
        Send the fire detection alert to the Node.js backend
        
        Args:
            frame: The image frame with detected fire
            confidence_score: The confidence score of the detection
        """
        try:
            # Convert the image to base64 string
            _, buffer = cv2.imencode('.jpg', frame)
            img_base64 = base64.b64encode(buffer).decode('utf-8')
            
            # Prepare the payload
            payload = {
                'imageData': f"data:image/jpeg;base64,{img_base64}",
                'cameraLocation': self.camera_location,
                'confidenceScore': float(confidence_score)
            }
            
            # Send POST request to backend
            response = requests.post(self.backend_url, json=payload)
            
            # Check if the request was successful
            if response.status_code == 201:
                print("Alert sent successfully to MySQL database!")
                print(f"Detection ID: {response.json().get('detectionId')}")
                return True
            else:
                print(f"Error sending alert to backend: {response.status_code}")
                print(response.text)
                return False
        
        except Exception as e:
            print(f"Exception while sending alert to backend: {str(e)}")
            return False

# Global fire detector instance
fire_detector = None

def initialize_detector(model_path="models/fire_detector/best.pt", 
                        backend_url="http://localhost:3000/api/camera-detection",
                        camera_location="Dashboard Camera"):
    """Initialize the fire detector with the specified model path"""
    global fire_detector
    fire_detector = FireDetector(
        model_path=model_path,
        backend_url=backend_url,
        camera_location=camera_location
    )
    return fire_detector

def generate_frames(camera_source=0):
    """
    Generator function for camera frames
    
    Args:
        camera_source: Camera index or RTSP URL
    
    Yields:
        JPEG encoded frame data
    """
    global fire_detector
    if fire_detector is None:
        initialize_detector()
    
    print(f"Attempting to open camera source: {camera_source}")
    
    # Try multiple camera backends
    for backend in [cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY]:
        try:
            # Initialize camera with specific backend
            cap = cv2.VideoCapture(camera_source, backend)
            if cap.isOpened():
                print(f"Successfully opened camera with backend {backend}")
                break
        except Exception as e:
            print(f"Failed to open camera with backend {backend}: {e}")
            continue
    else:
        # If all backends fail, try one last time with default
        cap = cv2.VideoCapture(camera_source)
        if not cap.isOpened():
            print(f"Error: Could not open video source {camera_source} with any backend")
            # Return an error frame
            error_frame = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(
                error_frame,
                f"Error: Could not open camera {camera_source}",
                (50, 240),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 0, 255),
                2
            )
            ret, buffer = cv2.imencode('.jpg', error_frame)
            frame_bytes = buffer.tobytes()
            
            yield (
                b'--frame\r\n'
                b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n'
            )
            return
    
    # Set lower resolution for better performance
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    
    # Read a test frame to confirm camera is working
    ret, test_frame = cap.read()
    if not ret:
        print("Camera opened but failed to read test frame")
        # Return an error frame
        error_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(
            error_frame,
            "Error: Camera opened but couldn't read frame",
            (50, 240),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 0, 255),
            2
        )
        ret, buffer = cv2.imencode('.jpg', error_frame)
        frame_bytes = buffer.tobytes()
        
        yield (
            b'--frame\r\n'
            b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n'
        )
        cap.release()
        return
    
    print("Camera successfully initialized and reading frames")
    
    fire_status = False
    last_alert_time = 0
    alert_cooldown = 30  # seconds
    
    while True:
        success, frame = cap.read()
        if not success:
            print("Error: Failed to capture frame")
            # Try to reopen the camera
            cap.release()
            cap = cv2.VideoCapture(camera_source)
            if not cap.isOpened():
                break
            continue
            
        # Process frame with fire detector
        try:
            annotated_frame, has_fire, confidence_score = fire_detector.detect_fire(frame)
            
            # Update fire status with alert cooldown
            current_time = time.time()
            if has_fire:
                fire_status = True
                
                # Send alert to backend if we're not in cooldown period
                if current_time - last_alert_time > alert_cooldown:
                    print(f"Fire detected with confidence {confidence_score:.2f}! Sending alert to MySQL...")
                    fire_detector.send_alert_to_backend(frame, confidence_score)
                    last_alert_time = current_time
            elif current_time - last_alert_time > alert_cooldown:
                fire_status = False
            
            # Add status indicator to the frame
            status_color = (0, 0, 255) if fire_status else (0, 255, 0)
            status_text = "FIRE DETECTED!" if fire_status else "Normal"
            cv2.putText(
                annotated_frame,
                status_text,
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                status_color,
                2
            )
            
            # Encode the frame as JPEG
            ret, buffer = cv2.imencode('.jpg', annotated_frame)
            frame_bytes = buffer.tobytes()
            
            yield (
                b'--frame\r\n'
                b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n'
            )
        except Exception as e:
            print(f"Error processing frame: {e}")
            # Return a simple frame with error
            error_frame = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(
                error_frame,
                f"Error: {str(e)}",
                (50, 240),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 0, 255),
                2
            )
            ret, buffer = cv2.imencode('.jpg', error_frame)
            frame_bytes = buffer.tobytes()
            
            yield (
                b'--frame\r\n'
                b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n'
            )
            time.sleep(1)  # Sleep to avoid flooding errors
    
    # Release the camera when done
    cap.release()
