import * as THREE from 'three';

/**
 * Procedural 10ft x 14ft Changing Room Crime Scene
 * Room dimensions: Width = 3.05m (10 ft), Depth = 4.27m (14 ft), Height = 2.6m
 * Includes: Dresser, Chair, Slatted Closet with clothes, Convex/Reflective Mirror, Evidence items.
 */
export class CrimeScene {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0c10);
    this.scene.fog = new THREE.FogExp2(0x0a0e14, 0.08);

    // Dimensions in meters (10ft x 14ft)
    this.roomWidth = 3.05;
    this.roomDepth = 4.27;
    this.roomHeight = 2.6;

    // Invisible Drone Camera
    this.camera = new THREE.PerspectiveCamera(50, 4 / 3, 0.05, 50);
    this.dronePos = new THREE.Vector3(0, 1.25, 1.4);
    this.droneTarget = new THREE.Vector3(0, 1.2, -1.0);
    this.dronePitch = -0.05;
    this.droneYaw = 0;
    this.zoomLevel = 1.0; // 1.0x to 100.0x
    this.targetZoomLevel = 1.0;

    // Motion velocities for smooth inertia
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.rotVelocity = { pitch: 0, yaw: 0 };
    this.activeTrackCommand = null; // 'right', 'left', 'in', 'out', 'enhance'

    // Render target for offscreen screen projection
    this.renderTarget = new THREE.WebGLRenderTarget(1024, 768, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType
    });

    this.initLights();
    this.buildRoom();
    this.buildFurniture();
    this.buildMirror();
    this.updateCamera();
  }

  initLights() {
    // Ambient noir fill
    const ambient = new THREE.AmbientLight(0x1a2634, 1.2);
    this.scene.add(ambient);

    // Ceiling vintage fixture light
    this.ceilingLight = new THREE.PointLight(0xffeedd, 2.8, 6.0, 1.5);
    this.ceilingLight.position.set(0, this.roomHeight - 0.25, 0);
    this.scene.add(this.ceilingLight);

    // Subtle fixture mesh
    const fixtureGeo = new THREE.CylinderGeometry(0.2, 0.15, 0.08, 16);
    const fixtureMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      emissive: 0xffeedd,
      emissiveIntensity: 0.8
    });
    const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
    fixture.position.copy(this.ceilingLight.position);
    this.scene.add(fixture);

    // Atmospheric cool cyan neon street light leaking through Venetian blinds
    const streetLight = new THREE.SpotLight(0x226688, 5.0, 10.0, Math.PI / 6, 0.4);
    streetLight.position.set(-this.roomWidth / 2 - 1.0, 1.8, 0.8);
    streetLight.target.position.set(0, 1.0, -0.5);
    this.scene.add(streetLight);
    this.scene.add(streetLight.target);

    // Dresser accent warm light
    const vanityLamp = new THREE.PointLight(0xffaa55, 1.8, 3.0, 1.8);
    vanityLamp.position.set(0.65, 1.25, -this.roomDepth / 2 + 0.5);
    this.scene.add(vanityLamp);
  }

  buildRoom() {
    // Floor - dark wood parquet pattern using procedural canvas texture
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const fctx = floorCanvas.getContext('2d');
    fctx.fillStyle = '#221914';
    fctx.fillRect(0, 0, 512, 512);
    // Planks
    fctx.strokeStyle = '#150f0c';
    fctx.lineWidth = 2;
    for (let y = 0; y < 512; y += 32) {
      fctx.beginPath();
      fctx.moveTo(0, y);
      fctx.lineTo(512, y);
      fctx.stroke();
    }
    for (let x = 0; x < 512; x += 128) {
      for (let y = 0; y < 512; y += 32) {
        const offset = (Math.floor(y / 32) % 2) * 64;
        fctx.beginPath();
        fctx.moveTo((x + offset) % 512, y);
        fctx.lineTo((x + offset) % 512, y + 32);
        fctx.stroke();
      }
    }
    const floorTex = new THREE.CanvasTexture(floorCanvas);
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(4, 6);

    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.5,
      metalness: 0.1
    });
    const floorGeo = new THREE.PlaneGeometry(this.roomWidth, this.roomDepth);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    this.scene.add(floor);

    // Ceiling
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: 0x1f2429,
      roughness: 0.9
    });
    const ceiling = new THREE.Mesh(floorGeo, ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = this.roomHeight;
    this.scene.add(ceiling);

    // Walls
    const wallCanvas = document.createElement('canvas');
    wallCanvas.width = 512;
    wallCanvas.height = 512;
    const wctx = wallCanvas.getContext('2d');
    wctx.fillStyle = '#2a333c';
    wctx.fillRect(0, 0, 512, 512);
    // Subtle wallpaper stripes & patina
    wctx.fillStyle = '#232b33';
    for (let x = 0; x < 512; x += 16) {
      wctx.fillRect(x, 0, 8, 512);
    }
    const wallTex = new THREE.CanvasTexture(wallCanvas);
    wallTex.wrapS = THREE.RepeatWrapping;
    wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(4, 2);

    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex,
      roughness: 0.85,
      metalness: 0.05
    });

    // North Wall (Back wall with dresser and mirror)
    const northWall = new THREE.Mesh(
      new THREE.PlaneGeometry(this.roomWidth, this.roomHeight),
      wallMat
    );
    northWall.position.set(0, this.roomHeight / 2, -this.roomDepth / 2);
    this.scene.add(northWall);

    // South Wall (Behind initial drone camera)
    const southWall = new THREE.Mesh(
      new THREE.PlaneGeometry(this.roomWidth, this.roomHeight),
      wallMat
    );
    southWall.rotation.y = Math.PI;
    southWall.position.set(0, this.roomHeight / 2, this.roomDepth / 2);
    this.scene.add(southWall);

    // West Wall (Left wall with slatted window)
    const westWall = new THREE.Mesh(
      new THREE.PlaneGeometry(this.roomDepth, this.roomHeight),
      wallMat
    );
    westWall.rotation.y = Math.PI / 2;
    westWall.position.set(-this.roomWidth / 2, this.roomHeight / 2, 0);
    this.scene.add(westWall);

    // East Wall (Right wall with closet)
    const eastWall = new THREE.Mesh(
      new THREE.PlaneGeometry(this.roomDepth, this.roomHeight),
      wallMat
    );
    eastWall.rotation.y = -Math.PI / 2;
    eastWall.position.set(this.roomWidth / 2, this.roomHeight / 2, 0);
    this.scene.add(eastWall);

    // Baseboards along walls
    const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x161210, roughness: 0.7 });
    const bbNorth = new THREE.Mesh(new THREE.BoxGeometry(this.roomWidth, 0.12, 0.03), baseboardMat);
    bbNorth.position.set(0, 0.06, -this.roomDepth / 2 + 0.015);
    this.scene.add(bbNorth);
  }

  buildFurniture() {
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x3d271d,
      roughness: 0.6,
      metalness: 0.15
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.3,
      metalness: 0.8
    });

    // 1. DRESSER / VANITY (Against North Wall)
    // Width: 1.4m, Height: 0.85m, Depth: 0.55m
    const dresserGroup = new THREE.Group();
    dresserGroup.position.set(0, 0, -this.roomDepth / 2 + 0.35);

    const dresserBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.8, 0.55),
      woodMat
    );
    dresserBody.position.y = 0.45;
    dresserGroup.add(dresserBody);

    // Dresser Legs
    const legGeo = new THREE.CylinderGeometry(0.025, 0.015, 0.15, 8);
    [
      [-0.65, -0.22],
      [0.65, -0.22],
      [-0.65, 0.22],
      [0.65, 0.22]
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, woodMat);
      leg.position.set(lx, 0.075, lz);
      dresserGroup.add(leg);
    });

    // Drawer seams & brass knobs
    for (let r = 0; r < 3; r++) {
      const dy = 0.25 + r * 0.22;
      // Knobs
      [-0.35, 0.35].forEach((kx) => {
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 12), brassMat);
        knob.position.set(kx, dy, 0.285);
        dresserGroup.add(knob);
      });
    }

    // Props on Dresser:
    // Vintage Table Lamp with warm shade
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.03, 16), brassMat);
    lampBase.position.set(0.5, 0.865, 0.05);
    dresserGroup.add(lampBase);

    const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.35, 8), brassMat);
    lampPole.position.set(0.5, 1.05, 0.05);
    dresserGroup.add(lampPole);

    const lampShade = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.18, 16, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xffd599,
        emissive: 0xff9922,
        emissiveIntensity: 0.6,
        side: THREE.DoubleSide
      })
    );
    lampShade.position.set(0.5, 1.2, 0.05);
    dresserGroup.add(lampShade);

    // Perfume bottle (faceted crystal look)
    const perfumeGeo = new THREE.BoxGeometry(0.05, 0.09, 0.05);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x99ddff,
      roughness: 0.1,
      transmission: 0.85,
      thickness: 0.05,
      transparent: true,
      opacity: 0.85
    });
    const perfume = new THREE.Mesh(perfumeGeo, glassMat);
    perfume.position.set(-0.35, 0.9, 0.1);
    dresserGroup.add(perfume);

    // Jewelry box
    const jBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.08, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x1f1412, roughness: 0.4 })
    );
    jBox.position.set(-0.15, 0.89, 0.08);
    dresserGroup.add(jBox);

    // Scattered evidence photos (resembling Leon's apartment photos!)
    const photoMat = new THREE.MeshStandardMaterial({
      color: 0xdedede,
      roughness: 0.3
    });
    const photo1 = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.13), photoMat);
    photo1.rotation.x = -Math.PI / 2;
    photo1.rotation.z = 0.25;
    photo1.position.set(0.15, 0.852, 0.1);
    dresserGroup.add(photo1);

    const photo2 = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.13), photoMat);
    photo2.rotation.x = -Math.PI / 2;
    photo2.rotation.z = -0.4;
    photo2.position.set(0.05, 0.853, 0.15);
    dresserGroup.add(photo2);

    this.scene.add(dresserGroup);

    // 2. RETRO CHAIR (In front of dresser / angled)
    const chairGroup = new THREE.Group();
    chairGroup.position.set(0.2, 0, -this.roomDepth / 2 + 1.2);
    chairGroup.rotation.y = Math.PI - 0.35;

    // Chair Seat
    const seatMat = new THREE.MeshStandardMaterial({
      color: 0x5a2d22, // vintage oxblood leather
      roughness: 0.5,
      metalness: 0.1
    });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 0.46), seatMat);
    seat.position.y = 0.45;
    chairGroup.add(seat);

    // Chair Backrest
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.04), seatMat);
    backrest.position.set(0, 0.72, -0.21);
    chairGroup.add(backrest);

    // Chair Legs
    const chairLegGeo = new THREE.CylinderGeometry(0.018, 0.012, 0.45, 8);
    [
      [-0.2, -0.19],
      [0.2, -0.19],
      [-0.2, 0.19],
      [0.2, 0.19]
    ].forEach(([cx, cz]) => {
      const leg = new THREE.Mesh(chairLegGeo, woodMat);
      leg.position.set(cx, 0.225, cz);
      chairGroup.add(leg);
    });
    this.scene.add(chairGroup);

    // 3. CLOSET (Along East Wall, with slatted louvre doors & clothes)
    const closetGroup = new THREE.Group();
    closetGroup.position.set(this.roomWidth / 2 - 0.35, 0, -0.2);

    // Closet frame
    const closetFrameMat = new THREE.MeshStandardMaterial({ color: 0x221a16, roughness: 0.7 });
    const closetOuter = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, this.roomHeight - 0.1, 1.8),
      closetFrameMat
    );
    closetOuter.position.y = (this.roomHeight - 0.1) / 2;
    closetGroup.add(closetOuter);

    // Hollow interior alcove
    const alcoveMat = new THREE.MeshStandardMaterial({ color: 0x110d0b, roughness: 0.9 });
    const closetAlcove = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, this.roomHeight - 0.25, 1.6),
      alcoveMat
    );
    closetAlcove.position.set(-0.05, (this.roomHeight - 0.1) / 2, 0);
    closetGroup.add(closetAlcove);

    // Hanging garment rod
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 1.55, 8),
      brassMat
    );
    rod.rotation.x = Math.PI / 2;
    rod.position.set(-0.05, 1.9, 0);
    closetGroup.add(rod);

    // Hanging garments (sequined dresses, rain trenchcoats, shirts)
    const coatColors = [0x1a2430, 0x5c4232, 0x8a2be2, 0x2e4033, 0xd4af37];
    coatColors.forEach((color, i) => {
      const zOffset = -0.6 + i * 0.3;
      const garment = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.85, 0.12),
        new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
      );
      garment.position.set(-0.05, 1.4, zOffset);
      closetGroup.add(garment);
    });

    // Slatted sliding doors partly open
    const doorGeo = new THREE.BoxGeometry(0.04, this.roomHeight - 0.2, 0.85);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x36251c, roughness: 0.6 });
    const doorLeft = new THREE.Mesh(doorGeo, doorMat);
    doorLeft.position.set(-0.35, (this.roomHeight - 0.2) / 2, -0.45);
    closetGroup.add(doorLeft);

    this.scene.add(closetGroup);
  }

  buildMirror() {
    // Large round mirror above dresser on North wall (like Leon's apartment mirror!)
    const mirrorRadius = 0.55;
    const mirrorGroup = new THREE.Group();
    // Position on North wall centered over dresser
    mirrorGroup.position.set(0, 1.55, -this.roomDepth / 2 + 0.04);

    // Brass ornate beveled frame
    const frameGeo = new THREE.TorusGeometry(mirrorRadius + 0.03, 0.04, 16, 64);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0xaa8230,
      roughness: 0.35,
      metalness: 0.85
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    mirrorGroup.add(frame);

    // Reflection Camera for dynamic real-time room reflection
    this.mirrorCamera = new THREE.PerspectiveCamera(65, 1.0, 0.1, 20);
    this.mirrorRenderTarget = new THREE.WebGLRenderTarget(512, 512, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat
    });

    // Mirror Glass Surface
    const mirrorGeo = new THREE.CircleGeometry(mirrorRadius, 48);
    this.mirrorMat = new THREE.MeshBasicMaterial({
      map: this.mirrorRenderTarget.texture
    });
    const mirrorMesh = new THREE.Mesh(mirrorGeo, this.mirrorMat);
    mirrorMesh.rotation.y = Math.PI; // Face towards room
    mirrorGroup.add(mirrorMesh);

    // Subtle antique glass tint overlay
    const tintGeo = new THREE.CircleGeometry(mirrorRadius, 48);
    const tintMat = new THREE.MeshPhysicalMaterial({
      color: 0x112233,
      roughness: 0.05,
      metalness: 0.1,
      transparent: true,
      opacity: 0.22,
      depthWrite: false
    });
    const tintMesh = new THREE.Mesh(tintGeo, tintMat);
    tintMesh.position.z = 0.002;
    mirrorGroup.add(tintMesh);

    this.scene.add(mirrorGroup);
    this.mirrorWorldPos = mirrorGroup.position.clone();
  }

  updateCamera() {
    // Compute field of view based on Zoom Level (1.0x = 50deg, 100x = 0.5deg)
    const baseFov = 50.0;
    this.camera.fov = baseFov / Math.max(1.0, this.zoomLevel);
    this.camera.updateProjectionMatrix();

    // Position & Orientation
    this.camera.position.copy(this.dronePos);

    // Calculate look direction from pitch & yaw
    const cosPitch = Math.cos(this.dronePitch);
    const dir = new THREE.Vector3(
      Math.sin(this.droneYaw) * cosPitch,
      Math.sin(this.dronePitch),
      -Math.cos(this.droneYaw) * cosPitch
    ).normalize();

    this.droneTarget.copy(this.dronePos).add(dir);
    this.camera.lookAt(this.droneTarget);
  }

  updateMirror() {
    if (!this.mirrorCamera || !this.mirrorRenderTarget) return;

    // Position mirror camera at mirror location and reflect drone camera's viewpoint
    this.mirrorCamera.position.copy(this.mirrorWorldPos);

    // Vector from mirror to camera
    const dPos = this.camera.position.clone().sub(this.mirrorWorldPos);
    // Reflect Z across the mirror normal (facing +Z into room)
    const reflectedTarget = this.mirrorWorldPos.clone().add(
      new THREE.Vector3(dPos.x, dPos.y, -dPos.z + 1.0)
    );
    this.mirrorCamera.lookAt(reflectedTarget);

    // Temporarily hide mirror mesh while rendering reflection to prevent feedback
    this.mirrorMat.visible = false;
    this.renderer.setRenderTarget(this.mirrorRenderTarget);
    this.renderer.render(this.scene, this.mirrorCamera);
    this.renderer.setRenderTarget(null);
    this.mirrorMat.visible = true;
  }

  /**
   * Translates or pans the drone along its local axes
   */
  moveDrone(dx, dy, dz) {
    const forward = new THREE.Vector3(
      Math.sin(this.droneYaw),
      0,
      -Math.cos(this.droneYaw)
    ).normalize();

    const right = new THREE.Vector3(
      Math.cos(this.droneYaw),
      0,
      Math.sin(this.droneYaw)
    ).normalize();

    this.dronePos.addScaledVector(right, dx);
    this.dronePos.y += dy;
    this.dronePos.addScaledVector(forward, dz);

    // Clamp inside room boundaries
    const halfW = this.roomWidth / 2 - 0.15;
    const halfD = this.roomDepth / 2 - 0.15;
    this.dronePos.x = THREE.MathUtils.clamp(this.dronePos.x, -halfW, halfW);
    this.dronePos.y = THREE.MathUtils.clamp(this.dronePos.y, 0.3, this.roomHeight - 0.2);
    this.dronePos.z = THREE.MathUtils.clamp(this.dronePos.z, -halfD, halfD);
  }

  rotateDrone(dPitch, dYaw) {
    this.dronePitch = THREE.MathUtils.clamp(this.dronePitch + dPitch, -1.2, 1.2);
    this.droneYaw = (this.droneYaw + dYaw) % (Math.PI * 2);
  }

  setZoom(zm) {
    this.targetZoomLevel = THREE.MathUtils.clamp(zm, 1.0, 80.0);
  }

  enhance(factor = 1.8) {
    this.setZoom(this.targetZoomLevel * factor);
  }

  pullBack(factor = 0.55) {
    this.setZoom(this.targetZoomLevel * factor);
  }

  centerIn() {
    // Gently re-align pitch towards horizontal and slow down
    this.dronePitch = THREE.MathUtils.lerp(this.dronePitch, 0.0, 0.2);
    this.velocity.set(0, 0, 0);
  }

  stopMotion() {
    this.velocity.set(0, 0, 0);
    this.rotVelocity.pitch = 0;
    this.rotVelocity.yaw = 0;
    this.activeTrackCommand = null;
    this.targetZoomLevel = this.zoomLevel;
  }

  /**
   * Returns Blade Runner style telemetry:
   * ZM: 4-digit zoom integer (0000 to 9999)
   * NS: 4-digit north-south coordinate (0000 to 0999)
   * EW: 4-digit east-west coordinate (0000 to 0999)
   */
  getTelemetry() {
    const halfW = this.roomWidth / 2;
    const halfD = this.roomDepth / 2;

    // EW: map x [-halfW, halfW] to [0000, 0999]
    const ewNorm = (this.dronePos.x + halfW) / this.roomWidth;
    const ew = Math.floor(THREE.MathUtils.clamp(ewNorm * 1000, 0, 999));

    // NS: map z [-halfD, halfD] to [0000, 0999]
    const nsNorm = (this.dronePos.z + halfD) / this.roomDepth;
    const ns = Math.floor(THREE.MathUtils.clamp(nsNorm * 1000, 0, 999));

    // ZM: zoom level mapped to film scale (e.g. 1.0x -> 100, 45.6x -> 4562)
    const zm = Math.floor(this.zoomLevel * 100);

    return {
      zm: String(zm).padStart(4, '0'),
      ns: String(ns).padStart(4, '0'),
      ew: String(ew).padStart(4, '0'),
      zoomLevel: this.zoomLevel,
      position: this.dronePos.clone(),
      pitch: this.dronePitch,
      yaw: this.droneYaw
    };
  }

  setCoordinates(data) {
    if (!data) return;
    if (data.x !== undefined && data.y !== undefined && data.z !== undefined) {
      this.dronePos.set(data.x, data.y, data.z);
    }
    if (data.pitch !== undefined) this.dronePitch = data.pitch;
    if (data.yaw !== undefined) this.droneYaw = data.yaw;
    if (data.zoomLevel !== undefined) {
      this.zoomLevel = data.zoomLevel;
      this.targetZoomLevel = data.zoomLevel;
    } else if (data.zm !== undefined) {
      const parsedZm = parseFloat(data.zm) / 100;
      if (!isNaN(parsedZm)) {
        this.zoomLevel = parsedZm;
        this.targetZoomLevel = parsedZm;
      }
    }
    this.updateCamera();
  }

  update(delta) {
    // Handle continuous track commands
    if (this.activeTrackCommand === 'right') {
      this.moveDrone(0.6 * delta, 0, 0);
    } else if (this.activeTrackCommand === 'left') {
      this.moveDrone(-0.6 * delta, 0, 0);
    } else if (this.activeTrackCommand === 'in') {
      this.moveDrone(0, 0, -0.8 * delta);
    } else if (this.activeTrackCommand === 'out') {
      this.moveDrone(0, 0, 0.8 * delta);
    } else if (this.activeTrackCommand === 'enhance') {
      this.targetZoomLevel = Math.min(80.0, this.targetZoomLevel * (1.0 + 0.8 * delta));
    }

    // Apply inertia velocity
    if (this.velocity.lengthSq() > 0.0001) {
      this.moveDrone(
        this.velocity.x * delta,
        this.velocity.y * delta,
        this.velocity.z * delta
      );
      this.velocity.multiplyScalar(0.88);
    }

    // Smooth zoom interpolation
    this.zoomLevel = THREE.MathUtils.lerp(this.zoomLevel, this.targetZoomLevel, 0.08);

    this.updateCamera();
  }

  renderToTarget() {
    this.updateMirror();
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    return this.renderTarget.texture;
  }
}
