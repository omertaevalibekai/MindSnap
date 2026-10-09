import type { OutputMode } from "./notes";
import type { ParsedPage } from "./parsed-page";
import type { SavedItem } from "./mindmap";
import type { Notebook } from "./storage";

export type RuntimeMessage =
  | { type: "SNAP_PAGE"; payload: { outputMode: OutputMode; depth: 1 | 2 | 3 | 4; parsedPage: ParsedPage } }
  | { type: "GET_STORAGE" }
  | { type: "SAVE_SETTINGS"; payload: Record<string, unknown> }
  | { type: "UPDATE_ITEM_NOTES"; payload: { id: string; userNotes: string } }
  | { type: "DELETE_ITEM"; payload: { id: string } }
  | { type: "CREATE_PROJECT"; payload: { name: string } }
  | { type: "DELETE_PROJECT"; payload: { projectId: string } }
  | { type: "CREATE_PROJECT_NOTE"; payload: { projectId: string; title?: string; content?: string } }
  | { type: "UPDATE_PROJECT_NOTE"; payload: { projectId: string; noteId: string; title?: string; content?: string } }
  | { type: "DELETE_PROJECT_NOTE"; payload: { projectId: string; noteId: string } }
  | { type: "ASSIGN_ITEM_PROJECT"; payload: { itemId: string; projectId: string | null } }
  | { type: "REGENERATE"; payload: { item: SavedItem } }
  | { type: "CONVERT_ITEM"; payload: { item: SavedItem; targetMode: OutputMode } };

export interface ProjectMutationResult {
  item?: SavedItem;
  project?: Notebook;
}

