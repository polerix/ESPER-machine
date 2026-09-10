# ESPER // Model 99 Forensic Photo Analysis Workstation

A functional, high-fidelity web browser emulation of the iconic **ESPER photo analysis computer** from Ridley Scott's *Blade Runner* (1982), integrating the speculative interaction design critique by Christopher Noessel ([*Sci-Fi Interfaces*](https://scifiinterfaces.com/2020/04/29/deckards-photo-inspector/)).

In the LAPD lore, crime scenes are preserved as 3D forensic records. The ESPER functions as an invisible **"drone"** flying through this frozen moment of events, enabling detectives to inspect fine details, look around corners, and uncover clues reflected in convex mirrors.

---

## Features

### 1. 3D Physical ESPER Console
- High-fidelity 3D model of the forensic workstation console (model credit to **Glowbox 3D**).
- Moody noir lighting inspired by Deckard's rain-slicked apartment: warm amber desk lamp, cool cyan window spill, and ambient shadow blinds.
- Live CRT monitor display mapping the 3D crime scene directly onto the console screen in real time.
- Smooth camera switching between **Console Desk Mode** and **Direct CRT Focus Mode** (press <kbd>Space</kbd> or use the top navigation toggle).

### 2. 3D Changing Room Crime Scene & Drone Flight
- Procedural 10' x 14' changing room (dresser, vanity lamp, oxblood leather armchair, slatted closet with garments).
- **Dynamic Reflective Mirror**: A secondary reflection camera allows the user to pilot the drone and look *into* the convex wall mirror to reveal occluded angles and hidden reflections—just like Deckard finding Zhora.
- 6-DOF drone movement with authentic Blade Runner telemetry:
  - `ZM` — Optical magnification factor (0000 to 9999).
  - `NS` — North-South coordinate axis (0000 to 0999).
  - `EW` — East-West coordinate axis (0000 to 0999).

### 3. Forensic CRT Display & Minimap
- Labeled **101–910 cyan coordinate matrix** matching Christopher Noessel's improved forensic layout.
- Concentric zoom framing boxes and segmented crosshairs reticle.
- **Corner Minimap**: Top-down floorplan of the 10x14 room tracking drone location and directional viewing frustum.
- Ambient amber ticker strip along the upper bezel.

### 4. Tangible Webcam Object Tracking ("Whiskey Glass" TUI)
- Inspired by Deckard holding his drink on the couch arm:
  - Accesses webcam video (`getUserMedia`).
  - Click on any physical object in your webcam feed (a glass, cup, colored pen, or marker) to calibrate.
  - Centroid $(\bar{x}, \bar{y})$ and area tracking translates the drone horizontally/vertically and flies forward/backward against your desk surface.

### 5. Analogue VU Meter
- Positioned on the upper-left console, driven by real-time microphone input via the Web Audio API.
- Genuine ballistic meter dynamics (~300ms rise integration, spring overshoot damping, calibrated -20 dB to +3 dB logarithmic scale).
- Synchronously drives both the 3D needle on the console prop and the 2D illuminated gauge.

### 6. Dual "Unicorn" Joystick Dials
- Located on the right panel, emblazoned with the origami unicorn emblem:
  - **Dial I**: East-West and North-South coordinate translation.
  - **Dial II**: Camera Yaw orientation and Zoom magnification.

### 7. Canonical Voice Commands
- Powered by the Web Speech API:
  - `"Enhance"` / `"Zoom in"` / `"Enhance 224 to 176"` $\rightarrow$ Magnifies target.
  - `"Track right"` / `"Track left"` $\rightarrow$ Translates horizontally.
  - `"Move in"` / `"Pull back"` $\rightarrow$ Translates depth axis.
  - `"Center in"` $\rightarrow$ Centers reticle.
  - `"Stop"` / `"Wait"` $\rightarrow$ Halts active motion.
  - `"Give me a hard copy right there"` / `"Hard copy"` $\rightarrow$ Ejects instant photograph.

### 8. Chemical Hardcopy Instant Photo & Machine-Readable Watermark
- Pressing the **Yellow Button** or speaking `"Hard copy"`:
  - An instant photo slides upward from the top centered slot on the console.
  - Simulates chemical development: fades from dark unexposed emulsion to crisp photographic contrast over 2.8 seconds.
  - **Invisible / Machine-Readable Watermark**: Embeds a forensic QR glyph encoding the 3D scene reference, timestamp, and exact 6-DOF coordinates (`x, y, z, pitch, yaw, zm, ns, ew`).
  - **Recall Feature**: Clicking `"RECALL"` parses the recorded coordinates and automatically pilots the drone back to that exact vantage point.
  - **Print Dialog**: Click `"PRINT / EXPORT PDF"` to launch `window.print()`, formatted with `@media print` CSS for standard photo card output.

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- Modern web browser (Chrome, Edge, or Safari with WebGL, Web Audio, and Web Speech support)

### Installation
```bash
git clone https://github.com/polerix/ESPER-machine.git
cd ESPER-machine
npm install
```

### Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build
```bash
npm run build
npm run preview
```

---

## Controls Reference

| Control | Action |
|---|---|
| <kbd>W</kbd> / <kbd>S</kbd> or <kbd>↑</kbd> / <kbd>↓</kbd> | Move Drone Forward / Backward |
| <kbd>A</kbd> / <kbd>D</kbd> or <kbd>←</kbd> / <kbd>→</kbd> | Track Drone Left / Right |
| <kbd>R</kbd> / <kbd>F</kbd> | Elevation Up / Down |
| <kbd>E</kbd> / <kbd>Q</kbd> | Enhance (Zoom In) / Pull Back (Zoom Out) |
| <kbd>Space</kbd> | Toggle View (Console Desk vs. Direct CRT) |
| <kbd>P</kbd> | Print Hardcopy |
| Mouse Wheel | Smooth Optical Zoom |
| Optical Tracker | Slide calibrated object on desk to steer drone |
| Unicorn Dials | Drag rotary knobs to manipulate coordinates and yaw |

---

## Credits & Attribution

- **3D Console Model**: *"Esper Machine V.XB71"* by **[Glowbox 3D](https://sketchfab.com/ra3id)**, licensed under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).
- **Interaction Design**: Inspired by Christopher Noessel's analysis on [*Sci-Fi Interfaces*](https://scifiinterfaces.com/2020/04/29/deckards-photo-inspector/).
- *Blade Runner* is copyright © Warner Bros. & The Blade Runner Partnership. This is a non-commercial educational emulation and speculative interface project.
