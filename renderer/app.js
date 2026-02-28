/* ══════════════════════════════════════════════
   GazeOS — app.js
   Full port of eye_gaze_full.py → MediaPipe JS
   ══════════════════════════════════════════════ */

'use strict';

// ── MediaPipe landmark indices (same as Python) ──
const IDX_IRIS_RIGHT   = 468;  // right iris centre (from camera POV)
const IDX_L_TOP        = 159;  const IDX_L_BOT = 145;  // left eyelid
const IDX_R_TOP        = 386;  const IDX_R_BOT = 374;  // right eyelid

// ── Settings (mirrored from Python) ──────────────
const STABILITY_THRESHOLD  = 25;
let   DWELL_CLICK_TIME     = 3.0;
const DWELL_SCROLL_TIME    = 5.0;
let   SMOOTHING_ALPHA      = 0.20;
let   BLINK_THRESHOLD      = 0.017;
const BLINK_MIN_TIME       = 0.03;
const BLINK_MAX_TIME       = 0.35;
const LONG_BLINK_MIN       = 0.40;
const LONG_BLINK_MAX       = 1.20;
const DOUBLE_BLINK_GAP     = 0.6;
const WINK_MIN_DIFF        = 0.012;
const WINK_HOLD_TIME       = 0.08;

const CALIB_POINTS = [
  { name: 'TOP-LEFT',     nx: 0.07, ny: 0.07 },
  { name: 'TOP-RIGHT',    nx: 0.93, ny: 0.07 },
  { name: 'BOTTOM-RIGHT', nx: 0.93, ny: 0.93 },
  { name: 'BOTTOM-LEFT',  nx: 0.07, ny: 0.93 },
  { name: 'CENTER',       nx: 0.50, ny: 0.50 },
];

// ── State ─────────────────────────────────────────
let running         = false;
let controlEnabled  = false;
let calibrated      = false;
let calibIndex      = 0;
let calibSamples    = [];
let calibrating     = false;

let minX = null, maxX = null, minY = null, maxY = null;

let smoothX = null, smoothY = null;
let focusPointCam   = null;
let focusStartTime  = null;

let blinkActive     = false;
let blinkStart      = null;
let blinkQueue      = [];     // timestamps of recent short blinks

let winkLActive     = false, winkLStart = null;
let winkRActive     = false, winkRStart = null;

let lastClickTime   = 0;
let lastScrollTime  = 0;
let prevFrameTime   = performance.now();

let screenW = 1920, screenH = 1080;

let faceMeshReady   = false;
let faceMesh        = null;
let camera          = null;
let hudVisible      = true;

// ── Aim Assist state ──────────────────────────────
const AIM_THRESHOLDS = [0, 0.004, 0.008, 0.014]; // 0 = off, then LOW/MED/HIGH
let aimAssistLevel   = 2;   // default: MED
let aimLocked        = false;
let aimLockedX       = null, aimLockedY = null;
let stableStart      = null;
let prevIrisX        = null, prevIrisY  = null;

// ── DOM refs ──────────────────────────────────────
const video          = document.getElementById('webcam');
const canvas         = document.getElementById('overlay-canvas');
const ctx            = canvas.getContext('2d');
const placeholder    = document.getElementById('video-placeholder');

const stEngine       = document.getElementById('st-engine');
const stRobot        = document.getElementById('st-robot');
const stCamera       = document.getElementById('st-camera');
const stFace         = document.getElementById('st-face');
const stControl      = document.getElementById('st-control');
const stCalib        = document.getElementById('st-calib');

const mFps           = document.getElementById('m-fps');
const mIx            = document.getElementById('m-ix');
const mIy            = document.getElementById('m-iy');
const mLe            = document.getElementById('m-le');
const mRe            = document.getElementById('m-re');
const mDwell         = document.getElementById('m-dwell');
const mCursor        = document.getElementById('m-cursor');
const hudModeVal     = document.getElementById('hud-mode-val');
const hudPanel       = document.getElementById('hud-top-right');

const logEntries     = document.getElementById('log-entries');
const calibOverlay   = document.getElementById('calib-overlay');
const calibTargets   = document.getElementById('calib-targets');
const calibInstruction = document.getElementById('calib-instruction');
const calibPointName = document.getElementById('calib-point-name');
const calibCounter   = document.getElementById('calib-counter');
const calibBar       = document.getElementById('calib-progress-bar');

const btnStart       = document.getElementById('btn-start');
const btnCalib       = document.getElementById('btn-calib');
const btnToggle      = document.getElementById('btn-toggle');

const stAim     = document.getElementById('st-aim');
const slSmooth  = document.getElementById('sl-smooth');
const slDwell   = document.getElementById('sl-dwell');
const slBlink   = document.getElementById('sl-blink');
const slAim     = document.getElementById('sl-aim');
const valSmooth = document.getElementById('sl-smooth-val');
const valDwell  = document.getElementById('sl-dwell-val');
const valBlink  = document.getElementById('sl-blink-val');
const valAim    = document.getElementById('sl-aim-val');

// ── Helpers ───────────────────────────────────────
const now = () => performance.now() / 1000;

function dist2D(ax, ay, bx, by) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function setBadge(el, text, cls) {
  el.textContent = text;
  el.className = 'status-badge ' + cls;
}

let logMax = 6;
function addLog(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'log-entry' + (type ? ` log-${type}` : '');
  el.textContent = msg;
  logEntries.prepend(el);
  while (logEntries.children.length > logMax) {
    logEntries.removeChild(logEntries.lastChild);
  }
}

// ── Screen size ───────────────────────────────────
async function fetchScreenSize() {
  if (window.eyeAPI) {
    const s = await window.eyeAPI.getScreenSize();
    screenW = s.width;
    screenH = s.height;
  } else {
    screenW = window.screen.width;
    screenH = window.screen.height;
  }
}

// ── Robot check ───────────────────────────────────
async function checkRobot() {
  if (!window.eyeAPI) {
    setBadge(stRobot, 'N/A', 'badge-warn');
    addLog('No robot API (dev mode)', 'system');
    return;
  }
  const s = await window.eyeAPI.robotStatus();
  if (s.loaded) {
    setBadge(stRobot, 'OK', 'badge-good');
  } else {
    setBadge(stRobot, 'FAIL', 'badge-danger');
    addLog('⚠ robotjs failed — mouse control disabled', 'system');
  }
}

// ── Mouse actions ─────────────────────────────────
async function moveMouse(x, y) {
  if (!window.eyeAPI || !controlEnabled) return;
  await window.eyeAPI.moveMouse(x, y);
}

async function doClick(btn = 'left') {
  if (!window.eyeAPI || !controlEnabled) return;
  await window.eyeAPI.click(btn);
}

async function doScroll(dir) {
  if (!window.eyeAPI || !controlEnabled) return;
  await window.eyeAPI.scroll(dir, 3);
}

// ── Calibration ───────────────────────────────────
function startCalibration() {
  calibIndex   = 0;
  calibSamples = [];
  calibrating  = true;
  calibrated   = false;
  aimLocked = false; stableStart = null;
  setBadge(stCalib, 'CALIB', 'badge-warn');
  renderCalibTargets();
  updateCalibUI();
  calibOverlay.classList.remove('hidden');
  addLog('◈ Calibration started', 'system');
}

function renderCalibTargets() {
  calibTargets.innerHTML = '';
  CALIB_POINTS.forEach((pt, i) => {
    const el = document.createElement('div');
    el.className = 'calib-target';
    el.id = `calib-t-${i}`;
    el.style.left = `${pt.nx * 100}%`;
    el.style.top  = `${pt.ny * 100}%`;
    el.innerHTML  = `<div class="calib-target-ring"></div><div class="calib-target-dot"></div>`;
    calibTargets.appendChild(el);
  });
}

function updateCalibUI() {
  const pt = CALIB_POINTS[calibIndex];
  calibPointName.textContent  = pt ? pt.name : '—';
  calibCounter.textContent    = `${calibIndex} / ${CALIB_POINTS.length}`;
  calibBar.style.width        = `${(calibIndex / CALIB_POINTS.length) * 100}%`;

  // update active target
  CALIB_POINTS.forEach((_, i) => {
    const el = document.getElementById(`calib-t-${i}`);
    if (!el) return;
    el.classList.remove('active', 'done');
    if (i < calibIndex) el.classList.add('done');
    else if (i === calibIndex) el.classList.add('active');
  });
}

function recordCalibSample(irisX, irisY) {
  if (!calibrating || calibIndex >= CALIB_POINTS.length) return;
  calibSamples.push([irisX, irisY]);
  addLog(`✓ Point ${calibIndex + 1}: (${irisX.toFixed(3)}, ${irisY.toFixed(3)})`, 'system');
  calibIndex++;
  updateCalibUI();

  if (calibIndex >= CALIB_POINTS.length) {
    finishCalibration();
  }
}

function finishCalibration() {
  const xs = calibSamples.map(s => s[0]);
  const ys = calibSamples.map(s => s[1]);
  const rawMinX = Math.min(...xs), rawMaxX = Math.max(...xs);
  const rawMinY = Math.min(...ys), rawMaxY = Math.max(...ys);
  const padX = (rawMaxX - rawMinX) * 0.05 || 0.01;
  const padY = (rawMaxY - rawMinY) * 0.05 || 0.01;
  minX = rawMinX - padX; maxX = rawMaxX + padX;
  minY = rawMinY - padY; maxY = rawMaxY + padY;
  calibrated  = true;
  calibrating = false;
  smoothX = smoothY = null;
  calibBar.style.width = '100%';
  setBadge(stCalib, 'YES', 'badge-good');
  addLog('◈ Calibration complete!', 'system');
  setTimeout(() => calibOverlay.classList.add('hidden'), 1000);
  btnToggle.disabled = false;
}

function mapToScreen(irisX, irisY) {
  if (minX === null) return [screenW / 2, screenH / 2];
  const dx = maxX - minX || 1e-6;
  const dy = maxY - minY || 1e-6;
  const rx = Math.max(0, Math.min(1, (irisX - minX) / dx));
  const ry = Math.max(0, Math.min(1, (irisY - minY) / dy));
  return [Math.round(rx * screenW), Math.round(ry * screenH)];
}

// ── Eye openness (same formula as Python) ────────
function eyeOpenness(lm, idx1, idx2, h) {
  return Math.abs(lm[idx2].y - lm[idx1].y);  // already normalised 0-1
}

// ── MediaPipe setup ───────────────────────────────
function initFaceMesh() {
  faceMesh = new FaceMesh({
    locateFile: file =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,       // enables iris landmarks (468+)
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  faceMesh.onResults(onResults);
  setBadge(stEngine, 'READY', 'badge-good');
  faceMeshReady = true;
  addLog('✦ MediaPipe ready', 'system');
}

// ── Main results handler ──────────────────────────
function onResults(results) {
  const cw = canvas.width  = video.videoWidth  || canvas.offsetWidth;
  const ch = canvas.height = video.videoHeight || canvas.offsetHeight;

  ctx.clearRect(0, 0, cw, ch);

  // FPS
  const t = now();
  const fps = 1 / (t - prevFrameTime + 1e-9);
  prevFrameTime = t;
  mFps.textContent = fps.toFixed(1);

  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
    setBadge(stFace, 'NONE', 'badge-off');
    focusPointCam = null;
    mDwell.textContent = '—';
    return;
  }

  setBadge(stFace, 'LOCK', 'badge-good');
  const lm = results.multiFaceLandmarks[0];

  // Iris position (normalised 0–1)
  const irisX = lm[IDX_IRIS_RIGHT].x;
  const irisY = lm[IDX_IRIS_RIGHT].y;
  mIx.textContent = irisX.toFixed(3);
  mIy.textContent = irisY.toFixed(3);

  // Aim assist — gaze velocity (normalised iris delta per frame)
  let gazeVel = 0;
  if (prevIrisX !== null) gazeVel = dist2D(irisX, irisY, prevIrisX, prevIrisY);
  prevIrisX = irisX; prevIrisY = irisY;

  // Camera-pixel coords for dwell
  const irisCamX = irisX * cw;
  const irisCamY = irisY * ch;

  // Draw iris marker — crosshair when aim is locked, dot otherwise
  if (aimLocked) {
    ctx.strokeStyle = '#00e5ffcc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(irisCamX - 12, irisCamY); ctx.lineTo(irisCamX - 5, irisCamY);
    ctx.moveTo(irisCamX + 5,  irisCamY); ctx.lineTo(irisCamX + 12, irisCamY);
    ctx.moveTo(irisCamX, irisCamY - 12); ctx.lineTo(irisCamX, irisCamY - 5);
    ctx.moveTo(irisCamX, irisCamY + 5);  ctx.lineTo(irisCamX, irisCamY + 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(irisCamX, irisCamY, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#00e5ff';
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(irisCamX, irisCamY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#00ff8888';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(irisCamX, irisCamY, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#00ff88';
    ctx.fill();
  }

  // Eye openness
  const leftOpen  = eyeOpenness(lm, IDX_L_TOP, IDX_L_BOT);
  const rightOpen = eyeOpenness(lm, IDX_R_TOP, IDX_R_BOT);
  const avgOpen   = (leftOpen + rightOpen) / 2;
  mLe.textContent = leftOpen.toFixed(3);
  mRe.textContent = rightOpen.toFixed(3);

  // ── BLINK detection ──────────────────────────
  if (avgOpen < BLINK_THRESHOLD) {
    if (!blinkActive) {
      blinkActive = true;
      blinkStart  = t;
    }
  } else {
    if (blinkActive) {
      const dur = t - (blinkStart || t);
      blinkActive = false;
      blinkStart  = null;

      if (dur > BLINK_MIN_TIME && dur < BLINK_MAX_TIME) {
        // short blink — check for double
        blinkQueue.push(t);
        blinkQueue = blinkQueue.filter(ts => t - ts <= DOUBLE_BLINK_GAP);
        if (blinkQueue.length >= 2 &&
            (blinkQueue[blinkQueue.length - 1] - blinkQueue[blinkQueue.length - 2]) <= DOUBLE_BLINK_GAP) {
          blinkQueue = [];
          doClick('left');
          addLog('👁 Double-blink → CLICK', 'click');
        }
      } else if (dur >= LONG_BLINK_MIN && dur <= LONG_BLINK_MAX) {
        controlEnabled = !controlEnabled;
        updateControlUI();
        addLog(controlEnabled ? '▶ Control ACTIVE' : '⏸ Control PAUSED', 'system');
      }
    }
  }

  // ── WINK detection ───────────────────────────
  // Left wink: left eye more closed, right eye open
  if ((rightOpen - leftOpen) > WINK_MIN_DIFF && leftOpen < BLINK_THRESHOLD + 0.005) {
    if (!winkLActive) { winkLActive = true; winkLStart = t; }
  } else if (winkLActive) {
    if (t - (winkLStart || t) > WINK_HOLD_TIME) {
      doScroll('up');
      addLog('↑ Left wink → SCROLL UP', 'scroll');
    }
    winkLActive = false; winkLStart = null;
  }

  // Right wink: right eye more closed
  if ((leftOpen - rightOpen) > WINK_MIN_DIFF && rightOpen < BLINK_THRESHOLD + 0.005) {
    if (!winkRActive) { winkRActive = true; winkRStart = t; }
  } else if (winkRActive) {
    if (t - (winkRStart || t) > WINK_HOLD_TIME) {
      doScroll('down');
      addLog('↓ Right wink → SCROLL DOWN', 'scroll');
    }
    winkRActive = false; winkRStart = null;
  }

  // ── DWELL detection ───────────────────────────
  if (!focusPointCam) {
    focusPointCam = [irisCamX, irisCamY];
    focusStartTime = t;
  } else {
    const d = dist2D(focusPointCam[0], focusPointCam[1], irisCamX, irisCamY);
    if (d < STABILITY_THRESHOLD) {
      const dwell = t - focusStartTime;
      mDwell.textContent = dwell.toFixed(1) + 's';

      // Draw dwell ring
      if (dwell > 0.5) {
        const progress = Math.min(dwell / DWELL_CLICK_TIME, 1);
        ctx.beginPath();
        ctx.arc(irisCamX, irisCamY, 18, -Math.PI / 2, -Math.PI / 2 + progress * 2 * Math.PI);
        ctx.strokeStyle = `rgba(0, 229, 255, ${0.3 + progress * 0.5})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (dwell > DWELL_CLICK_TIME && dwell < DWELL_CLICK_TIME + 0.25 && (t - lastClickTime) > 1) {
        doClick('left');
        lastClickTime = t;
        addLog('⏱ Dwell 3s → CLICK', 'click');
      }
      if (dwell > DWELL_SCROLL_TIME && dwell < DWELL_SCROLL_TIME + 0.25 && (t - lastScrollTime) > 1) {
        doScroll('down');
        lastScrollTime = t;
        addLog('⏱ Dwell 5s → SCROLL', 'scroll');
      }
    } else {
      focusPointCam  = [irisCamX, irisCamY];
      focusStartTime = t;
      mDwell.textContent = '—';
    }
  }

  // ── AIM ASSIST — lock cursor when gaze is steady ──
  const aimThr = AIM_THRESHOLDS[aimAssistLevel];
  if (aimThr > 0) {
    if (gazeVel < aimThr) {
      if (stableStart === null) stableStart = t;
      if (!aimLocked && (t - stableStart) >= 0.25 && smoothX !== null) {
        aimLocked  = true;
        aimLockedX = smoothX; aimLockedY = smoothY;
        setBadge(stAim, 'LOCK', 'badge-good');
      }
    } else {
      if (aimLocked) setBadge(stAim, 'ON', 'badge-warn');
      aimLocked = false; stableStart = null;
    }
  }

  // ── CURSOR MAPPING ────────────────────────────
  if (calibrated) {
    const [sx, sy] = mapToScreen(irisX, irisY);
    if (smoothX === null) { smoothX = sx; smoothY = sy; }
    else {
      smoothX = Math.round(SMOOTHING_ALPHA * sx + (1 - SMOOTHING_ALPHA) * smoothX);
      smoothY = Math.round(SMOOTHING_ALPHA * sy + (1 - SMOOTHING_ALPHA) * smoothY);
    }
    const curX = aimLocked ? aimLockedX : smoothX;
    const curY = aimLocked ? aimLockedY : smoothY;
    mCursor.textContent = `${curX}, ${curY}`;
    moveMouse(curX, curY);
  }
}

// ── UI update helpers ─────────────────────────────
function updateControlUI() {
  if (controlEnabled) {
    setBadge(stControl, 'ON', 'badge-good');
    hudModeVal.textContent = 'ACTIVE';
    btnToggle.textContent  = '⏸ PAUSE';
    btnToggle.classList.remove('btn-active');
  } else {
    setBadge(stControl, 'OFF', 'badge-off');
    hudModeVal.textContent = 'PAUSED';
    btnToggle.textContent  = '▶ RESUME';
    btnToggle.classList.add('btn-active');
  }
}

// ── Camera start ──────────────────────────────────
async function startCamera() {
  setBadge(stCamera, 'WAIT', 'badge-warn');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    video.srcObject = stream;
    await new Promise(res => video.onloadedmetadata = res);
    video.style.display = 'block';
    placeholder.classList.add('hidden');
    hudPanel.classList.remove('hidden');
    setBadge(stCamera, 'ON', 'badge-good');
    addLog('📷 Camera started', 'system');
    running = true;
    btnStart.textContent = '⏹ STOP';
    btnCalib.disabled = false;

    // Attach MediaPipe camera util
    camera = new Camera(video, {
      onFrame: async () => {
        if (running && faceMeshReady) {
          await faceMesh.send({ image: video });
        }
      },
      width: 1280,
      height: 720,
    });
    camera.start();
  } catch (e) {
    setBadge(stCamera, 'ERR', 'badge-danger');
    addLog('❌ Camera: ' + e.message, 'system');
    console.error(e);
  }
}

function stopCamera() {
  running = false;
  if (camera) { camera.stop(); camera = null; }
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  }
  video.style.display = 'none';
  placeholder.classList.remove('hidden');
  hudPanel.classList.add('hidden');
  setBadge(stCamera, 'OFF', 'badge-off');
  setBadge(stFace, 'NONE', 'badge-off');
  controlEnabled = false;
  aimLocked = false; stableStart = null; prevIrisX = null; prevIrisY = null;
  setBadge(stAim, aimAssistLevel > 0 ? 'ON' : 'OFF', aimAssistLevel > 0 ? 'badge-warn' : 'badge-off');
  updateControlUI();
  btnStart.textContent = '▶ START CAMERA';
  btnCalib.disabled = true;
  btnToggle.disabled = true;
  addLog('⏹ Camera stopped', 'system');
}

// ── Keyboard shortcuts ────────────────────────────
document.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();

  if (key === 'c' && running && !calibrating) {
    startCalibration();
  }
  if (key === ' ' || e.code === 'Space') {
    e.preventDefault();
    if (calibrating && running) {
      // Need current iris from last frame — use last known
      if (lastIrisX !== null) recordCalibSample(lastIrisX, lastIrisY);
    }
  }
  if (key === 'p') {
    if (!running) return;
    controlEnabled = !controlEnabled;
    updateControlUI();
  }
  if (key === 'h') {
    hudVisible = !hudVisible;
    hudPanel.style.opacity = hudVisible ? '1' : '0';
  }
  if (key === 'escape') {
    if (calibrating) {
      calibrating = false;
      calibOverlay.classList.add('hidden');
      setBadge(stCalib, 'NO', 'badge-off');
      addLog('◈ Calibration cancelled', 'system');
    } else if (running) {
      stopCamera();
    }
  }
});

// ── Track last iris for space key ─────────────────
let lastIrisX = null, lastIrisY = null;
const _origOnResults = onResults;
// Wrap to capture last iris
let faceMesh_onResultsWrapper = function(results) {
  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    lastIrisX = results.multiFaceLandmarks[0][IDX_IRIS_RIGHT].x;
    lastIrisY = results.multiFaceLandmarks[0][IDX_IRIS_RIGHT].y;
  }
  onResults(results);
};

// ── Button events ─────────────────────────────────
btnStart.addEventListener('click', () => {
  if (!running) startCamera();
  else stopCamera();
});

btnCalib.addEventListener('click', () => {
  if (running && !calibrating) startCalibration();
});

btnToggle.addEventListener('click', () => {
  if (!running) return;
  controlEnabled = !controlEnabled;
  updateControlUI();
  addLog(controlEnabled ? '▶ Control ACTIVE' : '⏸ Control PAUSED', 'system');
});

// ── Init ──────────────────────────────────────────
(async function init() {
  await fetchScreenSize();
  await checkRobot();

  // ── Settings sliders ──────────────────────────
  const AIM_LABELS = ['OFF', 'LOW', 'MED', 'HIGH'];
  slSmooth.addEventListener('input', () => {
    SMOOTHING_ALPHA = parseFloat(slSmooth.value);
    valSmooth.textContent = SMOOTHING_ALPHA.toFixed(2);
  });
  slDwell.addEventListener('input', () => {
    DWELL_CLICK_TIME = parseFloat(slDwell.value);
    valDwell.textContent = DWELL_CLICK_TIME.toFixed(1) + 's';
  });
  slBlink.addEventListener('input', () => {
    BLINK_THRESHOLD = parseFloat(slBlink.value);
    valBlink.textContent = BLINK_THRESHOLD.toFixed(3);
  });
  slAim.addEventListener('input', () => {
    aimAssistLevel = parseInt(slAim.value);
    valAim.textContent = AIM_LABELS[aimAssistLevel];
    if (aimAssistLevel === 0) {
      aimLocked = false; stableStart = null;
      setBadge(stAim, 'OFF', 'badge-off');
    } else if (!aimLocked) {
      setBadge(stAim, 'ON', 'badge-warn');
    }
  });
  // Initial aim badge (default level 2 = MED)
  setBadge(stAim, 'ON', 'badge-warn');

  setBadge(stEngine, 'LOAD', 'badge-warn');
  addLog('⟳ Loading MediaPipe…', 'system');

  // Wait for MediaPipe scripts to be available
  const waitForMP = () => new Promise(res => {
    const check = () => (typeof FaceMesh !== 'undefined' ? res() : setTimeout(check, 100));
    check();
  });
  await waitForMP();

  initFaceMesh();

  // Re-bind with wrapper that also captures last iris
  faceMesh.onResults(function(results) {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      lastIrisX = results.multiFaceLandmarks[0][IDX_IRIS_RIGHT].x;
      lastIrisY = results.multiFaceLandmarks[0][IDX_IRIS_RIGHT].y;
    }
    onResults(results);
  });
})();
