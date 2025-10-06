#!/bin/bash
# 本地构建脚本 - 用于在不同平台上本地构建

set -e

echo "================================"
echo "WindChime Player - 多平台构建"
echo "================================"
echo ""

# 检测操作系统
OS=""
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    OS="windows"
else
    echo "❌ 不支持的操作系统: $OSTYPE"
    exit 1
fi

echo "📦 检测到操作系统: $OS"
echo ""

# 检查依赖
echo "🔍 检查依赖..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm 未安装，正在安装..."
    npm install -g pnpm
fi

if ! command -v cargo &> /dev/null; then
    echo "❌ Rust 未安装"
    echo "请访问 https://rustup.rs/ 安装 Rust"
    exit 1
fi

echo "✅ 依赖检查完成"
echo ""

# Linux 特定依赖
if [ "$OS" == "linux" ]; then
    echo "🐧 检查 Linux 系统依赖..."
    MISSING_DEPS=()
    
    # 检查必需的库
    for pkg in libgtk-3-dev libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev patchelf libasound2-dev; do
        if ! dpkg -l | grep -q $pkg; then
            MISSING_DEPS+=($pkg)
        fi
    done
    
    if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
        echo "❌ 缺少以下系统依赖:"
        printf '%s\n' "${MISSING_DEPS[@]}"
        echo ""
        echo "请运行以下命令安装:"
        echo "sudo apt-get install -y ${MISSING_DEPS[@]}"
        exit 1
    fi
    
    echo "✅ Linux 系统依赖完整"
    echo ""
fi

# 安装前端依赖
echo "📦 安装前端依赖..."
pnpm install
echo "✅ 前端依赖安装完成"
echo ""

# 构建
echo "🔨 开始构建..."
case "$OS" in
    macos)
        echo "🍎 构建 macOS 版本 (Universal Binary)..."
        pnpm run tauri:build:macos
        echo ""
        echo "✅ macOS 构建完成！"
        echo "📁 输出位置:"
        ls -lh src-tauri/target/release/bundle/dmg/*.dmg 2>/dev/null || echo "  (未生成 DMG)"
        ls -lh src-tauri/target/release/bundle/macos/*.app 2>/dev/null || echo "  (未生成 APP)"
        ;;
    linux)
        echo "🐧 构建 Linux 版本..."
        pnpm run tauri:build:linux
        echo ""
        echo "✅ Linux 构建完成！"
        echo "📁 输出位置:"
        ls -lh src-tauri/target/release/bundle/deb/*.deb 2>/dev/null || echo "  (未生成 DEB)"
        ls -lh src-tauri/target/release/bundle/appimage/*.AppImage 2>/dev/null || echo "  (未生成 AppImage)"
        ;;
    windows)
        echo "🪟 构建 Windows 版本..."
        pnpm run tauri:build:windows
        echo ""
        echo "✅ Windows 构建完成！"
        echo "📁 输出位置:"
        ls -lh src-tauri/target/release/bundle/msi/*.msi 2>/dev/null || echo "  (未生成 MSI)"
        ls -lh src-tauri/target/release/bundle/nsis/*.exe 2>/dev/null || echo "  (未生成 EXE)"
        ;;
esac

echo ""
echo "================================"
echo "✨ 构建完成！"
echo "================================"

