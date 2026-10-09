import { create } from "zustand";
import type { OutputMode } from "../../shared/types/notes";
import type { ParsedPage } from "../../shared/types/parsed-page";
import type { SavedItem } from "../../shared/types/mindmap";
import { useAppStore } from "./app-store";

const MODE_KEY = "mindsnap:last-mode";
const DEPTH_KEY = "mindsnap:last-depth";

interface GenerationStore {
  outputMode: OutputMode;
  depth: 1 | 2 | 3 | 4;
  status: "idle" | "loading" | "error";
  stage: "idle" | "parsing" | "analyzing" | "building";
  setOutputMode: (mode: OutputMode) => void;
  setDepth: (depth: 1 | 2 | 3 | 4) => void;
  generate: (parsedPage: ParsedPage) => Promise<SavedItem>;
}

const getInitialMode = (): OutputMode => (localStorage.getItem(MODE_KEY) as OutputMode) || "mindmap";
const getInitialDepth = (): 1 | 2 | 3 | 4 => {
  const value = Number(localStorage.getItem(DEPTH_KEY));
  return value >= 1 && value <= 4 ? (value as 1 | 2 | 3 | 4) : 3;
};

const sendRuntimeMessage = <T>(message: unknown): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: T) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(`Runtime message error: ${runtimeError.message}`));
        return;
      }
      resolve(response);
    });
  });

export const useGenerationStore = create<GenerationStore>((set, get) => ({
  outputMode: getInitialMode(),
  depth: getInitialDepth(),
  status: "idle",
  stage: "idle",
  setOutputMode: (outputMode) => {
    localStorage.setItem(MODE_KEY, outputMode);
    set({ outputMode });
  },
  setDepth: (depth) => {
    localStorage.setItem(DEPTH_KEY, String(depth));
    set({ depth });
  },
  generate: async (parsedPage) => {
    set({ status: "loading", stage: "parsing" });
    const { outputMode, depth } = get();
    await new Promise((resolve) => setTimeout(resolve, 250));
    set({ stage: "analyzing" });

    let response: { ok?: boolean; error?: string; result?: unknown } | undefined;
    try {
      response = await sendRuntimeMessage<{ ok?: boolean; error?: string; result?: unknown }>({
        type: "SNAP_PAGE",
        payload: { outputMode, depth, parsedPage }
      });
    } catch (error) {
      set({ status: "error", stage: "idle" });
      throw new Error(error instanceof Error ? error.message : "Background service is unavailable. Reload extension.");
    }
    if (!response || typeof response !== "object") {
      set({ status: "error", stage: "idle" });
      throw new Error(`Malformed background response: ${String(response)}`);
    }
    if (!("ok" in response)) {
      set({ status: "error", stage: "idle" });
      throw new Error(`Missing 'ok' flag in background response: ${JSON.stringify(response)}`);
    }
    if (!response.ok) {
      set({ status: "error", stage: "idle" });
      throw new Error(response.error ?? `Generation failed. Raw response: ${JSON.stringify(response)}`);
    }

    set({ stage: "building" });
    await useAppStore.getState().refresh();
    set({ status: "idle", stage: "idle" });
    return response.result as SavedItem;
  }
}));
