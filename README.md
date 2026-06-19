# Babylon Lite Playground

A browser playground for [`@babylonjs/lite`](https://www.npmjs.com/package/@babylonjs/lite) built with Vite 8, TypeScript, Monaco Editor, and a sandboxed iframe preview.

The playground runs real ES module snippets. User code imports from `@babylonjs/lite` directly, like it would in an editor project. There is no custom `api` object.

## Requirements

- Node.js with `pnpm`
- A current Chromium-based browser with WebGPU enabled

Babylon Lite uses WebGPU. If WebGPU is unavailable, the preview panel shows a friendly error.

## Install

```powershell
pnpm install
pnpm dev
```

Open the local URL printed by Vite, usually:

```text
http://localhost:5173
```

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Starts the Vite dev server. |
| `pnpm build` | Runs TypeScript checking and builds the production app. |
| `pnpm preview` | Serves the production build locally. |

## UI Overview

| Area | Purpose |
| --- | --- |
| Toolbar | Run scenes, manage snippets, reset code, and copy share URLs. |
| Editor | Monaco-powered code editor for the current snippet. |
| Preview | Sandboxed iframe that runs the scene and renders Babylon Lite output. |
| Bottom panel | Asset upload list and console/error output. |

## Toolbar Controls

| Control | Description |
| --- | --- |
| Snippet select | Chooses the active saved snippet. |
| New | Creates a new snippet using the default scene source. |
| Save | Saves the current editor contents into the selected snippet. |
| Duplicate | Creates a new snippet from the current editor contents. |
| Rename | Renames the selected snippet. |
| Delete | Deletes the selected snippet after confirmation. |
| Import ZIP | Imports a previously exported playground ZIP as a new snippet and reloads its assets. |
| Export ZIP | Downloads `playground.js`, `share-url.txt`, and all uploaded assets in one ZIP. |
| Share | Copies a compressed URL containing the current editor source. |
| Reset | Restores the editor to the selected snippet's last saved source. |
| Run | Recreates the preview iframe and runs the current editor source. |

## Scene Contract

Snippets are browser ES modules. Export a zero-argument `createScene` function:

```js
import {
  addToScene,
  attachControl,
  createArcRotateCamera,
  createBox,
  createEngine,
  createHemisphericLight,
  createSceneContext,
  createStandardMaterial,
  registerScene,
  startEngine,
} from "@babylonjs/lite";

export async function createScene() {
  const canvas = document.querySelector("#renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);

  const camera = createArcRotateCamera(Math.PI / 4, Math.PI / 3, 5, { x: 0, y: 0.8, z: 0 });
  attachControl(camera, canvas, scene);
  scene.camera = camera;

  addToScene(scene, createHemisphericLight([0, 1, 0], 0.8));

  const material = createStandardMaterial();
  material.diffuseColor = [0.2, 0.55, 1];

  const box = createBox(engine, 1.5);
  box.material = material;
  addToScene(scene, box);

  await registerScene(scene);
  await startEngine(engine);
}
```

The preview creates this canvas before importing your code:

```html
<canvas id="renderCanvas"></canvas>
```

For orbit controls, pass the scene to `attachControl(camera, canvas, scene)`. Babylon Lite applies camera inertia from the scene render loop.

## Public API Access

The playground exposes the full public Babylon Lite API through normal imports:

```js
import * as Lite from "@babylonjs/lite";
```

or:

```js
import { createEngine, createSceneContext, loadGltf } from "@babylonjs/lite";
```

Monaco receives the installed `@babylonjs/lite` declaration file, so completions come from the actual package instead of a hand-written subset.

## Uploaded Assets

Uploaded files are playground-specific, so they are exposed through one global:

```js
window.playgroundAssets["filename.ext"]
```

Files are converted to data URLs and include a filename fragment so Babylon Lite can detect `.glb` files correctly.

The asset panel has two controls:

| Control | Description |
| --- | --- |
| Upload | Adds one or more local files to the current browser session. |
| Insert | Inserts code for the selected asset at the editor cursor and adds missing Babylon Lite imports when needed. |

Click an asset row to select it. The selected row is highlighted. Inserted code depends on file type:

| File type | Inserted code |
| --- | --- |
| `.glb`, `.gltf` | Reads `window.playgroundAssets`, calls `loadGltf(engine, url)`, and adds the container with `addToScene(scene, container)`. |
| `.png`, `.jpg`, `.jpeg`, `.webp`, `.ktx2`, `.basis` | Reads `window.playgroundAssets` and calls `loadTexture2D(engine, url)`. |
| Other files | Inserts only a `window.playgroundAssets["filename"]` URL variable. |

The Insert button looks for `const scene = createSceneContext(...)` or `const scene = Lite.createSceneContext(...)` and places generated asset code immediately after that line. If it cannot find that setup line, it falls back to the editor cursor.

Example:

```js
import {
  addToScene,
  createEngine,
  createSceneContext,
  loadGltf,
  registerScene,
  startEngine,
} from "@babylonjs/lite";

export async function createScene() {
  const canvas = document.querySelector("#renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);

  const url = window.playgroundAssets["model.glb"];
  if (url) {
    const container = await loadGltf(engine, url);
    addToScene(scene, container);
  }

  await registerScene(scene);
  await startEngine(engine);
}
```

Uploaded assets live only in the current browser session and are not included in share URLs.

## Preview Sandbox

Every run is disposable:

1. The parent clears the console.
2. The parent recreates the sandboxed iframe.
3. The runner creates a fresh `#renderCanvas`.
4. The runner exposes uploaded assets as `window.playgroundAssets`.
5. The runner imports the editor source as a Blob ES module.
6. The runner calls `createScene()`.

The iframe uses:

```html
<iframe sandbox="allow-scripts" src="/src/preview/preview.html"></iframe>
```

The preview document uses an import map so Blob modules can resolve `@babylonjs/lite`.

## Console Panel

The preview runner captures:

- `console.log`
- `console.warn`
- `console.error`
- `window.error`
- `window.unhandledrejection`

Logs are appended to the console panel and the newest output stays visible. Errors are shown in red.

## Snippets

Snippets are stored in browser `localStorage`.

```ts
interface Snippet {
  id: string;
  name: string;
  source: string;
  updatedAt: number;
}
```

Snippet storage is local to the current browser profile.

## Share URLs

The Share button serializes the current source as:

```ts
interface SharePayload {
  version: 1;
  name?: string;
  source: string;
}
```

The payload is compressed with `lz-string` and placed in `location.hash`.

Share URLs are intended for small and medium snippets. Uploaded assets are not included.

## ZIP Export

Use **Export ZIP** when you need to save the current playground together with uploaded assets.

The ZIP contains:

```text
playground.js
share-url.txt
assets/
  uploaded-file.ext
```

`playground.js` is the plain editor source. `share-url.txt` contains the playground name, an uploaded asset list, the current share URL, and a note that the URL does not include uploaded assets. The `assets/` folder contains every uploaded asset from the current browser session.

Use **Import ZIP** to load a ZIP created by **Export ZIP**. The playground reads `playground.js`, creates a new snippet using the name from `share-url.txt`, and loads every file under `assets/` into the asset panel. If an imported asset has the same name as an existing asset, the imported file replaces it for the current browser session.

## Project Structure

```text
index.html
package.json
tsconfig.json
vite.config.ts
src/
  main.ts
  style.css
  default-scene.ts
  playground-types.ts
  snippets.ts
  assets.ts
  share-url.ts
  preview/
    babylon-lite.ts
    preview.html
    runner.ts
```

## Troubleshooting

### WebGPU is unavailable

Use a current Chromium-based browser with WebGPU enabled.

### `SyntaxError: Unexpected token ':'`

The preview runs raw browser JavaScript modules. Remove TypeScript-only syntax from snippets unless a transpile step is added later.

### CORS errors in the preview iframe

Restart the dev server after changing `vite.config.ts`. The dev server must send `Access-Control-Allow-Origin: *`.

### Share URL does not restore assets

This is expected. Share URLs include source code only, not uploaded files.
