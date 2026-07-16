@echo off
echo ==================================================
echo   LAUNCHING AUTOMATED LIBRARY SYSTEM...
echo ==================================================
echo.
echo 1. Opening your web browser to http://localhost:3000...
start "" "http://localhost:3000"
echo 2. Starting backend server...
cd /d "C:\Users\HP\Desktop\library-management-system"
npm start
pause
