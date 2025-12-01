# OpenCode V2 发布流程指南

## 📋 发布前准备清单

### 1. 环境变量配置

**首次发布前必须配置：**

```bash
# VSCode Marketplace 的 Personal Access Token
export VSCE_PAT=your_vscode_marketplace_token

# OpenVSX 的 Token（用于 Cursor 等开源编辑器）
export OPENVSX_TOKEN=your_openvsx_token
```

**持久化配置（推荐）：**

将环境变量添加到 `~/.zshrc` 或 `~/.bashrc`：

```bash
# 添加到 ~/.zshrc
export VSCE_PAT=your_vscode_marketplace_token
export OPENVSX_TOKEN=your_openvsx_token
```

然后执行：
```bash
source ~/.zshrc
```

**验证环境变量：**
```bash
echo $VSCE_PAT
echo $OPENVSX_TOKEN
```

### 2. 依赖工具检查

确保已安装必要的工具：

```bash
# 检查 vsce（VSCode Extension 打包工具）
which vsce || npm install -g @vscode/vsce

# 检查 ovsx（OpenVSX 发布工具）
which ovsx || npm install -g ovsx
```

## 🚀 完整发布流程（首次发布）

### 步骤 1: 测试打包好的插件

```bash
cd sdks/vscode-v2

# 1. 构建插件
bun run package

# 2. 打包为 .vsix
vsce package --no-dependencies --no-git-tag-version --no-update-package-json -o dist/opencode.vsix 0.1.0

# 3. 在 VSCode/Cursor 中安装测试
# Cmd+Shift+P -> Extensions: Install from VSIX...
# 选择 dist/opencode.vsix

# 4. 测试功能
# - 打开插件 (Cmd+Shift+Esc)
# - 测试基本功能
# - 确认没有明显问题
```

### 步骤 2: 提交代码并 Push

```bash
# 1. 检查修改的文件
git status

# 2. 添加需要提交的文件（不要用 git add .）
git add sdks/vscode-v2/
git add script/  # 如果有修改发布脚本

# 3. 提交
git commit -m "fix: WebView loading issue in packaged extension

- Fix asset copying in esbuild.js
- Update panel.ts path resolution for packaged extension
- Fix release script tag format"

# 4. 推送到远程
git push origin feature/vscode-v2
```

### 步骤 3: 创建版本 Tag（首次手动创建）

```bash
# 创建第一个版本 tag
git tag vscode-v0.1.0

# 推送 tag（需要 --no-verify 绕过 pre-push hook）
git push --tags --no-verify
```

**注意：** 首次发布必须手动创建 tag，后续版本可以使用 `./script/release` 自动创建。

### 步骤 4: 发布到市场

**确保环境变量已配置：**

```bash
# 验证环境变量
echo "VSCE_PAT: ${VSCE_PAT:0:10}..."  # 只显示前10个字符
echo "OPENVSX_TOKEN: ${OPENVSX_TOKEN:0:10}..."
```

**执行发布：**

```bash
cd sdks/vscode-v2

# 使用自动化脚本发布（推荐）
./script/publish
```

**脚本会自动：**
1. 检查环境变量
2. 查找最新的 `vscode-v*` tag
3. 构建插件（`bun run package`）
4. 打包为 .vsix
5. 发布到 VSCode Marketplace
6. 发布到 OpenVSX

## 🔄 后续版本发布流程（自动化）

### 使用 release 脚本创建新版本

```bash
cd sdks/vscode-v2

# Patch 版本 +1 (0.1.0 -> 0.1.1)
./script/release

# Minor 版本 +1 (0.1.5 -> 0.2.0)
./script/release --minor
```

**脚本会自动：**
1. 查找最新的 `vscode-v*` tag
2. 递增版本号
3. 创建新 tag
4. 推送 tag 到远程

### 使用 publish 脚本发布

```bash
cd sdks/vscode-v2

# 发布到两个市场
./script/publish
```

## 📝 关于 V2 命名的建议

### 当前情况

- **旧版本插件：** `opencode` (ID: `sst-dev.opencode`)
- **新版本插件：** `opencode-v2` (ID: `sst-dev.opencode-v2`)

### 命名考虑

**优点：**
- ✅ 明确区分新旧版本，避免用户混淆
- ✅ 过渡期可以同时存在，方便用户迁移
- ✅ 等旧版本下架后，可以去掉 V2 或重命名

**潜在问题：**
- ⚠️ 用户可能觉得 V2 是"测试版"或"不完整版"
- ⚠️ 未来去掉 V2 时，需要重新发布（但可以保持向后兼容）

### 建议方案

**方案 1：保持 V2（推荐）**
- 现在保持 `opencode-v2`
- 等旧版本下架后，可以考虑：
  - 保持 V2（如果用户已经习惯）
  - 或者发布新版本时去掉 V2，改名为 `opencode-assistant` 或 `opencode-pro`

**方案 2：现在就改名**
- 改名为 `opencode-assistant` 或 `opencode-pro`
- 优点：避免 V2 带来的困惑
- 缺点：需要重新配置，且与旧版本区分度降低

**我的建议：**
- **现在保持 V2**，因为：
  1. 过渡期需要明确区分新旧版本
  2. 用户已经知道这是 V2 版本
  3. 等旧版本下架后，可以再考虑是否去掉 V2
  4. 如果未来要去掉 V2，可以在发布 1.0.0 时考虑改名

### 未来迁移计划

当旧版本下架后，可以考虑：

1. **保持 V2** - 如果用户已经习惯，且不影响使用
2. **去掉 V2** - 发布新版本时，修改 `package.json` 中的 `name` 和 `displayName`
3. **改名** - 改为 `opencode-assistant` 或更合适的名字

**注意：** 如果改名，需要：
- 修改 `package.json` 中的 `name` 和 `displayName`
- 用户需要卸载旧版本，安装新版本
- 但可以保持相同的功能，只是名字不同

## 🐛 常见问题

### 1. 发布失败：环境变量未设置

**错误：**
```
❌ Error: VSCE_PAT environment variable is not set
```

**解决：**
```bash
export VSCE_PAT=your_token
export OPENVSX_TOKEN=your_token
```

### 2. 发布失败：找不到 Tag

**错误：**
```
❌ Error: No tags found matching pattern 'vscode-v*.*.*'
```

**解决：**
```bash
# 首次发布需要手动创建 tag
git tag vscode-v0.1.0
git push --tags --no-verify
```

### 3. 发布失败：版本已存在

**错误：**
```
Error: Extension version already exists
```

**解决：**
```bash
# 使用 release 脚本创建新版本
./script/release
# 然后重新发布
./script/publish
```

### 4. Tag 格式错误

**问题：** `release` 脚本创建的 tag 格式不对

**解决：** 已修复，现在会自动添加 `vscode-v` 前缀

## 📚 相关文件

- `script/release` - 创建新版本 tag
- `script/publish` - 打包并发布到市场
- `package.json` - 插件配置和版本号
- `RELEASE.md` - 本文档

## ✅ 发布检查清单

发布前确认：
- [ ] 代码已测试，功能正常
- [ ] 代码已提交并推送到远程
- [ ] 已创建版本 tag
- [ ] 环境变量已配置（VSCE_PAT, OPENVSX_TOKEN）
- [ ] 已安装必要工具（vsce, ovsx）
- [ ] 本地打包测试通过

发布后确认：
- [ ] VSCode Marketplace 显示新版本
- [ ] OpenVSX 显示新版本
- [ ] 可以正常安装和运行
- [ ] 功能测试通过

