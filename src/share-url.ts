import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { SharePayload } from "./playground-types";

const HASH_PREFIX = "#share=";

export function encodeSharePayload(payload: SharePayload): string {
  return `${location.origin}${location.pathname}${HASH_PREFIX}${compressToEncodedURIComponent(
    JSON.stringify(payload),
  )}`;
}

export function readSharePayload(): SharePayload | null {
  if (!location.hash.startsWith(HASH_PREFIX)) {
    return null;
  }

  const compressed = location.hash.slice(HASH_PREFIX.length);
  const json = decompressFromEncodedURIComponent(compressed);
  if (!json) {
    return null;
  }

  try {
    const payload = JSON.parse(json) as SharePayload;
    if (payload.version === 1 && typeof payload.source === "string") {
      return payload;
    }
  } catch {
    return null;
  }

  return null;
}
