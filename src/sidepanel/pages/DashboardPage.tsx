import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Library, NotebookPen } from "lucide-react";
import { OutputModeSelector, SnapButton } from "../components/generation/OutputModeSelector";
import { useAppStore } from "../stores/app-store";

export const DashboardPage = () => {
  const refresh = useAppStore((s) => s.refresh);
  const storage = useAppStore((s) => s.storage);
  const openKnowledgeBaseWindow = async (): Promise<void> => {
    const extensionKnowledgeBaseUrl = chrome.runtime.getURL("src/sidepanel/index.html#/knowledge-base");
    try {
      await chrome.tabs.create({ url: extensionKnowledgeBaseUrl });
    } catch {
      window.open(extensionKnowledgeBaseUrl, "_blank", "noopener,noreferrer");
    }
  };
  const items = useMemo(
    () =>
      Object.values(storage?.items ?? {})
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 15),
    [storage]
  );
  const projects = useMemo(
    () =>
      Object.values(storage?.notebooks ?? {})
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 8),
    [storage]
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <main className="app-shell p-3">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="font-heading text-lg tracking-tight">MindSnap</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void openKnowledgeBaseWindow()}
            className="rounded border border-zinc-700 p-1.5 muted"
            title="Open Knowledge Base window"
          >
            <Library size={14} />
          </button>
          <Link to="/notes" className="rounded border border-zinc-700 p-1.5 muted" title="Saved Notes">
            <NotebookPen size={14} />
          </Link>
        </div>
      </header>

      <section className="soft-card mb-3 p-3">
        <div className="flex justify-start">
          <button
            onClick={() => void openKnowledgeBaseWindow()}
            className="rounded border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700"
          >
            Open Knowledge Base
          </button>
        </div>
      </section>

      <div className="space-y-3">
        <OutputModeSelector />
        <SnapButton />
        <section className="panel-card">
          <h2 className="mb-2 text-sm font-heading">Projects</h2>
          <div className="space-y-2">
            {projects.length === 0 ? <p className="text-xs text-slate-400">No projects yet.</p> : projects.map((project) => (
              <Link key={project.id} to={`/knowledge-base?project=${project.id}`} className="block rounded-md border border-zinc-700 p-2 text-xs">
                <div className="flex items-center gap-2 font-semibold">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: project.color || "#645cff" }}
                  />
                  <span>{project.name}</span>
                </div>
                <div className="muted">{project.itemIds.length} maps - {(project.projectNotes ?? []).length} notes</div>
              </Link>
            ))}
          </div>
        </section>
        <section className="panel-card">
          <h2 className="mb-2 text-sm font-heading">Recent</h2>
          <div className="space-y-2">
            {items.length === 0 ? <p className="text-xs text-slate-400">Nothing here yet. Press Snap.</p> : items.map((item) => (
              <Link key={item.id} to={`/view/${item.id}`} className="block rounded-md border border-zinc-700 p-2 text-xs">
                <div className="font-semibold">{item.sourceTitle}</div>
                <div className="muted">{item.outputMode}</div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
};

