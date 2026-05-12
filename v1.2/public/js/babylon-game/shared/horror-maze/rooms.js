// Evil Jeopardy 1.2 — Horror Maze Room Builder
// Builds 3D geometry for each of the 14 horror maze rooms.

class RoomBuilder {
  constructor(scene, materials) {
    this.scene = scene;
    this.materials = materials;
    this._roomMeshes = [];
  }

  /**
   * Build a room by index (0-13).
   * @returns {{ root, scares, doorPosition, entryPosition, sideRoom }}
   */
  buildRoom(index) {
    const builders = [
      this._room1_darkPantry,
      this._room2_freezer,
      this._room3_boilingRoom,
      this._room4_knifeCorridor,
      this._room5_meatLocker,
      this._room6_theSink,
      this._room7_dishPit,
      this._room8_theOven,
      this._room9_spiceGauntlet,
      this._room10_walkIn,
      this._room11_dumbwaiter,
      this._room12_chase,
      this._room13_judgeCorridor,
      this._room14_judgeChamber
    ];
    const builder = builders[index];
    if (!builder) return null;
    return builder.call(this);
  }

  _createRoomShell(name, width, height, depth, color) {
    const root = new BABYLON.TransformNode(`room_${name}`, this.scene);

    const floorMat = this.materials.food(color.scale(0.3));
    const wallMat = this.materials.food(color.scale(0.5));
    const ceilMat = this.materials.food(color.scale(0.2));

    // Floor
    const floor = BABYLON.MeshBuilder.CreateBox(`${name}_floor`, {
      width, height: 0.2, depth
    }, this.scene);
    floor.position.y = -0.1;
    floor.material = floorMat;
    floor.parent = root;

    // Ceiling
    const ceil = BABYLON.MeshBuilder.CreateBox(`${name}_ceil`, {
      width, height: 0.15, depth
    }, this.scene);
    ceil.position.y = height;
    ceil.material = ceilMat;
    ceil.parent = root;

    // Walls (left, right)
    const wallL = BABYLON.MeshBuilder.CreateBox(`${name}_wallL`, {
      width: 0.2, height, depth
    }, this.scene);
    wallL.position = new BABYLON.Vector3(-width / 2, height / 2, 0);
    wallL.material = wallMat;
    wallL.parent = root;

    const wallR = BABYLON.MeshBuilder.CreateBox(`${name}_wallR`, {
      width: 0.2, height, depth
    }, this.scene);
    wallR.position = new BABYLON.Vector3(width / 2, height / 2, 0);
    wallR.material = wallMat;
    wallR.parent = root;

    // Back wall with wide doorway arch (2.5m wide, nearly full height)
    const doorW = 2.5;
    const doorH = Math.min(2.8, height - 0.2);
    // Left portion of back wall
    const bwLeft = BABYLON.MeshBuilder.CreateBox(`${name}_bwL`, {
      width: (width - doorW) / 2, height, depth: 0.2
    }, this.scene);
    bwLeft.position = new BABYLON.Vector3(-(width + doorW) / 4, height / 2, depth / 2);
    bwLeft.material = wallMat;
    bwLeft.parent = root;
    // Right portion of back wall
    const bwRight = BABYLON.MeshBuilder.CreateBox(`${name}_bwR`, {
      width: (width - doorW) / 2, height, depth: 0.2
    }, this.scene);
    bwRight.position = new BABYLON.Vector3((width + doorW) / 4, height / 2, depth / 2);
    bwRight.material = wallMat;
    bwRight.parent = root;
    // Thin arch above doorway
    const lintel = BABYLON.MeshBuilder.CreateBox(`${name}_lintel`, {
      width: doorW, height: height - doorH, depth: 0.2
    }, this.scene);
    lintel.position = new BABYLON.Vector3(0, doorH + (height - doorH) / 2, depth / 2);
    lintel.material = wallMat;
    lintel.parent = root;

    // Entry and exit positions for transitions
    const entryPosition = new BABYLON.Vector3(0, 0, -depth / 2 + 0.5);
    const exitPosition = new BABYLON.Vector3(0, 0, depth / 2 - 0.3);

    return { root, floor, wallL, wallR, ceil, entryPosition, exitPosition };
  }

  _addJudgeEyes(root, count, bounds) {
    const eyes = [];
    for (let i = 0; i < count; i++) {
      const eyePair = new BABYLON.TransformNode(`eyes_${i}`, this.scene);
      eyePair.parent = root;

      const x = (Math.random() - 0.5) * bounds.x;
      const y = 1.5 + Math.random() * 1.5;
      const z = (Math.random() - 0.5) * bounds.z;
      eyePair.position = new BABYLON.Vector3(x, y, z);

      for (let side = -1; side <= 1; side += 2) {
        const eye = BABYLON.MeshBuilder.CreateSphere(`eye_${i}_${side}`, {
          diameter: 0.12, segments: 8
        }, this.scene);
        eye.position.x = side * 0.09;
        eye.parent = eyePair;

        const eyeMat = new BABYLON.StandardMaterial(`eyeMat_${i}_${side}`, this.scene);
        eyeMat.emissiveColor = new BABYLON.Color3(0.9, 0.6, 0.1);
        eyeMat.disableLighting = true;
        eye.material = eyeMat;
      }
      eyes.push(eyePair);
    }
    return eyes;
  }

  _addRoomLight(root, x, y, z, color, intensity, range) {
    const light = new BABYLON.PointLight(
      `roomLight_${root.name}_${Math.round(x * 10)}_${Math.round(z * 10)}`,
      new BABYLON.Vector3(x, y, z),
      this.scene
    );
    light.diffuse = new BABYLON.Color3(color.r, color.g, color.b);
    light.specular = new BABYLON.Color3(color.r * 0.4, color.g * 0.4, color.b * 0.4);
    light.intensity = intensity;
    light.range = range;
    light.parent = root;

    if (this.scene.onBeforeRenderObservable && this.scene.onBeforeRenderObservable.add) {
      const seed = Math.random() * Math.PI * 2;
      const observer = this.scene.onBeforeRenderObservable.add(() => {
        const time = (typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now()) * 0.001;
        light.intensity = intensity * (
          0.82 +
          (Math.sin((time * 7) + seed) * 0.12) +
          (Math.sin((time * 17) + (seed * 0.5)) * 0.06)
        );
      });
      if (root.onDisposeObservable && root.onDisposeObservable.add) {
        root.onDisposeObservable.add(() => {
          if (this.scene.onBeforeRenderObservable && this.scene.onBeforeRenderObservable.remove) {
            this.scene.onBeforeRenderObservable.remove(observer);
          }
        });
      }
    }

    return light;
  }

  _addWallStain(root, x, y, z, side, color) {
    const isSideWall = side === 'left' || side === 'right';
    const stain = BABYLON.MeshBuilder.CreateBox(
      `stain_${root.name}_${Math.round(x * 10)}_${Math.round(y * 10)}_${Math.round(z * 10)}`,
      isSideWall
        ? { width: 0.01, height: 0.35 + Math.random() * 0.55, depth: 0.4 + Math.random() * 0.7 }
        : { width: 0.4 + Math.random() * 0.8, height: 0.35 + Math.random() * 0.55, depth: 0.01 },
      this.scene
    );
    stain.position = new BABYLON.Vector3(x, y, z);
    const stainMat = new BABYLON.StandardMaterial(`${stain.name}_mat`, this.scene);
    stainMat.diffuseColor = new BABYLON.Color3(color.r * 0.25, color.g * 0.25, color.b * 0.25);
    stainMat.emissiveColor = color;
    stainMat.alpha = 0.7;
    stainMat.backFaceCulling = false;
    stain.material = stainMat;
    stain.parent = root;
    return stain;
  }

  _addCobweb(root, x, y, z, size) {
    const cobweb = new BABYLON.Mesh(
      `cobweb_${root.name}_${Math.round(x * 10)}_${Math.round(z * 10)}`,
      this.scene
    );
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = [0, 0, 0, size, 0, 0, 0, size, 0];
    vertexData.indices = [0, 1, 2];
    vertexData.uvs = [0, 0, 1, 0, 0, 1];
    const normals = [];
    BABYLON.VertexData.ComputeNormals(vertexData.positions, vertexData.indices, normals);
    vertexData.normals = normals;
    vertexData.applyToMesh(cobweb);
    const cobwebMat = new BABYLON.StandardMaterial(`${cobweb.name}_mat`, this.scene);
    cobwebMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    cobwebMat.emissiveColor = new BABYLON.Color3(0.75, 0.75, 0.75);
    cobwebMat.alpha = 0.22;
    cobwebMat.backFaceCulling = false;
    cobweb.material = cobwebMat;
    cobweb.position = new BABYLON.Vector3(x, y, z);
    cobweb.rotation.z = Math.random() * Math.PI * 2;
    cobweb.parent = root;
    return cobweb;
  }

  // ─── ROOM 1: Dark Pantry ───
  _room1_darkPantry() {
    const shell = this._createRoomShell('pantry', 5, 3.5, 8,
      new BABYLON.Color3(0.4, 0.35, 0.3));
    const { root } = shell;
    root.metadata = { soundRefs: ['metalCreak'] };

    this._addRoomLight(root, 0, 2.9, -0.8, new BABYLON.Color3(1, 0.75, 0.45), 1.45, 10);
    this._addWallStain(root, -2.39, 1.5, -1.4, 'left', new BABYLON.Color3(0.28, 0.08, 0.04));
    this._addWallStain(root, 2.39, 1.9, 1.8, 'right', new BABYLON.Color3(0.18, 0.12, 0.05));
    this._addWallStain(root, -0.8, 1.2, 3.89, 'back', new BABYLON.Color3(0.1, 0.16, 0.06));
    this._addCobweb(root, -2.35, 3.0, -3.7, 0.45);
    this._addCobweb(root, 2.15, 2.9, 3.4, 0.38);

    const swingPivot = new BABYLON.TransformNode('pantrySwingPivot', this.scene);
    swingPivot.position = new BABYLON.Vector3(0, 3.15, -0.8);
    swingPivot.parent = root;
    const swingCable = BABYLON.MeshBuilder.CreateCylinder('pantrySwingCable', {
      diameter: 0.03, height: 0.9, tessellation: 6
    }, this.scene);
    swingCable.position.y = -0.45;
    swingCable.material = this.materials.metal();
    swingCable.parent = swingPivot;
    const pantrySwingLight = BABYLON.MeshBuilder.CreateSphere('pantrySwingLight', {
      diameter: 0.28, segments: 10
    }, this.scene);
    pantrySwingLight.position.y = -0.92;
    const swingMat = new BABYLON.StandardMaterial('pantrySwingLightMat', this.scene);
    swingMat.emissiveColor = new BABYLON.Color3(1, 0.72, 0.35);
    swingMat.diffuseColor = new BABYLON.Color3(0.2, 0.15, 0.08);
    pantrySwingLight.material = swingMat;
    pantrySwingLight.parent = swingPivot;
    if (this.scene.onBeforeRenderObservable && this.scene.onBeforeRenderObservable.add) {
      const swingSeed = Math.random() * Math.PI * 2;
      const swingObserver = this.scene.onBeforeRenderObservable.add(() => {
        const time = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) * 0.001;
        swingPivot.rotation.z = Math.sin((time * 1.7) + swingSeed) * 0.16;
      });
      if (root.onDisposeObservable && root.onDisposeObservable.add) {
        root.onDisposeObservable.add(() => {
          if (this.scene.onBeforeRenderObservable && this.scene.onBeforeRenderObservable.remove) {
            this.scene.onBeforeRenderObservable.remove(swingObserver);
          }
        });
      }
    }

    const pantryPuddle = BABYLON.MeshBuilder.CreateDisc('pantryPuddle', {
      radius: 0.55, tessellation: 16
    }, this.scene);
    pantryPuddle.rotation.x = Math.PI / 2;
    pantryPuddle.position = new BABYLON.Vector3(0.8, 0.02, 2.2);
    const pantryPuddleMat = new BABYLON.StandardMaterial('pantryPuddleMat', this.scene);
    pantryPuddleMat.diffuseColor = new BABYLON.Color3(0.15, 0.07, 0.04);
    pantryPuddleMat.emissiveColor = new BABYLON.Color3(0.08, 0.03, 0.02);
    pantryPuddleMat.alpha = 0.45;
    pantryPuddle.material = pantryPuddleMat;
    pantryPuddle.parent = root;

    for (let i = 0; i < 3; i++) {
      const crack = BABYLON.MeshBuilder.CreateBox(`pantryCrack_${i}`, {
        width: 0.45 + (i * 0.12), height: 0.01, depth: 0.03
      }, this.scene);
      crack.position = new BABYLON.Vector3(-1.2 + (i * 0.7), 0.01, -0.5 + (i * 1.4));
      crack.rotation.y = 0.5 - (i * 0.2);
      crack.material = this.materials.food(new BABYLON.Color3(0.08, 0.05, 0.04));
      crack.parent = root;
    }

    for (let i = 0; i < 4; i++) {
      const can = BABYLON.MeshBuilder.CreateCylinder(`pantryFloorCan_${i}`, {
        diameter: 0.12, height: 0.22, tessellation: 12
      }, this.scene);
      can.position = new BABYLON.Vector3(-1.1 + (i * 0.22), 0.11, 2.8 + (i * 0.1));
      can.rotation.z = 1.1 + (i * 0.18);
      can.rotation.x = 0.2 * i;
      can.material = this.materials.metal();
      can.parent = root;
    }

    // Shelves along walls
    for (let z = -3; z <= 3; z += 1.5) {
      for (let side = -1; side <= 1; side += 2) {
        const shelf = BABYLON.MeshBuilder.CreateBox(`shelf_${z}_${side}`, {
          width: 0.8, height: 0.06, depth: 0.4
        }, this.scene);
        shelf.position = new BABYLON.Vector3(side * 2.1, 1.2 + Math.random() * 0.8, z);
        shelf.material = this.materials.wood();
        shelf.parent = root;

        // Cans on shelves
        const canCount = 2 + Math.floor(Math.random() * 3);
        for (let c = 0; c < canCount; c++) {
          const can = BABYLON.MeshBuilder.CreateCylinder(`can_${z}_${side}_${c}`, {
            diameter: 0.12, height: 0.2, tessellation: 12
          }, this.scene);
          can.position = new BABYLON.Vector3(
            side * 2.1 + (Math.random() - 0.5) * 0.5,
            shelf.position.y + 0.13,
            z + (Math.random() - 0.5) * 0.3
          );
          can.material = this.materials.metal();
          can.parent = root;
        }
      }
    }

    const eyes = this._addJudgeEyes(root, 2, { x: 4, z: 7 });

    return {
      root,
      roomLength: 8,
      entryPosition: shell.entryPosition,
      exitPosition: shell.exitPosition,
      scares: [{ type: 'light', trigger: 'enter', delay: 2000, sound: 'metalCreak' }],
      hasSideRoom: false,
      eyes
    };
  }

  // ─── ROOM 2: The Freezer ───
  _room2_freezer() {
    const shell = this._createRoomShell('freezer', 5, 3.2, 8,
      new BABYLON.Color3(0.5, 0.6, 0.8));
    const { root } = shell;
    root.metadata = { soundRefs: ['iceCreak'] };

    this._addRoomLight(root, 0, 2.6, 0, new BABYLON.Color3(0.5, 0.78, 1), 1.35, 11);
    this._addWallStain(root, -2.39, 1.6, -1.8, 'left', new BABYLON.Color3(0.16, 0.2, 0.24));
    this._addWallStain(root, 2.39, 1.4, 1.6, 'right', new BABYLON.Color3(0.1, 0.18, 0.2));
    this._addCobweb(root, -2.28, 2.85, 3.35, 0.34);
    this._addCobweb(root, 2.08, 2.78, -3.55, 0.3);

    const ceilingPipe_freezer = BABYLON.MeshBuilder.CreateCylinder('ceilingPipe_freezer', {
      diameter: 0.12, height: 3.8, tessellation: 10
    }, this.scene);
    ceilingPipe_freezer.rotation.z = Math.PI / 2;
    ceilingPipe_freezer.position = new BABYLON.Vector3(0, 2.95, -2.2);
    ceilingPipe_freezer.material = this.materials.metal();
    ceilingPipe_freezer.parent = root;

    for (let i = 0; i < 5; i++) {
      const freezerIcicle = BABYLON.MeshBuilder.CreateCylinder(`freezerIcicle_${i}`, {
        diameterTop: 0, diameterBottom: 0.14, height: 0.45 + Math.random() * 0.25, tessellation: 6
      }, this.scene);
      freezerIcicle.position = new BABYLON.Vector3(-1.8 + (i * 0.9), 2.8, -2.8 + ((i % 2) * 3));
      freezerIcicle.material = this.materials.food(new BABYLON.Color3(0.75, 0.9, 1));
      freezerIcicle.parent = root;
    }

    for (let i = 0; i < 4; i++) {
      const frost = BABYLON.MeshBuilder.CreateBox(`freezerFrost_${i}`, {
        width: 0.7, height: 0.45, depth: 0.01
      }, this.scene);
      frost.position = new BABYLON.Vector3((i % 2 === 0 ? -2.39 : 2.39), 1.3 + (i * 0.35), -2.6 + (i * 1.7));
      const frostMat = new BABYLON.StandardMaterial(`freezerFrostMat_${i}`, this.scene);
      frostMat.diffuseColor = new BABYLON.Color3(0.8, 0.92, 1);
      frostMat.emissiveColor = new BABYLON.Color3(0.35, 0.5, 0.65);
      frostMat.alpha = 0.32;
      frost.material = frostMat;
      frost.parent = root;
    }

    for (let i = 0; i < 3; i++) {
      const crack = BABYLON.MeshBuilder.CreateBox(`freezerCrack_${i}`, {
        width: 0.5, height: 0.01, depth: 0.02
      }, this.scene);
      crack.position = new BABYLON.Vector3(-0.8 + (i * 0.9), 0.01, -1.4 + (i * 2.1));
      crack.rotation.y = 0.4 + (i * 0.25);
      crack.material = this.materials.food(new BABYLON.Color3(0.07, 0.09, 0.12));
      crack.parent = root;
    }

    // Ice patches on floor
    for (let i = 0; i < 6; i++) {
      const ice = BABYLON.MeshBuilder.CreateDisc(`ice_${i}`, {
        radius: 0.3 + Math.random() * 0.4, tessellation: 8
      }, this.scene);
      ice.rotation.x = Math.PI / 2;
      ice.position = new BABYLON.Vector3(
        (Math.random() - 0.5) * 4, 0.01,
        (Math.random() - 0.5) * 7
      );
      const iceMat = new BABYLON.StandardMaterial(`iceMat_${i}`, this.scene);
      iceMat.diffuseColor = new BABYLON.Color3(0.7, 0.85, 0.95);
      iceMat.alpha = 0.6;
      ice.material = iceMat;
      ice.parent = root;
    }

    // Frozen hands on walls
    for (let i = 0; i < 3; i++) {
      const hand = BABYLON.MeshBuilder.CreateBox(`frozenHand_${i}`, {
        width: 0.15, height: 0.3, depth: 0.08
      }, this.scene);
      hand.position = new BABYLON.Vector3(
        (i % 2 === 0 ? -1 : 1) * 2.3,
        1.0 + Math.random() * 1.0,
        -2 + i * 2.5
      );
      hand.material = this.materials.food(new BABYLON.Color3(0.6, 0.7, 0.85));
      hand.parent = root;
    }

    const eyes = this._addJudgeEyes(root, 2, { x: 4, z: 7 });

    return {
      root,
      roomLength: 8,
      entryPosition: shell.entryPosition,
      exitPosition: shell.exitPosition,
      scares: [{ type: 'medium', trigger: 'middle', delay: 1500, sound: 'iceCreak' }],
      hasSideRoom: false,
      eyes
    };
  }

  // ─── ROOM 3: Boiling Room ───
  _room3_boilingRoom() {
    const shell = this._createRoomShell('boiling', 6, 3.5, 9,
      new BABYLON.Color3(0.6, 0.4, 0.2));
    const { root } = shell;
    const particleSystems = [];
    root.metadata = { soundRefs: ['steamHiss'], bubblingSoundRef: 'steamHiss', particleSystems };

    this._addRoomLight(root, 0, 2.9, 1.2, new BABYLON.Color3(1, 0.35, 0.18), 1.7, 12);
    this._addWallStain(root, -2.89, 1.8, -1.4, 'left', new BABYLON.Color3(0.22, 0.07, 0.04));
    this._addWallStain(root, 2.89, 1.5, 2.6, 'right', new BABYLON.Color3(0.12, 0.08, 0.02));
    this._addCobweb(root, -2.72, 3.05, -4.1, 0.36);
    this._addCobweb(root, 2.46, 2.95, 3.8, 0.3);

    for (let i = 0; i < 2; i++) {
      const ceilingPipe_boiling = BABYLON.MeshBuilder.CreateCylinder(`ceilingPipe_boiling_${i}`, {
        diameter: 0.14, height: 4.8, tessellation: 10
      }, this.scene);
      ceilingPipe_boiling.rotation.z = Math.PI / 2;
      ceilingPipe_boiling.position = new BABYLON.Vector3(0, 3.08, -2.5 + (i * 2.5));
      ceilingPipe_boiling.material = this.materials.metal();
      ceilingPipe_boiling.parent = root;
    }

    for (let i = 0; i < 3; i++) {
      const scorch = BABYLON.MeshBuilder.CreateDisc(`boilingScorch_${i}`, {
        radius: 0.55, tessellation: 18
      }, this.scene);
      scorch.rotation.x = Math.PI / 2;
      scorch.position = new BABYLON.Vector3(-1.5 + (i * 1.5), 0.02, 1 + (i * 1.8));
      const scorchMat = new BABYLON.StandardMaterial(`boilingScorchMat_${i}`, this.scene);
      scorchMat.diffuseColor = new BABYLON.Color3(0.08, 0.04, 0.02);
      scorchMat.alpha = 0.5;
      scorch.material = scorchMat;
      scorch.parent = root;
    }

    // Giant pots
    for (let i = 0; i < 3; i++) {
      const pot = BABYLON.MeshBuilder.CreateCylinder(`pot_${i}`, {
        diameter: 1.2, height: 0.9, tessellation: 20
      }, this.scene);
      pot.position = new BABYLON.Vector3(-1.5 + i * 1.5, 0.45, 1 + i * 1.8);
      pot.material = this.materials.metal();
      pot.parent = root;

      const potGlow = BABYLON.MeshBuilder.CreateDisc(`potGlow_${i}`, {
        radius: 0.45, tessellation: 16
      }, this.scene);
      potGlow.rotation.x = Math.PI / 2;
      potGlow.position = new BABYLON.Vector3(pot.position.x, 0.04, pot.position.z);
      const potGlowMat = new BABYLON.StandardMaterial(`potGlowMat_${i}`, this.scene);
      potGlowMat.emissiveColor = new BABYLON.Color3(0.7, 0.15, 0.05);
      potGlowMat.alpha = 0.55;
      potGlow.material = potGlowMat;
      potGlow.parent = root;

      const boilingSteam = new BABYLON.ParticleSystem(`boilingSteam_${i}`, 70, this.scene);
      boilingSteam.emitter = pot;
      boilingSteam.minLifeTime = 0.8;
      boilingSteam.maxLifeTime = 1.8;
      boilingSteam.minSize = 0.08;
      boilingSteam.maxSize = 0.24;
      boilingSteam.emitRate = 28;
      boilingSteam.color1 = new BABYLON.Color4(0.95, 0.92, 0.9, 0.38);
      boilingSteam.color2 = new BABYLON.Color4(0.8, 0.78, 0.76, 0.12);
      boilingSteam.colorDead = new BABYLON.Color4(0.9, 0.9, 0.9, 0);
      boilingSteam.direction1 = new BABYLON.Vector3(-0.08, 0.9, -0.08);
      boilingSteam.direction2 = new BABYLON.Vector3(0.08, 1.5, 0.08);
      boilingSteam.gravity = new BABYLON.Vector3(0, 0.6, 0);
      boilingSteam.start();
      particleSystems.push(boilingSteam);
    }

    for (let i = 0; i < 3; i++) {
      const crack = BABYLON.MeshBuilder.CreateBox(`boilingCrack_${i}`, {
        width: 0.65, height: 0.01, depth: 0.03
      }, this.scene);
      crack.position = new BABYLON.Vector3(-2 + (i * 1.8), 0.01, -2.2 + (i * 1.8));
      crack.rotation.y = 0.25 + (i * 0.35);
      crack.material = this.materials.food(new BABYLON.Color3(0.08, 0.03, 0.02));
      crack.parent = root;
    }

    if (root.onDisposeObservable && root.onDisposeObservable.add) {
      root.onDisposeObservable.add(() => {
        particleSystems.forEach((ps) => ps.dispose());
      });
    }

    const eyes = this._addJudgeEyes(root, 3, { x: 5, z: 8 });

    return {
      root,
      roomLength: 9,
      entryPosition: shell.entryPosition,
      exitPosition: shell.exitPosition,
      scares: [
        { type: 'medium', trigger: 'position', z: 3, sound: 'steamHiss' },
        { type: 'medium', trigger: 'position', z: 6, sound: 'steamHiss' }
      ],
      hasSideRoom: true,
      eyes
    };
  }

  // ─── ROOM 4: Knife Corridor ───
  _room4_knifeCorridor() {
    const shell = this._createRoomShell('knife', 3.5, 3, 10,
      new BABYLON.Color3(0.35, 0.3, 0.3));
    const { root } = shell;
    root.metadata = { soundRefs: ['knifeWhoosh'] };

    this._addRoomLight(root, 0, 2.45, 0, new BABYLON.Color3(0.8, 0.12, 0.1), 1.35, 10);
    this._addWallStain(root, -1.64, 1.35, -2.4, 'left', new BABYLON.Color3(0.45, 0.05, 0.03));
    this._addWallStain(root, 1.64, 1.8, 1.9, 'right', new BABYLON.Color3(0.35, 0.04, 0.03));
    this._addCobweb(root, -1.5, 2.55, -4.45, 0.25);
    this._addCobweb(root, 1.24, 2.48, 4.1, 0.22);

    const ceilingPipe_knife = BABYLON.MeshBuilder.CreateCylinder('ceilingPipe_knife', {
      diameter: 0.08, height: 8.6, tessellation: 10
    }, this.scene);
    ceilingPipe_knife.rotation.z = Math.PI / 2;
    ceilingPipe_knife.position = new BABYLON.Vector3(0, 2.78, 0);
    ceilingPipe_knife.material = this.materials.metal();
    ceilingPipe_knife.parent = root;

    for (let i = 0; i < 5; i++) {
      const splatter = BABYLON.MeshBuilder.CreatePlane(`knifeSplatter_${i}`, {
        width: 0.45 + Math.random() * 0.25, height: 0.35 + Math.random() * 0.2
      }, this.scene);
      splatter.position = new BABYLON.Vector3((i % 2 === 0 ? -1.63 : 1.63), 1.0 + (i * 0.3), -4 + (i * 2));
      splatter.rotation.y = splatter.position.x < 0 ? Math.PI / 2 : -Math.PI / 2;
      const splatterMat = new BABYLON.StandardMaterial(`knifeSplatterMat_${i}`, this.scene);
      splatterMat.diffuseColor = new BABYLON.Color3(0.5, 0.05, 0.04);
      splatterMat.emissiveColor = new BABYLON.Color3(0.18, 0.02, 0.02);
      splatterMat.alpha = 0.58;
      splatterMat.backFaceCulling = false;
      splatter.material = splatterMat;
      splatter.parent = root;
    }

    for (let i = 0; i < 8; i++) {
      const scratch = BABYLON.MeshBuilder.CreateBox(`knifeScratch_${i}`, {
        width: 0.55, height: 0.01, depth: 0.02
      }, this.scene);
      scratch.position = new BABYLON.Vector3((i % 2 === 0 ? -0.45 : 0.35), 0.01, -4 + (i * 1.15));
      scratch.rotation.y = 0.65 - ((i % 3) * 0.28);
      scratch.material = this.materials.food(new BABYLON.Color3(0.07, 0.04, 0.04));
      scratch.parent = root;
    }

    // Knives in walls
    for (let z = -4; z <= 4; z += 1.2) {
      for (let side = -1; side <= 1; side += 2) {
        const knife = BABYLON.MeshBuilder.CreateBox(`knife_${z}_${side}`, {
          width: 0.04, height: 0.5, depth: 0.02
        }, this.scene);
        knife.position = new BABYLON.Vector3(side * 1.5, 1.2 + Math.random() * 0.8, z);
        knife.rotation.z = side * 0.3;
        knife.material = this.materials.metal();
        knife.parent = root;

        const extraKnife = BABYLON.MeshBuilder.CreateBox(`knifeExtra_${z}_${side}`, {
          width: 0.03, height: 0.42, depth: 0.02
        }, this.scene);
        extraKnife.position = new BABYLON.Vector3(side * 1.42, 0.7 + Math.random() * 1.1, z + 0.35);
        extraKnife.rotation.z = side * -0.55;
        extraKnife.material = this.materials.metal();
        extraKnife.parent = root;
      }
    }

    const eyes = this._addJudgeEyes(root, 3, { x: 3, z: 9 });

    return {
      root,
      roomLength: 10,
      entryPosition: shell.entryPosition,
      exitPosition: shell.exitPosition,
      scares: [
        { type: 'medium', trigger: 'position', z: 2, sound: 'knifeWhoosh' },
        { type: 'medium', trigger: 'position', z: 6, sound: 'knifeWhoosh' }
      ],
      hasSideRoom: false,
      eyes
    };
  }

  // ─── ROOM 5: Meat Locker ───
  _room5_meatLocker() {
    const shell = this._createRoomShell('meat', 5, 3.5, 8,
      new BABYLON.Color3(0.5, 0.2, 0.2));
    const { root } = shell;
    root.metadata = { soundRefs: ['scareString'] };

    this._addRoomLight(root, 0, 3.0, 0.8, new BABYLON.Color3(0.78, 0.18, 0.24), 1.55, 10);
    this._addWallStain(root, -2.39, 1.7, -2.2, 'left', new BABYLON.Color3(0.4, 0.08, 0.08));
    this._addWallStain(root, 2.39, 1.4, 1.4, 'right', new BABYLON.Color3(0.22, 0.06, 0.06));
    this._addCobweb(root, -2.32, 3.0, 3.25, 0.32);
    this._addCobweb(root, 2.05, 2.92, -3.4, 0.28);

    for (let i = 0; i < 2; i++) {
      const ceilingPipe_meat = BABYLON.MeshBuilder.CreateCylinder(`ceilingPipe_meat_${i}`, {
        diameter: 0.12, height: 3.6, tessellation: 10
      }, this.scene);
      ceilingPipe_meat.rotation.z = Math.PI / 2;
      ceilingPipe_meat.position = new BABYLON.Vector3(0, 3.05, -2.1 + (i * 3.4));
      ceilingPipe_meat.material = this.materials.metal();
      ceilingPipe_meat.parent = root;
    }

    for (let i = 0; i < 4; i++) {
      const meatChain = BABYLON.MeshBuilder.CreateCylinder(`meatChain_${i}`, {
        diameter: 0.04, height: 1.0 + Math.random() * 0.4, tessellation: 6
      }, this.scene);
      meatChain.position = new BABYLON.Vector3(-1.8 + (i * 1.2), 2.8, -2.6 + ((i % 2) * 3.5));
      meatChain.material = this.materials.metal();
      meatChain.parent = root;
    }

    for (let i = 0; i < 3; i++) {
      const bloodPool = BABYLON.MeshBuilder.CreateDisc(`meatPool_${i}`, {
        radius: 0.45 + Math.random() * 0.18, tessellation: 18
      }, this.scene);
      bloodPool.rotation.x = Math.PI / 2;
      bloodPool.position = new BABYLON.Vector3(-1.2 + (i * 1.2), 0.02, -1 + (i * 2.1));
      const bloodMat = new BABYLON.StandardMaterial(`meatPoolMat_${i}`, this.scene);
      bloodMat.diffuseColor = new BABYLON.Color3(0.18, 0.03, 0.03);
      bloodMat.emissiveColor = new BABYLON.Color3(0.08, 0.01, 0.01);
      bloodMat.alpha = 0.48;
      bloodPool.material = bloodMat;
      bloodPool.parent = root;
    }

    // Hanging shapes (hooks + meat-like forms)
    for (let i = 0; i < 5; i++) {
      const hookRoot = new BABYLON.TransformNode(`hook_${i}`, this.scene);
      hookRoot.parent = root;
      hookRoot.position = new BABYLON.Vector3(
        (Math.random() - 0.5) * 3.5,
        3.2,
        -3 + i * 1.6
      );

      const chainLink = BABYLON.MeshBuilder.CreateCylinder(`meatSuspension_${i}`, {
        diameter: 0.035, height: 0.35, tessellation: 6
      }, this.scene);
      chainLink.position.y = -0.18;
      chainLink.material = this.materials.metal();
      chainLink.parent = hookRoot;

      // Hook
      const hook = BABYLON.MeshBuilder.CreateTorus(`hookMesh_${i}`, {
        diameter: 0.2, thickness: 0.03, tessellation: 12
      }, this.scene);
      hook.parent = hookRoot;
      hook.material = this.materials.metal();

      const extraHook = BABYLON.MeshBuilder.CreateTorus(`meatExtraHook_${i}`, {
        diameter: 0.12, thickness: 0.02, tessellation: 10
      }, this.scene);
      extraHook.position = new BABYLON.Vector3(0.16, -0.08, 0);
      extraHook.parent = hookRoot;
      extraHook.material = this.materials.metal();

      // Hanging shape
      const meat = BABYLON.MeshBuilder.CreateCylinder(`meat_${i}`, {
        diameterTop: 0.2, diameterBottom: 0.35, height: 0.8, tessellation: 8
      }, this.scene);
      meat.position.y = -0.5;
      meat.material = this.materials.food(new BABYLON.Color3(0.5, 0.15, 0.15));
      meat.parent = hookRoot;
    }

    const eyes = this._addJudgeEyes(root, 4, { x: 4, z: 7 });

    return {
      root,
      roomLength: 8,
      entryPosition: shell.entryPosition,
      exitPosition: shell.exitPosition,
      scares: [{ type: 'heavy', trigger: 'middle', delay: 2000, sound: 'scareString' }],
      hasSideRoom: false,
      eyes
    };
  }

  // ─── ROOM 6: The Sink ───
  _room6_theSink() {
    const shell = this._createRoomShell('sink', 5, 3, 8,
      new BABYLON.Color3(0.3, 0.4, 0.45));
    const { root } = shell;
    root.metadata = { soundRefs: ['ambientDrip'] };

    this._addRoomLight(root, 0.2, 2.55, -1.5, new BABYLON.Color3(0.3, 0.78, 0.46), 1.4, 10);
    this._addWallStain(root, -2.39, 1.5, -2.2, 'left', new BABYLON.Color3(0.18, 0.22, 0.08));
    this._addWallStain(root, 2.39, 1.2, 1.9, 'right', new BABYLON.Color3(0.28, 0.18, 0.06));
    this._addCobweb(root, -2.3, 2.7, 3.4, 0.28);
    this._addCobweb(root, 2.02, 2.65, -3.5, 0.24);

    for (let i = 0; i < 3; i++) {
      const ceilingPipe_sink = BABYLON.MeshBuilder.CreateCylinder(`ceilingPipe_sink_${i}`, {
        diameter: 0.1, height: 3.6, tessellation: 10
      }, this.scene);
      ceilingPipe_sink.rotation.z = Math.PI / 2;
      ceilingPipe_sink.position = new BABYLON.Vector3(0, 2.72, -2.6 + (i * 2.4));
      ceilingPipe_sink.material = this.materials.metal();
      ceilingPipe_sink.parent = root;

      const rustBand = BABYLON.MeshBuilder.CreateBox(`sinkRustBand_${i}`, {
        width: 0.12, height: 0.12, depth: 0.12
      }, this.scene);
      rustBand.position = new BABYLON.Vector3(0.5 - (i * 0.6), 2.72, -2.6 + (i * 2.4));
      rustBand.material = this.materials.food(new BABYLON.Color3(0.35, 0.16, 0.06));
      rustBand.parent = root;
    }

    const water = BABYLON.MeshBuilder.CreateGround('water', { width: 5, height: 8 }, this.scene);
    const waterMat = new BABYLON.StandardMaterial('waterMat', this.scene);
    waterMat.diffuseColor = new BABYLON.Color3(0.15, 0.4, 0.28);
    waterMat.emissiveColor = new BABYLON.Color3(0.04, 0.12, 0.08);
    waterMat.alpha = 0.42;
    water.material = waterMat;
    water.position.y = 0.05;
    water.parent = root;

    for (let i = 0; i < 6; i++) {
      const sinkDrop = BABYLON.MeshBuilder.CreateSphere(`sinkDrop_${i}`, {
        diameter: 0.06, segments: 6
      }, this.scene);
      sinkDrop.position = new BABYLON.Vector3(-1.2 + ((i % 3) * 1.2), 2.35 - ((i % 2) * 0.4), -1.2 + (i * 0.6));
      const sinkDropMat = new BABYLON.StandardMaterial(`sinkDropMat_${i}`, this.scene);
      sinkDropMat.emissiveColor = new BABYLON.Color3(0.18, 0.65, 0.42);
      sinkDropMat.alpha = 0.6;
      sinkDrop.material = sinkDropMat;
      sinkDrop.parent = root;
    }

    for (let i = 0; i < 3; i++) {
      const slimeCrack = BABYLON.MeshBuilder.CreateBox(`sinkCrack_${i}`, {
        width: 0.5, height: 0.01, depth: 0.03
      }, this.scene);
      slimeCrack.position = new BABYLON.Vector3(-1.1 + (i * 1.1), 0.01, -0.8 + (i * 1.9));
      slimeCrack.rotation.y = 0.25 + (i * 0.3);
      slimeCrack.material = this.materials.food(new BABYLON.Color3(0.06, 0.09, 0.04));
      slimeCrack.parent = root;
    }

    for (let i = 0; i < 3; i++) {
      const drain = BABYLON.MeshBuilder.CreateCylinder(`drain_${i}`, {
        diameter: 0.4, height: 0.05, tessellation: 16
      }, this.scene);
      drain.position = new BABYLON.Vector3((i - 1) * 1.5, 0.02, -1 + i * 2.5);
      drain.material = this.materials.metal();
      drain.parent = root;
    }

    const eyes = this._addJudgeEyes(root, 3, { x: 4, z: 7 });
    return {
      root, roomLength: 8,
      entryPosition: shell.entryPosition, exitPosition: shell.exitPosition,
      scares: [{ type: 'medium', trigger: 'position', z: 4, sound: 'ambientDrip' }],
      hasSideRoom: true, eyes
    };
  }

  // ─── ROOM 7: Dish Pit ───
  _room7_dishPit() {
    const shell = this._createRoomShell('dishes', 6, 3.5, 9,
      new BABYLON.Color3(0.4, 0.4, 0.4));
    const { root } = shell;
    root.metadata = { soundRefs: ['metalCreak'] };

    this._addRoomLight(root, 0, 2.85, -1.2, new BABYLON.Color3(0.9, 0.78, 0.45), 1.3, 11);
    this._addWallStain(root, -2.89, 1.5, -1.8, 'left', new BABYLON.Color3(0.18, 0.14, 0.05));
    this._addWallStain(root, 2.89, 1.8, 2.1, 'right', new BABYLON.Color3(0.1, 0.18, 0.08));
    this._addCobweb(root, -2.72, 3.0, -4.1, 0.32);
    this._addCobweb(root, 2.4, 2.94, 3.8, 0.26);

    const ceilingPipe_dishes = BABYLON.MeshBuilder.CreateCylinder('ceilingPipe_dishes', {
      diameter: 0.11, height: 5.1, tessellation: 10
    }, this.scene);
    ceilingPipe_dishes.rotation.z = Math.PI / 2;
    ceilingPipe_dishes.position = new BABYLON.Vector3(0, 3.08, 0.5);
    ceilingPipe_dishes.material = this.materials.metal();
    ceilingPipe_dishes.parent = root;

    for (let i = 0; i < 6; i++) {
      const dishShard = BABYLON.MeshBuilder.CreateDisc(`dishShard_${i}`, {
        radius: 0.14 + ((i % 3) * 0.04), tessellation: 10
      }, this.scene);
      dishShard.rotation.x = Math.PI / 2;
      dishShard.rotation.z = 0.3 + (i * 0.2);
      dishShard.position = new BABYLON.Vector3(-2.1 + (i * 0.8), 0.03 + ((i % 2) * 0.01), 1.8 + ((i % 3) * 0.45));
      dishShard.material = this.materials.food(new BABYLON.Color3(0.85, 0.84, 0.78));
      dishShard.parent = root;
    }

    const greasePuddle = BABYLON.MeshBuilder.CreateDisc('dishGreasePuddle', {
      radius: 0.75, tessellation: 18
    }, this.scene);
    greasePuddle.rotation.x = Math.PI / 2;
    greasePuddle.position = new BABYLON.Vector3(1.8, 0.02, -1.2);
    const greaseMat = new BABYLON.StandardMaterial('dishGreaseMat', this.scene);
    greaseMat.diffuseColor = new BABYLON.Color3(0.14, 0.1, 0.04);
    greaseMat.alpha = 0.36;
    greasePuddle.material = greaseMat;
    greasePuddle.parent = root;

    for (let t = 0; t < 4; t++) {
      const towerX = -2 + t * 1.5;
      const towerZ = -2 + t * 2;
      for (let d = 0; d < 5 + Math.floor(Math.random() * 4); d++) {
        const plate = BABYLON.MeshBuilder.CreateCylinder(`plate_${t}_${d}`, {
          diameter: 0.5, height: 0.04, tessellation: 16
        }, this.scene);
        plate.position = new BABYLON.Vector3(towerX, 0.02 + d * 0.05, towerZ);
        plate.material = this.materials.food(new BABYLON.Color3(0.9, 0.9, 0.85));
        plate.parent = root;
      }
    }

    const eyes = this._addJudgeEyes(root, 3, { x: 5, z: 8 });
    return {
      root, roomLength: 9,
      entryPosition: shell.entryPosition, exitPosition: shell.exitPosition,
      scares: [
        { type: 'medium', trigger: 'position', z: 2, sound: 'metalCreak' },
        { type: 'medium', trigger: 'position', z: 4.5, sound: 'knifeWhoosh' },
        { type: 'medium', trigger: 'position', z: 7, sound: 'metalCreak' }
      ],
      hasSideRoom: false, eyes
    };
  }

  // ─── ROOM 8: The Oven ───
  _room8_theOven() {
    const shell = this._createRoomShell('oven', 6, 4, 9,
      new BABYLON.Color3(0.5, 0.3, 0.15));
    const { root } = shell;
    root.metadata = { soundRefs: ['steamHiss', 'scareString'] };

    this._addRoomLight(root, 0, 2.9, 2.6, new BABYLON.Color3(1, 0.45, 0.08), 1.8, 12);
    this._addWallStain(root, -2.89, 1.8, -2.1, 'left', new BABYLON.Color3(0.22, 0.09, 0.03));
    this._addWallStain(root, 2.89, 1.4, 1.7, 'right', new BABYLON.Color3(0.3, 0.11, 0.02));
    this._addCobweb(root, -2.72, 3.45, -4.15, 0.28);
    this._addCobweb(root, 2.4, 3.3, 3.7, 0.22);

    for (let i = 0; i < 2; i++) {
      const ceilingPipe_oven = BABYLON.MeshBuilder.CreateCylinder(`ceilingPipe_oven_${i}`, {
        diameter: 0.12, height: 5.2, tessellation: 10
      }, this.scene);
      ceilingPipe_oven.rotation.z = Math.PI / 2;
      ceilingPipe_oven.position = new BABYLON.Vector3(0, 3.45, -2.3 + (i * 2.3));
      ceilingPipe_oven.material = this.materials.metal();
      ceilingPipe_oven.parent = root;
    }

    const oven = BABYLON.MeshBuilder.CreateBox('giantOven', {
      width: 3, height: 2.5, depth: 2
    }, this.scene);
    oven.position = new BABYLON.Vector3(0, 1.25, 3);
    oven.material = this.materials.metal();
    oven.parent = root;

    const door = BABYLON.MeshBuilder.CreateBox('ovenDoor', {
      width: 1.5, height: 1.2, depth: 0.08
    }, this.scene);
    door.position = new BABYLON.Vector3(0, 1.0, 1.98);
    const doorMat = new BABYLON.StandardMaterial('ovenDoorMat', this.scene);
    doorMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    doorMat.emissiveColor = new BABYLON.Color3(0.3, 0.1, 0);
    door.material = doorMat;
    door.parent = root;

    for (let i = 0; i < 3; i++) {
      const glow = BABYLON.MeshBuilder.CreateSphere(`fireGlow_${i}`, {
        diameter: 0.3, segments: 8
      }, this.scene);
      glow.position = new BABYLON.Vector3(-0.5 + i * 0.5, 0.5, 3);
      const glowMat = new BABYLON.StandardMaterial(`glowMat_${i}`, this.scene);
      glowMat.emissiveColor = new BABYLON.Color3(1, 0.4, 0);
      glowMat.alpha = 0.5;
      glow.material = glowMat;
      glow.parent = root;
    }

    for (let i = 0; i < 3; i++) {
      const ovenFirePlane = BABYLON.MeshBuilder.CreatePlane(`ovenFirePlane_${i}`, {
        width: 0.45, height: 0.8
      }, this.scene);
      ovenFirePlane.position = new BABYLON.Vector3(-0.55 + (i * 0.55), 0.8, 2.02);
      const ovenFireMat = new BABYLON.StandardMaterial(`ovenFirePlaneMat_${i}`, this.scene);
      ovenFireMat.emissiveColor = new BABYLON.Color3(1, 0.42, 0.08);
      ovenFireMat.diffuseColor = new BABYLON.Color3(0.55, 0.15, 0.02);
      ovenFireMat.alpha = 0.55;
      ovenFireMat.backFaceCulling = false;
      ovenFirePlane.material = ovenFireMat;
      ovenFirePlane.parent = root;
    }

    for (let i = 0; i < 2; i++) {
      const ovenHeatShimmer = BABYLON.MeshBuilder.CreatePlane(`ovenHeatShimmer_${i}`, {
        width: 1.2, height: 1.6
      }, this.scene);
      ovenHeatShimmer.position = new BABYLON.Vector3(0, 1.2, 1.25 - (i * 0.2));
      const shimmerMat = new BABYLON.StandardMaterial(`ovenHeatShimmerMat_${i}`, this.scene);
      shimmerMat.emissiveColor = new BABYLON.Color3(0.5, 0.2, 0.02);
      shimmerMat.alpha = 0.12;
      shimmerMat.backFaceCulling = false;
      ovenHeatShimmer.material = shimmerMat;
      ovenHeatShimmer.parent = root;
    }

    for (let i = 0; i < 3; i++) {
      const scorch = BABYLON.MeshBuilder.CreateDisc(`ovenScorch_${i}`, {
        radius: 0.45 + (i * 0.08), tessellation: 18
      }, this.scene);
      scorch.rotation.x = Math.PI / 2;
      scorch.position = new BABYLON.Vector3(-1 + (i * 1.0), 0.02, 2.1 + (i * 0.5));
      const scorchMat = new BABYLON.StandardMaterial(`ovenScorchMat_${i}`, this.scene);
      scorchMat.diffuseColor = new BABYLON.Color3(0.05, 0.03, 0.02);
      scorchMat.alpha = 0.5;
      scorch.material = scorchMat;
      scorch.parent = root;
    }

    const eyes = this._addJudgeEyes(root, 4, { x: 5, z: 8 });
    return {
      root, roomLength: 9,
      entryPosition: shell.entryPosition, exitPosition: shell.exitPosition,
      scares: [
        { type: 'heavy', trigger: 'position', z: 3, sound: 'steamHiss' },
        { type: 'heavy', trigger: 'position', z: 6, sound: 'scareString' }
      ],
      hasSideRoom: false, eyes
    };
  }

  // ─── ROOM 9: Spice Gauntlet ───
  _room9_spiceGauntlet() {
    const shell = this._createRoomShell('spice', 4, 3, 10,
      new BABYLON.Color3(0.5, 0.4, 0.25));
    const { root } = shell;
    const particleSystems = [];
    root.metadata = { soundRefs: ['metalCreak'], particleSystems };

    this._addRoomLight(root, 0, 2.45, 0, new BABYLON.Color3(0.38, 0.78, 0.32), 1.25, 10);
    this._addWallStain(root, -1.89, 1.3, -2.1, 'left', new BABYLON.Color3(0.18, 0.15, 0.05));
    this._addWallStain(root, 1.89, 1.6, 2.5, 'right', new BABYLON.Color3(0.08, 0.18, 0.06));
    this._addCobweb(root, -1.7, 2.62, -4.45, 0.28);
    this._addCobweb(root, 1.45, 2.58, 4.05, 0.24);

    for (let side = -1; side <= 1; side += 2) {
      for (let z = -4; z <= 4; z += 2) {
        const shelf = BABYLON.MeshBuilder.CreateBox(`spiceShelf_${side}_${z}`, {
          width: 0.6, height: 2.5, depth: 0.4
        }, this.scene);
        shelf.position = new BABYLON.Vector3(side * 1.6, 1.25, z);
        shelf.material = this.materials.wood();
        shelf.parent = root;

        for (let j = 0; j < 3; j++) {
          const jarColors = [
            new BABYLON.Color3(0.7, 0.2, 0.1),
            new BABYLON.Color3(0.9, 0.75, 0.2),
            new BABYLON.Color3(0.25, 0.65, 0.2)
          ];
          const spiceJar = BABYLON.MeshBuilder.CreateCylinder(`spiceJar_${side}_${z}_${j}`, {
            diameter: 0.14, height: 0.28, tessellation: 10
          }, this.scene);
          spiceJar.position = new BABYLON.Vector3(side * 1.45, 0.55 + (j * 0.65), z + ((j - 1) * 0.12));
          spiceJar.material = this.materials.food(jarColors[j]);
          spiceJar.parent = root;
        }
      }
    }

    const dustEmitter = new BABYLON.TransformNode('spiceDustEmitter', this.scene);
    dustEmitter.position = new BABYLON.Vector3(0, 1.4, 0);
    dustEmitter.parent = root;
    const spiceDust = new BABYLON.ParticleSystem('spiceDust_0', 90, this.scene);
    spiceDust.emitter = dustEmitter;
    spiceDust.minLifeTime = 2.0;
    spiceDust.maxLifeTime = 3.5;
    spiceDust.minSize = 0.03;
    spiceDust.maxSize = 0.08;
    spiceDust.emitRate = 24;
    spiceDust.color1 = new BABYLON.Color4(0.8, 0.7, 0.35, 0.32);
    spiceDust.color2 = new BABYLON.Color4(0.4, 0.7, 0.25, 0.18);
    spiceDust.colorDead = new BABYLON.Color4(0.2, 0.2, 0.1, 0);
    spiceDust.direction1 = new BABYLON.Vector3(-0.05, 0.2, -0.05);
    spiceDust.direction2 = new BABYLON.Vector3(0.05, 0.5, 0.05);
    spiceDust.gravity = new BABYLON.Vector3(0, -0.08, 0);
    spiceDust.start();
    particleSystems.push(spiceDust);

    for (let i = 0; i < 3; i++) {
      const crack = BABYLON.MeshBuilder.CreateBox(`spiceCrack_${i}`, {
        width: 0.55, height: 0.01, depth: 0.03
      }, this.scene);
      crack.position = new BABYLON.Vector3(-0.9 + (i * 0.9), 0.01, -3 + (i * 2.6));
      crack.rotation.y = 0.4 - (i * 0.15);
      crack.material = this.materials.food(new BABYLON.Color3(0.07, 0.06, 0.03));
      crack.parent = root;
    }

    if (root.onDisposeObservable && root.onDisposeObservable.add) {
      root.onDisposeObservable.add(() => {
        particleSystems.forEach((ps) => ps.dispose());
      });
    }

    const eyes = this._addJudgeEyes(root, 4, { x: 3, z: 9 });
    return {
      root, roomLength: 10,
      entryPosition: shell.entryPosition, exitPosition: shell.exitPosition,
      scares: [{ type: 'heavy', trigger: 'middle', delay: 1500, sound: 'metalCreak' }],
      hasSideRoom: true, eyes
    };
  }

  // ─── ROOM 10: The Walk-In ───
  _room10_walkIn() {
    const shell = this._createRoomShell('walkin', 4, 3, 7,
      new BABYLON.Color3(0.15, 0.15, 0.18));
    const { root } = shell;
    const particleSystems = [];
    root.metadata = { soundRefs: ['doorSlam', 'jumpscareHit'], particleSystems };

    this._addRoomLight(root, 0, 2.5, -0.5, new BABYLON.Color3(0.62, 0.82, 1), 1.2, 9);
    this._addWallStain(root, -1.89, 1.4, -1.8, 'left', new BABYLON.Color3(0.12, 0.16, 0.18));
    this._addWallStain(root, 1.89, 1.7, 1.4, 'right', new BABYLON.Color3(0.08, 0.12, 0.18));
    this._addCobweb(root, -1.7, 2.64, -3.1, 0.28);
    this._addCobweb(root, 1.45, 2.58, 2.7, 0.24);

    for (let i = 0; i < 2; i++) {
      const ceilingPipe_walkin = BABYLON.MeshBuilder.CreateCylinder(`ceilingPipe_walkin_${i}`, {
        diameter: 0.09, height: 3.2, tessellation: 10
      }, this.scene);
      ceilingPipe_walkin.rotation.z = Math.PI / 2;
      ceilingPipe_walkin.position = new BABYLON.Vector3(0, 2.72, -1.8 + (i * 2.8));
      ceilingPipe_walkin.material = this.materials.metal();
      ceilingPipe_walkin.parent = root;
    }

    const doorFrame = BABYLON.MeshBuilder.CreateBox('walkInFrame', {
      width: 2.5, height: 3, depth: 0.3
    }, this.scene);
    doorFrame.position = new BABYLON.Vector3(0, 1.5, -3.3);
    doorFrame.material = this.materials.metal();
    doorFrame.parent = root;

    for (let i = 0; i < 4; i++) {
      const fogSheet = BABYLON.MeshBuilder.CreatePlane(`walkInFogPlane_${i}`, {
        width: 2.6, height: 1.8
      }, this.scene);
      fogSheet.position = new BABYLON.Vector3(0, 0.9 + ((i % 2) * 0.45), -2.2 + (i * 1.4));
      const fogMat = new BABYLON.StandardMaterial(`walkInFogMat_${i}`, this.scene);
      fogMat.diffuseColor = new BABYLON.Color3(0.75, 0.88, 1);
      fogMat.alpha = 0.14 + ((i % 2) * 0.04);
      fogMat.backFaceCulling = false;
      fogSheet.material = fogMat;
      fogSheet.parent = root;
    }

    for (let i = 0; i < 3; i++) {
      const hangingChain = BABYLON.MeshBuilder.CreateCylinder(`walkInChain_${i}`, {
        diameter: 0.04, height: 1.3 + (i * 0.25), tessellation: 6
      }, this.scene);
      hangingChain.position = new BABYLON.Vector3(-1 + (i * 1.0), 2.2, -1.2 + (i * 1.2));
      hangingChain.material = this.materials.metal();
      hangingChain.parent = root;
    }

    const breathEmitter = new BABYLON.TransformNode('walkInBreathEmitter', this.scene);
    breathEmitter.position = new BABYLON.Vector3(0, 1.35, 1.4);
    breathEmitter.parent = root;
    const walkInBreath = new BABYLON.ParticleSystem('walkInBreath_0', 70, this.scene);
    walkInBreath.emitter = breathEmitter;
    walkInBreath.minLifeTime = 1.2;
    walkInBreath.maxLifeTime = 2.4;
    walkInBreath.minSize = 0.06;
    walkInBreath.maxSize = 0.18;
    walkInBreath.emitRate = 14;
    walkInBreath.color1 = new BABYLON.Color4(0.85, 0.92, 1, 0.26);
    walkInBreath.color2 = new BABYLON.Color4(0.65, 0.8, 1, 0.12);
    walkInBreath.colorDead = new BABYLON.Color4(0.8, 0.9, 1, 0);
    walkInBreath.direction1 = new BABYLON.Vector3(-0.1, 0.2, 0.2);
    walkInBreath.direction2 = new BABYLON.Vector3(0.1, 0.45, 0.45);
    walkInBreath.gravity = new BABYLON.Vector3(0, 0.08, 0.12);
    walkInBreath.start();
    particleSystems.push(walkInBreath);

    if (root.onDisposeObservable && root.onDisposeObservable.add) {
      root.onDisposeObservable.add(() => {
        particleSystems.forEach((ps) => ps.dispose());
      });
    }

    const eyes = this._addJudgeEyes(root, 5, { x: 3.5, z: 6 });
    return {
      root, roomLength: 7,
      entryPosition: shell.entryPosition, exitPosition: shell.exitPosition,
      scares: [
        { type: 'heavy', trigger: 'enter', delay: 1000, sound: 'doorSlam' },
        { type: 'jumpscare', trigger: 'middle', delay: 3000, sound: 'jumpscareHit' }
      ],
      hasSideRoom: false, eyes
    };
  }

  // ─── ROOM 11: The Dumbwaiter ───
  _room11_dumbwaiter() {
    const shell = this._createRoomShell('dumbwaiter', 3, 4, 6,
      new BABYLON.Color3(0.25, 0.25, 0.28));
    const { root } = shell;
    root.metadata = { soundRefs: ['metalCreak'], cableSoundRef: 'metalCreak' };

    this._addRoomLight(root, 0, 3.15, 1.1, new BABYLON.Color3(0.95, 0.55, 0.12), 1.15, 8);
    this._addWallStain(root, -1.39, 1.7, -1.4, 'left', new BABYLON.Color3(0.12, 0.08, 0.03));
    this._addWallStain(root, 1.39, 1.2, 1.2, 'right', new BABYLON.Color3(0.18, 0.1, 0.04));
    this._addCobweb(root, -1.25, 3.35, -2.55, 0.22);
    this._addCobweb(root, 1.0, 3.28, 2.2, 0.18);

    for (let i = 0; i < 3; i++) {
      const cable = BABYLON.MeshBuilder.CreateCylinder(`cable_${i}`, {
        diameter: 0.03, height: 4, tessellation: 6
      }, this.scene);
      cable.position = new BABYLON.Vector3(-0.8 + i * 0.8, 2, 1);
      cable.material = this.materials.metal();
      cable.parent = root;

      const dumbSpark = BABYLON.MeshBuilder.CreateSphere(`dumbSpark_${i}`, {
        diameter: 0.09, segments: 6
      }, this.scene);
      dumbSpark.position = new BABYLON.Vector3(-0.8 + i * 0.8, 2.8 - (i * 0.35), 1.02);
      const sparkMat = new BABYLON.StandardMaterial(`dumbSparkMat_${i}`, this.scene);
      sparkMat.emissiveColor = new BABYLON.Color3(1, 0.65, 0.15);
      sparkMat.alpha = 0.78;
      dumbSpark.material = sparkMat;
      dumbSpark.parent = root;
    }

    for (let i = 0; i < 2; i++) {
      const cableCrack = BABYLON.MeshBuilder.CreateBox(`dumbCrack_${i}`, {
        width: 0.4, height: 0.01, depth: 0.03
      }, this.scene);
      cableCrack.position = new BABYLON.Vector3(-0.3 + (i * 0.6), 0.01, -0.6 + (i * 1.7));
      cableCrack.rotation.y = 0.35 + (i * 0.4);
      cableCrack.material = this.materials.food(new BABYLON.Color3(0.06, 0.05, 0.04));
      cableCrack.parent = root;
    }

    const box = BABYLON.MeshBuilder.CreateBox('dumbwaiterBox', {
      width: 1.2, height: 1.2, depth: 1.2
    }, this.scene);
    box.position = new BABYLON.Vector3(0, 2.5, 1);
    box.material = this.materials.metal();
    box.parent = root;

    const eyes = this._addJudgeEyes(root, 5, { x: 2.5, z: 5 });
    return {
      root, roomLength: 6,
      entryPosition: shell.entryPosition, exitPosition: shell.exitPosition,
      scares: [{ type: 'heavy', trigger: 'position', z: 2, sound: 'metalCreak' }],
      hasSideRoom: false, eyes
    };
  }

  // ─── ROOM 12: The Chase ───
  _room12_chase() {
    const shell = this._createRoomShell('chase', 4, 3.5, 30,
      new BABYLON.Color3(0.2, 0.18, 0.22));
    const { root } = shell;

    this._addWallStain(root, -1.89, 1.5, -6.2, 'left', new BABYLON.Color3(0.24, 0.05, 0.05));
    this._addWallStain(root, 1.89, 1.9, 8.4, 'right', new BABYLON.Color3(0.18, 0.04, 0.05));
    this._addCobweb(root, -1.75, 3.0, -14.0, 0.28);
    this._addCobweb(root, 1.5, 2.9, 12.4, 0.22);

    for (let i = 0; i < 4; i++) {
      this._addRoomLight(root, 0, 2.75, -10 + (i * 8), new BABYLON.Color3(0.85, 0.08, 0.08), 1.2, 8);
    }

    for (let i = 0; i < 3; i++) {
      const ceilingPipe_chase = BABYLON.MeshBuilder.CreateCylinder(`ceilingPipe_chase_${i}`, {
        diameter: 0.09, height: 5.5, tessellation: 10
      }, this.scene);
      ceilingPipe_chase.rotation.z = Math.PI / 2;
      ceilingPipe_chase.position = new BABYLON.Vector3(0, 3.15, -8 + (i * 10));
      ceilingPipe_chase.material = this.materials.metal();
      ceilingPipe_chase.parent = root;
    }

    const obstacles = [];
    for (let z = 0; z < 25; z += 3.5) {
      const type = Math.random() > 0.5 ? 'shelf' : 'pipe';
      const side = Math.random() > 0.5 ? 1 : -1;

      if (type === 'shelf') {
        const shelf = BABYLON.MeshBuilder.CreateBox(`chaseObs_${z}`, {
          width: 1.8, height: 1.5, depth: 0.4
        }, this.scene);
        shelf.position = new BABYLON.Vector3(side * 0.8, 0.75, z);
        shelf.material = this.materials.wood();
        shelf.parent = root;
        obstacles.push({ mesh: shelf, z, dodgeDir: side > 0 ? 'left' : 'right' });
      } else {
        const pipe = BABYLON.MeshBuilder.CreateCylinder(`chasePipe_${z}`, {
          diameter: 0.15, height: 4, tessellation: 8
        }, this.scene);
        pipe.rotation.z = Math.PI / 2;
        pipe.position = new BABYLON.Vector3(0, 1.5, z);
        pipe.material = this.materials.metal();
        pipe.parent = root;
        obstacles.push({ mesh: pipe, z, dodgeDir: 'duck' });
      }
    }

    for (let i = 0; i < 3; i++) {
      const chaseTable = BABYLON.MeshBuilder.CreateBox(`chaseTable_${i}`, {
        width: 1.6, height: 0.7, depth: 0.9
      }, this.scene);
      const z = 4 + (i * 7.5);
      const side = i % 2 === 0 ? -0.75 : 0.75;
      chaseTable.position = new BABYLON.Vector3(side, 0.45, z);
      chaseTable.rotation.z = i % 2 === 0 ? -0.55 : 0.55;
      chaseTable.rotation.x = 0.2;
      chaseTable.material = this.materials.wood();
      chaseTable.parent = root;
      obstacles.push({ mesh: chaseTable, z, dodgeDir: side < 0 ? 'right' : 'left' });
    }

    for (let i = 0; i < 6; i++) {
      const chaseCrack = BABYLON.MeshBuilder.CreateBox(`chaseCrack_${i}`, {
        width: 0.7, height: 0.01, depth: 0.03
      }, this.scene);
      chaseCrack.position = new BABYLON.Vector3((i % 2 === 0 ? -0.4 : 0.4), 0.01, -8 + (i * 6));
      chaseCrack.rotation.y = 0.3 + ((i % 3) * 0.2);
      chaseCrack.material = this.materials.food(new BABYLON.Color3(0.07, 0.03, 0.03));
      chaseCrack.parent = root;
    }

    const eyes = this._addJudgeEyes(root, 6, { x: 3.5, z: 28 });
    return {
      root, roomLength: 30, isChase: true,
      entryPosition: shell.entryPosition, exitPosition: shell.exitPosition,
      scares: [],
      obstacles,
      hasSideRoom: false, eyes
    };
  }

  // ─── ROOM 13: Judge's Corridor ───
  _room13_judgeCorridor() {
    const shell = this._createRoomShell('judgeCorridor', 4, 4, 10,
      new BABYLON.Color3(0.3, 0.1, 0.2));
    const { root } = shell;

    this._addWallStain(root, -1.89, 1.8, -2.5, 'left', new BABYLON.Color3(0.28, 0.05, 0.08));
    this._addWallStain(root, 1.89, 1.4, 2.2, 'right', new BABYLON.Color3(0.18, 0.05, 0.06));
    this._addCobweb(root, -1.72, 3.55, -4.3, 0.24);
    this._addCobweb(root, 1.46, 3.45, 4.0, 0.22);

    const wallGlow = new BABYLON.StandardMaterial('judgeWallGlow', this.scene);
    wallGlow.emissiveColor = new BABYLON.Color3(0.3, 0.05, 0.1);
    wallGlow.diffuseColor = new BABYLON.Color3(0.15, 0.05, 0.1);

    for (let z = -4; z <= 4; z += 1.5) {
      for (let side = -1; side <= 1; side += 2) {
        const panel = BABYLON.MeshBuilder.CreateBox(`judgePanel_${z}_${side}`, {
          width: 0.05, height: 1.5, depth: 1
        }, this.scene);
        panel.position = new BABYLON.Vector3(side * 1.9, 2, z);
        panel.material = wallGlow;
        panel.parent = root;
      }
    }

    for (let i = 0; i < 4; i++) {
      const z = -3.5 + (i * 2.3);
      for (const side of [-1, 1]) {
        const judgeTorch = BABYLON.MeshBuilder.CreateCylinder(`judgeTorch_${i}_${side}`, {
          diameterTop: 0, diameterBottom: 0.18, height: 0.35, tessellation: 8
        }, this.scene);
        judgeTorch.position = new BABYLON.Vector3(side * 1.72, 2.4, z);
        judgeTorch.rotation.z = side < 0 ? -Math.PI / 2 : Math.PI / 2;
        const torchMat = new BABYLON.StandardMaterial(`judgeTorchMat_${i}_${side}`, this.scene);
        torchMat.emissiveColor = new BABYLON.Color3(0.9, 0.45, 0.12);
        judgeTorch.material = torchMat;
        judgeTorch.parent = root;
        this._addRoomLight(root, side * 1.45, 2.45, z, new BABYLON.Color3(0.95, 0.45, 0.15), 1.05, 6);
      }
    }

    for (let i = 0; i < 3; i++) {
      const corridorCrack = BABYLON.MeshBuilder.CreateBox(`judgeCrack_${i}`, {
        width: 0.6, height: 0.01, depth: 0.03
      }, this.scene);
      corridorCrack.position = new BABYLON.Vector3(0, 0.01, -3 + (i * 2.6));
      corridorCrack.rotation.y = 0.7 - (i * 0.25);
      corridorCrack.material = this.materials.food(new BABYLON.Color3(0.08, 0.02, 0.04));
      corridorCrack.parent = root;
    }

    const eyes = this._addJudgeEyes(root, 9, { x: 3.5, z: 9 });
    return {
      root, roomLength: 10,
      entryPosition: shell.entryPosition, exitPosition: shell.exitPosition,
      scares: [],
      hasSideRoom: false, eyes
    };
  }

  // ─── ROOM 14: Judge's Chamber ───
  _room14_judgeChamber() {
    const shell = this._createRoomShell('judgeChamber', 8, 5, 10,
      new BABYLON.Color3(0.25, 0.08, 0.12));
    const { root } = shell;

    this._addRoomLight(root, 0, 3.9, 0.5, new BABYLON.Color3(1, 0.82, 0.55), 1.75, 13);
    this._addWallStain(root, -3.89, 2.2, -2.6, 'left', new BABYLON.Color3(0.22, 0.05, 0.08));
    this._addWallStain(root, 3.89, 2.6, 2.4, 'right', new BABYLON.Color3(0.14, 0.04, 0.06));
    this._addCobweb(root, -3.72, 4.45, -4.2, 0.34);
    this._addCobweb(root, 3.3, 4.3, 4.05, 0.28);

    const thronePositions = [
      new BABYLON.Vector3(-2.5, 0, 3),
      new BABYLON.Vector3(0, 0, 4),
      new BABYLON.Vector3(2.5, 0, 3)
    ];
    thronePositions.forEach((pos, i) => {
      const throne = BABYLON.MeshBuilder.CreateBox(`throne_${i}`, {
        width: 1.5, height: 3, depth: 1
      }, this.scene);
      throne.position = pos.add(new BABYLON.Vector3(0, 1.5, 0));
      const throneMat = new BABYLON.StandardMaterial(`throneMat_${i}`, this.scene);
      throneMat.diffuseColor = new BABYLON.Color3(0.15, 0.05, 0.08);
      throneMat.emissiveColor = new BABYLON.Color3(0.1, 0.02, 0.05);
      throne.material = throneMat;
      throne.parent = root;
    });

    const bloodCarpet = BABYLON.MeshBuilder.CreateDisc('judgeCarpet', {
      radius: 2.8, tessellation: 32
    }, this.scene);
    bloodCarpet.rotation.x = Math.PI / 2;
    bloodCarpet.position = new BABYLON.Vector3(0, 0.02, 1.4);
    const carpetMat = new BABYLON.StandardMaterial('judgeCarpetMat', this.scene);
    carpetMat.diffuseColor = new BABYLON.Color3(0.18, 0.03, 0.05);
    carpetMat.emissiveColor = new BABYLON.Color3(0.08, 0.01, 0.02);
    carpetMat.alpha = 0.55;
    bloodCarpet.material = carpetMat;
    bloodCarpet.parent = root;

    const pedestal = BABYLON.MeshBuilder.CreateCylinder('pedestal', {
      diameter: 1, height: 1.2, tessellation: 20
    }, this.scene);
    pedestal.position = new BABYLON.Vector3(0, 0.6, 0);
    pedestal.material = this.materials.metal();
    pedestal.parent = root;

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const candle = BABYLON.MeshBuilder.CreateCylinder(`candle_${i}`, {
        diameter: 0.06, height: 0.4, tessellation: 8
      }, this.scene);
      candle.position = new BABYLON.Vector3(
        Math.cos(angle) * 3.5, 0.2, Math.sin(angle) * 3.5 + 2
      );
      candle.material = this.materials.food(new BABYLON.Color3(0.9, 0.85, 0.7));
      candle.parent = root;

      const chamberCandleFlame = BABYLON.MeshBuilder.CreateSphere(`chamberCandleFlame_${i}`, {
        diameter: 0.08, segments: 6
      }, this.scene);
      chamberCandleFlame.position = candle.position.add(new BABYLON.Vector3(0, 0.26, 0));
      const flameMat = new BABYLON.StandardMaterial(`chamberCandleFlameMat_${i}`, this.scene);
      flameMat.emissiveColor = new BABYLON.Color3(1, 0.7, 0.22);
      chamberCandleFlame.material = flameMat;
      chamberCandleFlame.parent = root;
    }

    const dramaticBeam = BABYLON.MeshBuilder.CreateCylinder('judgeDramaticBeam', {
      diameterTop: 0.2, diameterBottom: 1.8, height: 3.5, tessellation: 20
    }, this.scene);
    dramaticBeam.position = new BABYLON.Vector3(0, 2.8, 0.4);
    dramaticBeam.rotation.x = Math.PI;
    const beamMat = new BABYLON.StandardMaterial('judgeDramaticBeamMat', this.scene);
    beamMat.emissiveColor = new BABYLON.Color3(0.6, 0.2, 0.28);
    beamMat.alpha = 0.12;
    dramaticBeam.material = beamMat;
    dramaticBeam.parent = root;

    const eyes = this._addJudgeEyes(root, 10, { x: 7, z: 9 });
    return {
      root, roomLength: 10, isJudgeChamber: true,
      entryPosition: shell.entryPosition, exitPosition: shell.exitPosition,
      scares: [],
      thronePositions,
      pedestal,
      hasSideRoom: false, eyes
    };
  }

  buildSideRoom(parentRoom, index) {
    const root = new BABYLON.TransformNode(`sideRoom_${index}`, this.scene);

    const shell = this._createRoomShell(`side_${index}`, 3, 3, 4,
      new BABYLON.Color3(0.2, 0.2, 0.25));
    shell.root.parent = root;

    const item = BABYLON.MeshBuilder.CreateBox(`sideItem_${index}`, {
      width: 0.5, height: 0.8, depth: 0.5
    }, this.scene);
    item.position = new BABYLON.Vector3(0, 0.4, 1);
    item.material = this.materials.food(new BABYLON.Color3(0.5, 0.2, 0.3));
    item.parent = root;

    const eyes = this._addJudgeEyes(root, 3, { x: 2.5, z: 3.5 });
    return {
      root, roomLength: 4,
      scares: [{ type: 'light', trigger: 'enter', delay: 1500, sound: 'whisper' }],
      eyes
    };
  }

  disposeRoom(roomData) {
    if (roomData && roomData.root) {
      roomData.root.dispose(false, true);
    }
  }
}

window.RoomBuilder = RoomBuilder;
