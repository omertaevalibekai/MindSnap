import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAppStore } from "../stores/app-store";

export const NotesPage = () => {
  const { id = "" } = useParams();
  const { storage, refresh } = useAppStore();
  const [noteDraft, setNoteDraft] = useState("");
  const [status, setStatus] = useState("");
  const [projectTargetId, setProjectTargetId] = useState("");
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const item = storage?.items[id];
  const projects = Object.values(storage?.notebooks ?? {}).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  useEffect(() => {
    setNoteDraft(item?.userNotes ?? "");
  }, [item?.userNotes, id]);

  const saveNotes = async (content: string): Promise<void> => {
    if (!item) return;
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
    setStatus("Adding to project...");
    const response = await chrome.runtime.sendMessage({
      type: "CREATE_PROJECT_NOTE",
      payload: {
        projectId: projectTargetId,
        title: firstWords(content, 3),
        content
      }
    });
    if (!response?.ok) {
      setStatus(response?.error ?? "Failed to add note to project.");
      return;
    }
    setStatus("Added to project");
    await refresh();
  };

  useEffect(() => {
    if (!item) return;
    if (noteDraft === item.userNotes) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void saveNotes(noteDraft);
    }, 850);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [noteDraft, item?.id]);

  if (!item) {
    return <main className="p-4 text-sm">Notes item not found</main>;
  }

  return (
    <main className="app-shell min-h-screen p-4">
      <section className="panel-card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-base">Notes Window</h1>
            <p className="text-xs muted">{item.sourceTitle}</p>
          </div>
          <Link to={`/view/${item.id}`} className="rounded border border-zinc-700 px-2 py-1 text-xs">
            <ChevronLeft size={14} />
          </Link>
        </div>
        <div className="rounded border border-zinc-700 bg-zinc-900/70 p-2 text-xs text-slate-200">
          {item.autoSummary || "No summary yet"}
        </div>
        <textarea
          className="min-h-[65vh] w-full rounded border border-zinc-700 bg-zinc-950 p-3 text-sm"
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
          placeholder="Write your notes here..."
        />
        <div className="flex items-center gap-2">
          <select
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
            value={projectTargetId}
            onChange={(event) => setProjectTargetId(event.target.value)}
          >
            <option value="">Select project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
          <button className="rounded border border-zinc-700 px-3 py-1 text-xs" onClick={() => void addNoteToProject()}>
            Add note to project
          </button>
          <button className="rounded bg-[#6d5efb] px-3 py-1 text-xs text-white" onClick={() => void saveNotes(noteDraft)}>
            Save Notes
          </button>
          <span className="text-xs muted">{status}</span>
        </div>
      </section>
    </main>
  );
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

