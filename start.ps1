param(
    [switch]$SkipOllama
)

$ErrorActionPreference = "Stop"
$ProjectDir = $PSScriptRoot

Write-Host ""
Write-Host "   ___     ____     ___     ___ " -ForegroundColor Magenta
Write-Host "  / _ |   / __ \   |_ _|   / _ |" -ForegroundColor Magenta
Write-Host " / __ |  / /_/ /    | |   / __ |" -ForegroundColor Magenta
Write-Host "/_/ |_| /_/ \_\   |___|  /_/ |_|" -ForegroundColor Magenta
Write-Host " Autonomous Reactive Intelligence Assistant" -ForegroundColor Cyan
Write-Host " ==========================================" -ForegroundColor Cyan
Write-Host ""

cd $ProjectDir

Write-Host "[*] Verificando y limpiando procesos anteriores..." -ForegroundColor Yellow
Stop-Process -Name "python" -ErrorAction SilentlyContinue
Stop-Process -Name "node" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

if (-not $SkipOllama) {
    Write-Host "[*] Verificando Motor Local de IA (Ollama)..." -ForegroundColor Blue
    try {
        $ollamaStatus = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -ErrorAction Stop
        Write-Host "   [+] Ollama activo en http://127.0.0.1:11434" -ForegroundColor Green
    } catch {
        Write-Host "   [-] Iniciando servicio Ollama en segundo plano..."
        Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
        Start-Sleep -Seconds 5
    }
}

Write-Host "[*] Iniciando Backend (FastAPI, SQLite, Watchdogs & RAG Vectorial)..." -ForegroundColor Blue
Start-Process -FilePath "cmd.exe" -ArgumentList "/k set PYTHONIOENCODING=utf-8 && py server.py" -WindowStyle Normal

Write-Host "[*] Iniciando Frontend (Vite + React 19)..." -ForegroundColor Blue
Start-Process -FilePath "cmd.exe" -ArgumentList "/k npm run dev -- --open" -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host "`n[*] Servicios de A.R.I.A lanzados en nuevas ventanas!" -ForegroundColor Green
Write-Host "--------------------------------------------------------------------"
Write-Host "  Dashboard Local:       http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Backend API / Docs:    http://127.0.0.1:8000/docs" -ForegroundColor Cyan
Write-Host "  Motor LLM (Ollama):    http://127.0.0.1:11434" -ForegroundColor Cyan
Write-Host "--------------------------------------------------------------------`n"
