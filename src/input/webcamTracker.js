/**
 * Webcam Tangible Object Tracker ("Whiskey Glass" Controller)
 * Implements the tangible user interface concept from Sci-Fi Interfaces:
 * Tracks a physical object (glass, cup, colored marker, hand) via the user's webcam
 * to fly the forensic drone inside the 3D crime scene.
 */
export class WebcamTracker {
  constructor(crimeScene, onStatusChange) {
    this.crimeScene = crimeScene;
    this.onStatusChange = onStatusChange || (() => {});

    this.stream = null;
    this.enabled = false;
    this.calibrated = false;

    // Target color in RGB / HSV
    this.targetRGB = { r: 200, g: 140, b: 60 }; // Default amber / whiskey tint
    this.colorTolerance = 45;

    // Tracking state
    this.lastCentroid = null;
    this.lastArea = 0;
    this.smoothing = 0.25; // low-pass filter
    this.confidence = 0;

    this.buildUI();
  }

  buildUI() {
    this.panel = document.createElement('div');
    this.panel.className = 'webcam-tracker-panel';
    this.panel.innerHTML = `
      <div class="tracker-header">
        <span class="tracker-title">⌖ TANGIBLE OPTICAL TRACKER</span>
        <div class="tracker-status" id="tracker-status-tag">STANDBY</div>
      </div>
      <div class="video-container">
        <video id="webcam-video" autoplay playsinline muted></video>
        <canvas id="webcam-canvas" width="320" height="240"></canvas>
        <div class="tracker-reticle" id="tracker-reticle"></div>
        <div class="tracker-crosshair"></div>
      </div>
      <div class="tracker-controls">
        <button id="btn-webcam-toggle" class="esper-btn">ENABLE SENSOR</button>
        <button id="btn-calibrate" class="esper-btn" disabled>SAMPLE OBJECT</button>
        <button id="btn-reset-origin" class="esper-btn" disabled>RESET ORIGIN</button>
      </div>
      <div class="tracker-telemetry">
        <span>CONFIDENCE: <b id="trk-conf">0%</b></span>
        <span>OBJECT: <b id="trk-obj">UNLOCKED</b></span>
      </div>
      <div class="tracker-instructions">
        Click video to lock onto any object (e.g. glass, cup, or marker).
      </div>
    `;
    document.body.appendChild(this.panel);

    this.video = this.panel.querySelector('#webcam-video');
    this.canvas = this.panel.querySelector('#webcam-canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.reticle = this.panel.querySelector('#tracker-reticle');
    this.statusTag = this.panel.querySelector('#tracker-status-tag');
    this.btnToggle = this.panel.querySelector('#btn-webcam-toggle');
    this.btnCalibrate = this.panel.querySelector('#btn-calibrate');
    this.btnReset = this.panel.querySelector('#btn-reset-origin');

    this.btnToggle.addEventListener('click', () => this.toggleWebcam());
    this.btnCalibrate.addEventListener('click', () => this.startSamplingMode());
    this.btnReset.addEventListener('click', () => {
      this.lastCentroid = null;
    });

    // Click canvas to sample color of object
    this.canvas.addEventListener('click', (e) => this.sampleColorAt(e));

    // Make panel draggable
    this.setupDraggable();
  }

  setupDraggable() {
    const header = this.panel.querySelector('.tracker-header');
    let isDragging = false;
    let startX, startY, initLeft, initTop;

    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.panel.getBoundingClientRect();
      initLeft = rect.left;
      initTop = rect.top;
      header.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      this.panel.style.left = `${initLeft + (e.clientX - startX)}px`;
      this.panel.style.top = `${initTop + (e.clientY - startY)}px`;
      this.panel.style.right = 'auto';
      this.panel.style.bottom = 'auto';
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
      header.style.cursor = 'grab';
    });
  }

  async toggleWebcam() {
    if (this.enabled) {
      this.stop();
    } else {
      await this.start();
    }
  }

  async start() {
    try {
      this.statusTag.textContent = 'CONNECTING...';
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' }
      });
      this.video.srcObject = this.stream;
      await this.video.play();

      this.enabled = true;
      this.btnToggle.textContent = 'DISABLE SENSOR';
      this.btnToggle.classList.add('active');
      this.btnCalibrate.disabled = false;
      this.btnReset.disabled = false;
      this.statusTag.textContent = 'READY (SAMPLE OBJ)';

      this.onStatusChange(true);
      this.startProcessing();
    } catch (err) {
      console.warn('Webcam permission / device notice:', err);
      this.statusTag.textContent = 'ERR: NO CAM';
      this.onStatusChange(false, err.message);
    }
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.enabled = false;
    this.btnToggle.textContent = 'ENABLE SENSOR';
    this.btnToggle.classList.remove('active');
    this.btnCalibrate.disabled = true;
    this.btnReset.disabled = true;
    this.statusTag.textContent = 'STANDBY';
    this.calibrated = false;
    this.reticle.style.display = 'none';
    this.onStatusChange(false);
  }

  startSamplingMode() {
    this.statusTag.textContent = 'CLICK OBJECT IN FEED';
  }

  sampleColorAt(e) {
    if (!this.enabled) return;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const p = this.ctx.getImageData(x, y, 1, 1).data;
    this.targetRGB = { r: p[0], g: p[1], b: p[2] };
    this.calibrated = true;
    this.lastCentroid = null;

    this.statusTag.textContent = 'LOCKED';
    const objEl = this.panel.querySelector('#trk-obj');
    if (objEl) {
      objEl.textContent = `RGB(${p[0]},${p[1]},${p[2]})`;
      objEl.style.color = `rgb(${p[0]},${p[1]},${p[2]})`;
    }
  }

  startProcessing() {
    const processFrame = () => {
      if (!this.enabled) return;

      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

      if (this.calibrated) {
        this.trackTarget();
      }

      requestAnimationFrame(processFrame);
    };
    requestAnimationFrame(processFrame);
  }

  trackTarget() {
    const imgData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imgData.data;
    const w = this.canvas.width;
    const h = this.canvas.height;

    let sumX = 0;
    let sumY = 0;
    let matchCount = 0;

    const tr = this.targetRGB.r;
    const tg = this.targetRGB.g;
    const tb = this.targetRGB.b;
    const tol = this.colorTolerance;
    const tolSq = tol * tol;

    // Scan every 2nd pixel for 60fps performance
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        const dr = r - tr;
        const dg = g - tg;
        const db = b - tb;
        const distSq = dr * dr + dg * dg + db * db;

        if (distSq < tolSq) {
          sumX += x;
          sumY += y;
          matchCount++;
        }
      }
    }

    const conf = Math.min(100, Math.floor((matchCount / 400) * 100));
    this.confidence = conf;
    const confEl = this.panel.querySelector('#trk-conf');
    if (confEl) confEl.textContent = `${conf}%`;

    if (matchCount > 30) {
      const cx = sumX / matchCount;
      const cy = sumY / matchCount;

      // Update visual tracking reticle position
      this.reticle.style.display = 'block';
      this.reticle.style.left = `${(cx / w) * 100}%`;
      this.reticle.style.top = `${(cy / h) * 100}%`;

      if (this.lastCentroid) {
        // Compute delta motion
        // Mirror X for natural webcam movement
        const dx = (this.lastCentroid.x - cx) * 0.025;
        const dy = (cy - this.lastCentroid.y) * 0.025;
        const dArea = (matchCount - this.lastArea) * 0.005;

        // Apply to Drone Flight
        // Horizontal motion -> Track left/right
        if (Math.abs(dx) > 0.04) {
          this.crimeScene.moveDrone(dx * 0.4, 0, 0);
          this.crimeScene.rotateDrone(0, dx * 0.3);
        }

        // Vertical motion -> Elevation / Dolly
        if (Math.abs(dy) > 0.04) {
          this.crimeScene.moveDrone(0, dy * 0.3, 0);
        }

        // Area change (moving closer/farther) -> Move in / pull back
        if (Math.abs(dArea) > 0.15) {
          this.crimeScene.moveDrone(0, 0, -dArea * 0.2);
        }
      }

      this.lastCentroid = {
        x: this.lastCentroid ? this.lastCentroid.x * 0.7 + cx * 0.3 : cx,
        y: this.lastCentroid ? this.lastCentroid.y * 0.7 + cy * 0.3 : cy
      };
      this.lastArea = matchCount;
    } else {
      this.reticle.style.display = 'none';
    }
  }
}
