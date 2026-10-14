import sys
import os

# Add parent directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

import face_recognition
from core.database import db

def seed():
    known_dir = os.path.join(os.path.dirname(__file__), '../../backend/known_faces')
    if not os.path.exists(known_dir):
        print(f"No known_faces directory found at {known_dir}. Creating it...")
        os.makedirs(known_dir)
        print("Please add some .jpg files and run this script again.")
        return

    # Check MongoDB connection
    try:
        db.command("ping")
    except Exception as e:
        print("Cannot connect to MongoDB. Is the Docker container running?")
        print(f"Error: {e}")
        return

    print("Checking for faces to import...")
    for filename in os.listdir(known_dir):
        if filename.lower().endswith((".jpg", ".jpeg", ".png")):
            name = os.path.splitext(filename)[0]
            filepath = os.path.join(known_dir, filename)
            
            # Check if already in DB
            if db.employees.find_one({"first_name": name}):
                print(f"Employee {name} already in DB. Skipping.")
                continue

            print(f"Processing {filename}...")
            try:
                image = face_recognition.load_image_file(filepath)
                encodings = face_recognition.face_encodings(image)
                
                if encodings:
                    encoding_list = encodings[0].tolist() # Convert numpy array to list for MongoDB
                    
                    db.employees.insert_one({
                        "first_name": name,
                        "last_name": "",
                        "role": "CEO / Founder" if name.lower() == "imad" else "Employee",
                        "email": f"{name.lower()}@company.com",
                        "face_encoding": encoding_list
                    })
                    print(f"✅ Successfully inserted {name} into MongoDB.")
                else:
                    print(f"❌ No face found in {filename}.")
            except Exception as e:
                print(f"❌ Error processing {filename}: {e}")

    print("Seed complete!")

if __name__ == "__main__":
    seed()
