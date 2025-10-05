#!/bin/bash
# Rust 死代码清理脚本 - 阶段1（安全删除）
# 生成日期: 2025-10-05
# 预计消除警告: ~25个

set -e  # 遇到错误立即退出

echo "🧹 Rust 死代码清理 - 阶段1"
echo "================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否在项目根目录
if [ ! -d "src-tauri" ]; then
    echo -e "${RED}❌ 错误: 请在项目根目录运行此脚本${NC}"
    exit 1
fi

# 1. 创建备份
echo "📦 创建备份..."
git add -A
git commit -m "backup: before dead code cleanup phase 1" || echo "⚠️  没有变更需要提交"
git tag backup-dead-code-cleanup-$(date +%Y%m%d-%H%M%S)
echo -e "${GREEN}✅ 备份完成${NC}"
echo ""

# 2. 删除配置系统模块
echo "🗑️  删除配置系统模块..."
if [ -d "src-tauri/src/config" ]; then
    rm -rf src-tauri/src/config/
    echo -e "${GREEN}✅ 已删除 src-tauri/src/config/${NC}"
else
    echo -e "${YELLOW}⚠️  目录不存在: src-tauri/src/config/${NC}"
fi
echo ""

# 3. 从 lib.rs 移除模块声明
echo "📝 更新 src-tauri/src/lib.rs..."
if [ -f "src-tauri/src/lib.rs" ]; then
    # 创建临时文件
    grep -v "^mod config;" src-tauri/src/lib.rs > src-tauri/src/lib.rs.tmp || true
    mv src-tauri/src/lib.rs.tmp src-tauri/src/lib.rs
    echo -e "${GREEN}✅ 已移除 config 模块声明${NC}"
else
    echo -e "${RED}❌ 找不到 src-tauri/src/lib.rs${NC}"
    exit 1
fi
echo ""

# 4. 验证编译
echo "🔨 验证编译..."
cd src-tauri
if cargo check --quiet; then
    echo -e "${GREEN}✅ 编译检查通过${NC}"
else
    echo -e "${RED}❌ 编译检查失败！${NC}"
    echo ""
    echo "回滚方法："
    echo "  git reset --hard HEAD~1"
    echo "  git tag -d \$(git tag -l 'backup-dead-code-cleanup-*' | tail -n 1)"
    exit 1
fi
cd ..
echo ""

# 5. 统计剩余警告
echo "📊 检查剩余警告..."
cd src-tauri
WARNING_COUNT=$(cargo clippy --quiet 2>&1 | grep -c "warning:" || echo "0")
echo "剩余警告数: $WARNING_COUNT"
cd ..
echo ""

# 完成
echo "================================"
echo -e "${GREEN}✅ 阶段1清理完成！${NC}"
echo ""
echo "📋 已完成："
echo "  ✅ 删除配置系统模块"
echo "  ✅ 更新 lib.rs"
echo "  ✅ 验证编译通过"
echo ""
echo "📝 下一步："
echo "  1. 测试应用功能是否正常"
echo "  2. 运行: cargo test（如果有测试）"
echo "  3. 查看详细清理计划: docs/rust-dead-code-cleanup-plan.md"
echo "  4. 执行阶段3（标记允许）或继续阶段2"
echo ""
echo "⚠️  如需回滚："
echo "  git reset --hard HEAD~1"
echo ""

