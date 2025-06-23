@echo off
setlocal enabledelayedexpansion

echo 🇷🇴 Romanian Flashcards App
echo ==========================

:: Check if .env file exists, create if not
if not exist ".env" (
    echo ⚠️  No .env file found. Creating one from template...
    if exist "env_example.txt" (
        copy "env_example.txt" ".env" >nul
        echo ✓ Created .env file from env_example.txt
        echo 📝 Please edit .env file with your MongoDB configuration
    ) else (
        :: Create basic .env file
        echo MONGO_URI=mongodb://localhost:27017/> .env
        echo DATABASE_NAME=romanian_flashcards>> .env
        echo ✓ Created basic .env file
    )
)

:: Load environment variables from .env file and strip quotes
for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
    if not "%%a"=="" if not "%%a:~0,1%"=="#" (
        set "temp_value=%%b"
        :: Remove leading and trailing quotes if present
        if "!temp_value:~0,1!"=="""" if "!temp_value:~-1!"=="""" (
            set "temp_value=!temp_value:~1,-1!"
        )
        set "%%a=!temp_value!"
    )
)

:: Set default values if not provided
if not defined MONGO_URI set "MONGO_URI=mongodb://localhost:27017/"

:: Mask credentials for display
set "DISPLAY_URI=%MONGO_URI%"
echo %MONGO_URI% | findstr "@" >nul
if not errorlevel 1 (
    for /f "tokens=1,2 delims=@" %%a in ("%MONGO_URI%") do (
        for /f "tokens=1,2 delims=/" %%c in ("%%a") do (
            set "DISPLAY_URI=%%c//***:***@%%b"
        )
    )
)

:: Create temporary Python script for MongoDB connection test
echo import pymongo > temp_mongo_test.py
echo import sys >> temp_mongo_test.py
echo try: >> temp_mongo_test.py
echo     client = pymongo.MongoClient('%MONGO_URI%', serverSelectionTimeoutMS=5000) >> temp_mongo_test.py
echo     client.admin.command('ping') >> temp_mongo_test.py
echo     print('✓ MongoDB connection successful') >> temp_mongo_test.py
echo except Exception as e: >> temp_mongo_test.py
echo     print(f'✗ MongoDB connection failed: {e}') >> temp_mongo_test.py
echo     print(f'Attempted to connect to: %DISPLAY_URI%') >> temp_mongo_test.py
echo     print('') >> temp_mongo_test.py
echo     print('Troubleshooting:') >> temp_mongo_test.py
echo     print('1. Make sure your .env file has the correct MONGO_URI') >> temp_mongo_test.py
echo     print('2. For local MongoDB: ensure it is running') >> temp_mongo_test.py
echo     print('3. For Atlas: check your connection string and network access') >> temp_mongo_test.py
echo     print('4. Check that your .env file does not have quotes around the URI') >> temp_mongo_test.py
echo     print('5. Example .env file:') >> temp_mongo_test.py
echo     print('   MONGO_URI=mongodb://localhost:27017/') >> temp_mongo_test.py
echo     print('   DATABASE_NAME=romanian_flashcards') >> temp_mongo_test.py
echo     sys.exit(1) >> temp_mongo_test.py

:: Check if MongoDB is running
echo 🔍 Checking MongoDB connection to: %DISPLAY_URI%
echo 🔍 Actual URI being used (for debugging): %MONGO_URI%
python temp_mongo_test.py
if errorlevel 1 (
    del temp_mongo_test.py 2>nul
    echo.
    echo 💡 Debug Info:
    echo Your .env file should look like this:
    echo MONGO_URI=mongodb+srv://username:password@cluster0.bmj954v.mongodb.net/
    echo DATABASE_NAME=romanian_flashcards
    echo.
    echo Make sure there are NO quotes around the URI values!
    pause
    exit /b 1
)

:: Clean up temporary file
del temp_mongo_test.py 2>nul

:: Install backend dependencies
echo.
echo 📦 Installing backend dependencies...
cd backend
pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ Failed to install backend dependencies
    pause
    exit /b 1
)
echo ✅ Backend dependencies installed

:: Install frontend dependencies
echo.
echo 📦 Installing frontend dependencies...
cd ..\frontend
if not exist "node_modules" (
    npm install
    if errorlevel 1 (
        echo ❌ Failed to install frontend dependencies
        pause
        exit /b 1
    )
)
echo ✅ Frontend dependencies ready

:: Start backend in background
echo.
echo 🚀 Starting Flask backend...
cd ..\backend
start "Romanian App Backend" /min python app.py

:: Wait for backend to start
timeout /t 3 /nobreak

:: Start frontend
echo.
echo 🚀 Starting React frontend...
cd ..\frontend
set BROWSER=none
start "Romanian App Frontend" npm start

echo.
echo ✅ Services started successfully!
echo.
echo 📍 Access your application at:
echo    Frontend: http://localhost:3000
echo    Backend API: http://localhost:5000
echo    Health Check: http://localhost:5000/api/health
echo.
echo ⚠️  Close the terminal windows to stop the services
echo.
pause 