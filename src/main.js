import * as THREE from 'three';
import { CrimeScene } from './scene/crimeScene.js';
import { ConsoleScene } from './scene/consoleScene.js';
import { CRTOverlay } from './hud/crtOverlay.js';
import { WebcamTracker } from './input/webcamTracker.js';
import { AudioVU } from './input/audioVU.js';
import { UnicornDials } from './input/unicornDials.js';
import { VoiceControl } from './input/voiceControl.js';
import { HardcopyPrinter } from './output/hardcopyPrinter.js';

/**
 * Main Application Orchestrator for ESPER Machine Emulation
 */
class EsperApp {
  constructor() {
    this.container = document.getElementById('app');

    // Main WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // 1. Initialize 3D Crime Scene (10' x 14' Room)
    this.crimeScene = new CrimeScene(this.renderer);

    // 2. Initialize 3D ESPER Console Workstation
    this.consoleScene = new ConsoleScene(this.renderer, this.crimeScene);

    // 3. Initialize CRT Overlay HUD
    this.overlayContainer = document.getElementById('crt-overlay-container');
    this.crtOverlay = new CRTOverlay(this.overlayContainer);

    // 4. Initialize Analogue VU Meter & Audio Processor
    this.audioVU = new AudioVU(this.consoleScene, (granted) => {
      this.crtOverlay.setTickerText(
        granted
          ? 'AUDIO SENSOR: ONLINE // ANALOGUE VU METER ENGAGED'
          : 'AUDIO SENSOR: ACCESS DENIED'
      );
    });

    // 5. Initialize Dual Unicorn Joysticks
    this.unicornDials = new UnicornDials(this.crimeScene);

    // 6. Initialize Hardcopy Photo System & Machine Watermark
    this.hardcopyPrinter = new HardcopyPrinter(
      this.crimeScene,
      this.consoleScene,
      this.crtOverlay
    );

    // 7. Initialize Voice Command Parser
    this.voiceControl = new VoiceControl(
      this.crimeScene,
      this.crtOverlay,
      () => this.hardcopyPrinter.generateHardcopy()
    );

    // 8. Initialize Webcam Tangible Object Tracker
    this.webcamTracker = new WebcamTracker(this.crimeScene, (enabled, msg) => {
      this.crtOverlay.setTickerText(
        enabled
          ? 'OPTICAL TRACKER: LIVE // SAMPLE ANY CONTROL OBJECT IN FEED'
          : `OPTICAL TRACKER: OFFLINE ${msg ? '(' + msg + ')' : ''}`
      );
    });

    // Raycaster for clicking 3D interactive buttons (Yellow Button, Dials)
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.clock = new THREE.Clock();
    this.initControls();
    this.initTopBar();

    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  initTopBar() {
    const topBar = document.getElementById('view-toggle-bar');
    const btnViewMode = document.getElementById('btn-toggle-view');

    btnViewMode.addEventListener('click', () => {
      const mode = this.consoleScene.toggleViewMode();
      btnViewMode.textContent = mode === 'desk' ? 'VIEW: CONSOLE DESK' : 'VIEW: CRT DIRECT';
      this.crtOverlay.setTickerText(
        mode === 'desk'
          ? 'VIEW CHANGED: CONSOLE WORKSTATION'
          : 'VIEW CHANGED: DIRECT CRT FORENSIC MONITOR'
      );
    });

    // Instructions modal button
    const btnHelp = document.getElementById('btn-show-help');
    const helpModal = document.getElementById('help-modal');
    const btnCloseHelp = document.getElementById('btn-close-help');

    btnHelp.addEventListener('click', () => helpModal.classList.add('visible'));
    btnCloseHelp.addEventListener('click', () => helpModal.classList.remove('visible'));
  }

  initControls() {
    // Keyboard navigation fallback
    window.addEventListener('keydown', (e) => {
      const step = 0.12;
      const rotStep = 0.04;

      switch (e.key.toLowerCase()) {
        case 'arrowup':
        case 'w':
          this.crimeScene.moveDrone(0, 0, -step);
          break;
        case 'arrowdown':
        case 's':
          this.crimeScene.moveDrone(0, 0, step);
          break;
        case 'arrowleft':
        case 'a':
          this.crimeScene.moveDrone(-step, 0, 0);
          break;
        case 'arrowright':
        case 'd':
          this.crimeScene.moveDrone(step, 0, 0);
          break;
        case 'r':
          this.crimeScene.moveDrone(0, step, 0); // elevation up
          break;
        case 'f':
          this.crimeScene.moveDrone(0, -step, 0); // elevation down
          break;
        case 'q':
          this.crimeScene.pullBack(0.75); // zoom out
          break;
        case 'e':
          this.crimeScene.enhance(1.4); // zoom in
          break;
        case ' ': // Space toggles view mode
          document.getElementById('btn-toggle-view').click();
          break;
        case 'p':
          this.hardcopyPrinter.generateHardcopy();
          break;
      }
    });

    // Mouse wheel zoom
    window.addEventListener('wheel', (e) => {
      if (e.target.closest('.webcam-tracker-panel') || e.target.closest('.unicorn-dials-panel')) {
        return;
      }
      if (e.deltaY < 0) {
        this.crimeScene.enhance(1.08);
      } else {
        this.crimeScene.pullBack(0.92);
      }
    }, { passive: true });

    // Click on 3D yellow button on console
    window.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('.webcam-tracker-panel') || e.target.closest('.unicorn-dials-panel') || e.target.closest('.analogue-vu-widget')) {
        return;
      }

      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.consoleScene.camera);

      const intersects = this.raycaster.intersectObjects(this.consoleScene.scene.children, true);
      for (const hit of intersects) {
        if (hit.object === this.consoleScene.yellowBtn) {
          this.hardcopyPrinter.generateHardcopy();
          break;
        } else if (hit.object === this.consoleScene.photoMesh) {
          if (this.hardcopyPrinter.currentHardcopy) {
            this.hardcopyPrinter.displayHardcopy(this.hardcopyPrinter.currentHardcopy);
          }
          break;
        }
      }
    });
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.consoleScene.onResize();
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = Math.min(0.1, this.clock.getDelta());

    // 1. Update Crime Scene & Render offscreen to texture
    this.crimeScene.update(delta);
    this.crimeScene.renderToTarget();

    // 2. Update Console Props & View transition
    this.consoleScene.update(delta);

    // 3. Update Analogue VU Meter with mic audio
    this.audioVU.update(delta);

    // 4. Update CRT Telemetry & HUD
    const tele = this.crimeScene.getTelemetry();
    this.crtOverlay.update(tele, this.crimeScene);

    // 5. Render physical workstation view
    this.consoleScene.render();
  }
}

// Start ESPER System on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new EsperApp();
});
