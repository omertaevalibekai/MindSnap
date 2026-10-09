import { generateLocally, generateQuickNotes } from "./ai/local-generator";
import { parseResponse } from "./ai/response-parser";
import { normalizeInput } from "./ai/token-counter";
import { storageService } from "./storage/storage-service";
import { hashString, uuid } from "../shared/utils";
import type { RuntimeMessage } from "../shared/types/messages";
import type { OutputMode } from "../shared/types/notes";

const AI_CACHE_LIMIT = 60;
const PROJECT_COLORS = ["#645cff", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#ef4444", "#8b5cf6", "#14b8a6"];

const cacheKey = async (mode: OutputMode, depth: number, text: string): Promise<string> =>
  hashString(`${mode}|${depth}|${text}`);

const pruneCache = (
  cache: Record<string, { raw: string; mode: OutputMode; createdAt: string }>
): Record<string, { raw: string; mode: OutputMode; createdAt: string }> => {
  const entries = Object.entries(cache).sort((a, b) => b[1].createdAt.localeCompare(a[1].createdAt));
  return Object.fromEntries(entries.slice(0, AI_CACHE_LIMIT));
};

const cleanAutoSummary = (raw: string): string => {
  if (!raw.trim()) return "";
  const normalized = raw
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^#{1,6}\s*/.test(line))
    .filter((line) => !/^[-*]\s*/.test(line))
    .filter((line) => !/^(t\s*;?\s*l\s*;?\s*d\s*;?\s*r)\b[:\-]*/i.test(line))
    .filter((line) => !/^tldr\b[:\-]*/i.test(line));

  const joined = normalized.join(" ");
  if (!joined) return "";
  const sentences = joined
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  return sentences.join(" ");
};

const extractKeywords = (input: string, max: number): string[] => {
  const stop = new Set([
    "the", "and", "for", "with", "that", "this", "from", "into", "about", "your", "have", "has", "are", "was", "were",
    "как", "это", "для", "что", "или", "при", "над", "под", "без", "про", "его", "ее", "она", "они", "also", "then"
  ]);
  const words = input
    .toLowerCase()
    .match(/[a-zа-яё0-9-]{3,}/gi)
    ?.map((word) => word.trim())
    .filter((word) => word.length >= 3 && !stop.has(word)) ?? [];

  const freq = new Map<string, number>();
  words.forEach((word) => freq.set(word, (freq.get(word) ?? 0) + 1));
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, max);
};

const deriveTags = ({
  outputMode,
  parsed,
  parsedPage,
  text,
  autoSummary
}: {
  outputMode: OutputMode;
  parsed: unknown;
  parsedPage: { title: string; headings?: string[] };
  text: string;
  autoSummary: string;
}): string[] => {
  const tags = new Set<string>([outputMode]);
  const rootObject = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const metadata = rootObject.metadata && typeof rootObject.metadata === "object" ? (rootObject.metadata as Record<string, unknown>) : {};
  const suggestedTags = Array.isArray(metadata.suggestedTags) ? metadata.suggestedTags : [];

  suggestedTags.forEach((tag) => {
    const normalized = String(tag).trim().toLowerCase();
    if (normalized.length >= 2) tags.add(normalized);
  });

  const headingText = (parsedPage.headings ?? []).slice(0, 8).join(" ");
  const keywordBase = `${parsedPage.title} ${autoSummary} ${headingText} ${text.slice(0, 1400)}`;
  extractKeywords(keywordBase, 6).forEach((keyword) => tags.add(keyword));

  return [...tags].slice(0, 8);
};

const projectNotesOf = (
  project: { id: string; notes?: string; projectNotes?: Array<{ id: string; title: string; content: string; createdAt: string; updatedAt: string }> }
): Array<{ id: string; title: string; content: string; createdAt: string; updatedAt: string }> => {
  if (Array.isArray(project.projectNotes)) {
    return project.projectNotes;
  }
  if (project.notes && project.notes.trim()) {
    const now = new Date().toISOString();
    return [
      {
        id: `legacy-${project.id}`,
        title: "Main note",
        content: project.notes,
        createdAt: now,
        updatedAt: now
      }
    ];
  }
  return [];
};

export const handleMessage = async (message: RuntimeMessage): Promise<unknown> => {
  const storage = await storageService.getAll();

  switch (message.type) {
    case "GET_STORAGE":
      return storage;
    case "SAVE_SETTINGS": {
      const merged = { ...storage.settings, ...message.payload };
      await storageService.patch({ settings: merged });
      return merged;
    }
    case "UPDATE_ITEM_NOTES": {
      const current = storage.items[message.payload.id];
      if (!current) {
        throw new Error("Item not found.");
      }
      const updated = {
        ...current,
        userNotes: message.payload.userNotes,
        updatedAt: new Date().toISOString()
      };
      const items = { ...storage.items, [message.payload.id]: updated };
      await storageService.patch({ items });
      return updated;
    }
    case "DELETE_ITEM": {
      const nextItems = { ...storage.items };
      delete nextItems[message.payload.id];
      await storageService.patch({ items: nextItems });
      return { ok: true };
    }
    case "CREATE_PROJECT": {
      const name = message.payload.name.trim();
      if (!name) {
        throw new Error("Project name is required.");
      }
      const now = new Date().toISOString();
      const id = uuid();
      const color = PROJECT_COLORS[Object.keys(storage.notebooks).length % PROJECT_COLORS.length];
      const project = {
        id,
        name,
        icon: "folder",
        color,
        createdAt: now,
        itemIds: [],
        projectNotes: []
      };
      const notebooks = { ...storage.notebooks, [id]: project };
      await storageService.patch({ notebooks });
      return project;
    }
    case "DELETE_PROJECT": {
      const project = storage.notebooks[message.payload.projectId];
      if (!project) {
        throw new Error("Project not found.");
      }
      const notebooks = { ...storage.notebooks };
      delete notebooks[project.id];
      const items = Object.fromEntries(
        Object.entries(storage.items).map(([itemId, item]) => [
          itemId,
          item.notebookId === project.id
            ? {
                ...item,
                notebookId: null,
                updatedAt: new Date().toISOString()
              }
            : item
        ])
      );
      await storageService.patch({ notebooks, items });
      return { ok: true };
    }
    case "CREATE_PROJECT_NOTE": {
      const project = storage.notebooks[message.payload.projectId];
      if (!project) {
        throw new Error("Project not found.");
      }
      const now = new Date().toISOString();
      const title = message.payload.title?.trim() || "Untitled note";
      const note = {
        id: uuid(),
        title,
        content: typeof message.payload.content === "string" && message.payload.content.trim().length > 0
          ? message.payload.content
          : `# ${title}\n\n## Summary\n- \n\n## Details\n- `,
        createdAt: now,
        updatedAt: now
      };
      const notebooks = {
        ...storage.notebooks,
        [project.id]: {
          ...project,
          projectNotes: [...projectNotesOf(project), note]
        }
      };
      await storageService.patch({ notebooks });
      return note;
    }
    case "DELETE_PROJECT_NOTE": {
      const project = storage.notebooks[message.payload.projectId];
      if (!project) {
        throw new Error("Project not found.");
      }
      const notes = projectNotesOf(project);
      const exists = notes.some((note) => note.id === message.payload.noteId);
      if (!exists) {
        throw new Error("Project note not found.");
      }
      const notebooks = {
        ...storage.notebooks,
        [project.id]: {
          ...project,
          projectNotes: notes.filter((note) => note.id !== message.payload.noteId)
        }
      };
      await storageService.patch({ notebooks });
      return { ok: true };
    }
    case "UPDATE_PROJECT_NOTE": {
      const project = storage.notebooks[message.payload.projectId];
      if (!project) {
        throw new Error("Project not found.");
      }
      const notes = projectNotesOf(project);
      const target = notes.find((note) => note.id === message.payload.noteId);
      if (!target) {
        throw new Error("Project note not found.");
      }
      const updatedNotes = notes.map((note) =>
        note.id === target.id
          ? {
              ...note,
              title: typeof message.payload.title === "string" ? message.payload.title : note.title,
              content: typeof message.payload.content === "string" ? message.payload.content : note.content,
              updatedAt: new Date().toISOString()
            }
          : note
      );
      const notebooks = {
        ...storage.notebooks,
        [project.id]: {
          ...project,
          projectNotes: updatedNotes
        }
      };
      await storageService.patch({ notebooks });
      return updatedNotes.find((note) => note.id === target.id);
    }
    case "ASSIGN_ITEM_PROJECT": {
      const item = storage.items[message.payload.itemId];
      if (!item) {
        throw new Error("Item not found.");
      }
      const projectId = message.payload.projectId;
      if (projectId && !storage.notebooks[projectId]) {
        throw new Error("Project not found.");
      }

      const notebooks = { ...storage.notebooks };
      const prevProjectId = item.notebookId;
      if (prevProjectId && notebooks[prevProjectId]) {
        notebooks[prevProjectId] = {
          ...notebooks[prevProjectId],
          itemIds: notebooks[prevProjectId].itemIds.filter((id) => id !== item.id)
        };
      }
      if (projectId) {
        const target = notebooks[projectId];
        notebooks[projectId] = {
          ...target,
          itemIds: [...new Set([...target.itemIds, item.id])]
        };
      }

      const updatedItem = {
        ...item,
        notebookId: projectId,
        updatedAt: new Date().toISOString()
      };
      const items = { ...storage.items, [item.id]: updatedItem };
      await storageService.patch({ items, notebooks });
      return updatedItem;
    }
    case "SNAP_PAGE": {
      const { outputMode, depth, parsedPage } = message.payload;
      const { text, tokens } = normalizeInput(parsedPage.text);
      const key = await cacheKey(outputMode, depth, text);
      let raw = storage.aiCache[key]?.raw ?? "";
      let parsed: unknown;

      if (raw) {
        parsed = parseResponse(raw, outputMode);
      } else {
        parsed = generateLocally({ outputMode, depth, text, parsedPage });
        raw = JSON.stringify(parsed);
      }

      const chunks = [
        ...(parsedPage.paragraphs ?? []),
        ...(parsedPage.lists ?? []),
        ...text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)
      ].filter(Boolean);
      const quickNotes = generateQuickNotes(parsedPage.title, chunks.length > 0 ? chunks : [text.slice(0, 500)]);
      const autoSummary = cleanAutoSummary(quickNotes);
      const tags = deriveTags({ outputMode, parsed, parsedPage, text, autoSummary });
      const id = uuid();
      const now = new Date().toISOString();
      const item = {
        id,
        outputMode,
        sourceUrl: parsedPage.url,
        sourceTitle: parsedPage.title,
        favicon: "",
        data: parsed,
        tags,
        notebookId: null,
        createdAt: now,
        updatedAt: now,
        isFavorite: false,
        autoSummary,
        userNotes: quickNotes,
        sourceText: text
      };
      const items = { ...storage.items, [id]: item };
      const aiCache = pruneCache({
        ...storage.aiCache,
        [key]: { raw, mode: outputMode, createdAt: now }
      });
      await storageService.patch({
        items,
        aiCache,
        stats: {
          ...storage.stats,
          totalItems: Object.keys(items).length,
          totalTokensUsed: storage.stats.totalTokensUsed + tokens,
          byMode: {
            ...storage.stats.byMode,
            [outputMode]: storage.stats.byMode[outputMode] + 1
          }
        }
      });
      return item;
    }
    case "REGENERATE":
      return handleMessage({ type: "SNAP_PAGE", payload: { outputMode: message.payload.item.outputMode, depth: storage.settings.defaultDepth, parsedPage: { url: message.payload.item.sourceUrl, title: message.payload.item.sourceTitle, text: message.payload.item.sourceText, headings: [], paragraphs: [], lists: [] } } });
    case "CONVERT_ITEM":
      return handleMessage({ type: "SNAP_PAGE", payload: { outputMode: message.payload.targetMode, depth: storage.settings.defaultDepth, parsedPage: { url: message.payload.item.sourceUrl, title: message.payload.item.sourceTitle, text: message.payload.item.sourceText, headings: [], paragraphs: [], lists: [] } } });
    default:
      throw new Error("Unsupported message");
  }
};

