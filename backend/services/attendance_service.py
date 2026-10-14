from datetime import datetime, timedelta
from core.database import db

# Cooldown dictionary: { "employee_id": datetime_of_last_log }
COOLDOWN_CACHE = {}
COOLDOWN_MINUTES = 5

class AttendanceService:
    @staticmethod
    def log_entry(employee):
        emp_id = str(employee["_id"])
        now = datetime.utcnow()
        
        # Check cooldown to prevent spamming logs
        if emp_id in COOLDOWN_CACHE:
            if now - COOLDOWN_CACHE[emp_id] < timedelta(minutes=COOLDOWN_MINUTES):
                return False, "cooldown" # Still in cooldown, don't log

        # Log entry
        db.attendance_logs.insert_one({
            "employee_id": emp_id,
            "first_name": employee.get("first_name", "Unknown"),
            "last_name": employee.get("last_name", ""),
            "role": employee.get("role", ""),
            "timestamp": now,
            "event_type": "entry"
        })
        
        # Update cache
        COOLDOWN_CACHE[emp_id] = now
        print(f"Attendance logged for {employee.get('first_name')} at {now}")
        return True, "logged"
