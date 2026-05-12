// Evil Jeopardy 1.2 — PresentScene3D (Horror Maze)
// First-person horror maze: 14 rooms, QTE dodging, chase scene, demonic judges.

class PresentScene3D extends BaseMinigameScene {
  constructor(engine, canvas, socketBridge, options) {
    super(engine, canvas, socketBridge, options);
    this.timeLimit = 240; // 4 minutes

    this.camera = null;
    this.currentRoomIndex = -1;
    this.currentRoomData = null;
    this.roomBuilder = null;
    this.scareSystem = null;
    this.chaseController = null;
    this.judgePresentation = null;
    this.cakeHealth = null;

    this.playerZ = 0;
    this.playerSpeed = 3.5;
    this.roomOffset = 0; // cumulative Z offset
    this.headBobPhase = 0;
    this.isMoving = false;
    this.moveInput = { w: false, a: false, s: false, d: false };
    this.bonusRoomsCleared = 0;
    this.inSideRoom = false;
    this.sideRoomDamageTaken = false;

    this._droneInterval = null;
    this._heartbeatInterval = null;
    this._dripInterval = null;
    this._previousRoomData = null;
    this._footstepCooldown = false;
    this._activeSideRoom = null;
    this._visitedSideRooms = new Set();
    this._droneHandle = null;
    this._chaseMusicHandle = null;
    this._whisperInterval = null;
    this._dustParticles = null;
  }

  getPhaseName() { return 'PRESENT'; }

  async create() {
    // Suppress default kitchen ambient
    if (this.sounds) this.sounds.stopAmbient();

    // FPS Camera — raw pointer lock mouse look (no Babylon mouse input)
    this.camera = new BABYLON.UniversalCamera('fpsCam',
      new BABYLON.Vector3(0, 1.7, 0), this.scene);
    this.camera.minZ = 0.1;
    this.camera.speed = 0;
    // Remove ALL default inputs AND kill internal rotation updates
    this.camera.inputs.clear();
    this.camera._checkInputs = () => {}; // Prevent Babylon from applying residual rotation
    this.camera.cameraRotation = new BABYLON.Vector2(0, 0);
    this.scene.activeCamera = this.camera;

    // Raw mouse look via pointer lock — with trackpad smoothing
    this._mouseSensitivity = 0.002;
    this._yaw = 0;
    this._pitch = 0;
    this._targetYaw = 0;
    this._targetPitch = 0;
    this._smoothFactor = 0.5; // 0 = instant, 1 = very smooth (trackpad friendly)
    this._onMouseMove = (e) => {
      if (document.pointerLockElement !== this.canvas) return;
      this._targetYaw += e.movementX * this._mouseSensitivity;
      this._targetPitch += e.movementY * this._mouseSensitivity;
      this._targetPitch = BABYLON.Scalar.Clamp(this._targetPitch, -0.785, 0.785);
    };
    document.addEventListener('mousemove', this._onMouseMove);

    // Fog — reddish-purple horror atmosphere, not gray
    this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.02;
    this.scene.fogColor = new BABYLON.Color3(0.08, 0.02, 0.06);
    this.scene.clearColor = new BABYLON.Color4(0.08, 0.02, 0.06, 1);

    // Ambient lighting — warmer, more colorful
    const ambient = new BABYLON.HemisphericLight('horrorAmbient',
      new BABYLON.Vector3(0, 1, 0), this.scene);
    ambient.intensity = 0.4;
    ambient.diffuse = new BABYLON.Color3(0.6, 0.35, 0.4);    // Reddish warm
    ambient.groundColor = new BABYLON.Color3(0.1, 0.08, 0.15); // Purple floor tint

    // Point light follows player — warm candlelight feel
    this.playerLight = new BABYLON.PointLight('playerLight',
      new BABYLON.Vector3(0, 2, 0), this.scene);
    this.playerLight.intensity = 1.5;
    this.playerLight.range = 12;
    this.playerLight.diffuse = new BABYLON.Color3(1.0, 0.75, 0.45); // Warm golden

    // Secondary red backlight for horror atmosphere
    this._backLight = new BABYLON.PointLight('backLight',
      new BABYLON.Vector3(0, 1, -3), this.scene);
    this._backLight.intensity = 0.4;
    this._backLight.range = 6;
    this._backLight.diffuse = new BABYLON.Color3(0.8, 0.1, 0.15); // Deep red

    // Initialize systems
    this.roomBuilder = new RoomBuilder(this.scene, this.materials);
    this.cakeHealth = new CakeHealthDisplay(this.scene, this.hud.texture);
    this.scareSystem = new ScareSystem(this.scene, this.hud.texture, this.cakeHealth, this.sounds);

    // Bind movement keys
    this._bindMovement();

    // Start ambient horror audio
    this._startHorrorAmbient();

    // Load first room
    this._enterRoom(0);

    this.hud.showMessage('🏚️ Carry the cake through... alive.', 3000);

    // Held cake — visible when looking down
    this._buildHeldCake();

    // Start dust particles
    this._addDustParticles();
  }

  _addDustParticles() {
    const dust = new BABYLON.ParticleSystem('dust', 80, this.scene);
    dust.emitter = this.camera;
    dust.minSize = 0.01;
    dust.maxSize = 0.04;
    dust.minLifeTime = 3;
    dust.maxLifeTime = 6;
    dust.emitRate = 15;
    dust.direction1 = new BABYLON.Vector3(-1.5, -0.3, -1.5);
    dust.direction2 = new BABYLON.Vector3(1.5, 0.8, 1.5);
    dust.color1 = new BABYLON.Color4(0.7, 0.6, 0.5, 0.4);
    dust.color2 = new BABYLON.Color4(0.4, 0.35, 0.3, 0.15);
    dust.colorDead = new BABYLON.Color4(0.2, 0.15, 0.1, 0);
    dust.createPointEmitter(new BABYLON.Vector3(-3, -1, -3), new BABYLON.Vector3(3, 2, 3));
    dust.gravity = new BABYLON.Vector3(0, -0.05, 0);
    dust.start();
    this._dustParticles = dust;
  }

  _buildHeldCake() {
    // Colorful 3-layer cake held prominently in front — yellow, white, pink
    const cakeRoot = new BABYLON.TransformNode('heldCake', this.scene);

    const layers = [
      { r: 0.22, h: 0.09, y: 0, color: new BABYLON.Color3(1.0, 0.85, 0.2) },   // Yellow base
      { r: 0.18, h: 0.08, y: 0.09, color: new BABYLON.Color3(1.0, 1.0, 0.95) }, // White middle
      { r: 0.13, h: 0.07, y: 0.17, color: new BABYLON.Color3(1.0, 0.55, 0.7) }  // Pink top
    ];

    this._cakeLayers = [];
    layers.forEach((l, i) => {
      const layer = BABYLON.MeshBuilder.CreateCylinder(`cakeLayer${i}`, {
        diameter: l.r * 2, height: l.h, tessellation: 20
      }, this.scene);
      layer.position.y = l.y + l.h / 2;
      const mat = new BABYLON.StandardMaterial(`cakeMat${i}`, this.scene);
      mat.diffuseColor = l.color;
      mat.emissiveColor = l.color.scale(0.15);
      mat.specularPower = 64;
      layer.material = mat;
      layer.parent = cakeRoot;
      this._cakeLayers.push({ mesh: layer, mat, originalColor: l.color.clone() });
    });

    // White frosting drip on top
    const frosting = BABYLON.MeshBuilder.CreateCylinder('frosting', {
      diameter: 0.28, height: 0.02, tessellation: 20
    }, this.scene);
    frosting.position.y = 0.245;
    const frostMat = new BABYLON.StandardMaterial('frostMat', this.scene);
    frostMat.diffuseColor = new BABYLON.Color3(1, 0.97, 0.95);
    frostMat.emissiveColor = new BABYLON.Color3(0.15, 0.12, 0.1);
    frosting.material = frostMat;
    frosting.parent = cakeRoot;
    this._frosting = frosting;
    this._frostMat = frostMat;

    // Frosting drips on sides (get messy when damaged)
    this._frostDrips = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const drip = BABYLON.MeshBuilder.CreateBox(`drip${i}`, {
        width: 0.02, height: 0.005, depth: 0.015
      }, this.scene);
      drip.position.x = Math.cos(angle) * 0.12;
      drip.position.z = Math.sin(angle) * 0.12;
      drip.position.y = 0.22;
      drip.material = frostMat;
      drip.parent = cakeRoot;
      drip.isVisible = false;
      this._frostDrips.push(drip);
    }

    // Plate
    const plate = BABYLON.MeshBuilder.CreateCylinder('plate', {
      diameter: 0.5, height: 0.015, tessellation: 24
    }, this.scene);
    plate.position.y = -0.01;
    const plateMat = new BABYLON.StandardMaterial('plateMat', this.scene);
    plateMat.diffuseColor = new BABYLON.Color3(0.92, 0.92, 0.95);
    plateMat.specularPower = 128;
    plate.material = plateMat;
    plate.parent = cakeRoot;

    this._heldCake = cakeRoot;
    this._lastCakeIntegrity = 100;
    this._cakeWobble = 0;
    this._screenShake = 0;
  }

  _updateCakeDamageVisual() {
    if (!this._cakeLayers || !this.cakeHealth) return;
    const integrity = this.cakeHealth.getIntegrity();
    if (integrity === this._lastCakeIntegrity) return;

    const justTookDamage = integrity < this._lastCakeIntegrity;
    this._lastCakeIntegrity = integrity;
    const dmgFactor = 1 - (integrity / 100);

    this._cakeLayers.forEach((layer, i) => {
      const orig = layer.originalColor;

      // Color: darken + brown/burnt tint
      const r = BABYLON.Scalar.Lerp(orig.r, 0.25, dmgFactor * 0.8);
      const g = BABYLON.Scalar.Lerp(orig.g, 0.12, dmgFactor * 0.85);
      const b = BABYLON.Scalar.Lerp(orig.b, 0.08, dmgFactor * 0.9);
      layer.mat.diffuseColor = new BABYLON.Color3(r, g, b);
      layer.mat.emissiveColor = new BABYLON.Color3(r * 0.1, g * 0.05, b * 0.05);

      // Layers shrink unevenly — like chunks bitten off
      const shrink = 1 - dmgFactor * 0.4 * (i === 2 ? 1.5 : i === 1 ? 1.2 : 1);
      layer.mesh.scaling.x = shrink + Math.sin(dmgFactor * 10 + i) * dmgFactor * 0.15;
      layer.mesh.scaling.z = shrink + Math.cos(dmgFactor * 8 + i * 2) * dmgFactor * 0.15;
      // Height collapses
      layer.mesh.scaling.y = Math.max(0.3, 1 - dmgFactor * 0.5);

      // Tilt and offset — cake falling apart
      layer.mesh.rotation.z = dmgFactor * 0.3 * (i === 1 ? -1 : 1);
      layer.mesh.rotation.x = dmgFactor * 0.2 * (i === 2 ? 1.5 : -0.5);
      // Layers slide off-center
      layer.mesh.position.x = dmgFactor * 0.03 * (i - 1);
      layer.mesh.position.z = dmgFactor * 0.02 * (i === 2 ? 1 : -1);
    });

    // Frosting gets messy — drips appear and slide down
    if (this._frostDrips) {
      const dripsToShow = Math.floor(dmgFactor * 6);
      this._frostDrips.forEach((drip, i) => {
        if (i < dripsToShow) {
          drip.isVisible = true;
          drip.scaling.y = 1 + dmgFactor * 8;
          drip.position.y = 0.22 - dmgFactor * 0.1;
        }
      });
    }

    // Frosting turns grey/dirty
    if (this._frostMat) {
      this._frostMat.diffuseColor = new BABYLON.Color3(
        BABYLON.Scalar.Lerp(1, 0.5, dmgFactor),
        BABYLON.Scalar.Lerp(0.97, 0.4, dmgFactor),
        BABYLON.Scalar.Lerp(0.95, 0.35, dmgFactor)
      );
    }

    // Top layer disappears below 40%
    if (integrity < 40 && this._cakeLayers[2]) {
      this._cakeLayers[2].mesh.isVisible = false;
    }
    // Middle layer disappears below 20%
    if (integrity < 20 && this._cakeLayers[1]) {
      this._cakeLayers[1].mesh.isVisible = false;
    }
    // Frosting gone below 30%
    if (integrity < 30 && this._frosting) {
      this._frosting.isVisible = false;
      this._frostDrips.forEach(d => d.isVisible = false);
    }

    // Spawn effects on damage
    if (justTookDamage && this._heldCake) {
      this._spawnCrumbs();
      this._spawnDamageSmoke();
      this._cakeWobble = 0.4;
      this._screenShake = 1.0;
      this._showDamageVignette();
    }
  }

  _showDamageVignette() {
    // Brief red vignette flash on damage
    const vignette = new BABYLON.GUI.Rectangle('dmgVignette');
    vignette.width = '100%';
    vignette.height = '100%';
    vignette.thickness = 0;
    vignette.isHitTestVisible = false;
    // Red border glow effect
    vignette.background = 'transparent';
    const inner = new BABYLON.GUI.Rectangle('dmgInner');
    inner.width = '100%';
    inner.height = '100%';
    inner.thickness = 30;
    inner.color = 'rgba(200, 0, 0, 0.6)';
    inner.background = 'rgba(100, 0, 0, 0.15)';
    inner.isHitTestVisible = false;
    inner.cornerRadius = 0;
    vignette.addControl(inner);
    this.hud.texture.addControl(vignette);

    // Fade out
    let alpha = 0.6;
    const fadeInterval = setInterval(() => {
      alpha -= 0.05;
      if (alpha <= 0 || this._disposed) {
        clearInterval(fadeInterval);
        this.hud.texture.removeControl(vignette);
        vignette.dispose();
        return;
      }
      inner.color = `rgba(200, 0, 0, ${alpha})`;
      inner.background = `rgba(100, 0, 0, ${alpha * 0.25})`;
    }, 30);
  }

  _spawnDamageSmoke() {
    if (!this._heldCake) return;
    const smoke = new BABYLON.ParticleSystem('cakeSmoke', 15, this.scene);
    smoke.emitter = this._heldCake.position.clone();
    smoke.minSize = 0.03;
    smoke.maxSize = 0.08;
    smoke.minLifeTime = 0.3;
    smoke.maxLifeTime = 0.8;
    smoke.emitRate = 30;
    smoke.direction1 = new BABYLON.Vector3(-0.3, 0.5, -0.3);
    smoke.direction2 = new BABYLON.Vector3(0.3, 1.2, 0.3);
    smoke.color1 = new BABYLON.Color4(0.6, 0.5, 0.4, 0.6);
    smoke.color2 = new BABYLON.Color4(0.4, 0.3, 0.3, 0.2);
    smoke.createPointEmitter(new BABYLON.Vector3(-0.1, 0, -0.1), new BABYLON.Vector3(0.1, 0.2, 0.1));
    smoke.start();
    setTimeout(() => { smoke.stop(); setTimeout(() => smoke.dispose(), 1000); }, 300);
  }

  _spawnCrumbs() {
    if (!this._heldCake) return;
    for (let i = 0; i < 5; i++) {
      const crumb = BABYLON.MeshBuilder.CreateBox(`crumb${Date.now()}_${i}`, {
        width: 0.015 + Math.random() * 0.02,
        height: 0.01 + Math.random() * 0.015,
        depth: 0.015 + Math.random() * 0.02
      }, this.scene);
      crumb.position = this._heldCake.position.clone();
      crumb.position.x += (Math.random() - 0.5) * 0.3;
      crumb.position.z += (Math.random() - 0.5) * 0.3;
      const crumbMat = new BABYLON.StandardMaterial(`crumbMat${i}`, this.scene);
      crumbMat.diffuseColor = new BABYLON.Color3(
        0.8 + Math.random() * 0.2,
        0.6 + Math.random() * 0.3,
        0.2 + Math.random() * 0.3
      );
      crumb.material = crumbMat;

      // Animate falling
      const vy = -1 - Math.random() * 2;
      const vx = (Math.random() - 0.5) * 0.5;
      const vz = (Math.random() - 0.5) * 0.5;
      let t = 0;
      const startY = crumb.position.y;
      const obs = this.scene.onBeforeRenderObservable.add(() => {
        t += 0.016;
        crumb.position.y = startY + vy * t;
        crumb.position.x += vx * 0.016;
        crumb.position.z += vz * 0.016;
        crumb.rotation.x += 3 * 0.016;
        crumb.rotation.z += 2 * 0.016;
        if (t > 1) {
          this.scene.onBeforeRenderObservable.remove(obs);
          crumb.dispose();
          crumbMat.dispose();
        }
      });
    }
  }

  _bindMovement() {
    this._moveDown = (e) => {
      if (this._disposed) return;
      const k = e.key.toLowerCase();
      if (this.moveInput.hasOwnProperty(k)) this.moveInput[k] = true;
    };
    this._moveUp = (e) => {
      if (this._disposed) return;
      const k = e.key.toLowerCase();
      if (this.moveInput.hasOwnProperty(k)) this.moveInput[k] = false;
    };
    this._interactHandler = (e) => {
      if (this._disposed) return;
      if (e.key.toLowerCase() === 'e') this._tryInteract();
    };
    window.addEventListener('keydown', this._moveDown);
    window.addEventListener('keyup', this._moveUp);
    window.addEventListener('keydown', this._interactHandler);
  }

  _startHorrorAmbient() {
    // Start loopable drone (returns handle with stop())
    if (this.sounds && this.sounds.horrorDroneLoop) {
      this._droneHandle = this.sounds.horrorDroneLoop();
    }

    // Random drips
    this._dripInterval = setInterval(() => {
      if (!this._disposed && this.sounds && Math.random() > 0.5) {
        this.sounds.ambientDrip();
      }
    }, 3000);
  }

  _enterRoom(index) {
    // Dispose previous room (keep one behind for transition)
    if (this._previousRoomData) {
      this.roomBuilder.disposeRoom(this._previousRoomData);
      this._previousRoomData = null;
    }

    if (this.currentRoomData) {
      this._previousRoomData = this.currentRoomData;
    }

    this.currentRoomIndex = index;

    if (index >= 14) {
      // All rooms done — shouldn't happen; judge handles completion
      return;
    }

    const roomData = this.roomBuilder.buildRoom(index);
    if (!roomData) return;

    // Position room at cumulative offset
    roomData.root.position.z = this.roomOffset;
    this.currentRoomData = roomData;

    // Unique fog/atmosphere color per room theme
    const roomColors = [
      new BABYLON.Color3(0.08, 0.04, 0.03),  // 0: pantry - warm dark
      new BABYLON.Color3(0.03, 0.05, 0.1),   // 1: freezer - icy blue
      new BABYLON.Color3(0.1, 0.04, 0.02),   // 2: boiling - orange haze
      new BABYLON.Color3(0.06, 0.02, 0.02),  // 3: knife - blood red
      new BABYLON.Color3(0.08, 0.02, 0.03),  // 4: meat - deep crimson
      new BABYLON.Color3(0.02, 0.05, 0.06),  // 5: sink - murky teal
      new BABYLON.Color3(0.05, 0.05, 0.04),  // 6: dish - grimy yellow
      new BABYLON.Color3(0.1, 0.04, 0.0),    // 7: oven - fire orange
      new BABYLON.Color3(0.06, 0.05, 0.02),  // 8: spice - earthy
      new BABYLON.Color3(0.02, 0.02, 0.06),  // 9: walk-in - cold purple
      new BABYLON.Color3(0.04, 0.04, 0.05),  // 10: dumbwaiter - industrial
      new BABYLON.Color3(0.08, 0.01, 0.01),  // 11: chase - panic red
      new BABYLON.Color3(0.05, 0.02, 0.06),  // 12: judge corridor - purple
      new BABYLON.Color3(0.06, 0.03, 0.08),  // 13: judge chamber - regal purple
    ];
    const fogColor = roomColors[index] || new BABYLON.Color3(0.05, 0.03, 0.05);
    this.scene.fogColor = fogColor;
    this.scene.clearColor = new BABYLON.Color4(fogColor.r, fogColor.g, fogColor.b, 1);

    // Increase fog density subtly as we progress (stays playable)
    this.scene.fogDensity = 0.02 + (index * 0.002);

    // Schedule scares based on room config
    this._scheduleRoomScares(roomData, index);

    // Handle special rooms
    if (roomData.isChase) {
      this._startChase(roomData);
    } else if (roomData.isJudgeChamber) {
      this._startJudgePresentation(roomData);
    }

    // Start whispers in later rooms
    if (index >= 9 && !this._whisperInterval && this.sounds) {
      this._whisperInterval = setInterval(() => {
        if (!this._disposed && this.sounds && Math.random() > 0.6) {
          this.sounds.whisper();
        }
      }, 4000);
    }
  }

  _scheduleRoomScares(roomData, roomIndex) {
    if (!roomData.scares || roomData.scares.length === 0) return;

    roomData.scares.forEach(scare => {
      if (scare.trigger === 'enter') {
        setTimeout(() => {
          if (this._disposed || this.currentRoomIndex !== roomIndex) return;
          this._triggerScare(scare, roomIndex);
        }, scare.delay || 1000);
      }
      // Position-based scares are checked in update()
    });
  }

  _triggerScare(scare, roomIndex) {
    if (scare.type === 'jumpscare') {
      this._showJumpscare();
      return;
    }
    if (scare.sound && this.sounds && this.sounds[scare.sound]) {
      this.sounds[scare.sound]();
    }
    if (scare.type !== 'ambient') {
      this.scareSystem.triggerQTE(scare.type, roomIndex, (success) => {
        if (!success && this.inSideRoom) {
          this.sideRoomDamageTaken = true;
        }
      });
    }
  }

  _showJumpscare() {
    if (this.sounds) this.sounds.jumpscareHit();
    this._screenShake = 2.0; // Heavy shake

    // Full-screen dark flash
    const flash = new BABYLON.GUI.Rectangle('jumpscare');
    flash.width = '100%';
    flash.height = '100%';
    flash.background = 'rgba(0, 0, 0, 0.85)';
    flash.thickness = 0;
    flash.isHitTestVisible = false;
    this.hud.texture.addControl(flash);

    // Red pulsing border
    const border = new BABYLON.GUI.Rectangle('scareBorder');
    border.width = '100%';
    border.height = '100%';
    border.thickness = 8;
    border.color = 'rgba(255, 0, 0, 0.8)';
    border.background = 'transparent';
    border.isHitTestVisible = false;
    this.hud.texture.addControl(border);

    // Load jumpscare face
    const jumpscareImages = [
      '/assets/jumpscares/face1.png',
      '/assets/jumpscares/face2.png',
      '/assets/jumpscares/face3.png'
    ];
    const imgSrc = jumpscareImages[Math.floor(Math.random() * jumpscareImages.length)];
    const img = new BABYLON.GUI.Image('scareImg', imgSrc);
    img.width = '60%';
    img.height = '80%';
    img.stretch = BABYLON.GUI.Image.STRETCH_UNIFORM;
    img.isHitTestVisible = false;
    this.hud.texture.addControl(img);

    // Animate face zooming in
    let scale = 0.3;
    let elapsed = 0;
    const animInterval = setInterval(() => {
      elapsed += 16;
      scale = Math.min(1.2, scale + 0.08);
      img.scaleX = scale;
      img.scaleY = scale;
      // Shake the image position
      img.left = `${(Math.random() - 0.5) * 40}px`;
      img.top = `${(Math.random() - 0.5) * 30}px`;
      // Pulse border
      const pulse = Math.sin(elapsed * 0.02) * 0.3 + 0.7;
      border.color = `rgba(255, 0, 0, ${pulse})`;

      if (elapsed > 600 || this._disposed) {
        clearInterval(animInterval);
      }
    }, 16);

    // Fallback if image fails
    img.domImage.onerror = () => {
      this.hud.texture.removeControl(img);
      img.dispose();
      const text = new BABYLON.GUI.TextBlock('scareFallback', '👹');
      text.fontSize = 250;
      text.isHitTestVisible = false;
      this.hud.texture.addControl(text);
      setTimeout(() => {
        if (this._disposed) return;
        this.hud.texture.removeControl(text);
        text.dispose();
      }, 500);
    };

    // Cleanup after 700ms
    setTimeout(() => {
      if (this._disposed) return;
      this.hud.texture.removeControl(flash);
      this.hud.texture.removeControl(border);
      this.hud.texture.removeControl(img);
      flash.dispose();
      border.dispose();
      img.dispose();
    }, 700);
  }

  _startChase(roomData) {
    // Disable normal movement during chase
    this._chaseActive = true;
    // Stop ambient drone, start chase music loop
    if (this._droneHandle) { this._droneHandle.stop(); this._droneHandle = null; }
    if (this.sounds && this.sounds.chaseMusicLoop) {
      this._chaseMusicHandle = this.sounds.chaseMusicLoop();
    }
    this.chaseController = new ChaseController(
      this.scene, this.camera, this.hud.texture, this.scareSystem, this.sounds
    );
    this.chaseController.start(() => {
      this._chaseActive = false;
      // Stop chase music, resume ambient
      if (this._chaseMusicHandle) { this._chaseMusicHandle.stop(); this._chaseMusicHandle = null; }
      if (this.sounds && this.sounds.horrorDroneLoop) {
        this._droneHandle = this.sounds.horrorDroneLoop();
      }
      this.chaseController.dispose();
      this.chaseController = null;
      // Move to next room
      this.roomOffset += roomData.roomLength + 2;
      this._enterRoom(this.currentRoomIndex + 1);
    });
  }

  _startJudgePresentation(roomData) {
    this._judgeActive = true;
    this.judgePresentation = new JudgePresentation(
      this.scene, this.hud.texture, this.cakeHealth, this.sounds
    );
    this.judgePresentation.setBonusRooms(this.bonusRoomsCleared);
    this.judgePresentation.start(roomData, (finalScore, details) => {
      this._judgeActive = false;
      this.setScore(finalScore);
      this.completePhase(details);
    });
  }

  _tryInteract() {
    // Check if near a side room door (within 2m of side-room trigger point)
    if (this.currentRoomData && this.currentRoomData.hasSideRoom && !this.inSideRoom) {
      const localZ = this.camera.position.z - this.roomOffset;
      const midZ = this.currentRoomData.roomLength * 0.5;
      if (Math.abs(localZ - midZ) > 2.5) {
        this.hud.showMessage('🚪 Get closer to the side door (E)', 1000);
        return;
      }
      // Already visited this side room?
      if (this._visitedSideRooms && this._visitedSideRooms.has(this.currentRoomIndex)) {
        this.hud.showMessage('Already explored this room', 1000);
        return;
      }

      this.inSideRoom = true;
      this.sideRoomDamageTaken = false;
      if (this.sounds) this.sounds.doorSlam();

      // Spawn actual side room geometry to the right of the main corridor
      this._activeSideRoom = this.roomBuilder.buildSideRoom(this.currentRoomData, this.currentRoomIndex);
      if (this._activeSideRoom) {
        this._activeSideRoom.root.position = new BABYLON.Vector3(
          4, 0, this.roomOffset + midZ
        );
        // Schedule side room scare
        if (this._activeSideRoom.scares) {
          this._activeSideRoom.scares.forEach(scare => {
            setTimeout(() => {
              if (!this._disposed && this.inSideRoom) {
                this._triggerScare(scare, this.currentRoomIndex);
              }
            }, scare.delay || 1500);
          });
        }
      }

      this.hud.showMessage('🚪 Entered side room... press E to exit', 2000);
    } else if (this.inSideRoom) {
      // Exit side room
      this.inSideRoom = false;
      if (this.sounds) this.sounds.doorSlam();

      // Track visit
      if (!this._visitedSideRooms) this._visitedSideRooms = new Set();
      this._visitedSideRooms.add(this.currentRoomIndex);

      // Dispose side room geometry
      if (this._activeSideRoom) {
        this.roomBuilder.disposeRoom(this._activeSideRoom);
        this._activeSideRoom = null;
      }

      if (!this.sideRoomDamageTaken) {
        this.bonusRoomsCleared++;
        this.hud.showMessage('✨ +5 Bonus! Side room cleared!', 1500);
      } else {
        this.hud.showMessage('Side room cleared (took damage — no bonus)', 1500);
      }
    }
  }

  update(dt) {
    if (this.isComplete || this._judgeActive) return;

    // Smooth camera rotation (lerp toward target — helps trackpad)
    const lerpSpeed = 1 - this._smoothFactor;
    this._yaw = BABYLON.Scalar.Lerp(this._yaw, this._targetYaw, lerpSpeed);
    this._pitch = BABYLON.Scalar.Lerp(this._pitch, this._targetPitch, lerpSpeed);

    // Screen shake overlay
    let shakeX = 0, shakeY = 0;
    if (this._screenShake > 0.01) {
      shakeX = (Math.random() - 0.5) * this._screenShake * 0.05;
      shakeY = (Math.random() - 0.5) * this._screenShake * 0.05;
      this._screenShake *= 0.9;
    }
    this.camera.rotation.x = this._pitch + shakeY;
    this.camera.rotation.y = this._yaw + shakeX;

    // Chase has its own update
    if (this._chaseActive && this.chaseController) {
      this.chaseController.update(dt);
      return;
    }

    // Player movement — uses camera look direction
    let moveZ = 0, moveX = 0;
    if (this.moveInput.w) moveZ = 1;
    if (this.moveInput.s) moveZ = -0.3;
    if (this.moveInput.a) moveX = -1;
    if (this.moveInput.d) moveX = 1;

    this.isMoving = (moveZ !== 0 || moveX !== 0);

    if (this.isMoving) {
      // Get camera forward/right vectors projected onto XZ plane
      const forward = this.camera.getDirection(BABYLON.Vector3.Forward());
      forward.y = 0;
      forward.normalize();
      const right = this.camera.getDirection(BABYLON.Vector3.Right());
      right.y = 0;
      right.normalize();

      const move = forward.scale(moveZ).add(right.scale(moveX));
      this.camera.position.x += move.x * this.playerSpeed * dt;
      this.camera.position.z += move.z * this.playerSpeed * dt;

      // Clamp X to corridor width
      this.camera.position.x = BABYLON.Scalar.Clamp(this.camera.position.x, -1.5, 1.5);

      // Head bob
      this.headBobPhase += dt * 8;
      this.camera.position.y = 1.7 + Math.sin(this.headBobPhase) * 0.04;

      // Footstep sounds
      if (!this._footstepCooldown && this.sounds) {
        this._footstepCooldown = true;
        this.sounds.footstep();
        setTimeout(() => { this._footstepCooldown = false; }, 400);
      }
    } else {
      this.camera.position.y = 1.7;
    }

    // Player light follows camera
    if (this.playerLight) {
      this.playerLight.position.copyFrom(this.camera.position);
    }
    // Red backlight follows behind player
    if (this._backLight) {
      const behind = this.camera.getDirection(BABYLON.Vector3.Forward()).scale(-2);
      this._backLight.position = this.camera.position.add(behind);
    }

    // Held cake follows camera — prominent, right in front
    if (this._heldCake) {
      const forward = this.camera.getDirection(BABYLON.Vector3.Forward());
      const right = this.camera.getDirection(BABYLON.Vector3.Right());
      const pos = this.camera.position
        .add(forward.scale(0.4))
        .add(right.scale(0.1))
        .add(new BABYLON.Vector3(0, -0.4, 0));

      // Wobble on damage impact
      if (this._cakeWobble > 0.01) {
        pos.x += Math.sin(performance.now() * 0.03) * this._cakeWobble * 0.1;
        pos.y += Math.cos(performance.now() * 0.04) * this._cakeWobble * 0.05;
        this._cakeWobble *= 0.92; // Dampen
      }

      this._heldCake.position = pos;
      this._heldCake.rotation.y = this.camera.rotation.y;
      this._updateCakeDamageVisual();
    }

    // Check position-based scares
    if (this.currentRoomData && this.currentRoomData.scares) {
      const localZ = this.camera.position.z - this.roomOffset;
      this.currentRoomData.scares.forEach(scare => {
        if (scare.trigger === 'position' && !scare._triggered) {
          if (localZ >= scare.z) {
            scare._triggered = true;
            this._triggerScare(scare, this.currentRoomIndex);
          }
        } else if (scare.trigger === 'middle' && !scare._triggered) {
          if (localZ >= this.currentRoomData.roomLength * 0.5) {
            scare._triggered = true;
            setTimeout(() => {
              if (!this._disposed) this._triggerScare(scare, this.currentRoomIndex);
            }, scare.delay || 0);
          }
        }
      });
    }

    // Check room transition
    if (this.currentRoomData) {
      const localZ = this.camera.position.z - this.roomOffset;
      if (localZ >= this.currentRoomData.roomLength - 1) {
        this.roomOffset += this.currentRoomData.roomLength;
        this._enterRoom(this.currentRoomIndex + 1);
      }
    }

    // Eye tracking (subtle)
    if (this.currentRoomData && this.currentRoomData.eyes) {
      this.currentRoomData.eyes.forEach(eyePair => {
        if (eyePair && !eyePair.isDisposed()) {
          eyePair.lookAt(this.camera.position, 0, 0, 0);
        }
      });
    }

    // Heartbeat ramps up in later rooms
    if (this.currentRoomIndex >= 9 && !this._heartbeatInterval) {
      this._heartbeatInterval = setInterval(() => {
        if (!this._disposed && this.sounds) {
          const rate = 1 + (this.currentRoomIndex - 9) * 0.3;
          this.sounds.heartbeat(rate);
        }
      }, 800);
    }

    // Light flickering in rooms 1, 4, 7, 10
    if ([0, 3, 6, 9].includes(this.currentRoomIndex)) {
      if (Math.random() > 0.97) {
        this.playerLight.intensity = 0.1 + Math.random() * 0.5;
        setTimeout(() => { if (this.playerLight) this.playerLight.intensity = 0.6; }, 100);
      }
    }
  }

  onTimeUp() {
    // Spec: lights-out + abbreviated chase (~10s) before judges
    if (this.sounds) this.sounds.entityRoar();
    this.scareSystem.applyDirectDamage(20);

    // Phase 1: Lights out (2s blackout)
    this.scene.fogDensity = 0.2; // near-total darkness
    if (this.playerLight) this.playerLight.intensity = 0.05;
    this.hud.showMessage('⏰ TIME UP! THE LIGHTS GO OUT!', 2000);

    setTimeout(() => {
      if (this._disposed) return;

      // Phase 2: Abbreviated chase (~10s) — auto-sprint toward judges
      this.hud.showMessage('🏃 SOMETHING IS COMING! RUN!', 1500);
      this._chaseActive = true;
      this._timeoutChaseElapsed = 0;
      const timeoutChaseDuration = 10; // seconds

      // Start chase music
      if (this.sounds) this.sounds.chaseMusic();

      // Auto-sprint toward judge room
      const chaseUpdate = () => {
        if (this._disposed || !this._chaseActive) return;
        this._timeoutChaseElapsed += 0.016;
        this.camera.position.z += 6 * 0.016; // auto-run speed

        // Camera shake
        this.camera.position.y = 1.7 + (Math.random() - 0.5) * 0.04;
        this.camera.position.x += (Math.random() - 0.5) * 0.02;

        // 2-3 QTE prompts during the abbreviated chase
        if (this._timeoutChaseElapsed > 3 && !this._tcQTE1) {
          this._tcQTE1 = true;
          this.scareSystem.triggerQTE('heavy', 11, () => {});
        }
        if (this._timeoutChaseElapsed > 6 && !this._tcQTE2) {
          this._tcQTE2 = true;
          this.scareSystem.triggerQTE('heavy', 11, () => {});
        }

        if (this._timeoutChaseElapsed >= timeoutChaseDuration) {
          this._chaseActive = false;
          // Transition to judges
          this.roomOffset = 0;
          this._enterRoom(13); // Judge chamber
          return;
        }
        requestAnimationFrame(chaseUpdate);
      };
      requestAnimationFrame(chaseUpdate);
    }, 2500);
  }

  dispose() {
    this._disposed = true;
    if (this._droneHandle) { this._droneHandle.stop(); this._droneHandle = null; }
    if (this._chaseMusicHandle) { this._chaseMusicHandle.stop(); this._chaseMusicHandle = null; }
    clearInterval(this._droneInterval);
    clearInterval(this._heartbeatInterval);
    clearInterval(this._dripInterval);
    clearInterval(this._whisperInterval);
    if (this._dustParticles) { this._dustParticles.dispose(); this._dustParticles = null; }
    if (this._backLight) { this._backLight.dispose(); this._backLight = null; }
    if (this._heldCake) { this._heldCake.dispose(); this._heldCake = null; }
    if (this._onMouseMove) document.removeEventListener('mousemove', this._onMouseMove);
    if (this._moveDown) window.removeEventListener('keydown', this._moveDown);
    if (this._moveUp) window.removeEventListener('keyup', this._moveUp);
    if (this._interactHandler) window.removeEventListener('keydown', this._interactHandler);
    if (this.scareSystem) this.scareSystem.dispose();
    if (this.chaseController) this.chaseController.dispose();
    if (this.judgePresentation) this.judgePresentation.dispose();
    if (this.cakeHealth) this.cakeHealth.dispose();
    super.dispose();
  }
}

window.PresentScene3D = PresentScene3D;