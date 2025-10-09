@echo off
echo ========================================
echo  REF-HUB Backend Quick Start
echo ========================================
echo.

:: Check if .env exists
if not exist ".env" (
    echo .env file not found. Creating it now...
    echo.
    
    :: Create .env file
    (
    echo PORT=5001
    echo MONGODB_URI=mongodb+srv://Rayulu7_db_user:n9zQJalBUtgvaFLz@cluster0.gwbiqnp.mongodb.net/?retryWrites=true&w=majority^&appName=Cluster0
    echo JWT_SECRET=refhub_secret_key_2024_production_ready
    echo FRONTEND_URL=http://localhost:3000
    echo CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000
    echo NODE_ENV=development
    ) > .env
    
    echo ✓ .env file created
    echo.
)

:: Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    echo This may take a few minutes...
    echo.
    call npm install
    echo.
    echo ✓ Dependencies installed
    echo.
)

:: Start the server
echo ========================================
echo  Starting Backend Server...
echo ========================================
echo.
echo Backend will run on: http://localhost:5001
echo.
echo Press Ctrl+C to stop the server
echo.
call npm start

