export type OutputMode =
  | "mindmap"
  | "cornell"
  | "outline"
  | "flashcards"
  | "summary"
  | "timeline"
  | "comparison"
  | "feynman"
  | "cheatsheet";

export interface OutputModeConfig {
  id: OutputMode;
  label: string;
  icon: string;
  description: string;
  bestFor: string;
  promptKey: string;
  component: string;
  accent: string;
}

export const OUTPUT_MODES: OutputModeConfig[] = [
  { id: "mindmap", label: "Mind Map", icon: "??", description: "Interactive knowledge graph", bestFor: "Documentation, complex topics, overview articles", promptKey: "MINDMAP_PROMPT", component: "MindMapCanvas", accent: "#6366f1" },
  { id: "cornell", label: "Cornell Notes", icon: "??", description: "Cues | Notes | Summary", bestFor: "Lectures, articles, study materials", promptKey: "CORNELL_PROMPT", component: "CornellView", accent: "#f59e0b" },
  { id: "flashcards", label: "Flashcards", icon: "??", description: "Question -> Answer", bestFor: "Exam prep and memorization", promptKey: "FLASHCARDS_PROMPT", component: "FlashcardsView", accent: "#8b5cf6" },
  { id: "timeline", label: "Timeline", icon: "?", description: "Chronological events", bestFor: "History, biographies, roadmaps", promptKey: "TIMELINE_PROMPT", component: "TimelineView", accent: "#f97316" },
  { id: "comparison", label: "Comparison", icon: "??", description: "Comparative analysis table", bestFor: "Reviews and trade-off analysis", promptKey: "COMPARISON_PROMPT", component: "ComparisonView", accent: "#ec4899" },
  { id: "feynman", label: "Feynman", icon: "??", description: "Explain in simple terms", bestFor: "Complex concepts and technical topics", promptKey: "FEYNMAN_PROMPT", component: "FeynmanView", accent: "#84cc16" },
  { id: "cheatsheet", label: "Cheatsheet", icon: "?", description: "Operational playbook", bestFor: "APIs, syntax, formulas, workflows", promptKey: "CHEATSHEET_PROMPT", component: "CheatsheetView", accent: "#14b8a6" }
];

