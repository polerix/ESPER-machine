/**
 * Dual "Unicorn" Joystick Dials
 * Implements the two rotary / 2-axis dials on the right panel labeled "unicorn".
 * - Upper Dial: Translates drone coordinates (East-West & North-South)
 * - Lower Dial: Steers camera orientation (Yaw & Pitch) and Zoom
 */
export class UnicornDials {
  constructor(crimeScene) {
    this.crimeScene = crimeScene;
    this.buildUI();
  }

  buildUI() {
    this.container = document.createElement('div');
    this.container.className = 'unicorn-dials-panel';
    this.container.innerHTML = `
      <div class="unicorn-header">
        <svg class="unicorn-icon" viewBox="0 0 24 24" width="22" height="22">
          <!-- Origami Unicorn Silhouette -->
          <polygon points="12,2 15,8 19,4 16,11 21,14 15,16 17,22 12,18 7,22 9,16 3,14 8,11 5,4 9,8" fill="#00e5ff" opacity="0.85"/>
        </svg>
        <span>UNICORN NAVIGATION</span>
      </div>

      <!-- Dial 1: Coordinates (E-W / N-S) -->
      <div class="dial-wrapper">
        <div class="dial-label">DIAL I // COORD [E-W / N-S]</div>
        <div class="dial-rotary" id="dial-1">
          <div class="dial-knob" id="knob-1">
            <div class="dial-marker"></div>
            <div class="dial-center-dot"></div>
          </div>
          <div class="dial-axis-labels">
            <span class="lbl-n">N</span>
            <span class="lbl-s">S</span>
            <span class="lbl-w">W</span>
            <span class="lbl-e">E</span>
          </div>
        </div>
      </div>

      <!-- Dial 2: Orientation & Zoom (Yaw / Pitch / ZM) -->
      <div class="dial-wrapper">
        <div class="dial-label">DIAL II // VECTOR [YAW / ZOOM]</div>
        <div class="dial-rotary" id="dial-2">
          <div class="dial-knob" id="knob-2">
            <div class="dial-marker alt"></div>
            <div class="dial-center-dot"></div>
          </div>
          <div class="dial-axis-labels">
            <span class="lbl-n">+ZM</span>
            <span class="lbl-s">-ZM</span>
            <span class="lbl-w">◀</span>
            <span class="lbl-e">▶</span>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(this.container);

    this.setupDialEvents(
      this.container.querySelector('#dial-1'),
      this.container.querySelector('#knob-1'),
      (dx, dy) => {
        // Upper dial: East-West / North-South translation
        this.crimeScene.moveDrone(dx * 0.08, 0, dy * 0.08);
      }
    );

    this.setupDialEvents(
      this.container.querySelector('#dial-2'),
      this.container.querySelector('#knob-2'),
      (dx, dy) => {
        // Lower dial: Yaw rotation (dx) and Zoom (dy)
        this.crimeScene.rotateDrone(0, dx * 0.06);
        if (Math.abs(dy) > 0.1) {
          if (dy < 0) {
            this.crimeScene.enhance(1.0 + Math.abs(dy) * 0.05);
          } else {
            this.crimeScene.pullBack(1.0 / (1.0 + dy * 0.05));
          }
        }
      }
    );
  }

  setupDialEvents(dialEl, knobEl, onMove) {
    let isInteracting = false;
    let startX = 0;
    let startY = 0;
    let rotAngle = 0;

    const onStart = (clientX, clientY) => {
      isInteracting = true;
      startX = clientX;
      startY = clientY;
      knobEl.classList.add('active');
    };

    const onUpdate = (clientX, clientY) => {
      if (!isInteracting) return;
      const rect = dialEl.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = (clientX - centerX) / (rect.width / 2);
      const deltaY = (clientY - centerY) / (rect.height / 2);

      // Deflect knob visually like a joystick
      const maxDeflect = 14; // pixels
      const clampedX = Math.max(-1, Math.min(1, deltaX));
      const clampedY = Math.max(-1, Math.min(1, deltaY));

      rotAngle = Math.atan2(clampedY, clampedX) * (180 / Math.PI) + 90;
      knobEl.style.transform = `translate(${clampedX * maxDeflect}px, ${clampedY * maxDeflect}px) rotate(${rotAngle}deg)`;

      onMove(clampedX, clampedY);
    };

    const onEnd = () => {
      if (!isInteracting) return;
      isInteracting = false;
      knobEl.classList.remove('active');
      knobEl.style.transform = `translate(0px, 0px) rotate(${rotAngle}deg)`;
    };

    // Mouse events
    dialEl.addEventListener('mousedown', (e) => onStart(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => onUpdate(e.clientX, e.clientY));
    window.addEventListener('mouseup', onEnd);

    // Touch events
    dialEl.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) onStart(e.touches[0].clientX, e.touches[0].clientY);
    });
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) onUpdate(e.touches[0].clientX, e.touches[0].clientY);
    });
    window.addEventListener('touchend', onEnd);
  }
}
