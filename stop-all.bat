@echo off
title Stop Studevo Platform
powershell -ExecutionPolicy Bypass -File "%~dp0stop-all.ps1"
timeout /t 2 >nul
