import type { OutputMode } from "./notes";

export interface ProjectNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notebook {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
  itemIds: string[];
  notes?: string;
  projectNotes: ProjectNote[];
}

export interface StorageSchema {
  settings: {
    theme: "dark" | "light" | "auto";
    defaultOutputMode: OutputMode;
    defaultDepth: 1 | 2 | 3 | 4;
    language: "en" | "ru";
  };
  notebooks: Record<string, Notebook>;
  items: Record<string, import("./mindmap").SavedItem>;
  searchIndex: Record<string, string>;
  aiCache: Record<string, { raw: string; mode: OutputMode; createdAt: string }>;
  stats: {
    totalItems: number;
    totalTokensUsed: number;
    itemsThisMonth: number;
    byMode: Record<OutputMode, number>;
  };
}

