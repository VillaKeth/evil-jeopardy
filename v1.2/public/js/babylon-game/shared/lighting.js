// Evil Jeopardy 1.2 — Kitchen Lighting Rigs

class KitchenLighting {
  static setupNormal(scene) {
    const key = new BABYLON.DirectionalLight(
      'keyLight',
      new BABYLON.Vector3(-1, -2, 1),
      scene
    );
    key.intensity = 0.9;
    key.diffuse = new BABYLON.Color3(1, 0.95, 0.85);

    const fill = new BABYLON.HemisphericLight(
      'fillLight',
      new BABYLON.Vector3(0, 1, 0),
      scene
    );
    fill.intensity = 0.4;
    fill.diffuse = new BABYLON.Color3(0.9, 0.9, 1.0);
    fill.groundColor = new BABYLON.Color3(0.3, 0.25, 0.2);

    const rim = new BABYLON.PointLight(
      'rimLight',
      new BABYLON.Vector3(3, 4, -3),
      scene
    );
    rim.intensity = 0.3;
    rim.diffuse = new BABYLON.Color3(1, 0.9, 0.7);

    return { key, fill, rim };
  }

  static setupCreepy(scene) {
    const key = new BABYLON.DirectionalLight(
      'keyLight',
      new BABYLON.Vector3(-0.5, -3, 0.5),
      scene
    );
    key.intensity = 0.6;
    key.diffuse = new BABYLON.Color3(0.4, 0.9, 0.3);

    const fill = new BABYLON.HemisphericLight(
      'fillLight',
      new BABYLON.Vector3(0, 1, 0),
      scene
    );
    fill.intensity = 0.2;
    fill.diffuse = new BABYLON.Color3(0.5, 0.3, 0.7);
    fill.groundColor = new BABYLON.Color3(0.1, 0.05, 0.15);

    const flicker = new BABYLON.PointLight(
      'flickerLight',
      new BABYLON.Vector3(0, 3, 0),
      scene
    );
    flicker.intensity = 0.5;
    flicker.diffuse = new BABYLON.Color3(0.8, 1.0, 0.6);

    scene.registerBeforeRender(() => {
      flicker.intensity = 0.3 + Math.random() * 0.4;
    });

    return { key, fill, flicker };
  }
}

window.KitchenLighting = KitchenLighting;
