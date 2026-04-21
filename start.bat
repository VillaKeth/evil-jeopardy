@echo off
echo ============================================
echo   Evil Jeopardy² — Starting Server
echo ============================================
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    echo.
)

:: Start the server
echo Starting server...
node server/index.js
