import numpy as np
import face_recognition
from core.database import db

class FaceEngine:
    def __init__(self):
        self.known_encodings = []   # flat list of np.ndarray (128-d)
        self.known_employees = []   # parallel list — one entry per encoding
        self.load_known_faces()

    def load_known_faces(self):
        print("Loading employee encodings from MongoDB into RAM...")
        self.known_encodings = []
        self.known_employees = []

        try:
            for emp in db.employees.find({}):
                encodings = []

                # New schema: face_encodings is a list of lists
                if "face_encodings" in emp and emp["face_encodings"]:
                    encodings = [np.array(e) for e in emp["face_encodings"]]
                # Legacy schema: single face_encoding list (backward-compat)
                elif "face_encoding" in emp and emp["face_encoding"]:
                    encodings = [np.array(emp["face_encoding"])]

                for enc in encodings:
                    self.known_encodings.append(enc)
                    self.known_employees.append(emp)

            print(f"Loaded {len(self.known_employees)} encoding(s) for "
                  f"{len(set(str(e['_id']) for e in self.known_employees))} employee(s).")
        except Exception as e:
            print(f"Error loading from MongoDB: {e}")

    def identify_face(self, frame_rgb):
        """
        Takes an RGB numpy array (cropped exactly to the face).
        Returns (employee_dict, distance) or (None, None).

        Uses the minimum distance across all stored encodings for that employee
        so that multi-sample galleries work correctly.
        """
        height, width, _ = frame_rgb.shape
        pre_calculated_location = [(0, width, height, 0)]

        # Bypass heavy HOG detection by providing exact bounds
        encodings = face_recognition.face_encodings(
            frame_rgb, known_face_locations=pre_calculated_location
        )

        if not encodings:
            return None, None

        encoding = encodings[0]

        if not self.known_encodings:
            return None, None

        face_distances = face_recognition.face_distance(self.known_encodings, encoding)

        best_idx = int(np.argmin(face_distances))
        best_dist = float(face_distances[best_idx])

        # Tightened tolerance — 0.5 reduces false-positives between similar faces
        if best_dist <= 0.5:
            return self.known_employees[best_idx], best_dist

        return None, None
