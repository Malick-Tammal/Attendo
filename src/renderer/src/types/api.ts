export interface Employee {
  _id: string
  first_name: string
  last_name: string
  email: string
  role: string
}

export interface AttendanceLog {
  _id: string
  timestamp: string
  first_name: string
  last_name: string
  role: string
  event_type: string
}
