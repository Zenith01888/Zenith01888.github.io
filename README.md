# Zenith01888.github.io 个人主页

一个零依赖、可直接部署到 GitHub Pages 的静态个人主页。使用原生 HTML、CSS 和 JavaScript 构建，本地包含 Lucide 图标与程序化生成的页面素材。云上自习室部署在 `study_room/`，PDF 合并工具部署在 `categories/pdf-merge/`，PWM 监控工具部署在 `categories/pwm_monitor/`，示波器上位机浏览器演示部署在 `categories/app_Oscilloscope/web/`，都可以从主页“工具”下拉菜单或项目卡片打开。

页面右下角提供三个部件：`中 / EN` 切换中英文、`月亮 / 太阳` 切换深色与浅色模式、`黑白` 按钮切换灰度显示。偏好会保存在 `localStorage` 中；右下角同时提供回到顶部按钮。

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
- 导航栏图标放在 `img/icon/`，替换同名图片即可更新。
- 页面素材由 `tools/generate_assets.py` 生成，重新生成前请先安装 Pillow；背景图是手动替换的 `img/background.webp`。
- `categories/pdf-merge/` 是 PDF 合并工具的生产构建产物；更新工具时在 `pdf_merge` 项目根目录运行 `npm run build -- --base=./`，再替换该目录。
- `categories/pwm_monitor/` 是 PWM 监控工具页面，包含 Web Serial 串口读取、三通道频率与占空比统计、Excel 导出和自动保存。
- `categories/app_Oscilloscope/` 是示波器 Web 上位机源码与说明页；`categories/app_Oscilloscope/web/` 是可在 GitHub Pages 打开的浏览器演示版，连接真实示波器时仍需本地运行 Flask 应用。
- `study_room/` 是云上自习室页面，包含番茄钟、待办、学习统计、氛围音、沉浸模式与全屏模式。
