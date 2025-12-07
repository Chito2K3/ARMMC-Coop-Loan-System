@echo off
cd /d "%~dp0"
git add .
git commit -m "Add For Approval and Input Salary features with approval workflow"
git push origin main
pause
