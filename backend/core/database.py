from pymongo import MongoClient
from core.config import MONGO_URI, DB_NAME

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
try:
    # Ping the server to ensure connection
    client.server_info()
    print(f"Connected to MongoDB at {MONGO_URI}")
except Exception as e:
    print(f"Failed to connect to MongoDB. Is Docker running? Error: {e}")

db = client[DB_NAME]
