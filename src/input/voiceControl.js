/**
 * Blade Runner ESPER Voice Recognition Controller
 * Uses the Web Speech API (SpeechRecognition / webkitSpeechRecognition)
 * to listen for canonical ESPER voice commands.
 */
export class VoiceControl {
  constructor(crimeScene, crtOverlay, onHardcopyTrigger) {
    this.crimeScene = crimeScene;
    this.crtOverlay = crtOverlay;
    this.onHardcopyTrigger = onHardcopyTrigger || (() => {});

    this.recognition = null;
    this.isListening = false;
    this.supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

    this.buildUI();
    if (this.supported) {
      this.initRecognition();
    }
  }

  buildUI() {
    this.bar = document.createElement('div');
    this.bar.className = 'voice-control-bar';
    this.bar.innerHTML = `
      <div class="voice-status-indicator">
        <span class="voice-dot" id="voice-dot"></span>
        <span class="voice-label" id="voice-label">VOICE CMD: STANDBY</span>
      </div>
      <div class="voice-transcript" id="voice-transcript">"Enhance", "Track Right", "Center In", "Hard Copy"</div>
      <button class="esper-btn voice-toggle-btn" id="btn-voice-toggle">
        ${this.supported ? 'START LISTENING' : 'SPEECH API UNAVAILABLE'}
      </button>
    `;
    document.body.appendChild(this.bar);

    this.dot = this.bar.querySelector('#voice-dot');
    this.label = this.bar.querySelector('#voice-label');
    this.transcriptEl = this.bar.querySelector('#voice-transcript');
    this.btnToggle = this.bar.querySelector('#btn-voice-toggle');

    if (this.supported) {
      this.btnToggle.addEventListener('click', () => this.toggleListening());
    } else {
      this.btnToggle.disabled = true;
    }
  }

  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      this.dot.classList.add('live');
      this.label.textContent = 'VOICE CMD: LISTENING';
      this.btnToggle.textContent = 'STOP LISTENING';
      this.btnToggle.classList.add('active');
      this.crtOverlay.setTickerText('ESPER SPEECH SYSTEM: LISTENING FOR CANONICAL ORDERS...');
    };

    this.recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const spoken = (finalTranscript || interimTranscript).trim().toLowerCase();
      if (spoken) {
        this.transcriptEl.textContent = `"${spoken}"`;
        this.parseCommand(spoken);
      }
    };

    this.recognition.onerror = (err) => {
      console.warn('Speech recognition notice:', err.error);
      if (err.error === 'not-allowed') {
        this.label.textContent = 'VOICE CMD: PERMISSION DENIED';
        this.stop();
      }
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        // Auto-restart if user still wants it active
        try {
          this.recognition.start();
        } catch (_) {
          this.stop();
        }
      } else {
        this.stop();
      }
    };
  }

  toggleListening() {
    if (this.isListening) {
      this.stop();
    } else {
      this.start();
    }
  }

  start() {
    if (!this.recognition) return;
    try {
      this.isListening = true;
      this.recognition.start();
    } catch (e) {
      console.warn('Speech recognition start notice:', e);
    }
  }

  stop() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (_) {}
    }
    this.dot.classList.remove('live');
    this.label.textContent = 'VOICE CMD: STANDBY';
    this.btnToggle.textContent = 'START LISTENING';
    this.btnToggle.classList.remove('active');
  }

  parseCommand(text) {
    // 1. Hardcopy Commands ("give me a hard copy right there", "hard copy", "print")
    if (text.includes('hard copy') || text.includes('hardcopy') || text.includes('print')) {
      this.crtOverlay.setTickerText('CMD EXECUTED: "GIVE ME A HARD COPY" -> EJECTING INSTANT PRINT');
      this.onHardcopyTrigger();
      return;
    }

    // 2. Stop Commands ("stop", "wait", "hold")
    if (text.includes('stop') || text.includes('wait') || text.includes('hold')) {
      this.crtOverlay.setTickerText('CMD EXECUTED: "STOP" // ALL AXES LOCKED');
      this.crimeScene.stopMotion();
      return;
    }

    // 3. Center In Commands ("center", "center in")
    if (text.includes('center')) {
      this.crtOverlay.setTickerText('CMD EXECUTED: "CENTER IN"');
      this.crimeScene.centerIn();
      return;
    }

    // 4. Enhance / Zoom In ("enhance 224 to 176", "enhance", "zoom in", "closer")
    if (text.includes('enhance') || text.includes('zoom in') || text.includes('magnify')) {
      // Check for coordinate numbers: e.g. "enhance 224 to 176"
      const matchNumbers = text.match(/\d+/g);
      if (matchNumbers && matchNumbers.length >= 2) {
        const c1 = parseInt(matchNumbers[0], 10);
        const c2 = parseInt(matchNumbers[1], 10);
        this.crtOverlay.setTickerText(`CMD EXECUTED: "ENHANCE ${c1} TO ${c2}"`);
        this.crtOverlay.setTargetBox(c1, c2);
        this.crimeScene.enhance(2.2);
      } else {
        this.crtOverlay.setTickerText('CMD EXECUTED: "ENHANCE" (STEPPING)');
        this.crimeScene.enhance(1.75);
      }
      return;
    }

    // 5. Pull back / Zoom out ("pull back", "pull out", "zoom out")
    if (text.includes('pull back') || text.includes('pull out') || text.includes('zoom out')) {
      this.crtOverlay.setTickerText('CMD EXECUTED: "PULL BACK"');
      this.crimeScene.pullBack(0.6);
      return;
    }

    // 6. Track Right / Go Right ("track right", "track 45 right", "go right")
    if (text.includes('track right') || text.includes('go right') || text.includes('pan right')) {
      this.crtOverlay.setTickerText('CMD EXECUTED: "TRACK RIGHT"');
      this.crimeScene.activeTrackCommand = 'right';
      return;
    }

    // 7. Track Left / Go Left ("track left", "go left", "pan left")
    if (text.includes('track left') || text.includes('go left') || text.includes('pan left')) {
      this.crtOverlay.setTickerText('CMD EXECUTED: "TRACK LEFT"');
      this.crimeScene.activeTrackCommand = 'left';
      return;
    }

    // 8. Move In ("move in", "go in")
    if (text.includes('move in') || text.includes('go in')) {
      this.crtOverlay.setTickerText('CMD EXECUTED: "MOVE IN"');
      this.crimeScene.activeTrackCommand = 'in';
      return;
    }
  }
}
