import JSZip from "jszip";
import type { PlaygroundAsset } from "./playground-types";

export interface PlaygroundZipInput {
  name: string;
  source: string;
  shareUrl: string;
  assets: PlaygroundAsset[];
}

export async function createPlaygroundZip(input: PlaygroundZipInput): Promise<Blob> {
  const zip = new JSZip();
  const assetsFolder = zip.folder("assets");
  const assets = input.assets.map((asset) => `- ${asset.name} (${formatBytes(asset.size)})`);

  zip.file("playground.js", input.source);
  zip.file(
    "share-url.txt",
    [
      "Babylon Lite Playground share URL",
      "",
      `Name: ${input.name}`,
      "",
      "Uploaded assets:",
      ...(assets.length > 0 ? assets : ["- none"]),
      "",
      input.shareUrl,
      "",
      "Note: share URLs include source code only. Uploaded assets are included in this zip under assets/.",
      "",
    ].join("\n"),
  );

  for (const asset of input.assets) {
    assetsFolder?.file(safeZipPath(asset.name), dataUrlToUint8Array(asset.url));
  }

  return zip.generateAsync({ type: "blob" });
}

export interface PlaygroundZipOutput {
  name: string;
  source: string;
  assets: PlaygroundAsset[];
}

export async function readPlaygroundZip(file: File): Promise<PlaygroundZipOutput> {
  const zip = await JSZip.loadAsync(file);
  const sourceFile = zip.file("playground.js");

  if (!sourceFile) {
    throw new Error("ZIP does not contain playground.js.");
  }

  const source = await sourceFile.async("string");
  const manifest = zip.file("share-url.txt") ? await zip.file("share-url.txt")!.async("string") : "";
  const name = readManifestName(manifest) || file.name.replace(/\.zip$/i, "") || "Imported Scene";
  const assets: PlaygroundAsset[] = [];
  const assetEntries = Object.values(zip.files).filter((entry) => !entry.dir && entry.name.startsWith("assets/"));

  for (const entry of assetEntries) {
    const bytes = await entry.async("uint8array");
    const name = entry.name.slice("assets/".length);
    if (!name) {
      continue;
    }

    assets.push({
      name,
      url: uint8ArrayToDataUrl(bytes, inferMimeType(name)),
      type: inferMimeType(name),
      size: bytes.byteLength,
    });
  }

  return { name, source, assets };
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) {
    throw new Error("Invalid asset data URL.");
  }

  const header = dataUrl.slice(0, commaIndex);
  const body = dataUrl.slice(commaIndex + 1);

  if (header.includes(";base64")) {
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  return new TextEncoder().encode(decodeURIComponent(body));
}

function safeZipPath(name: string): string {
  return name
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part !== "" && part !== "." && part !== "..")
    .join("_");
}

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function readManifestName(manifest: string): string {
  const line = manifest
    .split(/\r?\n/)
    .find((value) => value.trim().toLowerCase().startsWith("name:"));

  return line?.slice(line.indexOf(":") + 1).trim() ?? "";
}

function uint8ArrayToDataUrl(bytes: Uint8Array, type: string): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return `data:${type};base64,${btoa(binary)}`;
}

function inferMimeType(name: string): string {
  const extension = name.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "glb":
      return "model/gltf-binary";
    case "gltf":
      return "model/gltf+json";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "ktx2":
      return "image/ktx2";
    case "basis":
      return "image/basis";
    default:
      return "application/octet-stream";
  }
}
