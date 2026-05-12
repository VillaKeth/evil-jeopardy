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

    // Back wall with doorway opening (1.5m wide, 2.5m tall gap in center)
    const doorW = 1.5;
    const doorH = Math.min(2.5, height - 0.3);
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
    // Lintel above doorway
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

  // ─── ROOM 1: Dark Pantry ───
  _room1_darkPantry() {
    const shell = this._createRoomShell('pantry', 5, 3.5, 8,
      new BABYLON.Color3(0.4, 0.35, 0.3));
    const { root } = shell;

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

    // Giant pots
    for (let i = 0; i < 3; i++) {
      const pot = BABYLON.MeshBuilder.CreateCylinder(`pot_${i}`, {
        diameter: 1.2, height: 0.9, tessellation: 20
      }, this.scene);
      pot.position = new BABYLON.Vector3(-1.5 + i * 1.5, 0.45, 1 + i * 1.8);
      pot.material = this.materials.metal();
      pot.parent = root;

      // "Steam" placeholder
      const steam = BABYLON.MeshBuilder.CreateSphere(`steam_${i}`, {
        diameter: 0.6, segments: 8
      }, this.scene);
      steam.position = new BABYLON.Vector3(pot.position.x, 1.2, pot.position.z);
      const steamMat = new BABYLON.StandardMaterial(`steamMat_${i}`, this.scene);
      steamMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
      steamMat.alpha = 0.3;
      steam.material = steamMat;
      steam.parent = root;
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

    // Hanging shapes (hooks + meat-like forms)
    for (let i = 0; i < 5; i++) {
      const hookRoot = new BABYLON.TransformNode(`hook_${i}`, this.scene);
      hookRoot.parent = root;
      hookRoot.position = new BABYLON.Vector3(
        (Math.random() - 0.5) * 3.5,
        3.2,
        -3 + i * 1.6
      );

      // Hook
      const hook = BABYLON.MeshBuilder.CreateTorus(`hookMesh_${i}`, {
        diameter: 0.2, thickness: 0.03, tessellation: 12
      }, this.scene);
      hook.parent = hookRoot;
      hook.material = this.materials.metal();

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
}

window.RoomBuilder = RoomBuilder;
