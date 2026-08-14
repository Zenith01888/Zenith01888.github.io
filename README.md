# Zenith01888.github.io 个人主页

一个零依赖、可直接部署到 GitHub Pages 的静态个人主页。使用原生 HTML、CSS 和 JavaScript 构建，本地包含 Lucide 图标与程序化生成的页面素材。

## 本地预览

直接在浏览器打开 `index.html`，或在当前目录启动任意静态文件服务器：

```bash
python -m http.server 8080
```

## 部署到 GitHub Pages

1. 本仓库已经使用 `Zenith01888.github.io` 作为 GitHub Pages 用户主页仓库。
2. 在 GitHub 仓库的 Settings -> Pages 中，将 Source 设置为 `main` 分支根目录。
3. 保存后，访问 `https://Zenith01888.github.io/`。

## 自定义

- 个人介绍、技能和项目文字在 `index.html` 中修改。
- 主题色、字体和布局变量在 `styles.css` 的 `:root` 中修改。
- 页面素材由 `tools/generate_assets.py` 生成，重新生成前请先安装 Pillow。
