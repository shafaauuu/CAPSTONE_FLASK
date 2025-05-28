import cv2
from ultralytics import YOLO

# Load the trained model
model = YOLO('models/fire_detector/best.pt')  # Change path if needed

# Open webcam (0 = default camera)
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Error: Could not open webcam.")
    exit()

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Run detection
    results = model(frame, conf=0.5)  # adjust confidence if needed

    # Plot results on frame
    annotated_frame = results[0].plot()

    # Display
    cv2.imshow("YOLOv8 Flame Recognition", annotated_frame)

    # Press Q to quit
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()