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
let state = { running: false, remaining: 0, label: '专注', mode: 'focus' }

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
    title: '番茄钟',
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
      showOnceBalloon('番茄钟仍在后台运行，右键托盘图标可退出')
    }
  })
  win.on('show', rebuildMenu)
  win.on('hide', rebuildMenu)
}

function createTray() {
  const icon = nativeImage.createFromPath(icon32())
  tray = new Tray(icon)
  tray.setToolTip('番茄钟')
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
    { label: state.running ? '暂停' : '开始', click: () => cmd(state.running ? 'pause' : 'start') },
    { label: '跳过', click: () => cmd('skip') },
    { type: 'separator' },
    { label: win && win.isVisible() ? '隐藏窗口' : '显示窗口', click: toggleWindow },
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; app.quit() } },
  ])
  tray.setContextMenu(menu)
}

function updateTrayTooltip() {
  if (!tray) return
  const suffix = state.running ? '' : '（已暂停）'
  tray.setToolTip('番茄钟 · ' + state.label + ' ' + fmt(state.remaining) + suffix)
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
  try { tray.displayBalloon({ title: '番茄钟', content: text }) } catch (err) {}
}

function onDone(msg) {
  let title = '休息结束'
  let body = '开始专注吧 🍅'
  if (msg.finished === 'focus') { title = '专注完成！'; body = '已完成 ' + (msg.count || 0) + ' 个番茄，休息一下吧 ☕' }
  else if (msg.finished === 'long') { title = '长休息结束'; body = '开始新的一轮专注吧 🍅' }
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
