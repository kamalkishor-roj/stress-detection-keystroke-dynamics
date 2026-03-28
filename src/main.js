const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, globalShortcut } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { mouseEvents } = require('./mouse-tracker');

let mainWindow;
let tray;
let isTracking = false;
let trackingInterval = null;
let batchBuffer = [];
let results = [];

// Per-second snapshot
let currentSecond = {
  keystrokes: 0,
  keyHoldDurations: [],
  keyIntervals: [],
  mouseMovements: [],
  mouseClicks: 0,
  scrollEvents: 0,
  mouseSpeed: [],
  timestamp: null,
};

let lastKeyTime = null;
let lastMousePos = { x: 0, y: 0 };
let lastMouseTime = null;
let keyboardListener = null;
let mouseTracker = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 700,
    minHeight: 550,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: isTracking ? '🟢 Tracking Active' : '⚪ Not Tracking',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Open App',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: isTracking ? 'Stop Tracking' : 'Start Tracking',
      click: () => {
        if (isTracking) {
          stopTracking();
          mainWindow.show();
          mainWindow.focus();
        } else {
          startTracking();
          mainWindow.hide();
        }
        updateTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
  tray.setToolTip(isTracking ? 'Cognitive Load Detector — Tracking...' : 'Cognitive Load Detector');
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  updateTrayMenu();

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

// ── Keystroke Listener ──────────────────────────────────────────────────────
function startKeyboardListener() {
  try {
    const { uIOhook } = require('uiohook-napi');
    let keyDownTimes = {};

    uIOhook.on('keydown', (e) => {
      if (!isTracking) return;
      const now = Date.now();
      keyDownTimes[e.keycode] = now;
      currentSecond.keystrokes++;

      if (lastKeyTime !== null) {
        currentSecond.keyIntervals.push(now - lastKeyTime);
      }
      lastKeyTime = now;
    });

    uIOhook.on('keyup', (e) => {
      if (!isTracking) return;
      if (keyDownTimes[e.keycode]) {
        const holdDuration = Date.now() - keyDownTimes[e.keycode];
        currentSecond.keyHoldDurations.push(holdDuration);
        delete keyDownTimes[e.keycode];
      }
    });

    // uIOhook may already be started by mouse-tracker; calling start() again is safe
    if (!uIOhook.isRunning) uIOhook.start();
    keyboardListener = uIOhook;
  } catch (err) {
    console.warn('Keyboard listener not available:', err.message);
  }
}

// ── Mouse Tracker ───────────────────────────────────────────────────────────
function startMouseListener() {
  try {
    const tracker = mouseEvents();

    tracker.on('mousemove', (event) => {
      if (!isTracking) return;
      const now = Date.now();
      const dx = event.x - lastMousePos.x;
      const dy = event.y - lastMousePos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (lastMouseTime !== null) {
        const dt = (now - lastMouseTime) / 1000;
        if (dt > 0) {
          currentSecond.mouseSpeed.push(dist / dt);
        }
      }

      currentSecond.mouseMovements.push({ x: event.x, y: event.y });
      lastMousePos = { x: event.x, y: event.y };
      lastMouseTime = now;
    });

    tracker.on('mouseclick', () => {
      if (!isTracking) return;
      currentSecond.mouseClicks++;
    });

    tracker.on('mousescroll', () => {
      if (!isTracking) return;
      currentSecond.scrollEvents++;
    });

    mouseTracker = tracker;
  } catch (err) {
    console.warn('Mouse tracker not available:', err.message);
  }
}

// ── Snapshot every second ───────────────────────────────────────────────────
function snapshotSecond() {
  const snapshot = {
    timestamp: Date.now(),
    keystrokes_per_second: currentSecond.keystrokes,
    avg_key_hold_duration_ms:
      currentSecond.keyHoldDurations.length > 0
        ? average(currentSecond.keyHoldDurations)
        : 0,
    avg_key_interval_ms:
      currentSecond.keyIntervals.length > 0
        ? average(currentSecond.keyIntervals)
        : 0,
    mouse_movement_count: currentSecond.mouseMovements.length,
    mouse_clicks: currentSecond.mouseClicks,
    scroll_events: currentSecond.scrollEvents,
    avg_mouse_speed: currentSecond.mouseSpeed.length > 0
      ? average(currentSecond.mouseSpeed)
      : 0,
    mouse_path_length: currentSecond.mouseMovements.length > 1
      ? pathLength(currentSecond.mouseMovements)
      : 0,
  };

  batchBuffer.push(snapshot);

  // Reset second counter
  currentSecond = {
    keystrokes: 0,
    keyHoldDurations: [],
    keyIntervals: [],
    mouseMovements: [],
    mouseClicks: 0,
    scrollEvents: 0,
    mouseSpeed: [],
    timestamp: null,
  };

  // Update UI with live progress
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tracking-progress', {
      secondsRecorded: batchBuffer.length,
      totalNeeded: 30,
    });
  }

  // Every 30 seconds, send batch to ML model
  if (batchBuffer.length >= 30) {
    const batch = batchBuffer.splice(0, 30);
    sendToMLModel(batch);
  }
}

// ── Send batch to Python ML model ──────────────────────────────────────────
function sendToMLModel(batch) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('ml-processing', true);
  }

  const pythonScript = path.join(__dirname, '../ml/model.py');
  const inputJson = JSON.stringify({ batch });

  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const python = spawn(pythonCmd, [pythonScript], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  python.stdin.write(inputJson);
  python.stdin.end();

  let output = '';
  let errorOutput = '';

  python.stdout.on('data', (data) => {
    output += data.toString();
  });

  python.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });

  python.on('close', (code) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ml-processing', false);
    }

    if (code === 0 && output.trim()) {
      try {
        const result = JSON.parse(output.trim());
        const entry = {
          id: Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          result,
          batchSize: batch.length,
        };
        results.push(entry);

        // Notify via tray balloon if window is hidden
        if (tray && mainWindow && !mainWindow.isVisible()) {
          try {
            tray.displayBalloon({
              title: 'Cognitive Load Result',
              content: `Level: ${result.cognitive_load_level || JSON.stringify(result).slice(0, 60)}`,
              iconType: 'info',
            });
          } catch (e) {}
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('new-result', entry);
        }
      } catch (e) {
        // Raw string result
        const entry = {
          id: Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          result: { output: output.trim() },
          batchSize: batch.length,
        };
        results.push(entry);

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('new-result', entry);
        }
      }
    } else {
      const entry = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        result: { error: errorOutput || 'ML model returned no output', code },
        batchSize: batch.length,
      };
      results.push(entry);

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('new-result', entry);
      }
    }
  });

  python.on('error', (err) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ml-processing', false);
    }
    const entry = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      result: { error: `Failed to run Python: ${err.message}` },
      batchSize: batch.length,
    };
    results.push(entry);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('new-result', entry);
    }
  });
}

function startTracking() {
  if (isTracking) return;
  isTracking = true;
  batchBuffer = [];
  lastKeyTime = null;
  lastMouseTime = null;

  startKeyboardListener();
  startMouseListener();

  trackingInterval = setInterval(snapshotSecond, 1000);

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tracking-state', true);
  }

  // Tell user how to bring app back
  setTimeout(() => {
    try {
      tray && tray.displayBalloon({
        title: 'Cognitive Load Detector — Running',
        content: 'Tracking in background. Press Ctrl+Shift+C anytime to open the app.',
        iconType: 'info',
      });
    } catch (e) {}
  }, 500);

  updateTrayMenu();
}

function stopTracking() {
  if (!isTracking) return;
  isTracking = false;

  clearInterval(trackingInterval);
  trackingInterval = null;

  if (keyboardListener) {
    try { keyboardListener.stop(); } catch (e) {}
    keyboardListener = null;
  }

  if (mouseTracker) {
    try { mouseTracker.destroy(); } catch (e) {}
    mouseTracker = null;
  }

  batchBuffer = [];

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tracking-state', false);
  }

  updateTrayMenu();
}

// ── IPC Handlers ────────────────────────────────────────────────────────────
ipcMain.handle('start-tracking', () => {
  startTracking();
  // Minimize to tray when tracking starts
  if (mainWindow) mainWindow.hide();
  return { success: true };
});

ipcMain.handle('stop-tracking', () => {
  stopTracking();
  return { success: true };
});

ipcMain.handle('get-results', () => {
  return results;
});

ipcMain.handle('clear-results', () => {
  results = [];
  return { success: true };
});

ipcMain.handle('minimize-window', () => {
  mainWindow.minimize();
});

ipcMain.handle('close-window', () => {
  mainWindow.hide();
});

// ── App Lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();

  // Global shortcut to show/hide app from anywhere
  globalShortcut.register('CommandOrControl+Shift+C', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('window-all-closed', (e) => {
  e.preventDefault(); // keep running in background
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  globalShortcut.unregisterAll();
  stopTracking();
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}
