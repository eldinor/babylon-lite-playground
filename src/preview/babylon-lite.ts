import * as Lite from "@babylonjs/lite";

export * from "@babylonjs/lite";

let activeScene: Lite.SceneContext | undefined;

export function createSceneContext(surface: Lite.SurfaceContext, options?: Lite.SceneContextOptions): Lite.SceneContext {
  activeScene = Lite.createSceneContext(surface, options);
  return activeScene;
}

export function attachControl(
  camera: Lite.ArcRotateCamera,
  canvas: HTMLCanvasElement,
  scene?: Lite.SceneContext,
  options?: Lite.AttachControlOptions,
): () => void {
  return Lite.attachControl(camera, canvas, scene ?? activeScene, options);
}
