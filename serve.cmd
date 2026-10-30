@echo off
setlocal
cd /d "%~dp0"
set PORT=8765

where python >nul 2>nul
if %errorlevel%==0 (
  echo Serving The Paper Photobooth at http://127.0.0.1:%PORT%/
  start "" "http://127.0.0.1:%PORT%/"
  python -m http.server %PORT% --bind 127.0.0.1
  goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
  echo Serving The Paper Photobooth at http://127.0.0.1:%PORT%/
  start "" "http://127.0.0.1:%PORT%/"
  py -m http.server %PORT% --bind 127.0.0.1
  goto :eof
)

echo Python 3 was not found.
echo Run any static file server in this folder, then open http://127.0.0.1:8765/
echo For example: npx --yes http-server -p 8765
pause
