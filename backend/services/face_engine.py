import numpy as np
import face_recognition
from core.database import db

class FaceEngine:
    def __init__(self):
        self.known_encodings = []
        self.known_employees = []
        self.load_known_faces()

    def load_known_faces(self):
        print("Loading employee encodings from MongoDB into RAM...")
        self.known_encodings = []
        self.known_employees = []
        
        try:
            employees = db.employees.find({})
            for emp in employees:
                if "face_encoding" in emp and emp["face_encoding"]:
                    self.known_encodings.append(np.array(emp["face_encoding"]))
                    self.known_employees.append(emp)
            print(f"Loaded {len(self.known_employees)} employees from database.")
        except Exception as e:
            print(f"Error loading from MongoDB: {e}")

    def identify_face(self, frame_rgb):
        """
        Takes an RGB numpy array (cropped exactly to the face).
        Returns the recognized employee dict or None.
        """
        height, width, _ = frame_rgb.shape
        pre_calculated_location = [(0, width, height, 0)]
        
        # Bypass heavy HOG detection by providing exact bounds
        encodings = face_recognition.face_encodings(frame_rgb, known_face_locations=pre_calculated_location)
        
        if not encodings:
            return None
        
        encoding = encodings[0]
        if not self.known_encodings:
            return None

        matches = face_recognition.compare_faces(self.known_encodings, encoding, tolerance=0.6)
        face_distances = face_recognition.face_distance(self.known_encodings, encoding)
        
        if len(face_distances) > 0:
            best_match_index = np.argmin(face_distances)
            if matches[best_match_index]:
                return self.known_employees[best_match_index]
        
        return None
