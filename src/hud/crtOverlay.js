/**
 * Blade Runner ESPER Forensic CRT Display Overlay
 * Renders:
 * - 101-910 cyan coordinate matrix (Christopher Noessel design)
 * - White/Cyan selection reticle & concentric zoom boxes
 * - Telemetry readout: ZM 0000  NS 0000  EW 0000
 * - Corner Minimap with room layout, drone position, and camera frustum cone
 * - CRT scanlines, flicker, and phosphor persistence
 */
export class CRTOverlay {
  constructor(overlayContainer) {
    this.container = overlayContainer;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'crt-overlay-canvas';
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    // CRT scanline overlay element
    this.scanlines = document.createElement('div');
    this.scanlines.className = 'crt-scanlines';
    this.container.appendChild(this.scanlines);

    // Target box state
    this.targetBox = {
      active: false,
      startCell: 204,
      endCell: 608,
      animProgress: 1.0,
      blinkCount: 0
    };

    // Telemetry text element
    this.telemetryEl = document.createElement('div');
    this.telemetryEl.className = 'crt-telemetry';
    this.telemetryEl.innerHTML = `
      <span class="tele-item"><span class="label">ZM</span> <span id="tele-zm" class="val">0100</span></span>
      <span class="tele-item"><span class="label">NS</span> <span id="tele-ns" class="val">0197</span></span>
      <span class="tele-item"><span class="label">EW</span> <span id="tele-ew" class="val">0334</span></span>
    `;
    this.container.appendChild(this.telemetryEl);

    // Minimap Canvas
    this.minimapCanvas = document.createElement('canvas');
    this.minimapCanvas.className = 'crt-minimap-canvas';
    this.minimapCtx = this.minimapCanvas.getContext('2d');
    this.container.appendChild(this.minimapCanvas);

    // Top Amber Ticker
    this.tickerEl = document.createElement('div');
    this.tickerEl.className = 'crt-top-ticker';
    this.tickerEl.innerHTML = `
      <div class="ticker-amber-bar"></div>
      <div class="ticker-text" id="ticker-text">LAPD ESPER SYSTEM 99 // FORENSIC 3D RECONSTRUCTION // READY</div>
    `;
    this.container.appendChild(this.tickerEl);

    this.onResize();
    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = Math.max(1, Math.round(this.width * dpr));
    this.canvas.height = Math.max(1, Math.round(this.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Minimap dimensions (180x130)
    this.minimapWidth = 180;
    this.minimapHeight = 130;
    this.minimapCanvas.width = this.minimapWidth * dpr;
    this.minimapCanvas.height = this.minimapHeight * dpr;
    this.minimapCanvas.style.width = `${this.minimapWidth}px`;
    this.minimapCanvas.style.height = `${this.minimapHeight}px`;
    this.minimapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setTargetBox(startCell, endCell) {
    this.targetBox.active = true;
    this.targetBox.startCell = startCell;
    this.targetBox.endCell = endCell;
    this.targetBox.animProgress = 0.0;
    this.targetBox.blinkCount = 0;
  }

  clearTargetBox() {
    this.targetBox.active = false;
  }

  setTickerText(text) {
    const el = document.getElementById('ticker-text');
    if (el) el.textContent = text;
  }

  update(telemetry, crimeScene, screenBounds, viewMode) {
    // Follow the 3D display through camera moves and viewport resizes.
    const { left, top, width, height } = screenBounds;
    this.container.style.left = `${left}px`;
    this.container.style.top = `${top}px`;
    this.container.style.width = `${width}px`;
    this.container.style.height = `${height}px`;
    this.container.classList.toggle('is-desk', viewMode === 'desk');

    if (Math.abs(width - this.width) > 1 || Math.abs(height - this.height) > 1) {
      this.onResize();
    }

    // Update Telemetry Readout text
    const zmEl = document.getElementById('tele-zm');
    const nsEl = document.getElementById('tele-ns');
    const ewEl = document.getElementById('tele-ew');

    if (zmEl) zmEl.textContent = telemetry.zm;
    if (nsEl) nsEl.textContent = telemetry.ns;
    if (ewEl) ewEl.textContent = telemetry.ew;

    this.drawHUD(telemetry);
    this.drawMinimap(telemetry, crimeScene);
  }

  drawHUD(telemetry) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Grid matrix (9 rows, 10 columns: 101 to 910)
    const rows = 9;
    const cols = 10;
    const cellW = w / cols;
    const cellH = h / rows;

    ctx.strokeStyle = 'rgba(28, 140, 180, 0.45)';
    ctx.lineWidth = 1;

    // Draw Grid lines
    for (let c = 0; c <= cols; c++) {
      const x = c * cellW;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      const y = r * cellH;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Grid Cell Numbers (101 - 910)
    ctx.font = '11px "Courier New", monospace';
    ctx.fillStyle = 'rgba(0, 220, 255, 0.55)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    if (w >= 400) {
      for (let r = 1; r <= rows; r++) {
        for (let c = 1; c <= cols; c++) {
          const cellNum = `${r}${String(c).padStart(2, '0')}`;
          const x = (c - 1) * cellW + 6;
          const y = (r - 1) * cellH + 6;
          ctx.fillText(cellNum, x, y);
        }
      }
    }

    // 2. Thick Crosshair Reticle (blade-runner film style)
    const cx = w / 2;
    const cy = h / 2;

    ctx.save();
    // Segmented white crosshair
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0, 240, 255, 0.8)';
    ctx.shadowBlur = 8;

    // Horizontal line with center gap
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(cx - 35, cy);
    ctx.moveTo(cx + 35, cy);
    ctx.lineTo(w, cy);
    ctx.stroke();

    // Vertical line with center gap
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, cy - 35);
    ctx.moveTo(cx, cy + 35);
    ctx.lineTo(cx, h);
    ctx.stroke();

    // Center target tick ring
    ctx.beginPath();
    ctx.arc(cx, cy, 25, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner reticle dot
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // 3. Concentric Zoom Framing Rectangles (film still style)
    const zoomAnim = (telemetry.zoomLevel % 2.0) / 2.0;
    const boxSizes = [
      { rw: cellW * 3.5, rh: cellH * 3.5 },
      { rw: cellW * 2.2, rh: cellH * 2.2 },
      { rw: cellW * 1.2, rh: cellH * 1.2 }
    ];

    ctx.strokeStyle = 'rgba(220, 245, 255, 0.7)';
    ctx.lineWidth = 1.5;
    boxSizes.forEach((b, idx) => {
      const bx = cx - b.rw / 2;
      const by = cy - b.rh / 2;
      ctx.strokeRect(bx, by, b.rw, b.rh);

      // Corner accent markers
      const clen = 10;
      ctx.lineWidth = 3;
      ctx.beginPath();
      // Top-Left
      ctx.moveTo(bx, by + clen); ctx.lineTo(bx, by); ctx.lineTo(bx + clen, by);
      // Top-Right
      ctx.moveTo(bx + b.rw - clen, by); ctx.lineTo(bx + b.rw, by); ctx.lineTo(bx + b.rw, by + clen);
      // Bottom-Left
      ctx.moveTo(bx, by + b.rh - clen); ctx.lineTo(bx, by + b.rh); ctx.lineTo(bx + clen, by + b.rh);
      // Bottom-Right
      ctx.moveTo(bx + b.rw - clen, by + b.rh); ctx.lineTo(bx + b.rw, by + b.rh); ctx.lineTo(bx + b.rw, by + b.rh - clen);
      ctx.stroke();
      ctx.lineWidth = 1.5;
    });

    ctx.restore();
  }

  drawMinimap(telemetry, crimeScene) {
    if (!crimeScene) return;

    const ctx = this.minimapCtx;
    const mw = this.minimapWidth;
    const mh = this.minimapHeight;

    ctx.clearRect(0, 0, mw, mh);

    // CRT Minimap background & cyan border
    ctx.fillStyle = 'rgba(4, 18, 26, 0.88)';
    ctx.fillRect(0, 0, mw, mh);

    ctx.strokeStyle = '#00ddff';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, mw - 2, mh - 2);

    // Zoom Readout Header
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillStyle = '#00f0ff';
    ctx.textAlign = 'right';
    ctx.fillText(`ZM ${telemetry.zoomLevel.toFixed(3)}x`, mw - 8, 16);

    // Room Layout scaling
    // Room is width 3.05m x depth 4.27m
    const margin = 20;
    const roomAreaW = mw - margin * 2;
    const roomAreaH = mh - margin * 2 - 10;

    const scaleX = roomAreaW / crimeScene.roomWidth;
    const scaleZ = roomAreaH / crimeScene.roomDepth;
    const scale = Math.min(scaleX, scaleZ);

    const mapOriginX = mw / 2;
    const mapOriginZ = mh / 2 + 6;

    // Helper: 3D (x, z) to minimap (mx, my)
    const toMap = (x, z) => ({
      x: mapOriginX + x * scale,
      y: mapOriginZ + z * scale
    });

    // Draw Room Walls
    const halfW = crimeScene.roomWidth / 2;
    const halfD = crimeScene.roomDepth / 2;
    const tl = toMap(-halfW, -halfD);
    const br = toMap(halfW, halfD);

    ctx.strokeStyle = 'rgba(0, 180, 220, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

    // Draw Dresser & Mirror (North Wall, top)
    const dresserTop = toMap(-0.7, -halfD);
    const dresserBot = toMap(0.7, -halfD + 0.55);
    ctx.fillStyle = 'rgba(120, 80, 50, 0.7)';
    ctx.fillRect(dresserTop.x, dresserTop.y, dresserBot.x - dresserTop.x, dresserBot.y - dresserTop.y);

    // Mirror line (cyan highlight)
    const m1 = toMap(-0.55, -halfD + 0.05);
    const m2 = toMap(0.55, -halfD + 0.05);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(m1.x, m1.y);
    ctx.lineTo(m2.x, m2.y);
    ctx.stroke();

    // Draw Closet (East Wall, right)
    const clTop = toMap(halfW - 0.55, -1.0);
    const clBot = toMap(halfW, 0.8);
    ctx.fillStyle = 'rgba(70, 70, 90, 0.6)';
    ctx.fillRect(clTop.x, clTop.y, clBot.x - clTop.x, clBot.y - clTop.y);

    // Draw Chair
    const ch = toMap(0.2, -halfD + 1.2);
    ctx.fillStyle = 'rgba(140, 50, 40, 0.8)';
    ctx.beginPath();
    ctx.arc(ch.x, ch.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw Drone Position & Frustum Cone
    const drone = toMap(crimeScene.dronePos.x, crimeScene.dronePos.z);

    // Drone Frustum Cone
    const fovRad = (crimeScene.camera.fov * Math.PI) / 180;
    const viewLen = 28;
    const yaw = crimeScene.droneYaw;

    const p1x = drone.x + Math.sin(yaw - fovRad / 2) * viewLen;
    const p1y = drone.y - Math.cos(yaw - fovRad / 2) * viewLen;
    const p2x = drone.x + Math.sin(yaw + fovRad / 2) * viewLen;
    const p2y = drone.y - Math.cos(yaw + fovRad / 2) * viewLen;

    ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(drone.x, drone.y);
    ctx.lineTo(p1x, p1y);
    ctx.lineTo(p2x, p2y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Drone Marker (bright cyan point with pulse)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(drone.x, drone.y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(drone.x, drone.y, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
}
