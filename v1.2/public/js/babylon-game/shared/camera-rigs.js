// Evil Jeopardy 1.2 — Camera Rig Presets

class CameraRigs {
  static topDown(scene, canvas, options = {}) {
    const camera = new BABYLON.ArcRotateCamera(
      'topDownCam',
      -Math.PI / 2,
      Math.PI / 4,
      options.distance || 8,
      options.target || BABYLON.Vector3.Zero(),
      scene
    );
    camera.lowerBetaLimit = Math.PI / 6;
    camera.upperBetaLimit = Math.PI / 3;
    camera.lowerRadiusLimit = options.minZoom || 5;
    camera.upperRadiusLimit = options.maxZoom || 12;
    camera.attachControl(canvas, true);
    camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
    return camera;
  }

  static orbit(scene, canvas, options = {}) {
    const camera = new BABYLON.ArcRotateCamera(
      'orbitCam',
      options.alpha || 0,
      options.beta || Math.PI / 3,
      options.distance || 10,
      options.target || BABYLON.Vector3.Zero(),
      scene
    );
    camera.attachControl(canvas, true);
    return camera;
  }

  static fixed(scene, position, target) {
    const camera = new BABYLON.FreeCamera(
      'fixedCam',
      position || new BABYLON.Vector3(0, 5, -8),
      scene
    );
    camera.setTarget(target || BABYLON.Vector3.Zero());
    return camera;
  }

  static isometric(scene, canvas, options = {}) {
    const camera = new BABYLON.ArcRotateCamera(
      'isoCam',
      Math.PI / 4,
      Math.PI / 3,
      options.distance || 15,
      options.target || BABYLON.Vector3.Zero(),
      scene
    );
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    const aspect = scene.getEngine().getAspectRatio(camera);
    const size = options.orthoSize || 6;
    camera.orthoLeft = -size * aspect;
    camera.orthoRight = size * aspect;
    camera.orthoTop = size;
    camera.orthoBottom = -size;
    camera.inputs.clear();
    return camera;
  }

  static dramaticReveal(scene, target, options = {}) {
    const camera = new BABYLON.ArcRotateCamera(
      'revealCam',
      0,
      Math.PI / 3,
      options.startDistance || 15,
      target || BABYLON.Vector3.Zero(),
      scene
    );

    const anim = new BABYLON.Animation(
      'revealOrbit',
      'alpha',
      30,
      BABYLON.Animation.ANIMATIONTYPE_FLOAT,
      BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
    );
    anim.setKeys([
      { frame: 0, value: 0 },
      { frame: 150, value: Math.PI * 2 }
    ]);
    camera.animations = [anim];

    return {
      camera,
      play: () => scene.beginAnimation(camera, 0, 150, true)
    };
  }
}

window.CameraRigs = CameraRigs;
