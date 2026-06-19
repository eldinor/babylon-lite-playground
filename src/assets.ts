import type { PlaygroundAsset } from "./playground-types";

export interface AssetStore {
  add(files: FileList): Promise<PlaygroundAsset[]>;
  addAssets(nextAssets: PlaygroundAsset[]): PlaygroundAsset[];
  remove(name: string): PlaygroundAsset[];
  list(): PlaygroundAsset[];
  map(): Record<string, string>;
  clear(): void;
}

export function createAssetStore(): AssetStore {
  const assets = new Map<string, PlaygroundAsset>();

  return {
    async add(files) {
      for (const file of Array.from(files)) {
        assets.set(file.name, {
          name: file.name,
          url: await readFileAsDataUrl(file),
          type: file.type || "application/octet-stream",
          size: file.size,
        });
      }

      return Array.from(assets.values());
    },

    addAssets(nextAssets) {
      for (const asset of nextAssets) {
        assets.set(asset.name, asset);
      }

      return Array.from(assets.values());
    },

    remove(name) {
      assets.delete(name);

      return Array.from(assets.values());
    },

    list() {
      return Array.from(assets.values());
    },

    map() {
      return Object.fromEntries(Array.from(assets.values()).map((asset) => [asset.name, withFilenameHint(asset)]));
    },

    clear() {
      assets.clear();
    },
  };
}

function withFilenameHint(asset: PlaygroundAsset): string {
  return `${asset.url}#${encodeURIComponent(asset.name)}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error ?? new Error(`Could not read ${file.name}.`)));
    reader.readAsDataURL(file);
  });
}

export function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
