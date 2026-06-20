# GazeOS — Eye Gaze Mouse Control

Cross-platform eye gaze mouse controller built with **Electron + MediaPipe JS + RobotJS**.
Works on **Windows** and **macOS** from the same codebase.

> **Internet required at runtime** — MediaPipe Face Mesh models are loaded from the jsDelivr CDN each time the app starts. Make sure you have an active connection before launching.

---

## Features

| Gesture | Action |
|---|---|
| 👁👁 Double-blink | Left click |
| 😉 Left wink | Scroll up |
| 😏 Right wink | Scroll down |
| 😑 Dwell (default 3 s) | Left click |
| 😌 Dwell (default 5 s) | Scroll down |
| 😴 Long blink (0.4 – 1.2 s) | Pause / resume control |

---

## Running on Windows

### Step 1 — Install prerequisites

You need **Node.js 20 LTS** and **Visual Studio Build Tools** (required to compile the native mouse-control module `@jitsi/robotjs`).

#### 1a. Install Node.js 20 LTS

Download and run the installer from [nodejs.org](https://nodejs.org) — choose the **LTS** version.

Verify in a new terminal:
```cmd
node --version    :: should print v20.x.x
npm --version     :: should print 10.x.x
```

#### 1b. Install Visual Studio Build Tools (C++ compiler)

`@jitsi/robotjs` is a native add-on that must be compiled from source. You need the MSVC toolchain.

**Option A — winget (fastest):**
```cmd
winget install Microsoft.VisualStudio.2022.BuildTools
```
When the Visual Studio Installer opens, select **"Desktop development with C++"** and click Install.

**Option B — manual download:**
Download [Build Tools for Visual Studio 2022](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022), run the installer, and select the **"Desktop development with C++"** workload.

After installation, verify that `cl.exe` is accessible by opening a **Developer Command Prompt for VS 2022** (not a regular terminal).

> **Note:** Python is also required by `node-gyp` (the native build system). Node.js 20 ships with a bundled Python; if the build step fails with a Python error, install Python 3 from [python.org](https://www.python.org) and run `npm config set python python3`.

---

### Step 2 — Install dependencies and run

Open a **regular PowerShell or Command Prompt** (not Developer Command Prompt — npm finds MSVC automatically):

```cmd
cd path\to\electron-eye-gaze

:: Install and compile native modules (~2–5 min on first run)
npm install

:: Launch the app
npm start
```

If `npm install` fails with a build error, see the Troubleshooting section below.

---

### Step 3 — Grant camera permission

When you click **▶ START CAMERA** for the first time, Windows will show a permission prompt:

> *"electron.exe wants to access your camera"*

Click **Allow**. If you accidentally denied it:

1. Open **Windows Settings → Privacy & Security → Camera**
2. Scroll to **"Let desktop apps access your camera"** and make sure it is **On**
3. Restart the app with `npm start`

---

### Step 4 — Use the app

No Accessibility setup is needed on Windows — the app controls the mouse directly.

1. Click **▶ START CAMERA** — webcam feed appears
2. Click **◈ CALIBRATE** — follow the on-screen instructions (look at each corner, press `Space` to record)
3. After calibration, click **▶ RESUME** to enable cursor control
4. Your eyes now control the mouse

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

## Settings (live sliders — no restart needed)

| Slider | Range | Description |
|---|---|---|
| **SMOOTH** | 0.05 – 0.60 | Cursor responsiveness. Lower = more stable, Higher = follows eye faster |
| **DWELL CLICK** | 0.5 – 5.0 s | How long to hold gaze before auto-clicking |
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

### Windows installer (`.exe`)

```cmd
:: Must be run on Windows with Visual Studio Build Tools installed
npm run build:win
:: Output: dist\EyeGazeControl Setup <version>.exe
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

### Windows

| Problem | Fix |
|---|---|
| `npm install` fails: `MSBUILD : error MSB3428` | Visual Studio Build Tools with "Desktop development with C++" not installed — see Step 1b |
| `npm install` fails: `python not found` | Install Python 3 from python.org, then run `npm config set python python3` and retry |
| `npm install` fails: `gyp ERR! find VS` | Open the Visual Studio Installer and confirm the C++ workload is installed |
| Camera badge shows `ERR` | Check **Settings → Privacy & Security → Camera** and ensure desktop apps can access it |
| Mouse doesn't move after calibration | Restart the app — on Windows no extra permission is needed, so this usually means robotjs failed to load (check console) |
| `ROBOT: FAIL` badge on startup | `@jitsi/robotjs` failed to load; re-run `npm install` in a terminal where MSVC is available |
| App opens but camera shows black screen | Another app may be using the camera — close Teams, Zoom, or any other video app |
| Face not detected (`FACE: NONE`) | Improve lighting — face a light source, avoid backlit backgrounds |
| Cursor jitters too much | Lower the **SMOOTH** slider or increase **AIM ASSIST** to HIGH |
| Blinks not detected | Raise the **BLINK SENS** slider |
| MediaPipe won't load (`ENGINE: LOAD` stays forever) | No internet connection — MediaPipe models are fetched from CDN on startup |

### macOS

| Problem | Fix |
|---|---|
| `npm install` fails with build error | Run `xcode-select --install` then retry |
| Camera badge shows `ERR` | Check **System Settings → Privacy & Security → Camera** and allow the app |
| Mouse doesn't move after calibration | Grant Accessibility permission (Step 4) and restart |
| Face not detected (`FACE: NONE`) | Improve lighting — face the light source, avoid backlight |
| Cursor jitters too much | Lower the **SMOOTH** slider or increase **AIM ASSIST** to HIGH |
| Blinks not detected | Raise the **BLINK SENS** slider |
| App opens but camera shows black screen | Another app may be using the camera — close Teams/Zoom/FaceTime |
| MediaPipe won't load (`ENGINE: LOAD` stays forever) | No internet connection — MediaPipe models are fetched from CDN on startup |
