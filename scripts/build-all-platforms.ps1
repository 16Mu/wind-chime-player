# Windows PowerShell 构建脚本

Write-Host "================================" -ForegroundColor Cyan
Write-Host "WindChime Player - Windows 构建" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# 检查依赖
Write-Host "🔍 检查依赖..." -ForegroundColor Yellow

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js 未安装" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ pnpm 未安装，正在安装..." -ForegroundColor Yellow
    npm install -g pnpm
}

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Rust 未安装" -ForegroundColor Red
    Write-Host "请访问 https://rustup.rs/ 安装 Rust" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ 依赖检查完成" -ForegroundColor Green
Write-Host ""

# 安装前端依赖
Write-Host "📦 安装前端依赖..." -ForegroundColor Yellow
pnpm install
Write-Host "✅ 前端依赖安装完成" -ForegroundColor Green
Write-Host ""

# 构建
Write-Host "🔨 开始构建 Windows 版本..." -ForegroundColor Yellow
pnpm run tauri:build:windows

Write-Host ""
Write-Host "✅ Windows 构建完成！" -ForegroundColor Green
Write-Host "📁 输出位置:" -ForegroundColor Cyan

if (Test-Path "src-tauri\target\release\bundle\msi\*.msi") {
    Get-ChildItem "src-tauri\target\release\bundle\msi\*.msi" | ForEach-Object {
        Write-Host "  MSI: $($_.FullName)" -ForegroundColor White
    }
}

if (Test-Path "src-tauri\target\release\bundle\nsis\*.exe") {
    Get-ChildItem "src-tauri\target\release\bundle\nsis\*.exe" | ForEach-Object {
        Write-Host "  EXE: $($_.FullName)" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "✨ 构建完成！" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan

