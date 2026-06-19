import * as Lite from "@babylonjs/lite";

export * from "@babylonjs/lite";

let activeScene;

export function createSceneContext(surface, options) {
  activeScene = Lite.createSceneContext(surface, options);
  return activeScene;
}

export function attachControl(camera, canvas, scene, options) {
  return Lite.attachControl(camera, canvas, scene ?? activeScene, options);
}
