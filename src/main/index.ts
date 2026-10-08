import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fetchAStockMetrics } from './market/eastmoney';
import { searchStock } from './market/suggest';

// 权威数据文件（userData/stock-data.json）：比 Electron localStorage(leveldb) 更稳定的持久化
const dataFile = () => path.join(app.getPath('userData'), 'stock-data.json');

ipcMain.handle('stocks:load', () => {
  try {
    const f = dataFile();
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8'));
    return null;
  } catch { return null; }
});

ipcMain.handle('stocks:save', (_event, data: unknown) => {
  try {
    fs.writeFileSync(dataFile(), JSON.stringify(data), 'utf-8');
    return true;
  } catch { return false; }
});

ipcMain.handle('market:quote', async (_event, code: string) => {
  if (!/^([036]\d{5})$/.test(code)) return null;
  try { return await fetchAStockMetrics(code); } catch { return null; }
});

ipcMain.handle('stock:search', async (_event, keyword: string) => {
  if (typeof keyword !== 'string') return [];
  try { return await searchStock(keyword); } catch { return []; }
});

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'app-icon.ico')
      : path.join(app.getAppPath(), 'assets/icons/app-icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }
}

// 单实例：重复点击图标/快捷方式不再新开窗口，而是唤起并聚焦已有窗口
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
