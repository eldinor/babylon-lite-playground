import type { Snippet } from "./playground-types";

const STORAGE_KEY = "babylon-lite-playground:snippets";

export function createSnippet(name: string, source: string): Snippet {
  return {
    id: crypto.randomUUID(),
    name,
    source,
    updatedAt: Date.now(),
  };
}

export function loadSnippets(defaultSource: string): Snippet[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [createSnippet("Default Scene", defaultSource)];
  }

  try {
    const parsed = JSON.parse(raw) as Snippet[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      const migrated = parsed.map(migrateSnippetSource);
      saveSnippets(migrated);
      return migrated;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  return [createSnippet("Default Scene", defaultSource)];
}

function migrateSnippetSource(snippet: Snippet): Snippet {
  const isOldDefaultScene =
    snippet.source.includes("export async function createScene(api)") &&
    snippet.source.includes("Scene ready. Try changing the box color or size.");

  const source = migrateCanvasParameter(
    isOldDefaultScene
      ? defaultDirectImportScene()
      : snippet.source
          .replace("export async function createScene(api: any)", "export async function createScene(api)")
  ).replace(/^\/\/\s*@ts-nocheck\s*\r?\n(?:\r?\n)?/, "");

  return {
    ...snippet,
    source,
  };
}

function migrateCanvasParameter(source: string): string {
  const typedCanvasParameter = "/** @param {HTMLCanvasElement} canvas */\nexport async function createScene(canvas) {\n";

  return source
    .replace(
      /export async function createScene\(\) \{\r?\n\s*const canvas = document\.querySelector(?:<HTMLCanvasElement>)?\(["']#renderCanvas["']\);\r?\n(?:\s*if \(!canvas\) \{\r?\n\s*throw new Error\(["']Preview canvas #renderCanvas was not found\.["']\);\r?\n\s*\}\r?\n)?/,
      typedCanvasParameter,
    )
    .replace("export async function createScene(canvas: HTMLCanvasElement) {", typedCanvasParameter.trimEnd());
}

function defaultDirectImportScene(): string {
  return `import {
  addToScene,
  attachControl,
  createArcRotateCamera,
  createBox,
  createDirectionalLight,
  createEngine,
  createGround,
  createHemisphericLight,
  createSceneContext,
  createStandardMaterial,
  registerScene,
  startEngine,
} from "@babylonjs/lite";

/** @param {HTMLCanvasElement} canvas */
export async function createScene(canvas) {
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);

  const camera = createArcRotateCamera(Math.PI / 4, Math.PI / 3, 6, { x: 0, y: 0.8, z: 0 });
  attachControl(camera, canvas, scene);
  scene.camera = camera;
  scene.clearColor = { r: 0.04, g: 0.055, b: 0.075, a: 1 };

  addToScene(scene, createHemisphericLight([0, 1, 0], 0.7));
  addToScene(scene, createDirectionalLight([-0.4, -1, -0.3], 0.55));

  const blue = createStandardMaterial();
  blue.diffuseColor = [0.16, 0.5, 1];
  blue.specularColor = [0.7, 0.85, 1];

  const floor = createStandardMaterial();
  floor.diffuseColor = [0.38, 0.4, 0.44];
  floor.specularColor = [0.08, 0.08, 0.08];

  const box = createBox(engine, 1.5);
  box.material = blue;
  box.position.set(0, 1.05, 0);

  const ground = createGround(engine, {
    width: 7,
    height: 7,
  });
  ground.material = floor;

  addToScene(scene, box);
  addToScene(scene, ground);

  await registerScene(scene);
  await startEngine(engine);

  console.log("Scene ready. Try changing the box color or size.");
}
`;
}

export function saveSnippets(snippets: Snippet[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets));
}
