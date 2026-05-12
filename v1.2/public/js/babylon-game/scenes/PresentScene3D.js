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

    // FPS Camera — fixed forward, no mouse look (corridor walker style)
    this.camera = new BABYLON.UniversalCamera('fpsCam',
      new BABYLON.Vector3(0, 1.7, 0), this.scene);
    this.camera.minZ = 0.1;
    // NO attachControl — no mouse input at all
    this.camera.speed = 0;
    this.camera.rotation = new BABYLON.Vector3(0, 0, 0); // Look straight forward
    this.scene.activeCamera = this.camera;

    // Fog — subtle, not overwhelming
    this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.025; // Lighter start fog — can still see room structure
    this.scene.fogColor = new BABYLON.Color3(0.05, 0.03, 0.07);
    this.scene.clearColor = new BABYLON.Color4(0.05, 0.03, 0.07, 1);

    // Ambient lighting — bright enough to see geometry
    const ambient = new BABYLON.HemisphericLight('horrorAmbient',
      new BABYLON.Vector3(0, 1, 0), this.scene);
    ambient.intensity = 0.35;
    ambient.diffuse = new BABYLON.Color3(0.5, 0.4, 0.45);
    ambient.groundColor = new BABYLON.Color3(0.15, 0.1, 0.12); // Floor tint for up/down sense

    // Point light follows player — brighter with more range
    this.playerLight = new BABYLON.PointLight('playerLight',
      new BABYLON.Vector3(0, 2, 0), this.scene);
    this.playerLight.intensity = 1.2;
    this.playerLight.range = 10;
    this.playerLight.diffuse = new BABYLON.Color3(0.95, 0.8, 0.6);

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

    // Start dust particles
    this._addDustParticles();
  }

  _addDustParticles() {
    const dust = new BABYLON.ParticleSystem('dust', 50, this.scene);
    dust.emitter = this.camera;
    dust.minSize = 0.01;
    dust.maxSize = 0.03;
    dust.minLifeTime = 2;
    dust.maxLifeTime = 5;
    dust.emitRate = 10;
    dust.direction1 = new BABYLON.Vector3(-1, -0.5, -1);
    dust.direction2 = new BABYLON.Vector3(1, 0.5, 1);
    dust.color1 = new BABYLON.Color4(0.5, 0.5, 0.5, 0.3);
    dust.color2 = new BABYLON.Color4(0.3, 0.3, 0.3, 0.1);
    dust.createPointEmitter(new BABYLON.Vector3(-2, -1, -2), new BABYLON.Vector3(2, 1, 2));
    dust.start();
    this._dustParticles = dust;
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

    // Increase fog density subtly as we progress (stays playable)
    this.scene.fogDensity = 0.025 + (index * 0.002);

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

    // Full-screen red flash
    const flash = new BABYLON.GUI.Rectangle('jumpscare');
    flash.width = '100%';
    flash.height = '100%';
    flash.background = 'rgba(180, 0, 0, 0.7)';
    flash.thickness = 0;
    flash.isHitTestVisible = false;
    this.hud.texture.addControl(flash);

    // Try to show a jumpscare PNG (if assets exist), otherwise fall back to emoji
    const jumpscareImages = [
      '/assets/jumpscares/face1.png',
      '/assets/jumpscares/face2.png',
      '/assets/jumpscares/face3.png'
    ];
    const imgSrc = jumpscareImages[Math.floor(Math.random() * jumpscareImages.length)];
    const img = new BABYLON.GUI.Image('scareImg', imgSrc);
    img.width = '512px';
    img.height = '512px';
    img.stretch = BABYLON.GUI.Image.STRETCH_UNIFORM;
    img.isHitTestVisible = false;
    this.hud.texture.addControl(img);
    // If image fails to load, show emoji fallback
    img.onImageLoadedObservable.addOnce(() => {});
    img.domImage.onerror = () => {
      this.hud.texture.removeControl(img);
      img.dispose();
      const text = new BABYLON.GUI.TextBlock('scareFallback', '👹');
      text.fontSize = 200;
      text.isHitTestVisible = false;
      this.hud.texture.addControl(text);
      setTimeout(() => {
        if (this._disposed) return;
        this.hud.texture.removeControl(text);
        text.dispose();
      }, 300);
    };

    setTimeout(() => {
      if (this._disposed) return;
      this.hud.texture.removeControl(flash);
      this.hud.texture.removeControl(img);
      flash.dispose();
      img.dispose();
    }, 300);
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

    // Chase has its own update
    if (this._chaseActive && this.chaseController) {
      this.chaseController.update(dt);
      return;
    }

    // Player movement
    let moveZ = 0, moveX = 0;
    if (this.moveInput.w) moveZ = 1;
    if (this.moveInput.s) moveZ = -0.3;
    if (this.moveInput.a) moveX = -1;
    if (this.moveInput.d) moveX = 1;

    this.isMoving = (moveZ !== 0 || moveX !== 0);

    if (this.isMoving) {
      // Fixed-forward movement (no mouse look, so forward = +Z always)
      this.camera.position.z += moveZ * this.playerSpeed * dt;
      this.camera.position.x += moveX * this.playerSpeed * dt;

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
        this.roomOffset += this.currentRoomData.roomLength + 2;
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