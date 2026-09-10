/**
 * Microphone Audio Input & Analogue VU Meter Controller
 * Captures microphone audio and drives:
 * 1. The 3D physical needle on the ESPER console.
 * 2. An authentic 2D vintage backlit analogue meter with VU ballistics.
 */
export class AudioVU {
  constructor(consoleScene, onPermissionGranted) {
    this.consoleScene = consoleScene;
    this.onPermissionGranted = onPermissionGranted || (() => {});

    this.audioCtx = null;
    this.analyser = null;
    this.microphone = null;
    this.stream = null;
    this.enabled = false;

    // Ballistics
    this.currentLevel = 0.0;
    this.targetLevel = 0.0;
    this.peakLevel = 0.0;

    this.buildUI();
  }

  buildUI() {
    this.vuWidget = document.createElement('div');
    this.vuWidget.className = 'analogue-vu-widget';
    this.vuWidget.innerHTML = `
      <div class="vu-glass">
        <div class="vu-scale">
          <div class="vu-ticks">
            <span class="tick">-20</span>
            <span class="tick">-10</span>
            <span class="tick">-7</span>
            <span class="tick">-5</span>
            <span class="tick">-3</span>
            <span class="tick">0</span>
            <span class="tick red">+1</span>
            <span class="tick red">+3</span>
          </div>
          <div class="vu-label">VU</div>
        </div>
        <div class="vu-needle-container">
          <div class="vu-needle" id="ui-vu-needle"></div>
          <div class="vu-pivot"></div>
        </div>
      </div>
      <div class="vu-status-bar">
        <button id="btn-mic-toggle" class="vu-mic-btn">MIC SENSOR: OFF</button>
        <span id="vu-peak-db" class="vu-db-readout">-∞ dB</span>
      </div>
    `;
    document.body.appendChild(this.vuWidget);

    this.needleEl = this.vuWidget.querySelector('#ui-vu-needle');
    this.btnMic = this.vuWidget.querySelector('#btn-mic-toggle');
    this.peakDbEl = this.vuWidget.querySelector('#vu-peak-db');

    this.btnMic.addEventListener('click', () => this.toggleMicrophone());
  }

  async toggleMicrophone() {
    if (this.enabled) {
      this.stop();
    } else {
      await this.start();
    }
  }

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.3;

      this.microphone = this.audioCtx.createMediaStreamSource(this.stream);
      this.microphone.connect(this.analyser);

      this.enabled = true;
      this.btnMic.textContent = 'MIC SENSOR: LIVE';
      this.btnMic.classList.add('active');

      this.onPermissionGranted(true);
    } catch (err) {
      console.warn('Microphone permission or device notice:', err);
      this.btnMic.textContent = 'MIC: UNAVAILABLE';
      this.onPermissionGranted(false);
    }
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    this.enabled = false;
    this.btnMic.textContent = 'MIC SENSOR: OFF';
    this.btnMic.classList.remove('active');
    this.targetLevel = 0.0;
    this.currentLevel = 0.0;
    this.updateNeedle(0);
  }

  update(delta) {
    if (this.enabled && this.analyser) {
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteTimeDomainData(dataArray);

      // Compute Root-Mean-Square (RMS)
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const norm = (dataArray[i] - 128) / 128;
        sumSquares += norm * norm;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);

      // Boost mic gain for visual dynamism
      const boostedRms = Math.min(1.0, rms * 4.5);
      this.targetLevel = boostedRms;

      // Peak dB estimation
      const db = rms > 0.001 ? 20 * Math.log10(rms) : -60;
      if (this.peakDbEl) {
        this.peakDbEl.textContent = `${db.toFixed(1)} dB`;
      }
    } else {
      this.targetLevel = 0.0;
      if (this.peakDbEl) this.peakDbEl.textContent = '-∞ dB';
    }

    // Classic VU meter ballistics: Fast attack (rise ~300ms) with slight overshoot, smooth release
    const speed = this.targetLevel > this.currentLevel ? 14.0 : 6.0;
    this.currentLevel += (this.targetLevel - this.currentLevel) * Math.min(1.0, delta * speed);

    // Update 3D Needle on ESPER machine console
    if (this.consoleScene) {
      this.consoleScene.setVuLevel(this.currentLevel);
    }

    // Update 2D Widget Needle
    this.updateNeedle(this.currentLevel);
  }

  updateNeedle(level) {
    // Angular deflection: -38deg to +38deg
    const minDeg = -38;
    const maxDeg = 38;
    const deg = minDeg + level * (maxDeg - minDeg);
    if (this.needleEl) {
      this.needleEl.style.transform = `rotate(${deg}deg)`;
    }
  }
}
