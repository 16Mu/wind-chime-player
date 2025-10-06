# WindChime Player 官网部署指南

## 🚀 自动部署（GitHub Pages）

### 第一次设置

1. **启用 GitHub Pages**
   - 进入仓库 Settings → Pages
   - Source 选择 "GitHub Actions"
   - 保存设置

2. **推送代码触发部署**
   ```bash
   git add website/
   git commit -m "feat: add official website"
   git push origin master
   ```

3. **查看部署状态**
   - 进入仓库的 Actions 标签页
   - 查看 "Deploy Website to GitHub Pages" 工作流
   - 等待构建完成（约 2-3 分钟）

4. **访问网站**
   - 部署成功后访问: https://16mu.github.io/wind-chime-player/

### 后续更新

修改 `website/` 目录下的任何文件后：

```bash
git add website/
git commit -m "update: website content"
git push origin master
```

GitHub Actions 会自动检测到变化并重新部署。

## 🔧 手动部署

### 构建

```bash
cd website
npm install
npm run build
```

构建产物在 `website/dist/` 目录。

### 部署到其他平台

#### Vercel

1. 导入 GitHub 仓库
2. 设置根目录为 `website`
3. 构建命令: `npm run build`
4. 输出目录: `dist`

#### Netlify

1. 拖拽 `website/dist/` 文件夹到 Netlify
2. 或连接 GitHub 仓库自动部署

#### 自有服务器

将 `website/dist/` 目录内容上传到 Web 服务器：

```bash
# 使用 rsync
rsync -avz dist/ user@server:/var/www/html/

# 或使用 scp
scp -r dist/* user@server:/var/www/html/
```

## 🌐 自定义域名

### GitHub Pages

1. 购买域名（如 windchime.app）
2. 添加 DNS 记录：
   ```
   类型: CNAME
   名称: www
   值: 16mu.github.io
   ```
3. 在仓库 Settings → Pages → Custom domain 填入域名
4. 等待 DNS 生效（最多 24 小时）

### Vercel/Netlify

在平台设置中添加自定义域名，按照提示配置 DNS 即可。

## 🔒 HTTPS

GitHub Pages、Vercel 和 Netlify 都会自动提供免费的 HTTPS 证书（Let's Encrypt）。

自有服务器可以使用 Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## 📊 监控和分析

### Google Analytics

1. 在 `website/index.html` 的 `<head>` 中添加:

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### Plausible Analytics（开源、隐私友好）

```html
<script defer data-domain="yourdomain.com" src="https://plausible.io/js/script.js"></script>
```

## 🐛 故障排查

### 构建失败

查看 GitHub Actions 日志：
- 进入 Actions 标签页
- 点击失败的工作流
- 查看详细错误信息

常见问题：
- Node.js 版本不匹配
- 依赖安装失败
- TypeScript 类型错误

### 404 错误

确保 `vite.config.ts` 中的 `base` 配置正确：

```ts
base: '/wind-chime-player/'  // 与仓库名一致
```

### 样式或资源加载失败

检查浏览器控制台的网络请求，确保所有资源的 URL 正确。

## 📝 环境变量

如果需要使用环境变量（如 API 密钥），在 GitHub 仓库设置中添加：

Settings → Secrets and variables → Actions → New repository secret

在代码中使用：
```ts
const apiKey = import.meta.env.VITE_API_KEY
```

## 🔄 回滚

如果新版本有问题，可以回滚到之前的部署：

1. 进入 Actions 标签页
2. 找到之前成功的工作流
3. 点击 "Re-run all jobs"

## 📚 相关资源

- [GitHub Pages 文档](https://docs.github.com/pages)
- [Vite 部署指南](https://vitejs.dev/guide/static-deploy.html)
- [React Router 部署](https://reactrouter.com/en/main/start/tutorial#deploying)

