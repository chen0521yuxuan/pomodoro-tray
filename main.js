// 番茄钟 · 本地托盘版 - Electron 主进程
const electron = require('electron')
const { BrowserWindow, Tray, Menu, ipcMain, Notification, nativeImage, session } = electron
const app = electron.app
const path = require('path')

// 防呆：若以纯 Node 模式启动（环境变量 ELECTRON_RUN_AS_NODE 泄漏），
// 用干净环境重新拉起真正的 Electron 进程
if (!app) {
  const { spawn } = require('child_process')
  const env = Object.assign({}, process.env)
  delete env.ELECTRON_RUN_AS_NODE
  spawn(process.execPath, [__dirname], { env, detached: true, stdio: 'ignore' }).unref()
  process.exit(0)
}

let win = null
let tray = null
let quitting = false
let state = { running: false, remaining: 0, label: '专注', mode: 'focus', lang: 'zh' }

function L(zh, en) { return state.lang === 'en' ? en : zh }

function htmlPath() { return path.join(__dirname, '番茄钟.html') }
function icon256() { return path.join(__dirname, 'tomato.png') }
function icon32() { return path.join(__dirname, 'tomato-32.png') }

function fmt(s) {
  s = Math.max(0, Math.floor(s))
  const m = Math.floor(s / 60), r = s % 60
  return m + ':' + String(r).padStart(2, '0')
}

function createWindow() {
  win = new BrowserWindow({
    width: 520,
    height: 900,
    minWidth: 420,
    minHeight: 640,
    title: '番茄钟 · Pomodoro',
    autoHideMenuBar: true,
    icon: icon256(),
    backgroundColor: '#f5f3ee',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.loadFile(htmlPath())
  // 点 X 只隐藏，不退出；托盘常驻
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      win.hide()
      showOnceBalloon(L('番茄钟仍在后台运行，右键托盘图标可退出', 'Pomodoro is still running in the background. Right-click the tray icon to quit.'))
    }
  })
  win.on('show', rebuildMenu)
  win.on('hide', rebuildMenu)
}

function createTray() {
  const icon = nativeImage.createFromPath(icon32())
  tray = new Tray(icon)
  tray.setToolTip('番茄钟 · Pomodoro')
  tray.on('click', toggleWindow)
  tray.on('double-click', toggleWindow)
  rebuildMenu()
  ipcMain.on('pomo-state', (_e, msg) => {
    try {
      if (!msg || typeof msg !== 'object') return
      if (msg.type === 'state') {
        state = {
          running: !!msg.running,
          remaining: msg.remaining | 0,
          label: msg.label || '专注',
          mode: msg.mode || 'focus',
          lang: msg.lang === 'en' ? 'en' : 'zh',
        }
        updateTrayTooltip()
        rebuildMenu()
      } else if (msg.type === 'done') {
        onDone(msg)
      }
    } catch (err) {}
  })
}

function rebuildMenu() {
  if (!tray) return
  const menu = Menu.buildFromTemplate([
    { label: state.running ? L('暂停', 'Pause') : L('开始', 'Start'), click: () => cmd(state.running ? 'pause' : 'start') },
    { label: L('跳过', 'Skip'), click: () => cmd('skip') },
    { type: 'separator' },
    { label: win && win.isVisible() ? L('隐藏窗口', 'Hide window') : L('显示窗口', 'Show window'), click: toggleWindow },
    { type: 'separator' },
    { label: L('退出', 'Quit'), click: () => { quitting = true; app.quit() } },
  ])
  tray.setContextMenu(menu)
}

function updateTrayTooltip() {
  if (!tray) return
  const suffix = state.running ? '' : L('（已暂停）', ' (paused)')
  tray.setToolTip(L('番茄钟', 'Pomodoro') + ' · ' + state.label + ' ' + fmt(state.remaining) + suffix)
}

function cmd(name) {
  if (!win || win.isDestroyed() || !win.webContents) return
  try { win.webContents.send('pomo-cmd', name) } catch (err) {}
}

function toggleWindow() {
  if (!win) return
  if (win.isVisible()) win.hide()
  else { win.show(); win.focus() }
}

let balloonShown = false
function showOnceBalloon(text) {
  if (balloonShown) return
  balloonShown = true
  try { tray.displayBalloon({ title: L('番茄钟', 'Pomodoro'), content: text }) } catch (err) {}
}

function onDone(msg) {
  const en = (msg.lang || state.lang) === 'en'
  let title = en ? 'Break over' : '休息结束'
  let body = en ? 'Time to focus 🍅' : '开始专注吧 🍅'
  if (msg.finished === 'focus') {
    title = en ? 'Focus complete!' : '专注完成！'
    body = en ? '🍅 × ' + (msg.count || 0) + ' done — take a break ☕' : '已完成 ' + (msg.count || 0) + ' 个番茄，休息一下吧 ☕'
  } else if (msg.finished === 'long') {
    title = en ? 'Long break over' : '长休息结束'
    body = en ? 'Ready for a new round? 🍅' : '开始新的一轮专注吧 🍅'
  }
  // 窗口隐藏时由主进程发系统通知（可见时网页自己会弹）
  if (!win || !win.isVisible()) {
    try {
      if (Notification.isSupported()) {
        new Notification({ title, body, icon: icon256() }).show()
      } else {
        tray.displayBalloon({ title, content: title + '：' + body })
      }
    } catch (err) {}
  }
}

// 未打包的 Electron 应用应使用可执行文件路径作为 AppUserModelID：
// 这样任务栏能与指向 electron.exe 的快捷方式/固定项正确归组，系统通知也更可靠
app.setAppUserModelId(process.execPath)

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) { win.show(); win.focus() }
  })
  app.whenReady().then(() => {
    try {
      session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
        // 允许：系统通知、全屏（F 键）、剪贴板写入（导出备份）
        cb(permission === 'notifications' || permission === 'fullscreen' || permission === 'clipboard-sanitized-write')
      })
    } catch (err) {}
    createWindow()
    createTray()
  })
  // 窗口全部关闭也不退出（托盘常驻）
  app.on('window-all-closed', () => {})
  app.on('before-quit', () => {
    quitting = true
    try { if (tray) tray.destroy() } catch (err) {}
  })
}
