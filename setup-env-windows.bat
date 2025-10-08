@echo off
echo ========================================
echo  Creating .env file for REF-HUB
echo ========================================
echo.

:: Check if .env already exists
if exist ".env" (
    echo WARNING: .env file already exists!
    echo.
    set /p OVERWRITE="Do you want to overwrite it? (Y/N): "
    if /i not "%OVERWRITE%"=="Y" (
        echo Cancelled. Keeping existing .env file.
        pause
        exit /b 0
    )
    echo.
)

:: Create .env file with MongoDB URI
echo Creating .env file...
(
echo PORT=5001
echo MONGODB_URI=mongodb+srv://Rayulu7_db_user:n9zQJalBUtgvaFLz@cluster0.gwbiqnp.mongodb.net/?retryWrites=true&w=majority^&appName=Cluster0
echo JWT_SECRET=refhub_secret_key_2024_production_ready
echo FRONTEND_URL=http://localhost:3000
echo CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001
echo NODE_ENV=development
) > .env

echo.
echo ========================================
echo  SUCCESS! .env file created
echo ========================================
echo.
echo Configuration:
echo   - MongoDB: Connected to Cluster0
echo   - Port: 5001
echo   - JWT Secret: Set
echo   - Frontend URL: http://localhost:3000
echo.
echo Next steps:
echo   1. Run: npm install
echo   2. Run: npm start
echo.
pause

