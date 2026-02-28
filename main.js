const { app, BrowserWindow, ipcMain, systemPreferences, dialog, screen, session } = require('electron');
const path = require('path');

let robot;
let mainWindow;

// Load robotjs safely
function loadRobot() {
  try {
    robot = require('@jitsi/robotjs');
    // Speed up mouse movement
    robot.setMouseDelay(0);
    console.log('[Main] robotjs loaded successfully');
    return true;
  } catch (e) {
    console.error('[Main] robotjs failed to load:', e.message);
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#0a0a0f',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  // macOS: request camera and accessibility permissions
  if (process.platform === 'darwin') {
    // Camera permission
    const camStatus = systemPreferences.getMediaAccessStatus('camera');
    if (camStatus !== 'granted') {
      await systemPreferences.askForMediaAccess('camera');
    }

    // Accessibility (for mouse control)
    const hasAccess = systemPreferences.isTrustedAccessibilityClient(false);
    if (!hasAccess) {
      dialog.showMessageBoxSync({
        type: 'warning',
        title: 'Accessibility Permission Required',
        message: 'Eye Gaze Control needs Accessibility permission to move the mouse.',
        detail:
          'Please go to:\nSystem Settings → Privacy & Security → Accessibility\n\nAdd and enable "EyeGazeControl" in the list, then restart the app.',
        buttons: ['OK — I will grant it'],
      });
      // Prompt the OS dialog
      systemPreferences.isTrustedAccessibilityClient(true);
    }
  }

  // Windows: grant camera permission for getUserMedia
  if (process.platform === 'win32') {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'media') {
        callback(true);
      } else {
        callback(false);
      }
    });
    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
      if (permission === 'media') return true;
      return false;
    });
  }

  loadRobot();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─────────────────────────────────────────────
//  IPC Handlers — called from renderer via preload
// ─────────────────────────────────────────────

ipcMain.handle('robot:getScreenSize', () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  return { width, height };
});

ipcMain.handle('robot:moveMouse', (_, x, y) => {
  if (!robot) return { ok: false, error: 'robotjs not loaded' };
  try {
    robot.moveMouse(Math.round(x), Math.round(y));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('robot:click', (_, button = 'left') => {
  if (!robot) return { ok: false, error: 'robotjs not loaded' };
  try {
    robot.mouseClick(button);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('robot:scroll', (_, direction, amount = 3) => {
  if (!robot) return { ok: false, error: 'robotjs not loaded' };
  try {
    // robotjs scrollMouse: positive y = down, negative y = up
    if (direction === 'up') robot.scrollMouse(0, -amount);
    else robot.scrollMouse(0, amount);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('robot:getMousePos', () => {
  if (!robot) return { x: 0, y: 0 };
  try {
    return robot.getMousePos();
  } catch (e) {
    return { x: 0, y: 0 };
  }
});

ipcMain.handle('robot:status', () => {
  return { loaded: !!robot };
});
