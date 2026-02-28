# GazeOS — Eye Gaze Mouse Control

Cross-platform eye gaze mouse controller built with **Electron + MediaPipe JS + RobotJS**.
Works on **Windows** and **macOS** from the same codebase
## Features

| Gesture | Action |
|---|---|
| 👁👁 Double-blink | Left click |
| 😉 Left wink | Scroll up |
| 😏 Right wink | Scroll down |
| 😑 Dwell (default 3s) | Left click |
| 😌 Dwell (default 5s) | Scroll down |
| 😴 Long blink (0.4–1.2s) | Pause / resume control |

---

## Running on macOS

### Step 1 — Install prerequisites

You need **Node.js 20 LTS** and **Xcode Command Line Tools** (required to compile the native mouse-control module).

```bash
# Install Xcode Command Line Tools (skip if already installed)
xcode-select --install

# Install Node.js — use the official installer or Homebrew
# Option A: Download from https://nodejs.org  (choose "LTS")
# Option B: Homebrew
brew install node@20 && echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

Verify:
```bash
node --version   # should print v20.x.x
npm --version    # should print 10.x.x
```

---

### Step 2 — Install dependencies and run

```bash
# Navigate into the project folder
cd path/to/electron-eye-gaze

# Install — this also compiles robotjs for your Mac (takes ~2 min first time)
npm install

# Launch the app
npm start
```

> **Apple Silicon (M1/M2/M3/M4)?**
> `npm install` compiles `@jitsi/robotjs` natively for ARM — no Rosetta needed.
> If you see a build error, make sure Xcode Command Line Tools are installed (`xcode-select --install`).

---

### Step 3 — Grant Camera permission

When you click **▶ START CAMERA** for the first time, macOS will show a permission prompt:

> *"EyeGazeControl" would like to access the camera.*

Click **OK**. If you accidentally denied it:

1. Open **System Settings → Privacy & Security → Camera**
2. Toggle **EyeGazeControl** (or **Electron**) to ON
3. Restart the app with `npm start`

---

### Step 4 — Grant Accessibility permission (required for mouse control)

The app moves your system mouse cursor using macOS Accessibility APIs.
On first launch a dialog will guide you, but you must add it manually:

1. Open **System Settings → Privacy & Security → Accessibility**
2. Click the **＋** button
3. Navigate to your project folder → `node_modules/.bin/` and add **electron**
   *(or approve the entry that appears automatically after the first launch prompt)*
4. Toggle it **ON**
5. Restart the app with `npm start`

> **macOS Sequoia (15) note:** The Accessibility prompt may appear behind the app window. Check your Dock for a System Settings badge if nothing happens.

---

### Step 5 — Use the app

1. Click **▶ START CAMERA** — webcam feed appears
2. Click **◈ CALIBRATE** — follow the on-screen instructions (look at each corner, press `Space` to record)
3. After calibration, click **▶ RESUME** to enable cursor control
4. Your eyes now control the mouse

---

## Running on Windows

### Requirements
- **Node.js 20 LTS** — download from https://nodejs.org
- A webcam

```bash
cd path/to/electron-eye-gaze
npm install
npm start
```

Windows will show a camera permission prompt on first use — click **Allow**.
No Accessibility setup is needed on Windows.

---

## Settings (live sliders — no restart needed)

| Slider | Range | Description |
|---|---|---|
| **SMOOTH** | 0.05 – 0.60 | Cursor responsiveness. Lower = more stable, Higher = follows eye faster |
| **DWELL CLICK** | 0.5 – 5.0s | How long to hold gaze before auto-clicking |
| **BLINK SENS** | 0.008 – 0.035 | Blink detection threshold. Raise if blinks aren't detected |
| **AIM ASSIST** | OFF / LOW / MED / HIGH | Locks cursor when gaze is steady, making it easier to hit targets |

**AIM ASSIST status badges:**
- `ON` (orange) — active, tracking gaze
- `LOCK` (green) — cursor is locked on target, ready to click

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `C` | Start calibration |
| `Space` | Record calibration point |
| `P` | Pause / resume cursor control |
| `H` | Toggle HUD overlay |
| `Esc` | Stop camera / cancel calibration |

---

## Calibration

1. Click **◈ CALIBRATE** (or press `C`)
2. The screen shows a calibration overlay with corner/center targets
3. **Look at the named position on your actual monitor** (not the camera feed)
4. Press `Space` to record each of the 5 points
5. Cursor control activates automatically after the 5th point

Recalibrate any time accuracy degrades — lighting changes or head position shifts affect accuracy.

---

## Building a distributable

### macOS `.dmg`

```bash
# Must be run on a Mac
npm run build:mac
# Output: dist/EyeGazeControl-<version>.dmg
```

> **Code signing required for distribution:**
> Without an Apple Developer ID certificate, macOS Gatekeeper will block the DMG on other Macs.
> For personal/local use, right-click the app → Open → Open anyway to bypass Gatekeeper.

### Windows installer

```bash
npm run build:win
# Output: dist/EyeGazeControl Setup <version>.exe
```

---

## Architecture

```
main.js          Electron main process — window creation, robotjs mouse control,
                 camera permission handling (Windows + macOS)
preload.js       Secure IPC bridge (contextIsolation enabled)
renderer/
  index.html     App shell — sidebar, video feed, calibration overlay
  style.css      Dark industrial UI (Syne + Space Mono fonts)
  app.js         MediaPipe FaceMesh, gaze tracking, blink/wink/dwell detection,
                 aim assist, settings sliders
entitlements.mac.plist   macOS hardened runtime entitlements (camera, network, accessibility)
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm install` fails with build error | Run `xcode-select --install` then retry |
| Camera badge shows `ERR` | Check System Settings → Privacy → Camera and allow the app |
| Mouse doesn't move after calibration | Grant Accessibility permission (Step 4 above) and restart |
| Face not detected (`FACE: NONE`) | Improve lighting — face the light source, avoid backlight |
| Cursor jitters too much | Lower the **SMOOTH** slider or increase **AIM ASSIST** to HIGH |
| Blinks not detected | Raise the **BLINK SENS** slider |
| App opens but camera shows black screen | Another app may be using the camera — close Teams/Zoom/FaceTime |
