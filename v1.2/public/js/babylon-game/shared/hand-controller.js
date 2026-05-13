// Evil Jeopardy 1.2 — Shared Hand Controller

class HandController3D {
  constructor(scene, materials) {
    this.scene = scene;
    this.materials = materials || null;
    this.skinColor = new BABYLON.Color3(0.96, 0.80, 0.69);
    this._ownsMaterial = !(this.materials && typeof this.materials.food === 'function');
    this.skinMaterial = this._createSkinMaterial();

    this.activeSide = 'right';
    this.gripModifier = 1.0;
    this.gripStrength = 0;

    this.fingerTargets = {
      left: [0, 0, 0, 0, 0],
      right: [0, 0, 0, 0, 0]
    };
    this.fingerStates = {
      left: [0, 0, 0, 0, 0],
      right: [0, 0, 0, 0, 0]
    };

    this.heldMesh = null;
    this.heldSide = null;

    this._keyMap = {
      a: 0,
      s: 1,
      d: 2,
      f: 3,
      g: 4
    };

    this._onKeyDown = null;
    this._onKeyUp = null;
    this._inputBound = false;

    this.hands = {
      left: this._buildHand('left'),
      right: this._buildHand('right')
    };

    this._setHandVisible('left', false);
    this._setHandVisible('right', true);
  }

  _createSkinMaterial() {
    if (this.materials && typeof this.materials.food === 'function') {
      return this.materials.food(this.skinColor);
    }

    const material = new BABYLON.StandardMaterial('handControllerSkin', this.scene);
    material.diffuseColor = this.skinColor;
    material.specularColor = new BABYLON.Color3(0.15, 0.12, 0.1);
    return material;
  }

  _buildHand(side) {
    const sideSign = side === 'right' ? 1 : -1;
    const hand = {
      side,
      root: new BABYLON.TransformNode(`handController_${side}_root`, this.scene),
      meshes: [],
      fingers: []
    };

    const palm = BABYLON.MeshBuilder.CreateBox(`handController_${side}_palm`, {
      width: 0.35,
      height: 0.08,
      depth: 0.3
    }, this.scene);
    palm.parent = hand.root;
    hand.palm = this._registerHandMesh(hand, palm);
    this._addPalmEdgeSphere(hand, 'wristEdge', -0.09, -0.12, 0.11);
    this._addPalmEdgeSphere(hand, 'wristEdgeRight', 0.09, -0.12, 0.11);
    this._addPalmEdgeSphere(hand, 'knuckleEdge', -0.09, 0.12, 0.11);
    this._addPalmEdgeSphere(hand, 'knuckleEdgeRight', 0.09, 0.12, 0.11);

    const fingerXs = [0.11, 0.04, -0.04, -0.11].map((value) => value * sideSign);
    const fingerLengths = [
      { name: 'index', proximalLength: 0.17, distalLength: 0.13, width: 0.048, height: 0.05 },
      { name: 'middle', proximalLength: 0.19, distalLength: 0.14, width: 0.052, height: 0.052 },
      { name: 'ring', proximalLength: 0.17, distalLength: 0.125, width: 0.048, height: 0.048 },
      { name: 'pinky', proximalLength: 0.13, distalLength: 0.1, width: 0.042, height: 0.044 }
    ];

    hand.fingers.push(this._buildFinger(hand, 0, {
      name: 'thumb',
      maxCurl: 1.0,
      proximalLength: 0.11,
      distalLength: 0.09,
      width: 0.055,
      height: 0.05,
      position: new BABYLON.Vector3(0.205 * sideSign, -0.01, 0.025),
      anchorRotation: new BABYLON.Vector3(0, side === 'right' ? Math.PI / 2.2 : -Math.PI / 2.2, side === 'right' ? -0.45 : 0.45)
    }));

    fingerLengths.forEach((config, index) => {
      hand.fingers.push(this._buildFinger(hand, index + 1, {
        name: config.name,
        maxCurl: 1.4,
        proximalLength: config.proximalLength,
        distalLength: config.distalLength,
        width: config.width,
        height: config.height,
        position: new BABYLON.Vector3(fingerXs[index], 0.015, 0.16),
        anchorRotation: BABYLON.Vector3.Zero()
      }));
    });

    return hand;
  }

  _registerHandMesh(hand, mesh) {
    mesh.material = this.skinMaterial;
    mesh.isPickable = false;
    hand.meshes.push(mesh);
    return mesh;
  }

  _addPalmEdgeSphere(hand, name, x, z, diameter) {
    const edge = BABYLON.MeshBuilder.CreateSphere(`handController_${hand.side}_${name}`, {
      diameter,
      segments: 8
    }, this.scene);
    edge.parent = hand.root;
    edge.position = new BABYLON.Vector3(x, 0, z);
    return this._registerHandMesh(hand, edge);
  }

  _buildFinger(hand, index, config) {
    const anchor = new BABYLON.TransformNode(`handController_${hand.side}_${config.name}_anchor`, this.scene);
    anchor.parent = hand.root;
    anchor.position.copyFrom(config.position);
    anchor.rotation.copyFrom(config.anchorRotation);

    const proximalPivot = new BABYLON.TransformNode(`handController_${hand.side}_${config.name}_proximalPivot`, this.scene);
    proximalPivot.parent = anchor;

    const baseKnuckle = BABYLON.MeshBuilder.CreateSphere(`handController_${hand.side}_${config.name}_baseKnuckle`, {
      diameter: config.width * 1.1,
      segments: 8
    }, this.scene);
    baseKnuckle.parent = proximalPivot;
    baseKnuckle.position.z = 0;
    this._registerHandMesh(hand, baseKnuckle);

    const proximal = BABYLON.MeshBuilder.CreateCylinder(`handController_${hand.side}_${config.name}_proximal`, {
      diameterTop: config.width * 0.85,
      diameterBottom: config.width,
      height: config.proximalLength,
      tessellation: 12
    }, this.scene);
    proximal.parent = proximalPivot;
    proximal.rotation.x = Math.PI / 2;
    proximal.position.z = config.proximalLength * 0.5;
    this._registerHandMesh(hand, proximal);

    const distalPivot = new BABYLON.TransformNode(`handController_${hand.side}_${config.name}_distalPivot`, this.scene);
    distalPivot.parent = proximalPivot;
    distalPivot.position.z = config.proximalLength;

    const middleKnuckle = BABYLON.MeshBuilder.CreateSphere(`handController_${hand.side}_${config.name}_middleKnuckle`, {
      diameter: config.width,
      segments: 8
    }, this.scene);
    middleKnuckle.parent = distalPivot;
    middleKnuckle.position.z = 0;
    this._registerHandMesh(hand, middleKnuckle);

    const distal = BABYLON.MeshBuilder.CreateCylinder(`handController_${hand.side}_${config.name}_distal`, {
      diameterTop: config.width * 0.7,
      diameterBottom: config.width * 0.85,
      height: config.distalLength,
      tessellation: 12
    }, this.scene);
    distal.parent = distalPivot;
    distal.rotation.x = Math.PI / 2;
    distal.position.z = config.distalLength * 0.5;
    this._registerHandMesh(hand, distal);

    const tip = BABYLON.MeshBuilder.CreateSphere(`handController_${hand.side}_${config.name}_tip`, {
      diameter: config.width * 0.7,
      segments: 8
    }, this.scene);
    tip.parent = distalPivot;
    tip.position.z = config.distalLength;
    this._registerHandMesh(hand, tip);

    return {
      index,
      name: config.name,
      maxCurl: config.maxCurl,
      anchor,
      proximalPivot,
      distalPivot,
      proximal,
      distal,
      baseKnuckle,
      middleKnuckle,
      tip,
      curlAngle: 0
    };
  }

  _setHandVisible(side, visible) {
    const hand = this.hands[side];
    if (!hand) return;
    hand.meshes.forEach((mesh) => mesh.setEnabled(visible));
  }

  _resetHand(side, immediate) {
    this.fingerTargets[side] = [0, 0, 0, 0, 0];
    this.fingerStates[side] = [0, 0, 0, 0, 0];

    if (immediate && this.hands[side]) {
      this.hands[side].fingers.forEach((finger) => {
        finger.curlAngle = 0;
        finger.proximalPivot.rotation.x = 0;
        finger.distalPivot.rotation.x = 0;
      });
    }
  }

  _switchHand() {
    const previousSide = this.activeSide;
    const nextSide = previousSide === 'right' ? 'left' : 'right';
    const previousHand = this.hands[previousSide];
    const nextHand = this.hands[nextSide];

    if (this.heldMesh) {
      this._dropObject(false);
    }

    nextHand.root.position.copyFrom(previousHand.root.position);
    nextHand.root.rotation.copyFrom(previousHand.root.rotation);

    this._resetHand(previousSide, true);
    this._setHandVisible(previousSide, false);
    this.activeSide = nextSide;
    this._setHandVisible(nextSide, true);
    this._updateGripMetrics();
    this._playClick();
  }

  _playClick() {
    if (window.gameSounds && typeof window.gameSounds.click === 'function') {
      window.gameSounds.click();
    }
  }

  _playMiss() {
    if (window.gameSounds && typeof window.gameSounds.miss === 'function') {
      window.gameSounds.miss();
    }
  }

  _countCurledFingers(side) {
    const states = this.fingerStates[side] || [];
    let count = 0;
    for (let i = 0; i < states.length; i += 1) {
      count += states[i] ? 1 : 0;
    }
    return count;
  }

  _getGripThreshold() {
    if (this.gripModifier >= 1) {
      return 3;
    }

    const modifier = Math.max(0.01, this.gripModifier);
    return Math.min(5, Math.ceil(3 / modifier));
  }

  _updateGripMetrics() {
    const curledCount = this._countCurledFingers(this.activeSide);
    this.gripStrength = curledCount / 5;
    return curledCount;
  }

  _captureWorldTransform(mesh) {
    const scaling = new BABYLON.Vector3();
    const rotation = new BABYLON.Quaternion();
    const position = new BABYLON.Vector3();
    mesh.computeWorldMatrix(true).decompose(scaling, rotation, position);
    return { scaling, rotation, position };
  }

  bindInput() {
    if (this._inputBound) {
      return;
    }

    this._onKeyDown = (event) => {
      if (!this.hands) return;
      const key = (event.key || '').toLowerCase();

      if (event.code === 'Space' || key === ' ' || key === 'spacebar') {
        event.preventDefault();
        if (!event.repeat) {
          this._switchHand();
        }
        return;
      }

      const fingerIndex = this._keyMap[key];
      if (fingerIndex === undefined) {
        return;
      }

      event.preventDefault();
      this.fingerTargets[this.activeSide][fingerIndex] = 1;
    };

    this._onKeyUp = (event) => {
      if (!this.hands) return;
      const key = (event.key || '').toLowerCase();
      const fingerIndex = this._keyMap[key];
      if (fingerIndex === undefined) {
        return;
      }

      event.preventDefault();
      this.fingerTargets[this.activeSide][fingerIndex] = 0;
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    this._inputBound = true;
  }

  update(dt) {
    if (!this.hands) return;
    const amount = BABYLON.Scalar.Clamp((dt || 0) * 10, 0, 1);

    ['left', 'right'].forEach((side) => {
      const targets = this.fingerTargets[side];
      this.hands[side].fingers.forEach((finger, index) => {
        const targetAngle = targets[index] ? finger.maxCurl : 0;
        finger.curlAngle = BABYLON.Scalar.Lerp(finger.curlAngle, targetAngle, amount);

        if (Math.abs(finger.curlAngle - targetAngle) < 0.001) {
          finger.curlAngle = targetAngle;
        }

        finger.proximalPivot.rotation.x = -finger.curlAngle;
        finger.distalPivot.rotation.x = -(finger.curlAngle * 0.7);
        this.fingerStates[side][index] = finger.curlAngle > (finger.maxCurl * 0.6) ? 1 : 0;
      });
    });

    const activeCurlCount = this._updateGripMetrics();
    if (this.heldMesh && activeCurlCount < 2) {
      this._dropObject();
    }
  }

  setPosition(x, y, z) {
    this.hands[this.activeSide].root.position.set(x, y, z);
  }

  setTilt(angle) {
    this.hands[this.activeSide].root.rotation.x = angle;
  }

  getTiltAngle() {
    return this.hands[this.activeSide].root.rotation.x;
  }

  canGrip() {
    const curledCount = this._updateGripMetrics();
    return curledCount >= this._getGripThreshold();
  }

  tryGrab(mesh) {
    if (!mesh || this.heldMesh || !this.canGrip()) {
      return false;
    }

    const handRoot = this.hands[this.activeSide].root;
    const handPosition = handRoot.getAbsolutePosition();
    const meshPosition = mesh.getAbsolutePosition();
    if (BABYLON.Vector3.Distance(handPosition, meshPosition) > 1.0) {
      return false;
    }

    if (typeof mesh.setParent === 'function') {
      mesh.setParent(handRoot);
    } else {
      mesh.parent = handRoot;
    }

    this.heldMesh = mesh;
    this.heldSide = this.activeSide;
    this._playClick();
    return true;
  }

  _dropObject(playSound = true) {
    if (!this.heldMesh) {
      return;
    }

    const mesh = this.heldMesh;
    const world = this._captureWorldTransform(mesh);

    if (typeof mesh.setParent === 'function') {
      mesh.setParent(null);
    } else {
      mesh.parent = null;
    }

    mesh.position.copyFrom(world.position);
    if (mesh.rotationQuaternion) {
      mesh.rotationQuaternion.copyFrom(world.rotation);
    } else {
      mesh.rotation = world.rotation.toEulerAngles();
    }
    mesh.scaling.copyFrom(world.scaling);

    this.heldMesh = null;
    this.heldSide = null;

    if (playSound) {
      this._playMiss();
    }
  }

  isHolding() {
    return !!this.heldMesh;
  }

  drop(playSound) {
    this._dropObject(playSound);
  }

  dispose() {
    if (this._inputBound) {
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
    }

    if (this.heldMesh) {
      this._dropObject(false);
    }

    ['left', 'right'].forEach((side) => {
      const hand = this.hands[side];
      if (!hand) return;
      hand.root.dispose(false, false);
      hand.meshes = null;
      hand.fingers = null;
    });

    if (this._ownsMaterial && this.skinMaterial) {
      this.skinMaterial.dispose();
    }

    this._onKeyDown = null;
    this._onKeyUp = null;
    this._inputBound = false;
    this.hands = null;
    this.fingerTargets = null;
    this.fingerStates = null;
    this.heldMesh = null;
    this.heldSide = null;
    this.scene = null;
    this.materials = null;
    this.skinMaterial = null;
  }
}

window.HandController3D = HandController3D;
