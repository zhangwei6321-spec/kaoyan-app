# ⏳ 备考助手 · 倒计时与打卡

> 考研 / 国考备考 PWA —— 考试倒计时、每日打卡、正计时 / 倒计时 / 番茄钟。纯前端，无后端，数据存放在本机浏览器。

🔗 **在线访问：<https://zhangwei6321-spec.github.io/kaoyan-app/>**

## ✨ 功能

底部四个标签页：

| 标签 | 说明 |
|------|------|
| ⏳ 倒计时 | 考试日倒计时，卡片式显示剩余天数 |
| ✅ 打卡 | 每日学习打卡记录 |
| ⏱ 计时 | 正计时 / 倒计时 / 番茄钟 |
| 👤 我的 | 设置与本地数据管理 |

已配置 `manifest.json` 与 `sw.js`，手机浏览器打开后可「添加到主屏幕」当 App 用。

## 🛠 本地运行

纯静态，零构建。Service Worker 需要 http 环境（`file://` 下不生效）：

```bash
python3 -m http.server 8080
# 打开 http://127.0.0.1:8080
```

## 📁 目录

```
index.html      入口（视图由 JS 渲染）
css/style.css   样式
js/app.js       全部逻辑
icons/          应用图标
manifest.json   PWA 配置
sw.js           Service Worker
```

## 📦 部署

GitHub Pages，`main` 分支根目录直接发布，推送即更新。
