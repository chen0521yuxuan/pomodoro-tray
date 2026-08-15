// 预加载脚本：把受控的桥接接口暴露给页面
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pomoBridge', {
  // 页面 -> 主进程：状态同步 / 完成事件
  post: (msg) => {
    try { ipcRenderer.send('pomo-state', msg) } catch (e) {}
  },
  // 主进程 -> 页面：托盘菜单命令
  onCmd: (fn) => {
    ipcRenderer.on('pomo-cmd', (_e, cmd) => {
      try { fn(cmd) } catch (e) {}
    })
  },
})
