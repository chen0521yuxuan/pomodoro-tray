# 🍅 番茄钟 Pomodoro Tray

一个开源的番茄工作法桌面应用：专注计时、舒尔特方格专注力训练、白噪音、系统托盘常驻、完成铃声与通知。

界面与逻辑全部为原生 HTML/CSS/JavaScript，桌面壳使用 Electron，无其他运行时依赖；铃声与白噪音由 Web Audio API 实时合成，不需要任何音频文件。

## 功能特性

- 🍅 **番茄工作法**：专注 / 短休息 / 长休息，每 4 个番茄自动进入长休息，各阶段时长可自定义并自动保存
- 🎯 **舒尔特方格**：开始专注前测一测注意力（4×4 / 5×5 / 6×6，点错计数，自动记录每种规格的最佳成绩）
- 🌊 **白噪音**：合成粉红噪声，一键进入学习状态
- 🔔 **完成提醒**：合成钟声 + 系统通知，窗口最小化或隐藏时同样准时
- 🖥 **系统托盘**：悬停显示剩余时间，右键菜单开始/暂停/跳过/退出；点 × 只是隐藏窗口，倒计时继续
- 📊 **专注统计**：每日专注时长自动记录，近 7 天柱状图、连续天数、累计时长，一键导出/导入备份
- 🎯 今日目标、全屏沉浸、自动开始下一阶段、深色模式
- ⌨️ **快捷键**：`空格` 开始/暂停 · `R` 重置 · `S` 跳过 · `F` 全屏 · `Esc` 关闭测试

## 快速开始

### 网页版（零依赖）

直接双击 `番茄钟.html`，或把它拖进任意现代浏览器即可使用（除系统托盘外功能完整）。

### 桌面托盘版（Electron）

```bash
npm install
npm start
```

> 国内网络可先设置镜像再安装：
> ```bash
> npm config set registry https://registry.npmmirror.com
> # PowerShell:
> $env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
> ```

## 项目结构

| 文件 | 说明 |
| --- | --- |
| `番茄钟.html` | 完整网页应用（界面 + 全部逻辑，单文件） |
| `main.js` | Electron 主进程：窗口、托盘、通知、状态桥接、单实例锁 |
| `preload.js` | 主进程与页面的安全桥接（contextBridge） |
| `gen-icon.js` | 番茄图标生成器（PNG/ICO，纯 Node 实现，零依赖） |
| `scripts/patch-icon.js` | 把番茄图标写进 electron.exe 内置资源（基于 resedit） |

## 分享给朋友（绿色版打包）

1. `npm install` 完成后，把整个项目文件夹（含 `node_modules`）压缩为 zip，对方解压后双击即可：
   `启动番茄钟.bat` 内容为 `start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0"`
2. 想让任务栏/托盘图标变成番茄（否则显示 Electron 默认图标）：

```bash
node gen-icon.js
node scripts/patch-icon.js node_modules/electron/dist/electron.exe tomato.ico
```

## 技术栈

- HTML + CSS + 原生 JavaScript（无框架、无构建步骤）
- Electron（托盘、通知、窗口管理）
- Web Audio API（铃声、白噪音实时合成）
- localStorage（设置与统计数据持久化）

## 许可证

[MIT](./LICENSE)
