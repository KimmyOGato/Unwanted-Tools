#!/usr/bin/env powershell

# Setup script for Wayback Media Saver
# Run: .\setup.ps1

Write-Host "Wayback Media Saver - Setup Script" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Check if Node.js is installed
Write-Host "`nChecking for Node.js..." -ForegroundColor Yellow
$nodeExists = (Get-Command node -ErrorAction SilentlyContinue) -ne $null

if (-not $nodeExists) {
  Write-Host "Node.js not found!" -ForegroundColor Red
  Write-Host "`nPlease install Node.js 16+ from: https://nodejs.org/" -ForegroundColor Yellow
  Write-Host "Then run this script again." -ForegroundColor Yellow
  exit 1
}

$nodeVersion = node -v
Write-Host "✓ Node.js $nodeVersion found" -ForegroundColor Green

# Install dependencies
Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
  Write-Host "Installation failed!" -ForegroundColor Red
  exit 1
}

Write-Host "`n✓ Installation complete!" -ForegroundColor Green
Write-Host "`nTo start the app:" -ForegroundColor Cyan
Write-Host "  npm run electron-dev   (development with hot-reload)" -ForegroundColor Cyan
Write-Host "  npm run electron-build (production build)" -ForegroundColor Cyan
Write-Host "  npm start              (run production build)" -ForegroundColor Cyan