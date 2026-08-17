@echo off
echo =======================================================
echo   TRACKTOR WORKS AND REPAIRS - WORKSHOP DASHBOARD
echo =======================================================
echo.
echo [1/3] Installing Python dependencies (Flask)...
pip install -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo.
    echo WARNING: Failed to install requirements using pip. 
    echo Ensure Python is added to your PATH and internet is connected.
    echo.
)
echo.
echo [2/3] Initializing SQLite database with 42 customers, 18 orders, financial records...
python -c "import database; database.init_db()"
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Database initialization failed.
    echo Please make sure Python is installed correctly.
    pause
    exit /b
)
echo.
echo [3/3] Launching web browser and starting local Flask server...
start http://127.0.0.1:5000/
python app.py
pause
