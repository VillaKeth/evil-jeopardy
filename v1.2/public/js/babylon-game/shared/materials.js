// Evil Jeopardy 1.2 — Reusable PBR Materials

class MaterialLibrary {
  constructor(scene) {
    this.scene = scene;
    this._cache = {};
  }

  _getOrCreate(name, builder) {
    if (this._cache[name]) return this._cache[name];
    const mat = builder();
    this._cache[name] = mat;
    return mat;
  }

  wood() {
    return this._getOrCreate('wood', () => {
      const mat = new BABYLON.PBRMaterial('wood', this.scene);
      mat.albedoColor = new BABYLON.Color3(0.55, 0.35, 0.18);
      mat.metallic = 0;
      mat.roughness = 0.85;
      return mat;
    });
  }

  metal() {
    return this._getOrCreate('metal', () => {
      const mat = new BABYLON.PBRMaterial('metal', this.scene);
      mat.albedoColor = new BABYLON.Color3(0.8, 0.8, 0.82);
      mat.metallic = 0.9;
      mat.roughness = 0.3;
      return mat;
    });
  }

  glass() {
    return this._getOrCreate('glass', () => {
      const mat = new BABYLON.PBRMaterial('glass', this.scene);
      mat.albedoColor = new BABYLON.Color3(0.9, 0.95, 1.0);
      mat.metallic = 0;
      mat.roughness = 0.05;
      mat.alpha = 0.3;
      return mat;
    });
  }

  food(color) {
    const key = `food_${color.r}_${color.g}_${color.b}`;
    return this._getOrCreate(key, () => {
      const mat = new BABYLON.PBRMaterial(key, this.scene);
      mat.albedoColor = color;
      mat.metallic = 0;
      mat.roughness = 0.7;
      mat.subSurface.isTranslucencyEnabled = true;
      mat.subSurface.translucencyIntensity = 0.3;
      return mat;
    });
  }

  frosting(color) {
    const key = `frosting_${color.r}_${color.g}_${color.b}`;
    return this._getOrCreate(key, () => {
      const mat = new BABYLON.PBRMaterial(key, this.scene);
      mat.albedoColor = color;
      mat.metallic = 0.1;
      mat.roughness = 0.4;
      return mat;
    });
  }

  marble() {
    return this._getOrCreate('marble', () => {
      const mat = new BABYLON.PBRMaterial('marble', this.scene);
      mat.albedoColor = new BABYLON.Color3(0.92, 0.90, 0.88);
      mat.metallic = 0.05;
      mat.roughness = 0.25;
      return mat;
    });
  }

  cakeSponge() {
    return this._getOrCreate('cakeSponge', () => {
      const mat = new BABYLON.PBRMaterial('cakeSponge', this.scene);
      mat.albedoColor = new BABYLON.Color3(0.9, 0.75, 0.45);
      mat.metallic = 0;
      mat.roughness = 0.95;
      return mat;
    });
  }

  dispose() {
    for (const mat of Object.values(this._cache)) {
      mat.dispose();
    }
    this._cache = {};
  }
}

window.MaterialLibrary = MaterialLibrary;
