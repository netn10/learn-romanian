#!/bin/bash

# Romanian Flashcards App Launcher Script
echo "🇷🇴 Romanian Flashcards App"
echo "=========================="

# Function to load environment variables from .env file
load_env() {
    if [ -f ".env" ]; then
        export $(grep -v '^#' .env | xargs)
    fi
}

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    
    if [ ! -z "$BACKEND_PID" ]; then
        echo "Stopping backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        echo "Stopping frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID 2>/dev/null
    fi
    
    # Wait a bit for graceful shutdown
    sleep 2
    
    # Force kill if needed
    if [ ! -z "$BACKEND_PID" ]; then
        kill -9 $BACKEND_PID 2>/dev/null
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill -9 $FRONTEND_PID 2>/dev/null
    fi
    
    echo "✅ All services stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check if .env file exists, create if not
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating one from template..."
    if [ -f "env_example.txt" ]; then
        cp env_example.txt .env
        echo "✓ Created .env file from env_example.txt"
        echo "📝 Please edit .env file with your MongoDB configuration"
    else
        # Create basic .env file
        cat > .env << EOF
MONGO_URI=mongodb://localhost:27017/
DATABASE_NAME=romanian_flashcards
EOF
        echo "✓ Created basic .env file"
    fi
fi

# Load environment variables
load_env

# Set default values if not provided
MONGO_URI=${MONGO_URI:-"mongodb://localhost:27017/"}

# Mask credentials for display
DISPLAY_URI="$MONGO_URI"
if [[ "$MONGO_URI" == *"@"* ]]; then
    # Extract and mask credentials
    DISPLAY_URI=$(echo "$MONGO_URI" | sed 's|://[^@]*@|://***:***@|')
fi

# Check if MongoDB is running
echo "🔍 Checking MongoDB connection to: $DISPLAY_URI"
if ! python3 -c "
import pymongo
import sys
try:
    client = pymongo.MongoClient('$MONGO_URI', serverSelectionTimeoutMS=5000)
    client.admin.command('ping')
    print('✓ MongoDB connection successful')
except Exception as e:
    print(f'✗ MongoDB connection failed: {e}')
    print(f'Attempted to connect to: $DISPLAY_URI')
    print('\nTroubleshooting:')
    print('1. Make sure your .env file has the correct MONGO_URI')
    print('2. For local MongoDB: ensure it is running')
    print('3. For Atlas: check your connection string and network access')
    sys.exit(1)
" 2>/dev/null; then
    exit 1
fi

# Install backend dependencies
echo ""
echo "📦 Installing backend dependencies..."
cd backend
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "❌ Failed to install backend dependencies"
    exit 1
fi
echo "✅ Backend dependencies installed"

# Install frontend dependencies
echo ""
echo "📦 Installing frontend dependencies..."
cd ../frontend
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install frontend dependencies"
        exit 1
    fi
fi
echo "✅ Frontend dependencies ready"

# Start backend
echo ""
echo "🚀 Starting Flask backend..."
cd ../backend
python3 app.py &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"

# Wait for backend to start
sleep 3

# Start frontend
echo ""
echo "🚀 Starting React frontend..."
cd ../frontend
BROWSER=none npm start &
FRONTEND_PID=$!
echo "Frontend started with PID: $FRONTEND_PID"

echo ""
echo "✅ Services started successfully!"
echo ""
echo "📍 Access your application at:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:5000"
echo "   Health Check: http://localhost:5000/api/health"
echo ""
echo "⚠️  Press Ctrl+C to stop all services"
echo ""

# Keep script running and monitor processes
while true; do
    sleep 1
    
    # Check if backend is still running
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "❌ Backend process died unexpectedly"
        cleanup
    fi
    
    # Check if frontend is still running
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "❌ Frontend process died unexpectedly"
        cleanup
    fi
done 