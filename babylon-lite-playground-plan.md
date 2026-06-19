# Plan: Babylon Lite Playground App

## Objective

Create a Vite 8 + TypeScript Playground for Babylon Lite with:

- textarea/code editor
- Run button
- iframe preview
- console/error panel
- Monaco editor upgrade
- saved snippets
- asset upload
- shareable URLs

The app should be a real playground as the first screen, not a landing page. Do not add Babylon.js, WebGL fallback, Three.js, React, or the Babylon Lite parity harness.

## Core Constraints

- Use `babylon-lite` public APIs and standalone functions.
- Do not expect Babylon.js method-style APIs such as `scene.add(...)`, `engine.runRenderLoop(...)`, or `mesh.dispose()`.
- Keep user code sandboxed in an iframe.
- Treat every run as disposable: recreate or fully reset the preview context.
- Avoid exposing raw WebGPU handles in the user-facing playground API.
- Use Vite 8.
- Use the latest available package versions at implementation time. For Vite, use the latest Vite 8 release, not an older pinned Vite 8 version.

## Target File Structure

```text
babylon-lite-playground/
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
      preview.html
      runner.ts
```

## Phase 1: Minimal Playground Shell

Build the first version with plain DOM and a textarea.

When scaffolding dependencies, check and install the latest compatible versions instead of copying stale versions from an old note. Keep Vite constrained to major version 8. Example intent:

```powershell
pnpm add babylon-lite@latest
pnpm add -D vite@^8 typescript@latest @webgpu/types@latest
```

UI regions:

- top toolbar with Run button, Reset button, status text
- left editor textarea
- right preview iframe
- bottom or side console/error panel

Parent responsibilities:

1. Load `default-scene.ts` text into the textarea.
2. Create the iframe with `sandbox="allow-scripts"`.
3. On Run, clear the console panel.
4. Send `{ type: "run", source }` to the iframe with `postMessage`.
5. Listen for console/status/error messages from the iframe.
6. Render logs and runtime errors in the console panel.

Recommended iframe markup:

```html
<iframe id="preview" sandbox="allow-scripts" src="/src/preview/preview.html"></iframe>
```

## Phase 2: Preview Runner

Implement `src/preview/runner.ts`.

Runner responsibilities:

1. Import stable Babylon Lite public APIs once.
2. Listen for `{ type: "run", source, assets }`.
3. Dispose or abandon the previous run.
4. Replace preview body with a fresh `<canvas>`.
5. Check `navigator.gpu`; report a friendly error if unavailable.
6. Create `engine` and `scene`.
7. Build a Blob ES module from user source.
8. `await import(blobUrl)`.
9. Require `module.createScene` to be a function.
10. Call `await module.createScene(api)`.
11. Call `await registerScene(scene)`.
12. Call `await startEngine(engine)`.
13. Revoke the Blob URL after import.

Expose user code through an API object instead of requiring user imports. This avoids bare-module resolution issues inside dynamic Blob modules.

Initial API object:

```ts
{
    canvas,
    engine,
    scene,
    assets,
    addToScene,
    createSceneContext,
    createEngine,
    registerScene,
    startEngine,
    createArcRotateCamera,
    attachControl,
    createDefaultCamera,
    createHemisphericLight,
    createDirectionalLight,
    createPointLight,
    createSpotLight,
    createBox,
    createSphere,
    createGround,
    createPlane,
    createStandardMaterial,
    createPbrMaterial,
    loadGltf,
    loadEnvironment,
    loadTexture2D,
}
```

Before implementation, inspect the current `babylon-lite` root exports and simple examples to confirm exact function signatures.

## Phase 3: Console And Error Capture

In the runner:

- wrap `console.log`
- wrap `console.warn`
- wrap `console.error`
- listen for `window.error`
- listen for `window.unhandledrejection`

Send parent messages:

```ts
type PreviewMessage =
    | { type: "status"; value: "idle" | "running" | "ready" | "failed" }
    | { type: "console"; level: "log" | "warn" | "error"; args: string[] }
    | { type: "runtime-error"; message: string; stack?: string };
```

In the parent, append messages to a scrollable console panel. Make errors visually distinct and keep the newest output visible.

## Phase 4: Default Scene Contract

User scene modules should export:

```ts
export async function createScene(api) {
    const {
        engine,
        scene,
        canvas,
        addToScene,
        createArcRotateCamera,
        attachControl,
        createHemisphericLight,
        createBox,
        createStandardMaterial,
    } = api;

    const camera = createArcRotateCamera("camera", Math.PI / 4, Math.PI / 3, 5, [0, 0.8, 0]);
    attachControl(camera, canvas);
    scene.camera = camera;

    addToScene(scene, createHemisphericLight([0, 1, 0], 0.8));

    const material = createStandardMaterial({
        diffuseColor: [0.2, 0.55, 1],
    });

    const box = createBox(engine, {
        size: 1.5,
        material,
    });

    addToScene(scene, box);
}
```

If the actual Babylon Lite factory signatures differ, adapt the default scene to the checked source examples.

## Phase 5: Monaco Editor

After the textarea version works, replace it with Monaco.

Steps:

1. Install the latest `monaco-editor`.
2. Create the editor in the left pane.
3. Use `editor.getValue()` when running.
4. Persist editor layout on window resize.
5. Set TypeScript compiler options matching the app.
6. Add ambient playground API types for better completions.

Keep the editor focused on code; do not turn the UI into a landing page or tutorial panel.

## Phase 6: Saved Snippets

Use `localStorage` first. No backend is needed.

Data model:

```ts
export interface Snippet {
    id: string;
    name: string;
    source: string;
    updatedAt: number;
}
```

UI controls:

- snippet select/list
- New
- Save
- Duplicate
- Rename
- Delete

Behavior:

1. Load snippets on app start.
2. If no snippets exist, create one from `default-scene.ts`.
3. Save current editor source into the selected snippet.
4. Store updated snippets as JSON in `localStorage`.
5. Confirm destructive deletes.

## Phase 7: Asset Upload

Add a compact asset panel with a file input and uploaded file list.

Data model:

```ts
export interface PlaygroundAsset {
    name: string;
    url: string;
    type: string;
    size: number;
}
```

Flow:

1. User uploads one or more files.
2. Parent creates object URLs with `URL.createObjectURL(file)`.
3. Parent stores an asset map by filename.
4. Parent sends serializable asset metadata to the iframe on every run.
5. Runner exposes the map as `api.assets`.
6. User code can load an uploaded asset by name.

Example user code:

```ts
export async function createScene(api) {
    const modelUrl = api.assets["model.glb"];
    if (modelUrl) {
        api.addToScene(api.scene, await api.loadGltf(api.engine, modelUrl));
    }
}
```

Revoke object URLs when assets are removed or replaced.

## Phase 8: Shareable URLs

Start with source-in-URL hash. Add backend persistence only later if necessary.

Flow:

1. Add a Copy Share URL button.
2. Serialize the current source and optional snippet name.
3. Compress the payload with `lz-string` or another small URL-safe compression package.
4. Put the encoded payload in `location.hash`.
5. On app load, detect hash payload and restore editor content.

Payload shape:

```ts
interface SharePayload {
    version: 1;
    name?: string;
    source: string;
}
```

If snippets become too large for browser URLs, add a later storage option such as GitHub Gist or a small API. Do not start with server persistence.

## Phase 9: Validation

For the standalone playground workspace:

```powershell
pnpm install
pnpm build
pnpm dev
```

Manual checks:

- app opens directly to editor + preview
- Run renders the default scene
- syntax/runtime errors appear in the console panel
- console logs from user code appear in the console panel
- repeated Run does not stack multiple active render loops
- missing WebGPU shows a friendly message
- Monaco editor works after upgrade
- snippets persist after refresh
- uploaded asset URLs are visible to user code
- share URL restores source in a fresh tab

## Implementation Order

1. Create Vite 8 TypeScript app scaffold.
2. Build static layout and CSS.
3. Implement iframe runner and postMessage protocol.
4. Add default scene and Run flow.
5. Add console/error capture.
6. Verify build and manual default render.
7. Replace textarea with Monaco.
8. Add saved snippets.
9. Add asset upload.
10. Add shareable URLs.
11. Final polish and verification.
