@echo off
title MDMan Local Server launcher
echo ===================================================
echo   📝 MDMan - 프리미엄 마크다운 폴더 관리자 구동기
echo ===================================================
echo.
echo 1. 백엔드 FastAPI 서버를 구동 중입니다...

:: Start the Python server in a new window or in the background, or directly
:: To let the browser open, we can start the browser slightly delayed or let the server run
:: A clean way is to start the server in the current window and let another command start the browser,
:: but if we run uvicorn it blocks. So we can use 'start' to open the browser first or after a short delay!

echo 2. 기본 웹 브라우저를 열어 http://127.0.0.1:8000 에 접속합니다.
start http://127.0.0.1:8000

echo.
echo ---------------------------------------------------
echo 서버를 종료하려면 이 창에서 [Ctrl + C]를 누르세요.
echo ---------------------------------------------------
echo.

python mdman_server.py
pause
