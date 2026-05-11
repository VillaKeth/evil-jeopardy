// Evil Jeopardy 1.2 — Particle System Presets

class ParticlePresets {
  static steam(scene, emitter, options = {}) {
    const ps = new BABYLON.ParticleSystem('steam', 50, scene);
    ps.createPointEmitter(
      new BABYLON.Vector3(-0.1, 1, -0.1),
      new BABYLON.Vector3(0.1, 1.5, 0.1)
    );
    ps.emitter = emitter;
    ps.minLifeTime = 0.8;
    ps.maxLifeTime = 2.0;
    ps.minSize = 0.05;
    ps.maxSize = 0.2;
    ps.emitRate = options.rate || 15;
    ps.color1 = new BABYLON.Color4(1, 1, 1, 0.4);
    ps.color2 = new BABYLON.Color4(0.9, 0.9, 0.95, 0.1);
    ps.colorDead = new BABYLON.Color4(1, 1, 1, 0);
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    ps.gravity = new BABYLON.Vector3(0, 0.5, 0);
    return ps;
  }

  static flourDust(scene, emitter, options = {}) {
    const ps = new BABYLON.ParticleSystem('flour', 100, scene);
    ps.createPointEmitter(
      new BABYLON.Vector3(-0.3, 0, -0.3),
      new BABYLON.Vector3(0.3, 0.5, 0.3)
    );
    ps.emitter = emitter;
    ps.minLifeTime = 0.5;
    ps.maxLifeTime = 1.5;
    ps.minSize = 0.02;
    ps.maxSize = 0.08;
    ps.emitRate = options.rate || 40;
    ps.color1 = new BABYLON.Color4(1, 0.98, 0.9, 0.6);
    ps.color2 = new BABYLON.Color4(0.95, 0.92, 0.85, 0.2);
    ps.colorDead = new BABYLON.Color4(1, 1, 1, 0);
    ps.gravity = new BABYLON.Vector3(0, -0.3, 0);
    return ps;
  }

  static sparkles(scene, emitter, options = {}) {
    const ps = new BABYLON.ParticleSystem('sparkles', 60, scene);
    ps.createPointEmitter(
      new BABYLON.Vector3(-0.5, 0.5, -0.5),
      new BABYLON.Vector3(0.5, 2, 0.5)
    );
    ps.emitter = emitter;
    ps.minLifeTime = 0.3;
    ps.maxLifeTime = 1.0;
    ps.minSize = 0.02;
    ps.maxSize = 0.06;
    ps.emitRate = options.rate || 20;
    ps.color1 = new BABYLON.Color4(1, 0.9, 0.3, 1);
    ps.color2 = new BABYLON.Color4(1, 0.7, 0.1, 0.5);
    ps.colorDead = new BABYLON.Color4(1, 1, 0.5, 0);
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    return ps;
  }

  static confetti(scene, emitter, options = {}) {
    const ps = new BABYLON.ParticleSystem('confetti', 200, scene);
    ps.createPointEmitter(
      new BABYLON.Vector3(-2, 3, -2),
      new BABYLON.Vector3(2, 5, 2)
    );
    ps.emitter = emitter;
    ps.minLifeTime = 2;
    ps.maxLifeTime = 4;
    ps.minSize = 0.03;
    ps.maxSize = 0.08;
    ps.emitRate = options.rate || 80;
    ps.color1 = new BABYLON.Color4(1, 0.2, 0.3, 1);
    ps.color2 = new BABYLON.Color4(0.2, 0.5, 1, 1);
    ps.colorDead = new BABYLON.Color4(0, 0, 0, 0);
    ps.gravity = new BABYLON.Vector3(0, -2, 0);
    ps.minAngularSpeed = -Math.PI;
    ps.maxAngularSpeed = Math.PI;
    return ps;
  }

  static splatter(scene, position, color, options = {}) {
    const ps = new BABYLON.ParticleSystem('splatter', 30, scene);
    ps.createSphereEmitter(0.1);
    ps.emitter = position;
    ps.minLifeTime = 0.3;
    ps.maxLifeTime = 0.8;
    ps.minSize = 0.02;
    ps.maxSize = 0.06;
    ps.manualEmitCount = options.count || 30;
    ps.emitRate = 0;
    ps.color1 = new BABYLON.Color4(color.r, color.g, color.b, 0.8);
    ps.color2 = new BABYLON.Color4(color.r * 0.8, color.g * 0.8, color.b * 0.8, 0.4);
    ps.colorDead = new BABYLON.Color4(color.r, color.g, color.b, 0);
    ps.gravity = new BABYLON.Vector3(0, -3, 0);
    ps.minEmitPower = 1;
    ps.maxEmitPower = 3;
    return ps;
  }

  static fire(scene, emitter, options = {}) {
    const ps = new BABYLON.ParticleSystem('fire', 80, scene);
    ps.createConeEmitter(0.1, Math.PI / 8);
    ps.emitter = emitter;
    ps.minLifeTime = 0.2;
    ps.maxLifeTime = 0.6;
    ps.minSize = 0.05;
    ps.maxSize = 0.15;
    ps.emitRate = options.rate || 40;
    ps.color1 = new BABYLON.Color4(1, 0.6, 0.1, 1);
    ps.color2 = new BABYLON.Color4(1, 0.2, 0, 0.5);
    ps.colorDead = new BABYLON.Color4(0.2, 0.2, 0.2, 0);
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    ps.gravity = new BABYLON.Vector3(0, 2, 0);
    return ps;
  }
}

window.ParticlePresets = ParticlePresets;
