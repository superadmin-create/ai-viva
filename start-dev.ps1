# Development Server Startup Script
# Kills any existing process on port 3000 and starts the dev server

Write-Host "Checking for processes on port 3000..." -ForegroundColor Yellow

$connection = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($connection) {
    $processId = $connection | Select-Object -ExpandProperty OwningProcess -Unique
    Write-Host "Found process $processId on port 3000. Killing it..." -ForegroundColor Yellow
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Write-Host "Process killed." -ForegroundColor Green
}

Write-Host "Current directory: $(Get-Location)" -ForegroundColor Green
Write-Host "Checking for package.json..." -ForegroundColor Yellow

if (Test-Path "package.json") {
    Write-Host "✓ package.json found" -ForegroundColor Green
    Write-Host "Starting Next.js development server on port 3000..." -ForegroundColor Yellow
    Write-Host ""
    npm run dev
} else {
    Write-Host "✗ ERROR: package.json not found!" -ForegroundColor Red
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Red
    Write-Host "Please navigate to the project directory manually." -ForegroundColor Yellow
}

