export type PreviewStatus = "idle" | "running" | "ready" | "failed";
export type ConsoleLevel = "log" | "warn" | "error";

export interface PlaygroundAsset {
  name: string;
  url: string;
  type: string;
  size: number;
}

export type AssetMap = Record<string, string>;

export interface Snippet {
  id: string;
  name: string;
  source: string;
  updatedAt: number;
}

export interface SharePayload {
  version: 1;
  name?: string;
  source: string;
}

export type ParentMessage = {
  type: "run";
  source: string;
  assets: AssetMap;
};

export type PreviewMessage =
  | { type: "status"; value: PreviewStatus }
  | { type: "console"; level: ConsoleLevel; args: string[] }
  | { type: "runtime-error"; message: string; stack?: string };
