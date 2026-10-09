import { create } from "zustand";
import type { StorageSchema } from "../../shared/types/storage";

interface AppStore {
  storage: StorageSchema | null;
  setStorage: (storage: StorageSchema) => void;
  refresh: () => Promise<void>;
}

export const useAppStore = create<AppStore>((set) => ({
  storage: null,
  setStorage: (storage) => set({ storage }),
  refresh: async () => {
    const response = await chrome.runtime.sendMessage({ type: "GET_STORAGE" });
    if (response?.ok) {
      set({ storage: response.result as StorageSchema });
    }
  }
}));

