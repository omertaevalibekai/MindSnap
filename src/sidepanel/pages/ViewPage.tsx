import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAppStore } from "../stores/app-store";
import { MindMapCanvas } from "../components/mindmap/MindMapCanvas";
import type { CanvasMindNode } from "../components/mindmap/MindMapCanvas";
import {
  CheatsheetView,
  ComparisonView,
  CornellView,
  FlashcardsView,
  FeynmanView,
  OutlineView,
  SummaryView,
  TimelineView
} from "../components/notes/Views";

export const ViewPage = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { storage, refresh } = useAppStore();
  const [noteDraft, setNoteDraft] = useState("");
  const [status, setStatus] = useState("");
  const [projectTargetId, setProjectTargetId] = useState("");
  const saveTimer = useRef<number | null>(null);
  const [selectedNode, setSelectedNode] = useState<CanvasMindNode | null>(null);
  useEffect(() => { void refresh(); }, [refresh]);
  const item = storage?.items[id];
  useEffect(() => {
    setNoteDraft(item?.userNotes ?? "");
  }, [item?.userNotes, id]);

  const generatedMindMapNotes = useMemo(() => {
    if (!item || item.outputMode !== "mindmap") return "";
    const data = item.data as {
      root?: { label?: string; summary?: string; children?: unknown[]; importance?: string; nodeType?: string };
      metadata?: { keyInsights?: string[]; suggestedTags?: string[]; totalNodes?: number; maxDepth?: number };
    };
    const root = data.root;
    if (!root) return "";
    return buildDetailedMindMapNotes({
      title: item.sourceTitle,
      url: item.sourceUrl,
      root,
      metadata: data.metadata
    });
  }, [item]);
  const cleanedSummary = useMemo(() => sanitizeSummaryText(item?.autoSummary ?? ""), [item?.autoSummary]);
  const projects = useMemo(
    () => Object.values(storage?.notebooks ?? {}).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [storage?.notebooks]
  );

  if (!item) {
    return <main className="p-4 text-sm">Item not found</main>;
  }

  const saveNotes = async (content: string): Promise<void> => {
    setStatus("Saving...");
    const response = await chrome.runtime.sendMessage({
      type: "UPDATE_ITEM_NOTES",
      payload: { id: item.id, userNotes: content }
    });
    if (!response?.ok) {
      setStatus(response?.error ?? "Failed to save notes.");
      return;
    }
    setStatus("Saved");
    await refresh();
  };

  useEffect(() => {
    if (!item) return;
    if (noteDraft === item.userNotes) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void saveNotes(noteDraft);
    }, 900);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [noteDraft, item?.id]);

  const appendSelectedNode = (): void => {
    if (!selectedNode) return;
    const line = `- ${selectedNode.label ?? "Node"}: ${selectedNode.summary ?? ""}`.trim();
    setNoteDraft((prev) => (prev ? `${prev}\n${line}` : line));
  };

  const appendQuickSummary = (): void => {
    const line = cleanedSummary.trim();
    if (!line) return;
    setNoteDraft((prev) => (prev ? `${prev}\n\n## Quick Summary\n${line}` : `## Quick Summary\n${line}`));
  };

  const addNoteToProject = async (): Promise<void> => {
    if (!projectTargetId.trim()) {
      setStatus("Choose a project first.");
      return;
    }
    const content = noteDraft.trim();
    if (!content) {
      setStatus("Note is empty.");
      return;
    }
    const title = firstWords(content, 3);
    setStatus("Adding to project...");
    const response = await chrome.runtime.sendMessage({
      type: "CREATE_PROJECT_NOTE",
      payload: { projectId: projectTargetId, title, content }
    });
    if (!response?.ok) {
      setStatus(response?.error ?? "Failed to add note to project.");
      return;
    }
    setStatus("Added to project");
    await refresh();
  };

  return (
    <main className="p-3">
      <header className="mb-3 panel-card">
        <div className="mb-2">
          <button
            className="rounded border border-slate-600 px-2 py-1 text-xs"
            onClick={() => navigate("/")}
          >
            <ChevronLeft size={14} />
          </button>
        </div>
        <h1 className="font-heading text-sm">{item.sourceTitle}</h1>
        <p className="text-xs text-slate-400">{item.outputMode}</p>
      </header>
      {item.outputMode === "mindmap" ? (
        <section className="panel-card mb-3 space-y-3">
          <h2 className="font-heading text-sm">MindMap Workspace</h2>
          <div className="rounded border border-slate-700 bg-slate-900 p-2">
            <p className="mb-1 text-[11px] font-semibold text-slate-300">Quick Summary</p>
            <p className="text-xs text-slate-200">{cleanedSummary || "Summary is being generated..."}</p>
          </div>
          <MindMapCanvas
            data={item.data}
            onNodeSelect={setSelectedNode}
            onBranchNotes={(branchNotes) => setNoteDraft((prev) => (prev ? `${prev}\n\n${branchNotes}` : branchNotes))}
          />
          {selectedNode ? (
            <div className="rounded border border-slate-700 bg-slate-900 p-2 text-xs">
              <div className="text-slate-200">{selectedNode.label}</div>
              <div className="text-slate-300">{selectedNode.summary || "No summary"}</div>
              {selectedNode.theses && selectedNode.theses.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-slate-200">
                  {selectedNode.theses.map((thesis, index) => (
                    <li key={`${selectedNode.id}-thesis-${index}`} className="font-semibold">{thesis}</li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="rounded border border-slate-600 px-2 py-1" onClick={appendSelectedNode}>
                  Add selected node to notes
                </button>
                <button className="rounded border border-slate-600 px-2 py-1" onClick={appendQuickSummary}>
                  Add quick summary
                </button>
              </div>
            </div>
          ) : null}
          <div className="space-y-2 rounded border border-slate-700 bg-slate-900 p-2">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-sm">Live Notes</h3>
              <div className="flex gap-2">
                <button
                  className="rounded border border-slate-600 px-2 py-1 text-xs"
                  onClick={() => setNoteDraft(generatedMindMapNotes)}
                >
                  Generate full notes from mind map
                </button>
              </div>
            </div>
            <textarea
              className="min-h-48 w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs"
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Write Notion-style notes here..."
            />
            <div className="flex items-center gap-2">
              <select
                className="rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs"
                value={projectTargetId}
                onChange={(event) => setProjectTargetId(event.target.value)}
              >
                <option value="">Select project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              <button className="rounded border border-slate-600 px-3 py-1 text-xs" onClick={() => void addNoteToProject()}>
                Add note to project
              </button>
              <button className="rounded bg-indigo-500 px-3 py-1 text-xs" onClick={() => void saveNotes(noteDraft)}>
                Save Notes
              </button>
              <span className="text-xs text-slate-400">{status}</span>
            </div>
          </div>
        </section>
      ) : null}
      {item.outputMode !== "mindmap" ? (
        <section className="panel-card mb-3 space-y-2">
          <h2 className="font-heading text-sm">Quick Summary</h2>
          <p className="text-xs text-slate-200">{cleanedSummary || "Summary is being generated..."}</p>
        </section>
      ) : null}
      {item.outputMode === "cornell" ? <CornellView data={item.data} /> : null}
      {item.outputMode === "outline" ? <OutlineView data={item.data} /> : null}
      {item.outputMode === "flashcards" ? <FlashcardsView data={item.data} /> : null}
      {item.outputMode === "summary" ? <SummaryView data={item.data} /> : null}
      {item.outputMode === "timeline" ? <TimelineView data={item.data} /> : null}
      {item.outputMode === "comparison" ? <ComparisonView data={item.data} /> : null}
      {item.outputMode === "feynman" ? <FeynmanView data={item.data} /> : null}
      {item.outputMode === "cheatsheet" ? <CheatsheetView data={item.data} /> : null}
      {["outline", "summary"].includes(item.outputMode) ? <section className="panel-card mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm">Notion-style Notes</h2>
        </div>
        <textarea
          className="min-h-28 w-full rounded border border-slate-700 bg-slate-900 p-2 text-xs"
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
          placeholder="Write your notes here..."
        />
        <div className="flex items-center gap-2">
          <select
            className="rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs"
            value={projectTargetId}
            onChange={(event) => setProjectTargetId(event.target.value)}
          >
            <option value="">Select project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
          <button className="rounded border border-slate-600 px-3 py-1 text-xs" onClick={() => void addNoteToProject()}>
            Add note to project
          </button>
          <button className="rounded bg-indigo-500 px-3 py-1 text-xs" onClick={() => void saveNotes(noteDraft)}>
            Save Notes
          </button>
          <span className="text-xs text-slate-400">{status}</span>
        </div>
      </section> : null}
    </main>
  );
};

const buildDetailedMindMapNotes = ({
  title,
  url,
  root,
  metadata
}: {
  title: string;
  url: string;
  root: { label?: string; summary?: string; children?: unknown[]; importance?: string; nodeType?: string };
  metadata?: { keyInsights?: string[]; suggestedTags?: string[]; totalNodes?: number; maxDepth?: number };
}): string => {
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`Source: ${url}`);
  lines.push("");
  lines.push("## Topic Overview");
  lines.push(`${root.label ?? "Main topic"} - ${root.summary ?? ""}`.trim());
  lines.push("");
  if (metadata) {
    lines.push("## Structure");
    lines.push(`- Total nodes: ${metadata.totalNodes ?? "-"}`);
    lines.push(`- Max depth: ${metadata.maxDepth ?? "-"}`);
    lines.push("");
    if (metadata.keyInsights && metadata.keyInsights.length > 0) {
      lines.push("## Key Insights");
      for (const insight of metadata.keyInsights) lines.push(`- ${insight}`);
      lines.push("");
    }
  }
  lines.push("## Mind Map Notes");
  lines.push(...toDetailedBulletNotes(root, 0));
  if (metadata?.suggestedTags?.length) {
    lines.push("");
    lines.push("## Suggested Tags");
    lines.push(metadata.suggestedTags.map((tag) => `#${tag}`).join(" "));
  }
  return lines.join("\n").trim();
};

const toDetailedBulletNotes = (
  node: { label?: string; summary?: string; children?: unknown[]; importance?: string; nodeType?: string },
  depth: number
): string[] => {
  const indent = "  ".repeat(depth);
  const importance = node.importance ? ` [${node.importance}]` : "";
  const nodeType = node.nodeType ? ` (${node.nodeType})` : "";
  const line = `${indent}- ${node.label ?? "Node"}${importance}${nodeType}: ${node.summary ?? ""}`.trimEnd();
  const children = Array.isArray(node.children)
    ? (node.children as { label?: string; summary?: string; children?: unknown[]; importance?: string; nodeType?: string }[])
    : [];
  return [line, ...children.flatMap((child) => toDetailedBulletNotes(child, depth + 1))];
};

const sanitizeSummaryText = (value: string): string => {
  const lines = value
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^#{1,6}\s*/.test(line))
    .filter((line) => !/^[-*]\s*/.test(line))
    .filter((line) => !/^t\s*;?\s*l\s*;?\s*d\s*;?\s*r[:\-]*/i.test(line))
    .filter((line) => !/^tldr[:\-]*/i.test(line));
  return lines.join(" ").trim();
};

const firstWords = (value: string, count: number): string => {
  const words = value
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, count);
  return words.join(" ") || "Untitled note";
};

