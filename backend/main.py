import base64
import json
import io
import sys
import numpy as np
import face_recognition
from bson import ObjectId
from PIL import Image
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from services.face_engine import FaceEngine
from services.attendance_service import AttendanceService
from core.database import db, client

app = FastAPI()

# Allow CORS so Electron frontend can make standard fetch() requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = FaceEngine()

class EmployeeCreate(BaseModel):
    first_name: str
    last_name: str
    role: str
    email: str
    image: str

@app.get("/health")
def health_check():
    try:
        client.server_info()
        return {"db": "online"}
    except Exception:
        return {"db": "offline"}

@app.get("/employees")
def get_employees():
    employees = []
    for emp in db.employees.find({}):
        emp["_id"] = str(emp["_id"])
        if "face_encoding" in emp:
            del emp["face_encoding"]
        employees.append(emp)
    return {"employees": employees}

@app.post("/employees")
def add_employee(data: EmployeeCreate):
    img_data = data.image
    if img_data.startswith("data:image"):
        img_data = img_data.split(",")[1]
    
    img_bytes = base64.b64decode(img_data)
    image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    frame = np.array(image)
    
    # Calculate encoding (we use the full image since it's taken from webcam)
    face_locations = face_recognition.face_locations(frame)
    if len(face_locations) == 0:
        raise HTTPException(status_code=400, detail="No face detected in the image.")
    if len(face_locations) > 1:
        raise HTTPException(status_code=400, detail="More than one face detected. Please ensure only one person is in frame.")
        
    face_encodings = face_recognition.face_encodings(frame, face_locations)
    encoding_list = face_encodings[0].tolist()
    
    db.employees.insert_one({
        "first_name": data.first_name,
        "last_name": data.last_name,
        "role": data.role,
        "email": data.email,
        "face_encoding": encoding_list
    })
    
    # Hot reload the AI engine RAM!
    engine.load_known_faces()
    
    return {"success": True, "message": "Employee added successfully"}

@app.delete("/employees/{emp_id}")
def delete_employee(emp_id: str):
    result = db.employees.delete_one({"_id": ObjectId(emp_id)})
    if result.deleted_count:
        engine.load_known_faces() # Hot reload
        return {"success": True}
    raise HTTPException(status_code=404, detail="Employee not found")

@app.get("/attendance")
def get_attendance():
    logs = []
    for log in db.attendance_logs.find({}).sort("timestamp", -1).limit(50):
        log["_id"] = str(log["_id"])
        logs.append(log)
    return {"logs": logs}

@app.delete("/attendance")
def clear_attendance():
    db.attendance_logs.delete_many({})
    return {"success": True}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Client connected to WebSocket")
    try:
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                if "faces" not in message:
                    continue

                results = []
                for face_req in message["faces"]:
                    face_id = face_req["id"]
                    img_data = face_req["image"]
                    
                    if img_data.startswith("data:image"):
                        img_data = img_data.split(",")[1]
                    
                    img_bytes = base64.b64decode(img_data)
                    image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                    frame = np.array(image)
                    
                    if frame.shape[0] < 10 or frame.shape[1] < 10:
                        continue

                    employee = engine.identify_face(frame)
                    
                    if employee:
                        # Log attendance (with cooldown)
                        logged, status = AttendanceService.log_entry(employee)
                        
                        results.append({
                            "id": face_id,
                            "name": employee.get("first_name", "Unknown"),
                            "role": employee.get("role", ""),
                            "accessGranted": True,
                            "justLogged": logged
                        })
                    else:
                        results.append({
                            "id": face_id,
                            "name": "Unknown",
                            "role": "Unregistered",
                            "accessGranted": False,
                            "justLogged": False
                        })

                await websocket.send_json({"results": results})

            except WebSocketDisconnect:
                print("Client disconnected.")
                break
            except Exception:
                import traceback
                traceback.print_exc(file=sys.stderr)
                
    except WebSocketDisconnect:
        print("Client disconnected")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
