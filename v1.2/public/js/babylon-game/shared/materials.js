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

  darkMetal() {
    return this._getOrCreate('darkMetal', () => {
      const mat = new BABYLON.PBRMaterial('darkMetal', this.scene);
      mat.albedoColor = new BABYLON.Color3(0.18, 0.18, 0.20);
      mat.metallic = 0.85;
      mat.roughness = 0.35;
      return mat;
    });
  }

  ovenInterior() {
    return this._getOrCreate('ovenInterior', () => {
      const mat = new BABYLON.PBRMaterial('ovenInterior', this.scene);
      mat.albedoColor = new BABYLON.Color3(0.12, 0.12, 0.14);
      mat.metallic = 0.7;
      mat.roughness = 0.5;
      mat.emissiveColor = new BABYLON.Color3(0.03, 0.01, 0.0);
      return mat;
    });
  }

  heatingCoil(intensity = 0) {
    const key = `heatingCoil_${intensity.toFixed(2)}`;
    return this._getOrCreate(key, () => {
      const mat = new BABYLON.StandardMaterial(key, this.scene);
      mat.diffuseColor = new BABYLON.Color3(0.3, 0.05, 0.02);
      mat.emissiveColor = new BABYLON.Color3(
        Math.min(1, 0.1 + intensity * 0.9),
        Math.min(1, 0.02 + intensity * 0.25),
        0.01
      );
      mat.specularColor = new BABYLON.Color3(0.1, 0.05, 0.02);
      return mat;
    });
  }

  tile(color) {
    const key = `tile_${color.r}_${color.g}_${color.b}`;
    return this._getOrCreate(key, () => {
      const mat = new BABYLON.PBRMaterial(key, this.scene);
      mat.albedoColor = color;
      mat.metallic = 0.02;
      mat.roughness = 0.35;
      return mat;
    });
  }

  darkWood() {
    return this._getOrCreate('darkWood', () => {
      const mat = new BABYLON.PBRMaterial('darkWood', this.scene);
      mat.albedoColor = new BABYLON.Color3(0.30, 0.18, 0.08);
      mat.metallic = 0;
      mat.roughness = 0.75;
      return mat;
    });
  }

  stainlessSteel() {
    return this._getOrCreate('stainlessSteel', () => {
      const mat = new BABYLON.PBRMaterial('stainlessSteel', this.scene);
      mat.albedoColor = new BABYLON.Color3(0.72, 0.73, 0.76);
      mat.metallic = 0.95;
      mat.roughness = 0.18;
      return mat;
    });
  }

  ovenGlass(tint = 0) {
    const key = `ovenGlass_${tint.toFixed(2)}`;
    return this._getOrCreate(key, () => {
      const mat = new BABYLON.PBRMaterial(key, this.scene);
      mat.albedoColor = new BABYLON.Color3(0.85 + tint * 0.15, 0.88, 0.92);
      mat.metallic = 0;
      mat.roughness = 0.05;
      mat.alpha = 0.25;
      mat.emissiveColor = new BABYLON.Color3(tint * 0.4, tint * 0.15, 0);
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
