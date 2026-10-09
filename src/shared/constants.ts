import type { OutputMode } from "./types/notes";

export const MAX_INPUT_CHARS = 30000;

export const OUTPUT_MODE_LABELS: Record<OutputMode, string> = {
  mindmap: "Mind Map",
  cornell: "Cornell",
  outline: "Outline",
  flashcards: "Flashcards",
  summary: "Summary",
  timeline: "Timeline",
  comparison: "Comparison",
  feynman: "Feynman",
  cheatsheet: "Cheatsheet"
};

