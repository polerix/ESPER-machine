import QRCode from 'qrcode';

/**
 * Chemical Hardcopy Instant Photo & Machine-Readable Watermark System
 * Renders an authentic forensic instant photograph from the current ESPER screen view.
 * Embeds:
 * - Machine-readable forensic QR glyph containing 3D coordinates and scene file reference.
 * - Chemical development animation (unexposed emulsion -> developed silver-halide print).
 * - Recall mechanism: Restores drone camera to the exact coordinates recorded on the card.
 * - System print dialog (window.print()) formatted as a photographic evidence card.
 */
export class HardcopyPrinter {
  constructor(crimeScene, consoleScene, crtOverlay) {
    this.crimeScene = crimeScene;
    this.consoleScene = consoleScene;
    this.crtOverlay = crtOverlay;

    this.savedHardcopies = [];
    this.currentHardcopy = null;

    this.buildUI();
  }

  buildUI() {
    // 1. Physical Yellow Button on UI (matching console yellow button)
    this.yellowBtnDock = document.createElement('div');
    this.yellowBtnDock.className = 'yellow-hardcopy-dock';
    this.yellowBtnDock.innerHTML = `
      <div class="yellow-btn-wrapper">
        <button id="btn-yellow-hardcopy" class="yellow-esper-btn" title="PRINT HARDCOPY / SEND LIGHT">
          <div class="yellow-cap">HARDCOPY</div>
        </button>
        <span class="yellow-label">SEND LIGHT</span>
      </div>
      <div class="recall-btn-wrapper">
        <button id="btn-recall-coords" class="recall-esper-btn" title="RECALL RECENT HARDCOPY COORDINATES">
          <div class="recall-cap">RECALL</div>
        </button>
        <span class="recall-label">COORDS</span>
      </div>
    `;
    document.body.appendChild(this.yellowBtnDock);

    this.btnYellow = this.yellowBtnDock.querySelector('#btn-yellow-hardcopy');
    this.btnRecall = this.yellowBtnDock.querySelector('#btn-recall-coords');

    this.btnYellow.addEventListener('click', () => this.generateHardcopy());
    this.btnRecall.addEventListener('click', () => this.recallLatest());

    // 2. Modal Inspection Card for Developed Hardcopy
    this.modal = document.createElement('div');
    this.modal.className = 'hardcopy-modal-backdrop';
    this.modal.innerHTML = `
      <div class="hardcopy-modal-card" id="hardcopy-card">
        <div class="hardcopy-header">
          <span class="stamp-lapd">LAPD FORENSIC DIVISION // ESPER 99</span>
          <span class="stamp-case" id="card-case-id">CASE # 2019-LEON</span>
        </div>
        <div class="hardcopy-photo-frame">
          <img id="card-photo-img" class="card-photo developing" alt="ESPER Screen Capture" />
          <div class="developing-chem-overlay" id="chem-overlay"></div>
        </div>
        <div class="hardcopy-footer">
          <div class="card-telemetry">
            <div class="card-row">
              <span class="tele-tag">TELEMETRY:</span>
              <span class="tele-data" id="card-tele-string">ZM 3852 // NS 0197 // EW 0334</span>
            </div>
            <div class="card-row">
              <span class="tele-tag">SCENE REF:</span>
              <span class="tele-data">changing_room_10x14.glb (10'x14')</span>
            </div>
            <div class="card-row">
              <span class="tele-tag">TIMESTAMP:</span>
              <span class="tele-data" id="card-timestamp">2026-09-09 17:50:22 PST</span>
            </div>
          </div>
          <!-- Machine Readable Forensic Watermark Glyph -->
          <div class="card-watermark-container">
            <img id="card-watermark-qr" class="watermark-qr" alt="Forensic Watermark QR" />
            <div class="watermark-label">FORENSIC DATA GLYPH</div>
          </div>
        </div>
        <div class="hardcopy-actions no-print">
          <button id="btn-print-host" class="modal-btn print-btn">🖨 PRINT / EXPORT PDF</button>
          <button id="btn-recall-this" class="modal-btn recall-btn">⌖ RECALL TO DRONE</button>
          <button id="btn-close-modal" class="modal-btn close-btn">DISMISS</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.modal);

    this.cardPhotoImg = this.modal.querySelector('#card-photo-img');
    this.chemOverlay = this.modal.querySelector('#chem-overlay');
    this.cardTeleStr = this.modal.querySelector('#card-tele-string');
    this.cardTimestamp = this.modal.querySelector('#card-timestamp');
    this.cardWatermarkQR = this.modal.querySelector('#card-watermark-qr');

    this.modal.querySelector('#btn-print-host').addEventListener('click', () => {
      window.print();
    });

    this.modal.querySelector('#btn-recall-this').addEventListener('click', () => {
      if (this.currentHardcopy) {
        this.recallCoordinates(this.currentHardcopy.coords);
        this.closeModal();
      }
    });

    this.modal.querySelector('#btn-close-modal').addEventListener('click', () => {
      this.closeModal();
    });
  }

  async generateHardcopy() {
    this.crtOverlay.setTickerText('HARDCOPY COMMAND RECEIVED // EXPOSING EMULSION // EJECTING PRINT...');

    // 1. Get current telemetry and coordinates
    const tele = this.crimeScene.getTelemetry();
    const timestamp = new Date().toISOString();

    // 2. Render high-res crime scene snapshot
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = 1024;
    captureCanvas.height = 768;
    const cctx = captureCanvas.getContext('2d');

    // Render offscreen crime scene to capture canvas
    this.crimeScene.renderToTarget();
    const gl = this.crimeScene.renderer.getContext();
    const pixels = new Uint8Array(1024 * 768 * 4);
    this.crimeScene.renderer.readRenderTargetPixels(
      this.crimeScene.renderTarget,
      0,
      0,
      1024,
      768,
      pixels
    );

    // Flip vertically because WebGL pixels are inverted
    const imgData = cctx.createImageData(1024, 768);
    for (let y = 0; y < 768; y++) {
      for (let x = 0; x < 1024; x++) {
        const srcIdx = ((767 - y) * 1024 + x) * 4;
        const dstIdx = (y * 1024 + x) * 4;
        imgData.data[dstIdx] = pixels[srcIdx];
        imgData.data[dstIdx + 1] = pixels[srcIdx + 1];
        imgData.data[dstIdx + 2] = pixels[srcIdx + 2];
        imgData.data[dstIdx + 3] = 255;
      }
    }
    cctx.putImageData(imgData, 0, 0);

    // Apply CRT phosphor vignette & reticle onto captured evidence photo
    cctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
    cctx.lineWidth = 2;
    cctx.strokeRect(10, 10, 1004, 748);
    cctx.font = 'bold 22px "Courier New", monospace';
    cctx.fillStyle = '#00f0ff';
    cctx.fillText(`ZM ${tele.zm}  NS ${tele.ns}  EW ${tele.ew}`, 24, 42);

    const snapshotDataURL = captureCanvas.toDataURL('image/jpeg', 0.92);

    // 3. Construct Machine-Readable Watermark Payload
    const watermarkPayload = {
      system: 'LAPD-ESPER-99',
      case_id: '2019-LEON-KOWALSKI',
      scene_file: 'changing_room_10x14.glb',
      coords: {
        zm: tele.zm,
        ns: tele.ns,
        ew: tele.ew,
        x: Number(tele.position.x.toFixed(3)),
        y: Number(tele.position.y.toFixed(3)),
        z: Number(tele.position.z.toFixed(3)),
        pitch: Number(tele.pitch.toFixed(3)),
        yaw: Number(tele.yaw.toFixed(3)),
        zoomLevel: Number(tele.zoomLevel.toFixed(3))
      },
      timestamp
    };

    // 4. Generate Forensic Watermark QR Glyph
    const qrDataURL = await QRCode.toDataURL(JSON.stringify(watermarkPayload), {
      margin: 1,
      width: 128,
      color: {
        dark: '#002830',
        light: '#e0f7fc'
      }
    });

    const hardcopyRecord = {
      image: snapshotDataURL,
      qr: qrDataURL,
      coords: watermarkPayload.coords,
      timestamp,
      tele
    };
    this.savedHardcopies.push(hardcopyRecord);
    this.currentHardcopy = hardcopyRecord;

    // 5. Trigger 3D Console Slot Ejection Animation
    this.consoleScene.ejectHardcopy();

    // 6. Present Developed Hardcopy Modal with chemical exposure transition
    setTimeout(() => {
      this.displayHardcopy(hardcopyRecord);
    }, 600);
  }

  displayHardcopy(record) {
    this.cardPhotoImg.src = record.image;
    this.cardWatermarkQR.src = record.qr;
    this.cardTeleStr.textContent = `ZM ${record.tele.zm} // NS ${record.tele.ns} // EW ${record.tele.ew}`;
    this.cardTimestamp.textContent = new Date(record.timestamp).toLocaleString();

    // Show modal
    this.modal.classList.add('visible');

    // Chemical development animation:
    // Starts with blue-grey opaque veil, fades out to reveal crisp photo
    this.chemOverlay.style.opacity = '0.92';
    this.chemOverlay.style.backgroundColor = '#152438';
    setTimeout(() => {
      this.chemOverlay.style.transition = 'opacity 2.8s cubic-bezier(0.2, 0.8, 0.4, 1)';
      this.chemOverlay.style.opacity = '0.0';
    }, 50);

    this.crtOverlay.setTickerText('HARDCOPY CHEMICALLY DEVELOPED // MACHINE WATERMARK ACTIVE');
  }

  closeModal() {
    this.modal.classList.remove('visible');
  }

  recallCoordinates(coords) {
    if (!coords) return;
    this.crimeScene.setCoordinates(coords);
    this.crtOverlay.setTickerText(
      `RECALL EXECUTED: RESTORED TO ZM ${coords.zm} // NS ${coords.ns} // EW ${coords.ew}`
    );
  }

  recallLatest() {
    if (this.savedHardcopies.length === 0) {
      this.crtOverlay.setTickerText('RECALL NOTICE: NO HARDCOPIES ON RECORD YET.');
      return;
    }
    const latest = this.savedHardcopies[this.savedHardcopies.length - 1];
    this.recallCoordinates(latest.coords);
  }
}
