const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { app, BrowserWindow, clipboard, dialog, ipcMain } = require('electron');
const { listSessions, readSessionDetail } = require('./session-service');
const { findCodexExecutable, resumeSession } = require('./terminal-service');

let mainWindow;
let sessionsRootOverride = null;
let sessionIndex = new Map();

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
    if (settings.sessionsRoot && fs.existsSync(settings.sessionsRoot)) sessionsRootOverride = settings.sessionsRoot;
  } catch { /* First run or invalid settings: use the standard Codex location. */ }
}

function saveSettings() {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify({ sessionsRoot: sessionsRootOverride }, null, 2), 'utf8');
}

function codexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

function sessionsRoot() {
  return sessionsRootOverride || path.join(codexHome(), 'sessions');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0b0d0f',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.handle('sessions:list', async () => {
  const sessions = await listSessions(sessionsRoot());
  sessionIndex = new Map(sessions.map((session) => [session.id, session]));
  return sessions.map(({ filePath, ...safe }) => safe);
});

ipcMain.handle('sessions:detail', async (_event, sessionId) => {
  const session = sessionIndex.get(sessionId);
  if (!session) throw new Error('세션을 찾을 수 없습니다. 목록을 새로고침하세요.');
  return readSessionDetail(session.filePath);
});

ipcMain.handle('sessions:resume', async (_event, sessionId) => {
  const session = sessionIndex.get(sessionId);
  if (!session) throw new Error('세션을 찾을 수 없습니다. 목록을 새로고침하세요.');
  return resumeSession({ sessionId: session.id, cwd: session.cwd });
});

ipcMain.handle('sessions:choose-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: 'Codex sessions 폴더 선택' });
  if (result.canceled || !result.filePaths[0]) return null;
  sessionsRootOverride = result.filePaths[0];
  saveSettings();
  return sessionsRootOverride;
});

ipcMain.handle('app:info', () => ({ sessionsRoot: sessionsRoot(), codexPath: findCodexExecutable(), platform: process.platform }));
ipcMain.handle('clipboard:write', (_event, text) => { clipboard.writeText(String(text)); return true; });

app.whenReady().then(() => {
  app.setAppUserModelId('com.codexvibecoding.sessionmanager');
  loadSettings();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
