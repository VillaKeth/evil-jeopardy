// Evil Jeopardy 1.2 — ResultScene3D (Cake Reveal & Score Display)
// Standalone display scene — NOT a minigame. No timer, no scoring.

class ResultScene3D {
  constructor(engine, canvas, socketBridge, options = {}) {
    this.babylonEngine = engine;
    this.canvas = canvas;
    this.options = options;
    this.scene = null;
    this._disposed = false;
  }

  getPhaseName() { return 'RESULT'; }

  async init() {
    this.scene = new BABYLON.Scene(this.babylonEngine);
    this.scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.05, 1);
    await this.create();
  }

  async create() {
    // Dramatic spotlight
    const spotlight = new BABYLON.SpotLight(
      'spotlight',
      new BABYLON.Vector3(0, 8, 0),
      new BABYLON.Vector3(0, -1, 0),
      Math.PI / 4,
      2,
      this.scene
    );
    spotlight.intensity = 1.5;
    spotlight.diffuse = new BABYLON.Color3(1, 0.95, 0.8);

    // Ambient fill
    const ambient = new BABYLON.HemisphericLight('ambient', new BABYLON.Vector3(0, 1, 0), this.scene);
    ambient.intensity = 0.15;
    ambient.diffuse = new BABYLON.Color3(0.5, 0.5, 0.7);

    // Presentation table
    const table = BABYLON.MeshBuilder.CreateCylinder('table', {
      diameter: 3, height: 0.2, tessellation: 32
    }, this.scene);
    table.position.y = -0.5;
    const tableMat = new BABYLON.PBRMaterial('tableMat', this.scene);
    tableMat.albedoColor = new BABYLON.Color3(0.15, 0.12, 0.1);
    tableMat.metallic = 0.3;
    tableMat.roughness = 0.6;
    table.material = tableMat;

    // Cake (placeholder cylinder with frosting)
    const cake = BABYLON.MeshBuilder.CreateCylinder('cake', {
      diameter: 1.8, height: 1.2, tessellation: 32
    }, this.scene);
    cake.position.y = 0.3;
    const cakeMat = new BABYLON.PBRMaterial('cakeMat', this.scene);
    cakeMat.albedoColor = new BABYLON.Color3(0.9, 0.75, 0.45);
    cakeMat.metallic = 0;
    cakeMat.roughness = 0.95;
    cake.material = cakeMat;

    // Frosting layer
    const frosting = BABYLON.MeshBuilder.CreateCylinder('frosting', {
      diameter: 1.9, height: 0.15, tessellation: 32
    }, this.scene);
    frosting.position.y = 0.95;
    const frostMat = new BABYLON.PBRMaterial('frostMat', this.scene);
    frostMat.albedoColor = new BABYLON.Color3(1, 0.85, 0.9);
    frostMat.metallic = 0.1;
    frostMat.roughness = 0.3;
    frosting.material = frostMat;

    // Dramatic orbiting camera
    const { camera, play } = CameraRigs.dramaticReveal(this.scene, new BABYLON.Vector3(0, 0.5, 0), {
      startDistance: 6
    });
    play();

    // Score GUI overlay
    const gui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI('resultUI', true, this.scene);
    this._gui = gui;

    const scores = this.options.scores || {};
    const categories = [
      { label: 'Taste', value: scores.taste || 0 },
      { label: 'Accuracy', value: scores.accuracy || 0 },
      { label: 'Creativity', value: scores.creativity || 0 }
    ];
    const total = categories.reduce((sum, c) => sum + c.value, 0);

    // Stagger score display
    for (let i = 0; i < categories.length; i++) {
      await new Promise(r => setTimeout(r, 800));
      if (this._disposed) return;

      const cat = categories[i];
      const text = new BABYLON.GUI.TextBlock(`score${i}`, `${cat.label}: ${cat.value}/100`);
      text.color = '#ffffff';
      text.fontSize = 28;
      text.top = `${-120 + i * 50}px`;
      text.left = '-300px';
      text.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      text.paddingLeft = '40px';
      text.outlineWidth = 2;
      text.outlineColor = '#000000';
      gui.addControl(text);
    }

    // Total after a pause
    await new Promise(r => setTimeout(r, 1200));
    if (this._disposed) return;

    const totalText = new BABYLON.GUI.TextBlock('total', `TOTAL: ${total}/300`);
    totalText.color = '#ffd700';
    totalText.fontSize = 36;
    totalText.top = `${-120 + categories.length * 50 + 20}px`;
    totalText.left = '-300px';
    totalText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    totalText.paddingLeft = '40px';
    totalText.outlineWidth = 3;
    totalText.outlineColor = '#000000';
    gui.addControl(totalText);

    // Confetti on high scores
    if (total > 200) {
      const confetti = ParticlePresets.confetti(this.scene, new BABYLON.Vector3(0, 5, 0), { rate: 100 });
      confetti.start();
    }
  }

  update() {}

  dispose() {
    this._disposed = true;
    if (this._gui) this._gui.dispose();
    if (this.scene) this.scene.dispose();
  }
}

window.ResultScene3D = ResultScene3D;
