import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookText, ChevronDown, ChevronRight, NotebookPen, Trash2 } from "lucide-react";
import { OUTPUT_MODES } from "../../shared/types/notes";
import { useAppStore } from "../stores/app-store";

type SidebarFilter = "projects" | "all" | "recent" | "starred" | "shared";
type ProjectTagFilter = "all" | "with-maps" | "with-notes" | "empty";
type DataTypeFilter = "all" | "mindmap" | "cornell" | "flashcards" | "timeline" | "comparison" | "feynman" | "cheatsheet";
type KBItem = {
  id: string;
  sourceTitle: string;
  outputMode: string;
  updatedAt: string;
  sourceUrl: string;
  data: unknown;
  notebookId: string | null;
};

export const KnowledgeBasePage = () => {
  const refresh = useAppStore((s) => s.refresh);
  const storage = useAppStore((s) => s.storage);
  const [query, setQuery] = useState("");
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>("projects");
  const [typesMenuOpen, setTypesMenuOpen] = useState(false);
  const [dataTypeFilter, setDataTypeFilter] = useState<DataTypeFilter>("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [projectTagFilter, setProjectTagFilter] = useState<ProjectTagFilter>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => {
    const hash = window.location.hash || "";
    const search = hash.includes("?") ? hash.slice(hash.indexOf("?")) : "";
    const params = new URLSearchParams(search);
    return params.get("project");
  });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const items = useMemo(
    () =>
      Object.values(storage?.items ?? {}).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [storage]
  );
  const projects = useMemo(
    () => Object.values(storage?.notebooks ?? {}).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [storage]
  );

  const itemTagsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    items.forEach((item) => {
      map.set(item.id, deriveUiTags(item));
    });
    return map;
  }, [items]);

  const tagStats = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((item) => {
      (itemTagsMap.get(item.id) ?? []).forEach((tag) => map.set(tag, (map.get(tag) ?? 0) + 1));
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [items, itemTagsMap]);

  const filteredBySidebar = useMemo(() => {
    const now = Date.now();
    if (sidebarFilter === "projects") {
      return [];
    }
    if (sidebarFilter === "recent") {
      return items.filter((item) => now - new Date(item.updatedAt).getTime() <= 3 * 24 * 60 * 60 * 1000);
    }
    if (sidebarFilter === "starred") {
      return items.filter((item) => item.isFavorite);
    }
    if (sidebarFilter === "shared") {
      return items.filter((item) => item.notebookId !== null);
    }
    return items;
  }, [items, sidebarFilter]);

  const filteredByProject = useMemo(() => {
    if (!selectedProjectId) return filteredBySidebar;
    return filteredBySidebar.filter((item) => item.notebookId === selectedProjectId);
  }, [filteredBySidebar, selectedProjectId]);

  const filteredByDataType = useMemo(() => {
    if (dataTypeFilter === "all") return filteredByProject;
    return filteredByProject.filter((item) => item.outputMode === dataTypeFilter);
  }, [filteredByProject, dataTypeFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byTag = activeTag
      ? filteredByDataType.filter((item) =>
          (itemTagsMap.get(item.id) ?? []).map((tag) => tag.toLowerCase()).includes(activeTag.toLowerCase())
        )
      : filteredByDataType;
    if (!q) return byTag;
    return byTag.filter((item) => {
      const target = [item.sourceTitle, item.outputMode, item.autoSummary, item.userNotes, ...(itemTagsMap.get(item.id) ?? [])].join(" ").toLowerCase();
      return target.includes(q);
    });
  }, [filteredByDataType, query, activeTag, itemTagsMap]);

  const sections = useMemo(() => groupByUpdatedAt(filtered), [filtered]);
  const totalCount = items.length;
  const projectStats = useMemo(() => {
    return projects.map((project) => {
      const projectItems = items.filter((item) => item.notebookId === project.id);
      const notesCount = (project.projectNotes ?? []).length;
      return { project, mapsCount: projectItems.length, notesCount };
    });
  }, [projects, items]);
  const filteredProjectStats = useMemo(() => {
    if (projectTagFilter === "with-maps") {
      return projectStats.filter((entry) => entry.mapsCount > 0);
    }
    if (projectTagFilter === "with-notes") {
      return projectStats.filter((entry) => entry.notesCount > 0);
    }
    if (projectTagFilter === "empty") {
      return projectStats.filter((entry) => entry.mapsCount === 0 && entry.notesCount === 0);
    }
    return projectStats;
  }, [projectStats, projectTagFilter]);
  const dataTypeOptions: Array<{ id: DataTypeFilter; label: string }> = [
    { id: "mindmap", label: "Mind Maps" },
    { id: "cornell", label: "Cornell Notes" },
    { id: "flashcards", label: "Flashcards" },
    { id: "timeline", label: "Timeline" },
    { id: "comparison", label: "Comparison" },
    { id: "feynman", label: "Feynman" },
    { id: "cheatsheet", label: "Cheatsheet" }
  ];
  const dataTypeCounts = useMemo(() => {
    const counts: Record<DataTypeFilter, number> = {
      all: items.length,
      mindmap: 0,
      cornell: 0,
      flashcards: 0,
      timeline: 0,
      comparison: 0,
      feynman: 0,
      cheatsheet: 0
    };
    items.forEach((item) => {
      const key = item.outputMode as DataTypeFilter;
      if (key in counts) counts[key] += 1;
    });
    return counts;
  }, [items]);
  const createProject = async (): Promise<void> => {
    const name = window.prompt("Project name");
    if (!name?.trim()) return;
    const response = await chrome.runtime.sendMessage({ type: "CREATE_PROJECT", payload: { name } });
    if (!response?.ok) return;
    await refresh();
  };

  const assignToProject = async (itemId: string, projectId: string | null): Promise<void> => {
    const response = await chrome.runtime.sendMessage({ type: "ASSIGN_ITEM_PROJECT", payload: { itemId, projectId } });
    if (!response?.ok) return;
    await refresh();
  };

  const openProjectNotesWindow = (projectId: string): void => {
    void createProjectNote(projectId);
  };

  const createProjectNote = async (projectId: string): Promise<void> => {
    const response = await chrome.runtime.sendMessage({
      type: "CREATE_PROJECT_NOTE",
      payload: { projectId, title: "Untitled note" }
    });
    if (!response?.ok || !response.result?.id) return;
    const url = chrome.runtime.getURL(`src/sidepanel/index.html#/projects/${projectId}/notes/${response.result.id}`);
    window.open(url, "_blank", "noopener,noreferrer");
    await refresh();
  };

  const deleteProject = async (projectId: string): Promise<void> => {
    const ok = window.confirm("Delete this project? Maps will stay in Knowledge Base.");
    if (!ok) return;
    const response = await chrome.runtime.sendMessage({
      type: "DELETE_PROJECT",
      payload: { projectId }
    });
    if (!response?.ok) return;
    if (selectedProjectId === projectId) {
      setSelectedProjectId(null);
      setSidebarFilter("projects");
    }
    await refresh();
  };

  const deleteProjectNote = async (projectId: string, noteId: string): Promise<void> => {
    const ok = window.confirm("Delete this note?");
    if (!ok) return;
    const response = await chrome.runtime.sendMessage({
      type: "DELETE_PROJECT_NOTE",
      payload: { projectId, noteId }
    });
    if (!response?.ok) return;
    await refresh();
  };

  return (
    <main className="kb-layout">
      <aside className="kb-sidebar">
        <div className="kb-brand">
          <div className="kb-brand-dot">
            <img
              src="/icons/logo.png"
              alt="MindSnap logo"
              className="kb-brand-logo"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = "/icons/icon-32.png";
              }}
            />
          </div>
          <div>
            <div className="kb-brand-title">MindSnap</div>
            <div className="kb-brand-sub">{totalCount} maps</div>
          </div>
        </div>

        <button className="kb-primary" onClick={() => void createProject()}>+ New project</button>

        <nav className="kb-nav">
          <button
            className={`kb-nav-item ${sidebarFilter === "projects" && selectedProjectId === null ? "kb-nav-item-active" : ""}`}
            onClick={() => {
              setSelectedProjectId(null);
              setSidebarFilter("projects");
            }}
          >
            All projects
            <span>{projects.length}</span>
          </button>
          <div className="kb-nav-group">
            <button
              className={`kb-nav-item ${(sidebarFilter === "all" || sidebarFilter === "recent" || sidebarFilter === "starred" || sidebarFilter === "shared") && selectedProjectId === null ? "kb-nav-item-active" : ""}`}
              onClick={() => {
                setSelectedProjectId(null);
                setSidebarFilter("all");
                setTypesMenuOpen((prev) => !prev);
              }}
            >
              <span className="kb-nav-label">
                {typesMenuOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                All data types
              </span>
              <span>{totalCount}</span>
            </button>
            {typesMenuOpen ? (
              <div className="kb-nav-submenu">
                <button className={`kb-nav-subitem ${dataTypeFilter === "all" ? "kb-nav-item-active" : ""}`} onClick={() => setDataTypeFilter("all")}>
                  All <span>{dataTypeCounts.all}</span>
                </button>
                {dataTypeOptions.map((option) => (
                  <button
                    key={option.id}
                    className={`kb-nav-subitem ${dataTypeFilter === option.id ? "kb-nav-item-active" : ""}`}
                    onClick={() => setDataTypeFilter(option.id)}
                  >
                    {option.label} <span>{dataTypeCounts[option.id]}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </nav>

        <div className="kb-tag-block">
          <div className="kb-tag-title">Projects</div>
          <div className="kb-project-list">
            {projectStats.map(({ project, mapsCount }) => (
              <button
                key={project.id}
                className={`kb-project-item ${selectedProjectId === project.id ? "kb-project-item-active" : ""}`}
                onClick={() => {
                  setSelectedProjectId(project.id);
                  setSidebarFilter("all");
                }}
              >
                <span className="kb-project-dot" style={{ background: project.color || "#645cff" }} />
                <span>{project.name}</span>
                <span>{mapsCount}</span>
              </button>
            ))}
          </div>
        </div>

        {sidebarFilter === "projects" && selectedProjectId === null ? (
          <div className="kb-tag-block">
            <div className="kb-tag-title">Project tags</div>
            <div className="kb-tags">
              <button className={`kb-tag ${projectTagFilter === "all" ? "kb-tag-active" : ""}`} onClick={() => setProjectTagFilter("all")}>
                all <span>{projectStats.length}</span>
              </button>
              <button className={`kb-tag ${projectTagFilter === "with-maps" ? "kb-tag-active" : ""}`} onClick={() => setProjectTagFilter("with-maps")}>
                with maps <span>{projectStats.filter((entry) => entry.mapsCount > 0).length}</span>
              </button>
              <button className={`kb-tag ${projectTagFilter === "with-notes" ? "kb-tag-active" : ""}`} onClick={() => setProjectTagFilter("with-notes")}>
                with notes <span>{projectStats.filter((entry) => entry.notesCount > 0).length}</span>
              </button>
              <button className={`kb-tag ${projectTagFilter === "empty" ? "kb-tag-active" : ""}`} onClick={() => setProjectTagFilter("empty")}>
                empty <span>{projectStats.filter((entry) => entry.mapsCount === 0 && entry.notesCount === 0).length}</span>
              </button>
            </div>
          </div>
        ) : sidebarFilter === "all" && !selectedProjectId ? (
          <div className="kb-tag-block">
            <div className="kb-tag-title">Tags</div>
            <div className="kb-tags">
              <button className={`kb-tag ${activeTag === null ? "kb-tag-active" : ""}`} onClick={() => setActiveTag(null)}>
                all
              </button>
              {tagStats.map(([tag, count]) => (
                <button key={tag} className={`kb-tag ${activeTag === tag ? "kb-tag-active" : ""}`} onClick={() => setActiveTag(tag)}>
                  {tag} <span>{count}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </aside>

      <section className="kb-content">
        <header className="kb-header">
          <h1>Your knowledge base</h1>
          <p>{filtered.length} maps linked</p>
        </header>

        <div className="kb-search-wrap">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your mind maps"
            className="kb-search"
          />
        </div>

        <>
          {!selectedProjectId && sidebarFilter === "projects" ? (
              <section className="kb-project-cards">
                <h2 className="kb-projects-heading">Active projects</h2>
                <div className="kb-project-cards-grid">
                  {filteredProjectStats.map(({ project, mapsCount, notesCount }) => {
                    const projectItems = items.filter((item) => item.notebookId === project.id);
                    const projectTypeCounts = countProjectTypes(projectItems, project.projectNotes ?? []);
                    return (
                    <article
                      key={project.id}
                      className="kb-project-card kb-project-card-clickable"
                      onClick={() => {
                        setSelectedProjectId(project.id);
                        setSidebarFilter("all");
                      }}
                    >
                      <div className="kb-project-card-top">
                        <div className="kb-project-card-title-wrap">
                          <span className="kb-project-dot" style={{ background: project.color || "#645cff" }} />
                          <h3>{project.name}</h3>
                        </div>
                        <button
                          className="kb-danger-btn"
                          title="Delete project"
                          style={{ border: "0", background: "transparent", color: "#98a2b3", boxShadow: "none", outline: "none" }}
                          onClick={(event) => {
                            event.stopPropagation();
                            void deleteProject(project.id);
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <p>{mapsCount} maps - {notesCount} notes</p>
                      <div className="kb-project-meta-row">
                        <span><BookText size={12} /> {mapsCount} maps</span>
                        <span><NotebookPen size={12} /> {notesCount} notes</span>
                      </div>
                      <div className="kb-card-tags">
                        {Object.entries(projectTypeCounts)
                          .filter(([, count]) => count > 0)
                          .map(([type, count]) => (
                            <span key={`${project.id}-${type}`} className="kb-mini-tag">{type}: {count}</span>
                          ))}
                      </div>
                      <div className="kb-project-progress">
                        <span style={{ width: `${Math.max(14, Math.min(100, mapsCount * 8))}%`, background: project.color || "#645cff" }} />
                      </div>
                    </article>
                  );
                  })}
                </div>
              </section>
          ) : null}
          {selectedProjectId ? (
              <section className="kb-project-cards">
                {projectStats
                  .filter(({ project }) => project.id === selectedProjectId)
                  .map(({ project, mapsCount, notesCount }) => {
                    const projectItems = items.filter((item) => item.notebookId === project.id);
                    const mindMapItems = projectItems.filter((item) => item.outputMode === "mindmap");
                    const flashcardNotes = (project.projectNotes ?? []).filter((note) => isFlashcardsNote(note.title, note.content));
                    const comparisonNotes = (project.projectNotes ?? []).filter((note) => isComparisonNote(note.title, note.content));
                    const timelineNotes = (project.projectNotes ?? []).filter((note) => isTimelineNote(note.title, note.content));
                    const feynmanNotes = (project.projectNotes ?? []).filter((note) => isFeynmanNote(note.title, note.content));
                    const cheatsheetNotes = (project.projectNotes ?? []).filter((note) => isCheatsheetNote(note.title, note.content));
                    const normalNotes = (project.projectNotes ?? []).filter((note) =>
                      !isFlashcardsNote(note.title, note.content) &&
                      !isComparisonNote(note.title, note.content) &&
                      !isTimelineNote(note.title, note.content) &&
                      !isFeynmanNote(note.title, note.content) &&
                      !isCheatsheetNote(note.title, note.content)
                    );
                    return (
                      <article key={project.id} className="kb-project-card">
                        <div className="kb-project-card-top">
                          <div className="kb-project-card-title-wrap">
                            <span className="kb-project-dot" style={{ background: project.color || "#645cff" }} />
                            <h3>{project.name}</h3>
                          </div>
                          <button
                            className="kb-danger-btn"
                            title="Delete project"
                            style={{ border: "0", background: "transparent", color: "#98a2b3", boxShadow: "none", outline: "none" }}
                            onClick={() => void deleteProject(project.id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <p>{mapsCount} maps - {notesCount} notes</p>

                        <div className="kb-category-block">
                        <div className="kb-project-notes-head">
                          <span>Notes</span>
                          <button onClick={() => openProjectNotesWindow(project.id)}>Create note</button>
                        </div>
                        <div className="kb-project-notes-grid">
                          {normalNotes.map((note) => (
                            <Link key={note.id} to={`/projects/${project.id}/notes/${note.id}`} className="kb-note-card">
                              <div className="kb-note-head">
                                <div className="kb-note-title"><NotebookPen size={14} /> {truncate(note.title || "Untitled note", 28)}</div>
                                <button
                                  className="kb-danger-btn kb-danger-btn-note"
                                  title="Delete note"
                                  style={{ border: "0", background: "transparent", color: "#98a2b3", boxShadow: "none", outline: "none" }}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    void deleteProjectNote(project.id, note.id);
                                  }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                              <div className="kb-note-snippet">{truncate(note.content.replace(/\s+/g, " ").trim(), 88)}</div>
                            </Link>
                          ))}
                        </div>
                        </div>

                        <div className="kb-category-block">
                        <div className="kb-project-notes-head">
                          <span>Mind Maps</span>
                        </div>
                        <div className="kb-project-notes-grid">
                          {mindMapItems.map((item) => (
                            <Link key={item.id} to={`/view/${item.id}`} className="kb-note-card kb-mindmap-card">
                              <MapPreview mapId={item.id} color={pickPreviewColor(item.id, item.outputMode)} />
                              <div className="kb-note-title"><NotebookPen size={14} /> {truncate(item.sourceTitle || "Untitled", 28)}</div>
                              <div className="kb-note-snippet">{sourceHost(item.sourceUrl)} - {nodeCountLabel(item.data, item.outputMode)}</div>
                            </Link>
                          ))}
                        </div>
                        </div>

                        <div className="kb-category-block">
                        <div className="kb-project-notes-head">
                          <span>Flashcards</span>
                        </div>
                        <div className="kb-project-notes-grid">
                          {flashcardNotes.map((note) => (
                            <Link key={note.id} to={`/projects/${project.id}/notes/${note.id}`} className="kb-note-card kb-flashcard-preview">
                              <div className="kb-note-head">
                                <div className="kb-note-title"><NotebookPen size={14} /> {truncate(note.title || "Flashcards", 28)}</div>
                                <button
                                  className="kb-danger-btn kb-danger-btn-note"
                                  title="Delete note"
                                  style={{ border: "0", background: "transparent", color: "#98a2b3", boxShadow: "none", outline: "none" }}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    void deleteProjectNote(project.id, note.id);
                                  }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                              <div className="kb-note-snippet">{truncate(note.content.replace(/\s+/g, " ").trim(), 120)}</div>
                            </Link>
                          ))}
                        </div>
                        </div>

                        <div className="kb-category-block">
                        <div className="kb-project-notes-head">
                          <span>Comparison</span>
                        </div>
                        <div className="kb-project-notes-grid">
                          {comparisonNotes.map((note) => (
                            <Link key={note.id} to={`/projects/${project.id}/notes/${note.id}`} className="kb-note-card kb-comparison-preview">
                              <div className="kb-note-head">
                                <div className="kb-note-title"><NotebookPen size={14} /> {truncate(note.title || "Comparison", 28)}</div>
                                <button
                                  className="kb-danger-btn kb-danger-btn-note"
                                  title="Delete note"
                                  style={{ border: "0", background: "transparent", color: "#98a2b3", boxShadow: "none", outline: "none" }}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    void deleteProjectNote(project.id, note.id);
                                  }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                              <ComparisonMiniPreview content={note.content} />
                              <div className="kb-note-snippet">{truncate(note.content.replace(/\s+/g, " ").trim(), 120)}</div>
                            </Link>
                          ))}
                        </div>
                        </div>

                        <div className="kb-category-block">
                        <div className="kb-project-notes-head">
                          <span>Timeline</span>
                        </div>
                        <div className="kb-project-notes-grid">
                          {timelineNotes.map((note) => (
                            <Link key={note.id} to={`/projects/${project.id}/notes/${note.id}`} className="kb-note-card kb-timeline-preview">
                              <div className="kb-note-head">
                                <div className="kb-note-title"><NotebookPen size={14} /> {truncate(note.title || "Timeline", 28)}</div>
                                <button
                                  className="kb-danger-btn kb-danger-btn-note"
                                  title="Delete note"
                                  style={{ border: "0", background: "transparent", color: "#98a2b3", boxShadow: "none", outline: "none" }}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    void deleteProjectNote(project.id, note.id);
                                  }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                              <TimelineMiniPreview content={note.content} />
                              <div className="kb-note-snippet">{truncate(note.content.replace(/\s+/g, " ").trim(), 120)}</div>
                            </Link>
                          ))}
                        </div>
                        </div>

                        <div className="kb-category-block">
                        <div className="kb-project-notes-head">
                          <span>Feynman</span>
                        </div>
                        <div className="kb-project-notes-grid">
                          {feynmanNotes.map((note) => (
                            <Link key={note.id} to={`/projects/${project.id}/notes/${note.id}`} className="kb-note-card kb-feynman-preview">
                              <div className="kb-note-head">
                                <div className="kb-note-title"><NotebookPen size={14} /> {truncate(note.title || "Feynman", 28)}</div>
                                <button
                                  className="kb-danger-btn kb-danger-btn-note"
                                  title="Delete note"
                                  style={{ border: "0", background: "transparent", color: "#98a2b3", boxShadow: "none", outline: "none" }}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    void deleteProjectNote(project.id, note.id);
                                  }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                              <div className="kb-note-snippet">{truncate(note.content.replace(/\s+/g, " ").trim(), 120)}</div>
                            </Link>
                          ))}
                        </div>
                        </div>

                        <div className="kb-category-block">
                        <div className="kb-project-notes-head">
                          <span>Cheatsheet</span>
                        </div>
                        <div className="kb-project-notes-grid">
                          {cheatsheetNotes.map((note) => (
                            <Link key={note.id} to={`/projects/${project.id}/notes/${note.id}`} className="kb-note-card kb-cheatsheet-preview">
                              <div className="kb-note-head">
                                <div className="kb-note-title"><NotebookPen size={14} /> {truncate(note.title || "Cheatsheet", 28)}</div>
                                <button
                                  className="kb-danger-btn kb-danger-btn-note"
                                  title="Delete note"
                                  style={{ border: "0", background: "transparent", color: "#98a2b3", boxShadow: "none", outline: "none" }}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    void deleteProjectNote(project.id, note.id);
                                  }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                              <div className="kb-note-snippet">{truncate(note.content.replace(/\s+/g, " ").trim(), 120)}</div>
                            </Link>
                          ))}
                        </div>
                        </div>
                      </article>
                    );
                  })}
              </section>
          ) : null}
          {sidebarFilter !== "projects" && sections.length === 0 && !selectedProjectId ? (
            <div className="kb-empty">No items yet. Use Snap on a page to build your knowledge base.</div>
          ) : null}
          {sidebarFilter !== "projects" && !selectedProjectId && sections.map((section) => (
            <section key={section.label} className="kb-section">
              <h2>{section.label}</h2>
              <div className="kb-grid">
                {section.items.map((item) => (
                  <article key={item.id} className="kb-card">
                    <Link to={`/view/${item.id}`} className="kb-card-link">
                      <OutputPreview item={item} />
                      <div className="kb-card-body">
                        <div className="kb-card-head">
                          <div className="kb-card-head-content">
                            <div className="kb-card-title">{truncate(item.sourceTitle || "Untitled", 52)}</div>
                            <div className="kb-card-meta">{sourceHost(item.sourceUrl)} - {nodeCountLabel(item.data, item.outputMode)}</div>
                          </div>
                        </div>
                        <div className="kb-card-tags">
                          {(itemTagsMap.get(item.id) ?? []).slice(0, 3).map((tag) => (
                            <span key={`${item.id}-${tag}`} className="kb-mini-tag">{tag}</span>
                          ))}
                        </div>
                      </div>
                    </Link>
                    <div className="kb-card-actions">
                      <label>
                        Project
                        <select
                          value={item.notebookId ?? ""}
                          onChange={(event) => void assignToProject(item.id, event.target.value || null)}
                        >
                          <option value="">No project</option>
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>{project.name}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </>
      </section>
    </main>
  );
};

const truncate = (value: string, max: number): string => (value.length > max ? `${value.slice(0, max - 3)}...` : value);

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const groupByUpdatedAt = (
  items: KBItem[]
): Array<{ label: string; items: KBItem[] }> => {
  const today = startOfDay(new Date()).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;
  const weekStart = today - 7 * 24 * 60 * 60 * 1000;

  const buckets = new Map<string, KBItem[]>([
    ["Today", []],
    ["Yesterday", []],
    ["This week", []],
    ["Earlier", []]
  ]);

  items.forEach((item) => {
    const updated = startOfDay(new Date(item.updatedAt)).getTime();
    if (updated >= today) buckets.get("Today")?.push(item);
    else if (updated >= yesterday) buckets.get("Yesterday")?.push(item);
    else if (updated >= weekStart) buckets.get("This week")?.push(item);
    else buckets.get("Earlier")?.push(item);
  });

  return [...buckets.entries()]
    .filter(([, values]) => values.length > 0)
    .map(([label, values]) => ({ label, items: values }));
};

const timeAgo = (isoDate: string): string => {
  const diff = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
};

const modeAccent = (mode: string): string => OUTPUT_MODES.find((entry) => entry.id === mode)?.accent ?? "#645cff";
const previewPalette = ["#645cff", "#0ea5e9", "#10b981", "#f97316", "#ec4899", "#f43f5e", "#14b8a6", "#8b5cf6"];

const hash = (value: string): number => value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

const pickPreviewColor = (mapId: string, mode: string): string => {
  const modeColor = modeAccent(mode);
  const idHash = hash(mapId);
  const paletteColor = previewPalette[idHash % previewPalette.length];
  return idHash % 4 === 0 ? modeColor : paletteColor;
};

const MapPreview = ({ mapId, color }: { mapId: string; color: string }) => {
  const seed = hash(mapId);
  const branchCount = 3 + (seed % 4);
  return (
    <div className="kb-preview">
      <svg viewBox="0 0 180 56" className="kb-preview-svg" aria-hidden="true">
        <circle cx="14" cy="28" r="3" fill={color} />
        {Array.from({ length: branchCount }).map((_, index) => {
          const x1 = 18;
          const y1 = 28;
          const x2 = 58 + index * 17;
          const y2 = 10 + ((seed + index * 11) % 36);
          return (
            <g key={`${mapId}-${index}`}>
              <path d={`M ${x1} ${y1} C ${x1 + 20} ${y1}, ${x2 - 12} ${y2}, ${x2} ${y2}`} stroke={color} strokeWidth="1.3" fill="none" opacity="0.95" />
              <circle cx={x2} cy={y2} r="2.3" fill="#fff" stroke={color} strokeWidth="1.2" />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const OutputPreview = ({ item }: { item: KBItem }) => {
  if (item.outputMode === "mindmap") {
    return <MapPreview mapId={item.id} color={pickPreviewColor(item.id, item.outputMode)} />;
  }
  if (item.outputMode === "timeline") {
    const events = (item.data as { events?: Array<{ date?: string; title?: string }> })?.events ?? [];
    return (
      <div className="kb-preview">
        <div className="w-full space-y-1 px-2 text-[10px] text-slate-600">
          {events.slice(0, 3).map((event, index) => (
            <div key={`${item.id}-timeline-${index}`} className="flex items-center gap-2">
              <span className="rounded-full border border-slate-300 px-1.5 py-0.5">{String(event.date ?? "date").slice(0, 8)}</span>
              <span className="truncate">{event.title ?? "Event"}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (item.outputMode === "comparison") {
    const criteria = (item.data as { criteria?: Array<{ name?: string }> })?.criteria ?? [];
    return (
      <div className="kb-preview">
        <div className="grid w-full grid-cols-2 gap-1 px-2 text-[10px] text-slate-600">
          {criteria.slice(0, 4).map((row, index) => (
            <span key={`${item.id}-cmp-${index}`} className="truncate rounded border border-slate-300 bg-white px-1 py-0.5">
              {row.name ?? "Criteria"}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (item.outputMode === "flashcards") {
    const cards = (item.data as { cards?: Array<{ front?: string }> })?.cards ?? [];
    return (
      <div className="kb-preview">
        <div className="w-full px-2 text-[10px] text-slate-600">
          {cards.slice(0, 2).map((card, index) => (
            <div key={`${item.id}-fc-${index}`} className="mb-1 truncate rounded border border-violet-200 bg-violet-50 px-2 py-1">
              Q: {card.front ?? "Question"}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (item.outputMode === "cornell") {
    const pairs = (item.data as { pairs?: Array<{ cue?: string }> })?.pairs ?? [];
    return (
      <div className="kb-preview">
        <div className="w-full px-2 text-[10px] text-slate-600">
          {pairs.slice(0, 3).map((pair, index) => (
            <div key={`${item.id}-cornell-${index}`} className="mb-1 truncate rounded border border-amber-200 bg-amber-50 px-2 py-0.5">
              {pair.cue ?? "Cue"}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (item.outputMode === "feynman") {
    const sections = (item.data as { sections?: Array<{ heading?: string }> })?.sections ?? [];
    return (
      <div className="kb-preview">
        <div className="w-full px-2 text-[10px] text-slate-600">
          {sections.slice(0, 3).map((section, index) => (
            <div key={`${item.id}-feyn-${index}`} className="mb-1 truncate rounded border border-lime-200 bg-lime-50 px-2 py-0.5">
              {section.heading ?? "Section"}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (item.outputMode === "cheatsheet") {
    const checks = (item.data as { quickChecks?: string[] })?.quickChecks ?? [];
    return (
      <div className="kb-preview">
        <div className="flex w-full flex-wrap gap-1 px-2 text-[10px]">
          {checks.slice(0, 5).map((check, index) => (
            <span key={`${item.id}-check-${index}`} className="rounded-full border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-teal-700">
              {check}
            </span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="kb-preview">
      <div className="text-xs text-slate-500">{item.outputMode}</div>
    </div>
  );
};

const deriveUiTags = (item: { outputMode: string; sourceTitle: string; autoSummary: string; userNotes: string; tags?: string[] }): string[] => {
  const existing = (item.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  if (existing.length > 0) {
    return existing.slice(0, 8);
  }

  const text = `${item.sourceTitle} ${item.autoSummary} ${item.userNotes}`.toLowerCase();
  const tokens = text.match(/[a-zа-яё0-9-]{3,}/gi) ?? [];
  const stop = new Set([
    "это", "как", "для", "что", "его", "она", "они", "или", "при", "без",
    "the", "and", "for", "with", "from", "this", "that", "have", "were"
  ]);
  const freq = new Map<string, number>();
  tokens.forEach((token) => {
    if (stop.has(token)) return;
    freq.set(token, (freq.get(token) ?? 0) + 1);
  });
  const dynamic = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token)
    .slice(0, 5);
  return [item.outputMode.toLowerCase(), ...dynamic].slice(0, 8);
};

const sourceHost = (url: string): string => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host || "source";
  } catch {
    return "source";
  }
};

const nodeCountLabel = (data: unknown, outputMode: string): string => {
  if (outputMode !== "mindmap" || !data || typeof data !== "object") return "note";
  const metadata = (data as { metadata?: { totalNodes?: number } }).metadata;
  const count = metadata?.totalNodes;
  return typeof count === "number" && count > 0 ? `${count} nodes` : "nodes";
};

const isFlashcardsNote = (title: string, content: string): boolean => {
  return /flashcards/i.test(title) || /#\s*flashcards/i.test(content);
};

const isComparisonNote = (title: string, content: string): boolean => {
  return /comparison/i.test(title) || /#\s*comparison/i.test(content);
};

const isTimelineNote = (title: string, content: string): boolean => {
  return /timeline/i.test(title) || /#\s*timeline/i.test(content);
};

const isFeynmanNote = (title: string, content: string): boolean => {
  return /feynman/i.test(title) || /#\s*feynman/i.test(content);
};

const isCheatsheetNote = (title: string, content: string): boolean => {
  return /cheatsheet/i.test(title) || /#\s*cheatsheet/i.test(content);
};

const ComparisonMiniPreview = ({ content }: { content: string }) => {
  const rows = extractComparisonRows(content).slice(0, 3);
  if (rows.length === 0) return null;
  return (
    <div className="kb-comparison-mini">
      {rows.map((row, index) => (
        <div key={`${row.label}-${index}`} className="kb-comparison-mini-row">
          <span className="kb-comparison-mini-label">{truncate(row.label, 18)}</span>
          <span className={`kb-comparison-mini-cell ${row.marker === "+" ? "is-good" : row.marker === "-" ? "is-bad" : "is-neutral"}`}>
            {row.marker} {truncate(row.value, 32)}
          </span>
        </div>
      ))}
    </div>
  );
};

const extractComparisonRows = (content: string): Array<{ label: string; marker: "+" | "-" | "~"; value: string }> => {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rows: Array<{ label: string; marker: "+" | "-" | "~"; value: string }> = [];

  for (const line of lines) {
    const markerMatch = line.match(/([+\-~])\s*([^\n]+)/);
    if (!markerMatch) continue;
    const marker = markerMatch[1] as "+" | "-" | "~";
    const value = markerMatch[2].replace(/^[|:\-\s]+/, "").trim();
    if (!value || value === "-") continue;
    const prefix = line.slice(0, markerMatch.index).replace(/^[-*#\s]+/, "").trim();
    const label = prefix || "Критерий";
    rows.push({ label, marker, value });
    if (rows.length >= 6) break;
  }
  return rows;
};

const TimelineMiniPreview = ({ content }: { content: string }) => {
  const rows = extractTimelineRows(content).slice(0, 3);
  if (rows.length === 0) return null;
  return (
    <div className="kb-timeline-mini">
      {rows.map((row, index) => (
        <div key={`${row.date}-${row.title}-${index}`} className="kb-timeline-mini-row">
          <span className="kb-timeline-mini-date">{truncate(row.date, 12)}</span>
          <span className="kb-timeline-mini-title">{truncate(row.title, 28)}</span>
        </div>
      ))}
    </div>
  );
};

const extractTimelineRows = (content: string): Array<{ date: string; title: string }> => {
  const matches = [...content.matchAll(/^##\s*(.+?)\s*-\s*(.+)$/gim)];
  return matches.map((match) => ({
    date: (match[1] ?? "").trim(),
    title: (match[2] ?? "").trim()
  })).filter((entry) => entry.date && entry.title);
};

const countProjectTypes = (
  items: Array<{ outputMode: string }>,
  notes: Array<{ title: string; content: string }>
): Record<string, number> => {
  const counts: Record<string, number> = {
    mindmap: 0,
    cornell: 0,
    flashcards: 0,
    timeline: 0,
    comparison: 0,
    feynman: 0,
    cheatsheet: 0
  };
  items.forEach((item) => {
    if (item.outputMode in counts) {
      counts[item.outputMode] += 1;
    }
  });
  notes.forEach((note) => {
    if (isFlashcardsNote(note.title, note.content)) counts.flashcards += 1;
    else if (isComparisonNote(note.title, note.content)) counts.comparison += 1;
    else if (isTimelineNote(note.title, note.content)) counts.timeline += 1;
    else if (isFeynmanNote(note.title, note.content)) counts.feynman += 1;
    else if (isCheatsheetNote(note.title, note.content)) counts.cheatsheet += 1;
  });
  return counts;
};

