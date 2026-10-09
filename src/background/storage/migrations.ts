import type { StorageSchema } from "../../shared/types/storage";
import { OUTPUT_MODES } from "../../shared/types/notes";

const byMode = Object.fromEntries(OUTPUT_MODES.map((mode) => [mode.id, 0])) as StorageSchema["stats"]["byMode"];

export const defaultStorage: StorageSchema = {
  settings: {
    theme: "dark",
    defaultOutputMode: "mindmap",
    defaultDepth: 3,
    language: "ru"
  },
  notebooks: {},
  items: {},
  searchIndex: {},
  aiCache: {},
  stats: {
    totalItems: 0,
    totalTokensUsed: 0,
    itemsThisMonth: 0,
    byMode
  }
};

