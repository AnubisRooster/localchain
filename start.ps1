# ──────────────────────────────────────────────────────────────
# LocalChain – Full Stack Launcher (Windows PowerShell)
# Installs deps, builds frontend, and starts everything via PM2.
# ──────────────────────────────────────────────────────────────
$ErrorActionPreference = "Stop"

$ROOT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ROOT_DIR

Write-Host ""
Write-Host "⛓  LocalChain Full Stack Launcher" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────"

# ── Check prerequisites ──────────────────────────────────────
foreach ($cmd in @("node", "npm")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "✖ '$cmd' is required. Install Node.js >= 18 first." -ForegroundColor Red
        exit 1
    }
}

# ── Install PM2 globally ────────────────────────────────────
if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Host "📦 Installing PM2..."
    npm install -g pm2
}

# ── Install backend deps ────────────────────────────────────
Write-Host "📦 Installing backend dependencies..."
Push-Location "$ROOT_DIR\dashboard\backend"
npm install --production
Pop-Location

# ── Install & build frontend ────────────────────────────────
Write-Host "📦 Installing frontend dependencies..."
Push-Location "$ROOT_DIR\dashboard\frontend"
npm install
Write-Host "🔨 Building frontend..."
npm run build
Pop-Location

# ── Start everything with PM2 ───────────────────────────────
Set-Location $ROOT_DIR
Write-Host "▶️  Starting services..."
pm2 start ecosystem.config.js
pm2 save

# ── Get Tailscale IP ─────────────────────────────────────────
$tsIP = ""
if (Get-Command tailscale -ErrorAction SilentlyContinue) {
    try { $tsIP = (tailscale ip -4 2>$null).Trim() } catch {}
}
$displayIP = if ($tsIP) { $tsIP } else { "localhost" }

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ⛓  LocalChain Stack Running" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Dashboard : http://${displayIP}:3000"
Write-Host "  Backend   : http://${displayIP}:4000"
Write-Host "  REST API  : http://${displayIP}:1317"
Write-Host "  RPC       : http://${displayIP}:26657"
Write-Host ""
Write-Host "  PM2 status: pm2 status"
Write-Host "  PM2 logs  : pm2 logs"
Write-Host "  Stop all  : pm2 stop all"
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
