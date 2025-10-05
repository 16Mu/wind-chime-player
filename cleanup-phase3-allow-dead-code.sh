#!/bin/bash
# Rust 死代码清理脚本 - 阶段3（标记允许）
# 生成日期: 2025-10-05
# 预计消除警告: ~96个

set -e

echo "⚠️  Rust 死代码清理 - 阶段3（标记允许）"
echo "================================"
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查是否在项目根目录
if [ ! -d "src-tauri" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

echo "📝 为预留功能添加 #[allow(dead_code)] 标记..."
echo ""

# 定义需要添加标记的文件
declare -a FILES=(
    "src-tauri/src/player/types/errors.rs"
    "src-tauri/src/player/types/events.rs"
    "src-tauri/src/player/types/commands.rs"
    "src-tauri/src/player/actors/preload_actor.rs"
    "src-tauri/src/player/actors/state_actor.rs"
    "src-tauri/src/player/actors/audio_actor.rs"
    "src-tauri/src/webdav/auth.rs"
    "src-tauri/src/webdav/safe_stream.rs"
    "src-tauri/src/remote_source/client_manager.rs"
    "src-tauri/src/remote_source/scanner.rs"
    "src-tauri/src/remote_source/types.rs"
)

# 为每个文件添加 #![allow(dead_code)]
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        # 检查是否已经有这个标记
        if grep -q "#!\[allow(dead_code)\]" "$file"; then
            echo -e "${YELLOW}⚠️  已存在标记: $file${NC}"
        else
            # 在文件开头（在现有注释和use语句之后）添加标记
            # 查找第一个非注释、非空行的位置
            echo "  添加标记到: $file"
            
            # 创建临时文件，在模块级文档注释后、第一个实际代码前插入
            awk '
            BEGIN { added = 0 }
            /^(\/\/|#\[|use |pub |mod |extern |$)/ { 
                if (!added && !/^\/\// && !/^$/ && !/^#!\[/) {
                    print "#![allow(dead_code)]"
                    print ""
                    added = 1
                }
            }
            { print }
            ' "$file" > "$file.tmp"
            
            mv "$file.tmp" "$file"
            echo -e "${GREEN}  ✅ 已添加${NC}"
        fi
    else
        echo "  ⚠️  文件不存在: $file"
    fi
done

echo ""
echo "================================"
echo -e "${GREEN}✅ 阶段3完成！${NC}"
echo ""
echo "📋 已为 ${#FILES[@]} 个文件添加标记"
echo ""
echo "🔨 验证编译..."
cd src-tauri
if cargo check --quiet 2>/dev/null; then
    echo -e "${GREEN}✅ 编译检查通过${NC}"
else
    echo "⚠️  编译有问题，请检查"
fi

echo ""
echo "📊 检查剩余警告..."
WARNING_COUNT=$(cargo clippy --quiet 2>&1 | grep -c "warning:" || echo "0")
echo "剩余警告数: $WARNING_COUNT"
cd ..

echo ""
echo "✅ 完成！现在可以提交更改："
echo "  git add -A"
echo "  git commit -m 'chore: add allow(dead_code) for reserved features'"
echo ""

