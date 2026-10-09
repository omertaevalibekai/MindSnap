import type { StorageSchema } from "../../shared/types/storage";
import { defaultStorage } from "./migrations";

const KEY = "mindsnap";

const mergeStorage = (raw: Partial<StorageSchema> | undefined): StorageSchema => {
  const source = raw ?? {};
  return {
    ...defaultStorage,
    ...source,
    settings: {
      ...defaultStorage.settings,
      ...(source.settings ?? {})
    },
    notebooks: {
      ...defaultStorage.notebooks,
      ...(source.notebooks ?? {})
    },
    items: {
      ...defaultStorage.items,
      ...(source.items ?? {})
    },
    searchIndex: {
      ...defaultStorage.searchIndex,
      ...(source.searchIndex ?? {})
    },
    aiCache: {
      ...defaultStorage.aiCache,
      ...(source.aiCache ?? {})
    },
    stats: {
      ...defaultStorage.stats,
      ...(source.stats ?? {}),
      byMode: {
        ...defaultStorage.stats.byMode,
        ...(source.stats?.byMode ?? {})
      }
    }
  };
};

export const storageService = {
  async getAll(): Promise<StorageSchema> {
    const raw = await chrome.storage.local.get(KEY);
    return mergeStorage(raw[KEY] as Partial<StorageSchema> | undefined);
  },
  async setAll(data: StorageSchema): Promise<void> {
    await chrome.storage.local.set({ [KEY]: data });
  },
  async patch(partial: Partial<StorageSchema>): Promise<StorageSchema> {
    const current = await this.getAll();
    const merged = { ...current, ...partial } as StorageSchema;
    await this.setAll(merged);
    return merged;
  }
};

