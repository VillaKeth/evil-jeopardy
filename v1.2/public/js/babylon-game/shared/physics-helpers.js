// Evil Jeopardy 1.2 — Havok Physics Helpers

class PhysicsHelpers {
  static async initHavok(scene) {
    const havok = await HavokPhysics();
    const plugin = new BABYLON.HavokPlugin(true, havok);
    scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), plugin);
    return plugin;
  }

  static addStaticBody(mesh, scene) {
    const aggregate = new BABYLON.PhysicsAggregate(
      mesh,
      BABYLON.PhysicsShapeType.MESH,
      { mass: 0, restitution: 0.2 },
      scene
    );
    return aggregate;
  }

  static addDynamicBody(mesh, scene, options = {}) {
    const aggregate = new BABYLON.PhysicsAggregate(
      mesh,
      options.shapeType || BABYLON.PhysicsShapeType.BOX,
      {
        mass: options.mass || 1,
        restitution: options.restitution || 0.3,
        friction: options.friction || 0.5
      },
      scene
    );
    return aggregate;
  }

  static applyImpulse(aggregate, direction, magnitude) {
    const impulse = direction.normalize().scale(magnitude);
    aggregate.body.applyImpulse(
      impulse,
      aggregate.body.getObjectCenterWorld()
    );
  }

  static setGravity(scene, direction) {
    const engine = scene.getPhysicsEngine();
    if (engine) {
      engine.setGravity(direction);
    }
  }

  static flipGravity(scene) {
    const engine = scene.getPhysicsEngine();
    if (!engine) return;
    const current = engine.gravity;
    engine.setGravity(current.scale(-1));
  }
}

window.PhysicsHelpers = PhysicsHelpers;
