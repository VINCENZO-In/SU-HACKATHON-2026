#!/bin/bash
# WeaveMind — Start all services
# Run this from the project root folder

echo "🧵 WeaveMind Smart Factory OS — Starting..."
echo ""

# Check MongoDB
if ! command -v mongod &> /dev/null; then
  echo "⚠️  MongoDB not found. Install from https://www.mongodb.com/try/download/community"
  echo "   On macOS: brew install mongodb-community"
  echo "   On Ubuntu: sudo apt install mongodb"
else
  echo "✅ MongoDB found"
fi

echo ""
echo "Starting Backend (Node.js) on port 5001..."
cd backend && npm install && node server.js &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

echo ""
echo "Starting ML Service (Python/YOLOv8) on port 8000..."
cd ../ml_service && pip install -r requirements.txt -q && uvicorn main:app --host 0.0.0.0 --port 8000 &
ML_PID=$!
echo "   ML Service PID: $ML_PID"

echo ""
echo "Starting Frontend (React) on port 3000..."
cd ../frontend && npm install && npm start &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

echo ""
echo "======================================"
echo "🚀 WeaveMind is starting up!"
echo "   Frontend:   http://localhost:3000"
echo "   Backend API: http://localhost:5001/api"
echo "   ML Service:  http://localhost:8000"
echo "   ML Docs:     http://localhost:8000/docs"
echo "======================================"
echo ""
echo "Login: admin@weavemind.com / admin123"
echo ""
echo "Press Ctrl+C to stop all services"
wait
