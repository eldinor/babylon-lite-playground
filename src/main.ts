import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import packageJson from "../package.json";
import liteTypes from "../node_modules/@babylonjs/lite/index.d.ts?raw";
import defaultSource from "./default-scene.ts?raw";
import "./style.css";
import { createAssetStore, formatFileSize } from "./assets";
import { createPlaygroundZip, readPlaygroundZip } from "./export-zip";
import type { PlaygroundAsset, PreviewMessage, Snippet } from "./playground-types";
import { readSharePayload, encodeSharePayload } from "./share-url";
import { createSnippet, loadSnippets, saveSnippets } from "./snippets";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root.");
}

self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === "typescript" || label === "javascript") {
      return new TsWorker();
    }

    return new EditorWorker();
  },
};

app.innerHTML = `
  <main class="shell">
    <header class="toolbar">
      <div class="brand">
        <img class="mark" src="https://raw.githubusercontent.com/eldinor/ifc-babylon/refs/heads/main/public/bplogo.svg" alt="" />
        <div>
          <h1>Babylon Lite Playground <span class="app-version">v${packageJson.version}</span></h1>
          <p id="statusText">Idle</p>
        </div>
      </div>
      <div class="toolbar-actions">
        <button id="formatCode" type="button" title="Format current code">Format</button>
        <a class="toolbar-link" href="/user-guide.html" target="_blank" rel="noreferrer" title="Open user guide">Help</a>
        <select id="snippetSelect" aria-label="Snippet"></select>
        <button id="newSnippet" type="button" title="New snippet">New</button>
        <button id="saveSnippet" type="button" title="Save snippet">Save</button>
        <button id="duplicateSnippet" type="button" title="Duplicate snippet">Duplicate</button>
        <button id="renameSnippet" type="button" title="Rename snippet">Rename</button>
        <button id="deleteSnippet" type="button" title="Delete snippet">Delete</button>
        <label class="file-button" title="Import playground ZIP">
          Import ZIP
          <input id="importZipInput" type="file" accept=".zip,application/zip" />
        </label>
        <button id="exportZip" type="button" title="Export current playground and assets as zip">Export ZIP</button>
        <button id="shareButton" type="button" title="Copy share URL">Share</button>
        <button id="resetButton" type="button" title="Reset current snippet">Reset</button>
        <button id="runButton" class="primary" type="button" title="Run scene">Run</button>
      </div>
    </header>
    <section class="workspace">
      <div class="editor-pane">
        <div id="editor" class="editor-host"></div>
      </div>
      <div class="preview-pane">
        <iframe id="preview" sandbox="allow-scripts" src="/src/preview/preview.html" title="Scene preview"></iframe>
      </div>
    </section>
    <aside class="bottom-pane">
      <section class="asset-panel">
        <div class="panel-header">
          <h2>Assets</h2>
          <div class="asset-actions">
            <button id="insertAsset" type="button" title="Insert selected asset code" disabled>Insert</button>
            <label class="file-button">
              Upload
              <input id="assetInput" type="file" multiple />
            </label>
          </div>
        </div>
        <ul id="assetList" class="asset-list"></ul>
      </section>
      <section class="console-panel">
        <div class="panel-header">
          <h2>Console</h2>
          <button id="clearConsole" type="button" title="Clear console">Clear</button>
        </div>
        <div id="consoleOutput" class="console-output" aria-live="polite"></div>
      </section>
    </aside>
  </main>
`;

const statusText = document.querySelector<HTMLParagraphElement>("#statusText")!;
const snippetSelect = document.querySelector<HTMLSelectElement>("#snippetSelect")!;
const runButton = document.querySelector<HTMLButtonElement>("#runButton")!;
const resetButton = document.querySelector<HTMLButtonElement>("#resetButton")!;
const newSnippetButton = document.querySelector<HTMLButtonElement>("#newSnippet")!;
const formatCodeButton = document.querySelector<HTMLButtonElement>("#formatCode")!;
const saveSnippetButton = document.querySelector<HTMLButtonElement>("#saveSnippet")!;
const duplicateSnippetButton = document.querySelector<HTMLButtonElement>("#duplicateSnippet")!;
const renameSnippetButton = document.querySelector<HTMLButtonElement>("#renameSnippet")!;
const deleteSnippetButton = document.querySelector<HTMLButtonElement>("#deleteSnippet")!;
const exportZipButton = document.querySelector<HTMLButtonElement>("#exportZip")!;
const importZipInput = document.querySelector<HTMLInputElement>("#importZipInput")!;
const shareButton = document.querySelector<HTMLButtonElement>("#shareButton")!;
const clearConsoleButton = document.querySelector<HTMLButtonElement>("#clearConsole")!;
const consoleOutput = document.querySelector<HTMLDivElement>("#consoleOutput")!;
const preview = document.querySelector<HTMLIFrameElement>("#preview")!;
const assetInput = document.querySelector<HTMLInputElement>("#assetInput")!;
const assetList = document.querySelector<HTMLUListElement>("#assetList")!;
const insertAssetButton = document.querySelector<HTMLButtonElement>("#insertAsset")!;
const editorHost = document.querySelector<HTMLDivElement>("#editor")!;

const sharePayload = readSharePayload();
const snippets = loadSnippets(defaultSource);
const assetStore = createAssetStore();
let selectedSnippetId = snippets[0]?.id ?? "";
let selectedAssetName = "";

if (sharePayload) {
  const sharedSnippet = createSnippet(sharePayload.name || "Shared Scene", sharePayload.source);
  snippets.unshift(sharedSnippet);
  selectedSnippetId = sharedSnippet.id;
  saveSnippets(snippets);
}

const editor = monaco.editor.create(editorHost, {
  value: getSelectedSnippet()?.source ?? defaultSource,
  language: "typescript",
  theme: "vs-dark",
  automaticLayout: true,
  minimap: { enabled: false },
  fontSize: 14,
  tabSize: 2,
  padding: { top: 14, bottom: 14 },
});

const monacoTypescript = monaco.languages.typescript as any;

monacoTypescript.typescriptDefaults.setCompilerOptions({
  target: monacoTypescript.ScriptTarget.ES2022,
  module: monacoTypescript.ModuleKind.ESNext,
  moduleResolution: monacoTypescript.ModuleResolutionKind.Bundler,
  allowNonTsExtensions: true,
});

monacoTypescript.typescriptDefaults.addExtraLib(liteTypes, "file:///node_modules/@babylonjs/lite/index.d.ts");
monacoTypescript.typescriptDefaults.addExtraLib(
  `
declare global {
  interface Window {
    playgroundAssets: Record<string, string>;
  }
}

export function createScene(): void | Promise<void>;
`,
  "file:///playground-globals.d.ts",
);

function getSelectedSnippet(): Snippet | undefined {
  return snippets.find((snippet) => snippet.id === selectedSnippetId);
}

function setStatus(value: string): void {
  statusText.textContent = value;
}

function renderSnippets(): void {
  snippetSelect.replaceChildren(
    ...snippets.map((snippet) => {
      const option = document.createElement("option");
      option.value = snippet.id;
      option.textContent = snippet.name;
      option.selected = snippet.id === selectedSnippetId;
      return option;
    }),
  );
}

function appendConsole(level: "log" | "warn" | "error", lines: string[]): void {
  const row = document.createElement("div");
  row.className = `console-line ${level}`;
  row.textContent = lines.join(" ");
  consoleOutput.append(row);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function clearConsole(): void {
  consoleOutput.replaceChildren();
}

function recreatePreview(): Promise<void> {
  return new Promise((resolve) => {
    preview.addEventListener("load", () => resolve(), { once: true });
    preview.src = "/src/preview/preview.html";
  });
}

async function runScene(): Promise<void> {
  clearConsole();
  setStatus("Starting");
  await recreatePreview();
  preview.contentWindow?.postMessage(
    {
      type: "run",
      source: editor.getValue(),
      assets: assetStore.map(),
    },
    "*",
  );
}

function saveCurrentSnippet(): void {
  const snippet = getSelectedSnippet();
  if (!snippet) {
    return;
  }

  snippet.source = editor.getValue();
  snippet.updatedAt = Date.now();
  saveSnippets(snippets);
  renderSnippets();
  setStatus("Saved");
}

function renderAssets(assets: PlaygroundAsset[]): void {
  if (assets.length === 0) {
    selectedAssetName = "";
    insertAssetButton.disabled = true;
    const empty = document.createElement("li");
    empty.className = "empty-assets";
    empty.textContent = "No assets uploaded";
    assetList.replaceChildren(empty);
    return;
  }

  if (!assets.some((asset) => asset.name === selectedAssetName)) {
    selectedAssetName = assets[0]?.name ?? "";
  }

  insertAssetButton.disabled = selectedAssetName === "";

  assetList.replaceChildren(
    ...assets.map((asset) => {
      const item = document.createElement("li");
      const details = document.createElement("span");
      const remove = document.createElement("button");

      item.className = asset.name === selectedAssetName ? "selected" : "";
      item.tabIndex = 0;
      item.title = "Select asset";
      details.textContent = `${asset.name} - ${formatFileSize(asset.size)}`;
      remove.type = "button";
      remove.textContent = "Remove";
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        renderAssets(assetStore.remove(asset.name));
      });

      item.addEventListener("click", () => {
        selectedAssetName = asset.name;
        renderAssets(assetStore.list());
      });
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectedAssetName = asset.name;
          renderAssets(assetStore.list());
        }
      });

      item.append(details, remove);
      return item;
    }),
  );
}

function insertSelectedAsset(): void {
  const asset = assetStore.list().find((item) => item.name === selectedAssetName);
  if (!asset) {
    setStatus("Select an asset");
    return;
  }

  const insert = createAssetInsert(asset);
  const model = editor.getModel();
  if (!model) {
    return;
  }

  const originalSource = editor.getValue();
  const cursorPosition = editor.getPosition();
  const cursorOffset = cursorPosition ? model.getOffsetAt(cursorPosition) : originalSource.length;
  const targetOffset = findSceneSetupInsertOffset(originalSource) ?? cursorOffset;
  const importUpdate = upsertBabylonLiteImports(originalSource, insert.imports, targetOffset);

  editor.executeEdits("insert-asset-imports", [
    {
      range: model.getFullModelRange(),
      text: importUpdate.source,
    },
  ]);

  const updatedModel = editor.getModel();
  const insertPosition = updatedModel?.getPositionAt(targetOffset + importUpdate.offsetDelta);

  editor.executeEdits("insert-asset-code", [
    {
      range: new monaco.Range(
        insertPosition?.lineNumber ?? 1,
        insertPosition?.column ?? 1,
        insertPosition?.lineNumber ?? 1,
        insertPosition?.column ?? 1,
      ),
      text: insert.code,
      forceMoveMarkers: true,
    },
  ]);
  editor.focus();
  setStatus(findSceneSetupInsertOffset(originalSource) ? `Inserted ${asset.name} after scene setup` : `Inserted ${asset.name}`);
}

async function exportPlaygroundZip(): Promise<void> {
  const source = editor.getValue();
  const shareUrl = encodeSharePayload({
    version: 1,
    name: getSelectedSnippet()?.name,
    source,
  });
  const zip = await createPlaygroundZip({
    name: getSelectedSnippet()?.name ?? "Untitled Scene",
    source,
    shareUrl,
    assets: assetStore.list(),
  });
  const filename = `${toFileBaseName(getSelectedSnippet()?.name ?? "babylon-lite-playground")}.zip`;

  downloadBlob(zip, filename);
  setStatus("Exported ZIP");
}

async function importPlaygroundZip(file: File): Promise<void> {
  const imported = await readPlaygroundZip(file);
  const snippet = createSnippet(imported.name, imported.source);

  snippets.push(snippet);
  selectedSnippetId = snippet.id;
  saveSnippets(snippets);
  editor.setValue(snippet.source);
  renderSnippets();
  renderAssets(assetStore.addAssets(imported.assets));
  setStatus(`Imported ${imported.name}`);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noreferrer";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createAssetInsert(asset: PlaygroundAsset): { imports: string[]; code: string } {
  const key = JSON.stringify(asset.name);
  const variableBase = toIdentifier(asset.name);
  const extension = asset.name.split(".").pop()?.toLowerCase() ?? "";

  if (extension === "glb" || extension === "gltf") {
    return {
      imports: ["addToScene", "loadGltf"],
      code: [
        `\n  const ${variableBase}Url = window.playgroundAssets[${key}];`,
        `  if (${variableBase}Url) {`,
        `    const ${variableBase} = await loadGltf(engine, ${variableBase}Url);`,
        `    addToScene(scene, ${variableBase});`,
        `  }\n`,
      ].join("\n"),
    };
  }

  if (["png", "jpg", "jpeg", "webp", "ktx2", "basis"].includes(extension)) {
    return {
      imports: ["loadTexture2D"],
      code: [
        `\n  const ${variableBase}Url = window.playgroundAssets[${key}];`,
        `  const ${variableBase}Texture = ${variableBase}Url ? await loadTexture2D(engine, ${variableBase}Url) : undefined;\n`,
      ].join("\n"),
    };
  }

  return {
    imports: [],
    code: `\n  const ${variableBase}Url = window.playgroundAssets[${key}];\n`,
  };
}

function upsertBabylonLiteImports(source: string, imports: string[], cursorOffset: number): { source: string; offsetDelta: number } {
  const needed = Array.from(new Set(imports)).filter((name) => name.length > 0);
  if (needed.length === 0) {
    return { source, offsetDelta: 0 };
  }

  const importPattern = /import\s*\{([\s\S]*?)\}\s*from\s*["']@babylonjs\/lite["'];?/m;
  const match = importPattern.exec(source);
  if (!match) {
    const prefix = `import { ${needed.sort().join(", ")} } from "@babylonjs/lite";\n`;
    return { source: `${prefix}${source}`, offsetDelta: prefix.length };
  }

  const existing = match[1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const merged = Array.from(new Set([...existing, ...needed])).sort();
  const replacement = `import {\n  ${merged.join(",\n  ")},\n} from "@babylonjs/lite";`;
  const nextSource = source.replace(importPattern, replacement);
  const replacedBeforeCursor = match.index < cursorOffset;
  const originalImport = match[0];
  const offsetDelta = replacedBeforeCursor ? replacement.length - originalImport.length : 0;

  return { source: nextSource, offsetDelta };
}

function findSceneSetupInsertOffset(source: string): number | null {
  const scenePattern = /\b(?:const|let|var)\s+scene\s*=\s*(?:[\w$]+\.)?createSceneContext\s*\([^;]+?\)\s*;?/m;
  const sceneMatch = scenePattern.exec(source);
  if (!sceneMatch) {
    return null;
  }

  const statementEnd = sceneMatch.index + sceneMatch[0].length;
  const lineEnd = source.indexOf("\n", statementEnd);
  return lineEnd === -1 ? statementEnd : lineEnd + 1;
}

function toIdentifier(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_$]+(.)?/g, (_match, next: string | undefined) => (next ? next.toUpperCase() : ""))
    .replace(/^[^a-zA-Z_$]+/, "");

  return base || "asset";
}

function toFileBaseName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || "babylon-lite-playground";
}

runButton.addEventListener("click", () => void runScene());
resetButton.addEventListener("click", () => {
  const snippet = getSelectedSnippet();
  editor.setValue(snippet?.source ?? defaultSource);
});
clearConsoleButton.addEventListener("click", clearConsole);
insertAssetButton.addEventListener("click", insertSelectedAsset);
formatCodeButton.addEventListener("click", async () => {
  await editor.getAction("editor.action.formatDocument")?.run();
  editor.focus();
  setStatus("Formatted");
});

snippetSelect.addEventListener("change", () => {
  selectedSnippetId = snippetSelect.value;
  editor.setValue(getSelectedSnippet()?.source ?? defaultSource);
  renderSnippets();
});

newSnippetButton.addEventListener("click", () => {
  const name = prompt("Snippet name", "Untitled Scene")?.trim();
  if (!name) {
    return;
  }
  const snippet = createSnippet(name, defaultSource);
  snippets.push(snippet);
  selectedSnippetId = snippet.id;
  saveSnippets(snippets);
  editor.setValue(snippet.source);
  renderSnippets();
});

saveSnippetButton.addEventListener("click", saveCurrentSnippet);

duplicateSnippetButton.addEventListener("click", () => {
  const current = getSelectedSnippet();
  const snippet = createSnippet(`${current?.name ?? "Scene"} Copy`, editor.getValue());
  snippets.push(snippet);
  selectedSnippetId = snippet.id;
  saveSnippets(snippets);
  renderSnippets();
});

renameSnippetButton.addEventListener("click", () => {
  const snippet = getSelectedSnippet();
  if (!snippet) {
    return;
  }
  const name = prompt("Snippet name", snippet.name)?.trim();
  if (name) {
    snippet.name = name;
    snippet.updatedAt = Date.now();
    saveSnippets(snippets);
    renderSnippets();
  }
});

deleteSnippetButton.addEventListener("click", () => {
  if (snippets.length === 1) {
    setStatus("Keep at least one snippet");
    return;
  }
  const snippet = getSelectedSnippet();
  if (!snippet || !confirm(`Delete "${snippet.name}"?`)) {
    return;
  }

  const index = snippets.findIndex((item) => item.id === snippet.id);
  snippets.splice(index, 1);
  selectedSnippetId = snippets[Math.max(0, index - 1)]!.id;
  saveSnippets(snippets);
  editor.setValue(getSelectedSnippet()?.source ?? defaultSource);
  renderSnippets();
});

shareButton.addEventListener("click", async () => {
  const url = encodeSharePayload({
    version: 1,
    name: getSelectedSnippet()?.name,
    source: editor.getValue(),
  });

  location.hash = new URL(url).hash;
  await navigator.clipboard.writeText(url);
  setStatus("Share URL copied");
});

exportZipButton.addEventListener("click", () => {
  void exportPlaygroundZip().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    appendConsole("error", [message]);
    setStatus("ZIP export failed");
  });
});

importZipInput.addEventListener("change", () => {
  const file = importZipInput.files?.[0];
  if (!file) {
    return;
  }

  void importPlaygroundZip(file).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    appendConsole("error", [message]);
    setStatus("ZIP import failed");
  });
  importZipInput.value = "";
});

assetInput.addEventListener("change", () => {
  if (assetInput.files) {
    void assetStore
      .add(assetInput.files)
      .then(renderAssets)
      .then(() => setStatus("Assets loaded"))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        appendConsole("error", [message]);
        setStatus("Asset load failed");
      });
    assetInput.value = "";
  }
});

window.addEventListener("message", (event: MessageEvent<PreviewMessage>) => {
  const message = event.data;
  if (!message || typeof message.type !== "string") {
    return;
  }

  if (message.type === "status") {
    setStatus(message.value[0].toUpperCase() + message.value.slice(1));
  }

  if (message.type === "console") {
    appendConsole(message.level, message.args);
  }

  if (message.type === "runtime-error") {
    appendConsole("error", [message.stack || message.message]);
  }
});

window.addEventListener("beforeunload", () => assetStore.clear());
window.addEventListener("resize", () => editor.layout());

renderSnippets();
renderAssets(assetStore.list());
void runScene();
