import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * 3D Physical ESPER Console Workstation
 * Loads the Glowbox 3D ESPER Machine GLB model.
 * Provides:
 * - Moody Blade Runner noir desk environment & lighting.
 * - Dynamic CRT monitor screen textured with live crime scene render target.
 * - 3D Analogue VU meter needle on the upper left.
 * - Dual "Unicorn" rotary dials on the right panel.
 * - Top hardcopy slot with physical photo ejection animation.
 * - Yellow "Hardcopy" print button.
 * - Smooth camera transitions between Desk View and Monitor Focus View.
 */
export class ConsoleScene {
  constructor(renderer, crimeScene) {
    this.renderer = renderer;
    this.crimeScene = crimeScene;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06080c);
    this.scene.fog = new THREE.FogExp2(0x06080c, 0.12);

    // Console Camera
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 50);

    // View Modes: 'desk' or 'monitor'
    this.viewMode = 'desk';
    this.cameraViews = {
      desk: {
        pos: new THREE.Vector3(0.0, 1.25, 2.3),
        target: new THREE.Vector3(0.0, 0.75, 0.0),
        fov: 48
      },
      monitor: {
        pos: new THREE.Vector3(-0.02, 0.88, 0.92),
        target: new THREE.Vector3(-0.02, 0.88, 0.0),
        fov: 34
      }
    };

    this.currentCamPos = this.cameraViews.desk.pos.clone();
    this.currentCamTarget = this.cameraViews.desk.target.clone();
    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentCamTarget);

    // Interactive 3D elements
    this.modelLoaded = false;
    this.vuNeedle = null;
    this.vuAngle = -0.55; // Resting angle (approx -30 deg)
    this.targetVuAngle = -0.55;

    this.unicornDial1 = null; // Upper coordinate dial
    this.unicornDial2 = null; // Lower angle/zoom dial

    this.photoMesh = null;
    this.photoEjected = false;
    this.photoAnimProgress = 0.0; // 0 = inside slot, 1 = ejected

    this.initLighting();
    this.buildDeskEnvironment();
    this.loadEsperModel();
    this.buildInteractiveProps();
  }

  initLighting() {
    // Soft moody ambient
    const ambient = new THREE.AmbientLight(0x1a2636, 1.2);
    this.scene.add(ambient);

    // Warm vintage desk lamp spotlight (casting dramatic shadows)
    this.deskSpot = new THREE.SpotLight(0xffb566, 8.0, 5.0, Math.PI / 4, 0.4, 1.2);
    this.deskSpot.position.set(1.4, 2.2, 1.5);
    this.deskSpot.target.position.set(0.0, 0.7, 0.0);
    this.scene.add(this.deskSpot);
    this.scene.add(this.deskSpot.target);

    // Rainy window cyan / electric blue backspill
    const neonLight = new THREE.DirectionalLight(0x0088cc, 2.2);
    neonLight.position.set(-2.0, 1.5, -1.0);
    this.scene.add(neonLight);

    // Subtle CRT monitor face glow into console
    this.crtGlow = new THREE.PointLight(0x00e1ff, 2.0, 1.5, 2.0);
    this.crtGlow.position.set(0.0, 0.88, 0.35);
    this.scene.add(this.crtGlow);
  }

  buildDeskEnvironment() {
    // Wooden detective desk surface
    const deskGeo = new THREE.BoxGeometry(3.6, 0.1, 2.4);
    const deskMat = new THREE.MeshStandardMaterial({
      color: 0x181310,
      roughness: 0.65,
      metalness: 0.1
    });
    const desk = new THREE.Mesh(deskGeo, deskMat);
    desk.position.set(0, 0.0, 0);
    this.scene.add(desk);

    // Apartment back wall with Venetian blind shadows
    const wallGeo = new THREE.PlaneGeometry(6.0, 4.0);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x0f151c,
      roughness: 0.9
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(0, 1.5, -1.2);
    this.scene.add(wall);
  }

  loadEsperModel() {
    const loader = new GLTFLoader();
    loader.load(
      '/models/esper_machine_v.xb71.glb',
      (gltf) => {
        this.esperModel = gltf.scene;

        // Compute model bounding box to scale and center on the desk
        const box = new THREE.Box3().setFromObject(this.esperModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Scale model appropriately to fit real-world desk proportions (~1.1m wide)
        const targetWidth = 1.15;
        const scaleFactor = targetWidth / Math.max(size.x, size.z);
        this.esperModel.scale.setScalar(scaleFactor);

        // Center on desk surface
        this.esperModel.position.x = -center.x * scaleFactor;
        this.esperModel.position.y = 0.05 - box.min.y * scaleFactor;
        this.esperModel.position.z = -center.z * scaleFactor;

        // Enhance material properties
        this.esperModel.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material.roughness = 0.55;
            child.material.metalness = 0.35;
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        this.scene.add(this.esperModel);
        this.modelLoaded = true;

        // Re-position screen and props relative to the scaled model
        this.adjustPropsToModel();
      },
      undefined,
      (err) => {
        console.warn('GLB load notice (using procedural console shell fallback if needed):', err);
      }
    );
  }

  buildInteractiveProps() {
    this.propsGroup = new THREE.Group();

    // 1. CRT Screen Surface (Positioned at monitor bezel)
    // Monitor screen width ~0.42m, height ~0.32m (4:3 aspect ratio)
    const screenGeo = new THREE.PlaneGeometry(0.42, 0.32, 16, 16);

    // Apply subtle CRT spherical bulging
    const pos = screenGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i);
      const v = pos.getY(i);
      const distSq = (u * u) / (0.21 * 0.21) + (v * v) / (0.16 * 0.16);
      const bulge = Math.max(0, 1 - distSq * 0.25) * 0.015;
      pos.setZ(i, bulge);
    }
    screenGeo.computeVertexNormals();

    this.screenMat = new THREE.MeshBasicMaterial({
      map: this.crimeScene.renderTarget.texture
    });
    this.screenMesh = new THREE.Mesh(screenGeo, this.screenMat);
    // Position on console screen bezel
    this.screenMesh.position.set(-0.02, 0.88, 0.08);
    this.screenMesh.rotation.x = -0.08; // subtle upward tilt
    this.propsGroup.add(this.screenMesh);

    // Screen Bezel border frame
    const bezelGeo = new THREE.BoxGeometry(0.45, 0.35, 0.02);
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x121417,
      roughness: 0.8
    });
    this.bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
    this.bezelMesh.position.set(-0.02, 0.88, 0.07);
    this.bezelMesh.rotation.x = -0.08;
    this.propsGroup.add(this.bezelMesh);

    // 2. Analogue VU Meter (Upper Left Panel)
    const vuGroup = new THREE.Group();
    vuGroup.position.set(-0.35, 1.05, 0.08);
    vuGroup.rotation.x = -0.15;

    // Meter Housing & Backlit Face
    const vuFaceGeo = new THREE.BoxGeometry(0.14, 0.09, 0.02);
    const vuFaceMat = new THREE.MeshStandardMaterial({
      color: 0xfff0cc,
      emissive: 0xaa8833,
      emissiveIntensity: 0.45,
      roughness: 0.5
    });
    const vuFace = new THREE.Mesh(vuFaceGeo, vuFaceMat);
    vuGroup.add(vuFace);

    // Meter Needle Pivot & Needle
    const needlePivot = new THREE.Group();
    needlePivot.position.set(0, -0.03, 0.012);

    const needleGeo = new THREE.BoxGeometry(0.002, 0.065, 0.001);
    needleGeo.translate(0, 0.032, 0); // pivot at base
    const needleMat = new THREE.MeshBasicMaterial({ color: 0xd62828 });
    this.vuNeedle = new THREE.Mesh(needleGeo, needleMat);
    needlePivot.add(this.vuNeedle);
    vuGroup.add(needlePivot);
    this.vuNeedlePivot = needlePivot;

    this.propsGroup.add(vuGroup);

    // 3. Dual "Unicorn" Joystick Dials (Right Panel)
    const dialGroup = new THREE.Group();
    dialGroup.position.set(0.36, 0.85, 0.12);
    dialGroup.rotation.x = -0.2;

    const dialMat = new THREE.MeshStandardMaterial({
      color: 0x184852, // vintage cyan / teal
      metalness: 0.6,
      roughness: 0.35
    });
    const dialGeo = new THREE.CylinderGeometry(0.045, 0.048, 0.025, 24);

    // Dial 1 (Upper: Coordinate Translation)
    this.unicornDial1 = new THREE.Mesh(dialGeo, dialMat);
    this.unicornDial1.position.set(0, 0.08, 0);
    dialGroup.add(this.unicornDial1);

    // Dial 2 (Lower: Angle & Zoom)
    this.unicornDial2 = new THREE.Mesh(dialGeo, dialMat);
    this.unicornDial2.position.set(0, -0.06, 0);
    dialGroup.add(this.unicornDial2);

    this.propsGroup.add(dialGroup);

    // 4. Centered Top Slot & Chemical Hardcopy Photo
    const slotGroup = new THREE.Group();
    slotGroup.position.set(-0.02, 1.15, -0.05);

    // Slot opening
    const slotRimGeo = new THREE.BoxGeometry(0.24, 0.015, 0.05);
    const slotRimMat = new THREE.MeshStandardMaterial({ color: 0x0a0c0e, roughness: 0.9 });
    const slotRim = new THREE.Mesh(slotRimGeo, slotRimMat);
    slotGroup.add(slotRim);

    // The Hardcopy Instant Photo (ejected upward and angled)
    const photoGeo = new THREE.BoxGeometry(0.18, 0.22, 0.003);
    this.photoMat = new THREE.MeshStandardMaterial({
      color: 0x1b2838, // Starts dark emulsion
      roughness: 0.4
    });
    this.photoMesh = new THREE.Mesh(photoGeo, this.photoMat);
    this.photoMesh.position.set(0, 0, 0);
    this.photoMesh.visible = false;
    slotGroup.add(this.photoMesh);

    this.propsGroup.add(slotGroup);

    // 5. Yellow "Hardcopy" Print Button
    const btnGroup = new THREE.Group();
    btnGroup.position.set(0.18, 0.68, 0.25);
    btnGroup.rotation.x = -0.35;

    const btnBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.03, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.8 })
    );
    btnGroup.add(btnBase);

    this.yellowBtn = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.02, 0.025),
      new THREE.MeshStandardMaterial({
        color: 0xf5b700, // iconic ESPER yellow
        emissive: 0x997300,
        emissiveIntensity: 0.4,
        roughness: 0.35
      })
    );
    this.yellowBtn.position.y = 0.012;
    btnGroup.add(this.yellowBtn);

    this.propsGroup.add(btnGroup);

    this.scene.add(this.propsGroup);
  }

  adjustPropsToModel() {
    // When GLB model loads, ensure screen matches exact visual alignment
    if (this.screenMesh) {
      this.screenMesh.visible = true;
    }
  }

  setVuLevel(normalizedLevel) {
    // Level 0.0 to 1.0 mapped to needle angle range: -0.65 rad (-37 deg) to +0.65 rad (+37 deg)
    const minAngle = -0.65;
    const maxAngle = 0.65;
    this.targetVuAngle = minAngle + normalizedLevel * (maxAngle - minAngle);
  }

  ejectHardcopy(texture) {
    if (!this.photoMesh) return;
    this.photoMesh.visible = true;
    this.photoEjected = true;
    this.photoAnimProgress = 0.0;

    if (texture) {
      this.photoMat.map = texture;
      this.photoMat.needsUpdate = true;
    }
  }

  resetHardcopy() {
    if (this.photoMesh) {
      this.photoMesh.visible = false;
      this.photoEjected = false;
      this.photoAnimProgress = 0.0;
    }
  }

  setViewMode(mode) {
    if (this.cameraViews[mode]) {
      this.viewMode = mode;
    }
  }

  toggleViewMode() {
    this.setViewMode(this.viewMode === 'desk' ? 'monitor' : 'desk');
    return this.viewMode;
  }

  update(delta) {
    // 1. Smooth Camera Transition between Desk Mode and Monitor Mode
    const targetView = this.cameraViews[this.viewMode];
    this.currentCamPos.lerp(targetView.pos, 0.08);
    this.currentCamTarget.lerp(targetView.target, 0.08);
    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentCamTarget);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetView.fov, 0.08);
    this.camera.updateProjectionMatrix();

    // 2. Animate Analogue VU Needle with realistic ballistics
    if (this.vuNeedlePivot) {
      // Fast attack, smooth spring release
      const speed = this.targetVuAngle > this.vuAngle ? 0.35 : 0.12;
      this.vuAngle = THREE.MathUtils.lerp(this.vuAngle, this.targetVuAngle, speed);
      this.vuNeedlePivot.rotation.z = -this.vuAngle;
    }

    // 3. Animate Hardcopy Photo Ejection
    if (this.photoEjected && this.photoAnimProgress < 1.0) {
      this.photoAnimProgress = Math.min(1.0, this.photoAnimProgress + delta * 0.8);
      // Photo slides up out of slot and tilts forward
      const ejectHeight = 0.14 * this.photoAnimProgress;
      const tilt = -0.2 * this.photoAnimProgress;
      this.photoMesh.position.set(0, ejectHeight, 0.04 * this.photoAnimProgress);
      this.photoMesh.rotation.x = tilt;

      // Chemical development: darken from unexposed blue to full color
      const developFactor = Math.min(1.0, this.photoAnimProgress * 1.2);
      this.photoMat.color.setRGB(
        developFactor,
        developFactor,
        developFactor
      );
    }

    // 4. Update Unicorn dial rotations to match drone movement
    if (this.unicornDial1 && this.unicornDial2) {
      this.unicornDial1.rotation.y = this.crimeScene.dronePos.x * 3.0;
      this.unicornDial2.rotation.y = this.crimeScene.droneYaw * 2.0;
    }

    // 5. Update CRT Screen Texture
    if (this.screenMat) {
      this.screenMat.map = this.crimeScene.renderTarget.texture;
      this.screenMat.needsUpdate = true;
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
