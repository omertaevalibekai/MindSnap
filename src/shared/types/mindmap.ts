import type { OutputMode } from "./notes";

export interface MindMapNode {
  id: string;
  label: string;
  summary: string;
  theses: string[];
  importance: "high" | "medium" | "low";
  nodeType: "concept" | "fact" | "example" | "warning" | "question" | "action";
  children: MindMapNode[];
}

export interface MindMapTree {
  root: MindMapNode;
  metadata: {
    totalNodes: number;
    maxDepth: number;
    keyInsights: string[];
    suggestedTags: string[];
  };
}

export interface SavedItem {
  id: string;
  outputMode: OutputMode;
  sourceUrl: string;
  sourceTitle: string;
  favicon: string;
  data: unknown;
  tags: string[];
  notebookId: string | null;
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
  autoSummary: string;
  userNotes: string;
  sourceText: string;
}

