import base64
import json
import io
import sys
import numpy as np
import face_recognition
from bson import ObjectId
from PIL import Image, ImageEnhance
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

# ── Adaptive learning constants ───────────────────────────────────────────────
# Only save a new encoding when confidence is this tight (well below tolerance)
LEARN_DISTANCE_THRESHOLD = 0.42
# Maximum encodings stored per employee (bounds DB size & matching time)
MAX_ENCODINGS_PER_EMPLOYEE = 50
# ─────────────────────────────────────────────────────────────────────────────


def generate_augmented_encodings(frame_rgb: np.ndarray) -> list:
    """
    Given a full-frame RGB numpy array with exactly one detected face,
    returns a list of up to 5 distinct 128-d face encodings by running
    face_recognition on the original + 4 lightweight augmentations.

    Augmentations are purely pixel-level (no geometric warp) so the
    face bounding box can be reused across all variants.
    """
    image = Image.fromarray(frame_rgb)
    face_locations = face_recognition.face_locations(frame_rgb)

    if not face_locations:
        return []

    # Reuse the detected location for all augmented variants
    loc = face_locations[:1]

    variants = []

    def _encode(pil_img: Image.Image) -> list | None:
        arr = np.array(pil_img.convert("RGB"))
        encs = face_recognition.face_encodings(arr, known_face_locations=loc)
        return encs[0].tolist() if encs else None

    # 0 — original
    enc = _encode(image)
    if enc:
        variants.append(enc)

    # 1 — brighter (+20 brightness)
    enc = _encode(ImageEnhance.Brightness(image).enhance(1.25))
    if enc:
        variants.append(enc)

    # 2 — darker (-20 brightness)
    enc = _encode(ImageEnhance.Brightness(image).enhance(0.75))
    if enc:
        variants.append(enc)

    # 3 — horizontal flip (simulates face slightly turned the other way)
    enc = _encode(image.transpose(Image.FLIP_LEFT_RIGHT))
    if enc:
        variants.append(enc)

    # 4 — contrast boost (simulates harsh lighting)
    enc = _encode(ImageEnhance.Contrast(image).enhance(1.3))
    if enc:
        variants.append(enc)

    return variants


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
        emp.pop("face_encoding", None)
        emp.pop("face_encodings", None)
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

    # Validate: exactly one face must be visible
    face_locations = face_recognition.face_locations(frame)
    if len(face_locations) == 0:
        raise HTTPException(status_code=400, detail="No face detected in the image.")
    if len(face_locations) > 1:
        raise HTTPException(
            status_code=400,
            detail="More than one face detected. Please ensure only one person is in frame.",
        )

    # Generate 5 augmented encodings from the single captured frame
    encodings = generate_augmented_encodings(frame)
    if not encodings:
        raise HTTPException(status_code=400, detail="Failed to encode face. Please try again.")

    db.employees.insert_one({
        "first_name": data.first_name,
        "last_name": data.last_name,
        "role": data.role,
        "email": data.email,
        "face_encodings": encodings,   # list of lists
    })

    # Hot-reload the in-RAM gallery
    engine.load_known_faces()

    print(f"Registered {data.first_name} with {len(encodings)} encoding sample(s).")
    return {"success": True, "message": f"Employee added with {len(encodings)} face samples."}


@app.delete("/employees/{emp_id}")
def delete_employee(emp_id: str):
    result = db.employees.delete_one({"_id": ObjectId(emp_id)})
    if result.deleted_count:
        engine.load_known_faces()
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


def _maybe_learn(employee: dict, frame_rgb: np.ndarray, distance: float) -> None:
    """
    Adaptive learning: if this recognition is high-confidence and the employee
    hasn't hit the encoding cap, save this frame's encoding to the DB and
    hot-reload the in-RAM gallery.

    This is called synchronously but is fast (a single face_encodings() call
    + one MongoDB $push) — typically <50ms, well within WebSocket RTT.
    """
    if distance > LEARN_DISTANCE_THRESHOLD:
        return  # Not confident enough to learn from

    emp_id = employee["_id"]

    # Count current encodings stored in DB
    emp_doc = db.employees.find_one({"_id": emp_id}, {"face_encodings": 1, "face_encoding": 1})
    if emp_doc is None:
        return

    existing = emp_doc.get("face_encodings") or []
    if emp_doc.get("face_encoding") and not existing:
        existing = [emp_doc["face_encoding"]]  # legacy compat

    if len(existing) >= MAX_ENCODINGS_PER_EMPLOYEE:
        return  # Cap reached

    # Encode the current frame
    height, width, _ = frame_rgb.shape
    loc = [(0, width, height, 0)]
    new_encs = face_recognition.face_encodings(frame_rgb, known_face_locations=loc)
    if not new_encs:
        return

    new_enc = new_encs[0].tolist()

    # Persist and hot-reload
    db.employees.update_one(
        {"_id": emp_id},
        {"$push": {"face_encodings": new_enc}}
    )
    engine.load_known_faces()
    print(f"[learn] Saved new encoding for {employee.get('first_name')} "
          f"(dist={distance:.3f}, total={len(existing)+1})")


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

                    employee, distance = engine.identify_face(frame)

                    if employee and distance is not None:
                        logged, status = AttendanceService.log_entry(employee)

                        # Adaptive learning — non-blocking, runs inline
                        _maybe_learn(employee, frame, distance)

                        results.append({
                            "id": face_id,
                            "name": employee.get("first_name", "Unknown"),
                            "role": employee.get("role", ""),
                            "accessGranted": True,
                            "justLogged": logged,
                        })
                    else:
                        results.append({
                            "id": face_id,
                            "name": "Unknown",
                            "role": "Unregistered",
                            "accessGranted": False,
                            "justLogged": False,
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
