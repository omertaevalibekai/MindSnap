import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAppStore } from "../stores/app-store";

export const SavedNotesPage = () => {
  const { storage, refresh } = useAppStore();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const itemsWithNotes = useMemo(
    () =>
      Object.values(storage?.items ?? {})
        .filter((item) => item.userNotes?.trim().length > 0)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [storage]
  );

  return (
    <main className="app-shell p-3">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="font-heading text-lg tracking-tight">Saved Notes</h1>
        <Link to="/" className="text-xs muted">
          <ChevronLeft size={14} />
        </Link>
      </header>
      <section className="panel-card space-y-2">
        {itemsWithNotes.length === 0 ? (
          <p className="text-xs muted">No saved notes yet.</p>
        ) : (
          itemsWithNotes.map((item) => (
            <Link key={item.id} to={`/notes/${item.id}`} className="block rounded-md border border-zinc-700 p-2">
              <div className="text-sm font-semibold">{item.sourceTitle}</div>
              <div className="mt-1 line-clamp-2 text-xs muted">{item.autoSummary || item.userNotes.slice(0, 120)}</div>
            </Link>
          ))
        )}
      </section>
    </main>
  );
};

