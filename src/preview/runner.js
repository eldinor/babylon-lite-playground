let runToken = 0;

function post(message) {
  window.parent.postMessage(message, "*");
}

function serialize(value) {
  if (value instanceof Error) {
    return value.stack || value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function patchConsole() {
  for (const level of ["log", "warn", "error"]) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      original(...args);
      post({ type: "console", level, args: args.map(serialize) });
    };
  }
}

function createCanvas() {
  const canvas = document.createElement("canvas");
  canvas.id = "renderCanvas";
  document.body.replaceChildren(canvas);
  return canvas;
}

function showPreviewMessage(message) {
  const element = document.createElement("div");
  element.className = "preview-message";
  element.textContent = message;
  document.body.replaceChildren(element);
}

async function runSource(message) {
  const token = ++runToken;
  post({ type: "status", value: "running" });

  if (!navigator.gpu) {
    showPreviewMessage("WebGPU is not available in this browser. Try a current Chromium-based browser with WebGPU enabled.");
    post({
      type: "runtime-error",
      message: "WebGPU is not available in this browser.",
    });
    post({ type: "status", value: "failed" });
    return;
  }

  createCanvas();
  window.playgroundAssets = message.assets;

  let blobUrl = null;

  try {
    blobUrl = URL.createObjectURL(new Blob([message.source], { type: "text/javascript" }));
    const module = await import(blobUrl);

    if (token !== runToken) {
      return;
    }

    if (typeof module.createScene !== "function") {
      throw new Error('User module must export a function named "createScene".');
    }

    await module.createScene();

    if (token === runToken) {
      post({ type: "status", value: "ready" });
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    showPreviewMessage(err.message);
    post({ type: "runtime-error", message: err.message, stack: err.stack });
    post({ type: "status", value: "failed" });
  } finally {
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
    }
  }
}

patchConsole();

window.addEventListener("error", (event) => {
  post({ type: "runtime-error", message: event.message, stack: event.error?.stack });
  post({ type: "status", value: "failed" });
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
  post({ type: "runtime-error", message: reason.message, stack: reason.stack });
  post({ type: "status", value: "failed" });
});

window.addEventListener("message", (event) => {
  if (event.data?.type === "run") {
    void runSource(event.data);
  }
});

post({ type: "status", value: "idle" });
