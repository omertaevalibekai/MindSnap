import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "../../stores/app-store";

const markdownCopy = (data: unknown): void => {
  const payload = "```json\n" + JSON.stringify(data, null, 2) + "\n```";
  void navigator.clipboard.writeText(payload);
};

const Card = ({ children, title, onCopy, actions }: { children: ReactNode; title: string; onCopy: () => void; actions?: ReactNode }) => (
  <section className="panel-card space-y-2">
    <div className="flex items-center justify-between">
      <h3 className="font-heading text-sm">{title}</h3>
      <div className="flex items-center gap-2">
        {actions}
        <button className="rounded bg-[#6d5efb] px-2 py-1 text-xs text-white" onClick={onCopy}>Copy as Markdown</button>
      </div>
    </div>
    {children}
  </section>
);

export const CornellView = ({ data }: { data: unknown }) => {
  const d = data as { pairs?: Array<{ id: string; cue: string; notes: string[]; importance: "high" | "medium" | "low" }>; summary?: string };
  const [active, setActive] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState("");
  const storage = useAppStore((s) => s.storage);
  const refresh = useAppStore((s) => s.refresh);
  const projects = useMemo(
    () => Object.values(storage?.notebooks ?? {}).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [storage?.notebooks]
  );

  const addToProject = async (targetProjectId?: string): Promise<void> => {
    const resolvedProjectId = targetProjectId ?? projectId;
    if (!resolvedProjectId) {
      setStatus("Select project");
      return;
    }
    const content = cornellToMarkdown(d);
    setStatus("Adding...");
    const response = await chrome.runtime.sendMessage({
      type: "CREATE_PROJECT_NOTE",
      payload: {
        projectId: resolvedProjectId,
        title: firstWords(content, 3),
        content
      }
    });
    if (!response?.ok) {
      setStatus(response?.error ?? "Failed");
      return;
    }
    setStatus("Added");
    await refresh();
  };

  return (
    <Card
      title="Cornell Notes"
      onCopy={() => markdownCopy(data)}
      actions={
        <>
          <select
            className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs"
            value={projectId}
            onChange={(event) => {
              const selected = event.target.value;
              setProjectId(selected);
              if (selected) {
                void addToProject(selected);
              } else {
                setStatus("");
              }
            }}
          >
            <option value="">Select project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </>
      }
    >
      <div className="grid grid-cols-[30%_70%] gap-2 text-xs">
        <div className="space-y-1">
          {(d.pairs ?? []).map((pair) => (
            <button key={pair.id} onMouseEnter={() => setActive(pair.id)} onMouseLeave={() => setActive(null)} className="block w-full rounded border border-slate-700 p-2 text-left" style={{ borderLeftWidth: pair.importance === "high" ? 3 : 1, borderLeftColor: pair.importance === "high" ? "#f59e0b" : "#334155" }}>
              {renderRichText(pair.cue)}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {(d.pairs ?? []).map((pair) => (
            <motion.ul key={pair.id} className="rounded border border-slate-700 p-2" animate={{ opacity: !active || active === pair.id ? 1 : 0.45 }}>
              {pair.notes.map((note) => <li key={note}>{renderRichText(note)}</li>)}
            </motion.ul>
          ))}
        </div>
      </div>
      <div className="border-t border-slate-700 pt-2 text-xs italic text-slate-300">{renderRichText(d.summary ?? "")}</div>
      {status ? <div className="text-xs text-slate-400">{status}</div> : null}
    </Card>
  );
};

const renderRichText = (value: string): ReactNode => {
  const chunks = value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  if (chunks.length === 0) return value;
  return chunks.map((chunk, index) => {
    const isBold = chunk.startsWith("**") && chunk.endsWith("**") && chunk.length > 4;
    if (!isBold) return <span key={`${chunk}-${index}`}>{chunk}</span>;
    return <strong key={`${chunk}-${index}`}>{chunk.slice(2, -2)}</strong>;
  });
};

const cornellToMarkdown = (data: { pairs?: Array<{ cue: string; notes: string[] }>; summary?: string }): string => {
  const lines: string[] = ["# Cornell Notes", ""];
  (data.pairs ?? []).forEach((pair) => {
    lines.push(`## ${pair.cue}`);
    pair.notes.forEach((note) => lines.push(`- ${note}`));
    lines.push("");
  });
  if (data.summary) {
    lines.push("## Summary");
    lines.push(data.summary);
  }
  return lines.join("\n").trim();
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

const flashcardsToMarkdown = (data: { cards?: Array<{ front: string; back: string; difficulty: "easy" | "medium" | "hard" }> }): string => {
  const lines: string[] = ["# Flashcards", ""];
  (data.cards ?? []).forEach((card, index) => {
    lines.push(`## Card ${index + 1} (${card.difficulty})`);
    lines.push(`Q: ${card.front}`);
    lines.push(`A: ${card.back}`);
    lines.push("");
  });
  return lines.join("\n").trim();
};

export const OutlineView = ({ data }: { data: unknown }) => {
  const d = data as { items?: Array<{ id: string; text: string; type?: string; children?: unknown[] }> };
  const [openAll, setOpenAll] = useState(true);
  return (
    <Card title="Outline" onCopy={() => markdownCopy(data)}>
      <div className="flex gap-2 text-xs">
        <button className="rounded border border-slate-600 px-2 py-1" onClick={() => setOpenAll(true)}>Expand all</button>
        <button className="rounded border border-slate-600 px-2 py-1" onClick={() => setOpenAll(false)}>Collapse all</button>
      </div>
      <ul className="space-y-1 text-xs">
        {(d.items ?? []).map((item, idx) => <OutlineNode key={item.id ?? String(idx)} node={item} depth={0} forced={openAll} />)}
      </ul>
    </Card>
  );
};

const OutlineNode = ({ node, depth, forced }: { node: { text?: string; type?: string; children?: unknown[] }; depth: number; forced: boolean }) => {
  const [open, setOpen] = useState(true);
  const expanded = forced ? true : open;
  const children = (node.children ?? []) as Array<{ text?: string; type?: string; children?: unknown[] }>;
  const icon = node.type === "warning" ? "!" : node.type === "action" ? "+" : node.type === "example" ? "*" : "-";

  return (
    <li>
      <button className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-slate-800" style={{ paddingLeft: depth * 12 }} onClick={() => setOpen((v) => !v)}>
        {children.length > 0 ? (expanded ? "v" : ">") : "-"} {icon} {node.text}
      </button>
      {expanded && children.length > 0 ? <ul>{children.map((child, idx) => <OutlineNode key={String(idx)} node={child} depth={depth + 1} forced={forced} />)}</ul> : null}
    </li>
  );
};

export const FlashcardsView = ({ data }: { data: unknown }) => {
  const d = data as { cards?: Array<{ id: string; front: string; back: string; difficulty: "easy" | "medium" | "hard" }> };
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [filter, setFilter] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState("");
  const storage = useAppStore((s) => s.storage);
  const refresh = useAppStore((s) => s.refresh);
  const projects = useMemo(
    () => Object.values(storage?.notebooks ?? {}).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [storage?.notebooks]
  );
  const cards = useMemo(() => (d.cards ?? []).filter((card) => filter === "all" || card.difficulty === filter), [d.cards, filter]);
  const card = cards[index] ?? null;
  const progress = cards.length > 0 ? Math.round(((index + 1) / cards.length) * 100) : 0;

  const addDeckToProject = async (targetProjectId?: string): Promise<void> => {
    const resolvedProjectId = targetProjectId ?? projectId;
    if (!resolvedProjectId) {
      setStatus("Select project");
      return;
    }
    const content = flashcardsToMarkdown(d);
    setStatus("Adding...");
    const response = await chrome.runtime.sendMessage({
      type: "CREATE_PROJECT_NOTE",
      payload: {
        projectId: resolvedProjectId,
        title: firstWords(content, 3),
        content
      }
    });
    if (!response?.ok) {
      setStatus(response?.error ?? "Failed");
      return;
    }
    setStatus("Added");
    await refresh();
  };

  return (
    <Card
      title="Flashcards"
      onCopy={() => markdownCopy(data)}
      actions={
        <>
          <select
            className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs"
            value={projectId}
            onChange={(event) => {
              const selected = event.target.value;
              setProjectId(selected);
              if (selected) {
                void addDeckToProject(selected);
              } else {
                setStatus("");
              }
            }}
          >
            <option value="">Select project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </>
      }
    >
      <div className="flex flex-wrap gap-1 text-xs">
        {(["all", "easy", "medium", "hard"] as const).map((f) => <button key={f} className={`rounded border px-2.5 py-1 ${filter === f ? "border-violet-400 bg-violet-500/20 text-slate-900" : "border-slate-600 text-slate-900"}`} onClick={() => { setFilter(f); setIndex(0); setFlipped(false); }}>{f}</button>)}
      </div>
      {!card ? <p className="text-xs text-slate-400">No cards</p> : (
        <button className="min-h-56 w-full rounded-2xl border border-violet-300/50 bg-gradient-to-b from-violet-500/15 to-violet-500/5 p-6 text-left transition hover:from-violet-500/20 hover:to-violet-500/10" onClick={() => setFlipped((v) => !v)}>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wide text-violet-700">{flipped ? "Answer" : "Question"}</div>
            <span className="rounded-full border border-violet-400/60 bg-violet-500/10 px-2.5 py-0.5 text-[10px] uppercase text-violet-700">{card.difficulty}</span>
          </div>
          <div className="text-base leading-relaxed text-slate-900 md:text-[17px]">{renderRichText(flipped ? card.back : card.front)}</div>
          <div className="mt-5 flex items-center justify-between text-xs text-slate-600">
            <span>Card {index + 1} of {cards.length}</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-700/60">
            <div className="h-full rounded-full bg-violet-400/80" style={{ width: `${progress}%` }} />
          </div>
        </button>
      )}
      <div className="flex justify-between text-xs">
        <button className="rounded border border-slate-600 px-3 py-1.5 hover:bg-slate-800/60" onClick={() => { setFlipped(false); setIndex((v) => Math.max(0, v - 1)); }}>&lt;</button>
        <button className="rounded border border-slate-600 px-3 py-1.5 hover:bg-slate-800/60" onClick={() => { setFlipped(false); setIndex((v) => Math.min(cards.length - 1, v + 1)); }}>&gt;</button>
      </div>
      {status ? <div className="text-xs text-slate-400">{status}</div> : null}
    </Card>
  );
};

export const SummaryView = ({ data }: { data: unknown }) => {
  const d = data as { tldr?: string; keyPoints?: Array<{ heading: string; detail: string; importance: "high" | "medium" }>; conclusions?: string[]; openQuestions?: string[] };
  return (
    <Card title="Summary" onCopy={() => markdownCopy(data)}>
      <div className="rounded border border-cyan-400/40 bg-cyan-500/10 p-3 text-sm">{d.tldr}</div>
      <div className="space-y-2 text-xs">
        {(d.keyPoints ?? []).map((kp, idx) => (
          <motion.div key={String(idx)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }} className="rounded border border-slate-700 p-2">
            <div className="font-semibold">{kp.importance === "high" ? "*" : "-"} {kp.heading}</div>
            <p className="text-slate-300">{kp.detail}</p>
          </motion.div>
        ))}
      </div>
      <ul className="text-xs"><b>Conclusions:</b>{(d.conclusions ?? []).map((item) => <li key={item}>- {item}</li>)}</ul>
      <ul className="text-xs"><b>Open Questions:</b>{(d.openQuestions ?? []).map((item) => <li key={item}>- {item}</li>)}</ul>
    </Card>
  );
};

export const TimelineView = ({ data }: { data: unknown }) => {
  const d = data as { events?: Array<{ id: string; date: string; title: string; description: string; isMilestone?: boolean }> };
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState("");
  const storage = useAppStore((s) => s.storage);
  const refresh = useAppStore((s) => s.refresh);
  const projects = useMemo(
    () => Object.values(storage?.notebooks ?? {}).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [storage?.notebooks]
  );
  const events = [...(d.events ?? [])];

  const addTimelineToProject = async (targetProjectId?: string): Promise<void> => {
    const resolvedProjectId = targetProjectId ?? projectId;
    if (!resolvedProjectId) {
      setStatus("Select project");
      return;
    }
    const content = timelineToMarkdown(d);
    setStatus("Adding...");
    const response = await chrome.runtime.sendMessage({
      type: "CREATE_PROJECT_NOTE",
      payload: {
        projectId: resolvedProjectId,
        title: firstWords(content, 3),
        content
      }
    });
    if (!response?.ok) {
      setStatus(response?.error ?? "Failed");
      return;
    }
    setStatus("Added");
    await refresh();
  };

  return (
    <Card
      title="Timeline"
      onCopy={() => markdownCopy(data)}
      actions={
        <select
          className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs"
          value={projectId}
          onChange={(event) => {
            const selected = event.target.value;
            setProjectId(selected);
            if (selected) {
              void addTimelineToProject(selected);
            } else {
              setStatus("");
            }
          }}
        >
          <option value="">Select project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
      }
    >
      <div className="relative space-y-3 pl-6 text-xs">
        <div className="absolute bottom-0 left-2 top-0 w-px bg-slate-500/50" />
        {events.map((event, idx) => (
          <motion.article
            key={event.id ?? String(idx)}
            className={`relative rounded-xl border p-3 ${event.isMilestone ? "border-violet-400/60 bg-violet-500/10" : "border-slate-600 bg-slate-900"}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <span className={`absolute -left-[20px] top-4 h-3 w-3 rounded-full border ${event.isMilestone ? "border-violet-300 bg-violet-400" : "border-slate-400 bg-slate-300"}`} />
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="rounded-full border border-slate-500/60 px-2 py-0.5 text-[10px] uppercase text-slate-200">{event.date}</span>
              {event.isMilestone ? <span className="text-[10px] uppercase text-violet-200">Milestone</span> : null}
            </div>
            <div className="font-semibold text-slate-100">{event.title}</div>
            <p className="mt-1 text-slate-300">{event.description}</p>
          </motion.article>
        ))}
      </div>
      {status ? <div className="text-xs text-slate-400">{status}</div> : null}
    </Card>
  );
};

const timelineToMarkdown = (
  data: { events?: Array<{ date: string; title: string; description: string; isMilestone?: boolean }> }
): string => {
  const lines: string[] = ["# Timeline", ""];
  (data.events ?? []).forEach((event) => {
    lines.push(`## ${event.date} - ${event.title}`);
    lines.push(event.description);
    lines.push(`- Milestone: ${event.isMilestone ? "yes" : "no"}`);
    lines.push("");
  });
  return lines.join("\n").trim();
};

export const ComparisonView = ({ data }: { data: unknown }) => {
  const d = data as { intro?: string; items?: string[]; criteria?: Array<{ id: string; name: string; values: Array<{ item: string; value: string; rating: "good" | "neutral" | "bad" }> }>; verdict?: string };
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState("");
  const storage = useAppStore((s) => s.storage);
  const refresh = useAppStore((s) => s.refresh);
  const projects = useMemo(
    () => Object.values(storage?.notebooks ?? {}).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [storage?.notebooks]
  );
  const summaryByItem = useMemo(() => {
    const source = d.items ?? [];
    return source.map((item) => {
      const values = (d.criteria ?? []).flatMap((row) => row.values.filter((value) => value.item === item));
      const pros = values.filter((value) => value.rating === "good").map((value) => value.value);
      const cons = values.filter((value) => value.rating === "bad").map((value) => value.value);
      const neutral = values.filter((value) => value.rating === "neutral").map((value) => value.value);
      return { item, pros, cons, neutral };
    });
  }, [d.criteria, d.items]);
  const introText = buildComparisonIntro(d);

  const addComparisonToProject = async (targetProjectId?: string): Promise<void> => {
    const resolvedProjectId = targetProjectId ?? projectId;
    if (!resolvedProjectId) {
      setStatus("Select project");
      return;
    }
    const content = comparisonToMarkdown(d);
    setStatus("Adding...");
    const response = await chrome.runtime.sendMessage({
      type: "CREATE_PROJECT_NOTE",
      payload: {
        projectId: resolvedProjectId,
        title: firstWords(content, 3),
        content
      }
    });
    if (!response?.ok) {
      setStatus(response?.error ?? "Failed");
      return;
    }
    setStatus("Added");
    await refresh();
  };
  return (
    <Card
      title="Comparison"
      onCopy={() => markdownCopy(data)}
      actions={
        <select
          className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs"
          value={projectId}
          onChange={(event) => {
            const selected = event.target.value;
            setProjectId(selected);
            if (selected) {
              void addComparisonToProject(selected);
            } else {
              setStatus("");
            }
          }}
        >
          <option value="">Select project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
      }
    >
      <p className="rounded border border-slate-300 bg-slate-50 p-3 text-sm leading-6 text-slate-900">{introText}</p>
      <div className="overflow-auto text-xs">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-slate-900">
            <tr>
              <th className="border border-slate-700 p-2 text-left">Criteria</th>
              {(d.items ?? []).map((item) => <th key={item} className="border border-slate-700 p-2 text-left">{item}</th>)}
            </tr>
          </thead>
          <tbody>
            {(d.criteria ?? []).map((row) => (
              <tr key={row.id} className="hover:bg-slate-800/60">
                <td className="border border-slate-700 p-2">{row.name}</td>
                {(d.items ?? []).map((item) => {
                  const cell = row.values.find((value) => value.item === item);
                  const bg = cell?.rating === "good" ? "#14532d" : cell?.rating === "neutral" ? "#78350f" : "#7f1d1d";
                  const marker = cell?.rating === "good" ? "+" : cell?.rating === "bad" ? "-" : "~";
                  return (
                    <td key={item} className="border border-slate-700 p-2" style={{ background: cell ? `${bg}55` : "transparent" }}>
                      <span className="mr-1 font-bold">{marker}</span>{cell?.value ?? "-"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {summaryByItem.map((entry) => (
          <article key={entry.item} className="rounded-xl border border-slate-300 bg-white p-3 text-xs shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">{entry.item}</div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                {entry.pros.length} + / {entry.cons.length} -
              </span>
            </div>
            <div className="space-y-2">
              <ComparisonSummaryRow
                marker="+"
                title="Strengths"
                colorClass="text-emerald-700"
                bgClass="bg-emerald-50"
                values={entry.pros}
                emptyText="No clear strengths found"
              />
              <ComparisonSummaryRow
                marker="-"
                title="Risks"
                colorClass="text-rose-700"
                bgClass="bg-rose-50"
                values={entry.cons}
                emptyText="No clear risks found"
              />
              <ComparisonSummaryRow
                marker="~"
                title="Trade-offs"
                colorClass="text-amber-700"
                bgClass="bg-amber-50"
                values={entry.neutral}
                emptyText="No trade-offs found"
              />
            </div>
          </article>
        ))}
      </div>
      <div className="rounded border border-pink-300 bg-pink-50 p-3 text-xs text-slate-900"><b>AI opinion:</b> {d.verdict}</div>
      {status ? <div className="text-xs text-slate-500">{status}</div> : null}
    </Card>
  );
};

const ComparisonSummaryRow = ({
  marker,
  title,
  colorClass,
  bgClass,
  values,
  emptyText
}: {
  marker: "+" | "-" | "~";
  title: string;
  colorClass: string;
  bgClass: string;
  values: string[];
  emptyText: string;
}) => {
  const preparedValues = values
    .map((value) => value.trim())
    .filter((value) => value && value !== "-")
    .slice(0, 2);

  return (
    <section className={`rounded-lg border border-slate-200 p-2 ${bgClass}`}>
      <div className={`mb-1 text-[11px] font-semibold uppercase tracking-wide ${colorClass}`}>
        {marker} {title}
      </div>
      {preparedValues.length > 0 ? (
        <ul className="space-y-1 text-slate-800">
          {preparedValues.map((value) => (
            <li key={value} className="leading-5">{value}</li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-500">{emptyText}</p>
      )}
    </section>
  );
};

const comparisonToMarkdown = (
  data: { intro?: string; items?: string[]; criteria?: Array<{ name: string; values: Array<{ item: string; value: string; rating: "good" | "neutral" | "bad" }> }>; verdict?: string }
): string => {
  const lines: string[] = ["# Comparison", ""];
  if (data.intro?.trim()) {
    lines.push(data.intro.trim());
    lines.push("");
  }
  (data.criteria ?? []).forEach((row) => {
    lines.push(`## ${row.name}`);
    (data.items ?? []).forEach((item) => {
      const value = row.values.find((entry) => entry.item === item);
      if (!value) return;
      const marker = value.rating === "good" ? "+" : value.rating === "bad" ? "-" : "~";
      lines.push(`- ${item}: ${marker} ${value.value}`);
    });
    lines.push("");
  });
  if (data.verdict?.trim()) {
    lines.push(`AI opinion: ${data.verdict.trim()}`);
  }
  return lines.join("\n").trim();
};

const buildComparisonIntro = (
  data: { intro?: string; items?: string[]; criteria?: Array<{ name: string }>; verdict?: string }
): string => {
  const providedIntro = (data.intro ?? "").trim();
  if (providedIntro && !isGenericComparisonIntro(providedIntro)) {
    return providedIntro;
  }
  const items = (data.items ?? []).filter(Boolean);
  const criteria = (data.criteria ?? []).map((row) => row.name).filter(Boolean);
  const topCriteria = criteria.slice(0, 3).join(", ");
  const itemsText = items.length > 0 ? items.join(", ") : "варианты";
  const criteriaText = topCriteria || "ключевые практические критерии";
  const verdictLine = (data.verdict ?? "").trim();
  const verdictText = verdictLine ? ` Предварительный вывод: ${verdictLine}` : "";
  return `Сравнение фокусируется на вариантах ${itemsText} и оценивает их по критериям: ${criteriaText}. Цель — показать, какой вариант дает лучший баланс преимуществ, ограничений и сложности внедрения в реальном использовании.${verdictText}`;
};

const isGenericComparisonIntro = (value: string): boolean => {
  const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();
  const genericFragments = [
    "это сравнение показывает",
    "ключевые отличия вариантов",
    "помочь принять практичное решение",
    "данное сравнение показывает",
    "это сравнение помогает"
  ];
  return genericFragments.some((fragment) => normalized.includes(fragment)) || normalized.length < 90;
};

export const FeynmanView = ({ data }: { data: unknown }) => {
  const d = data as { analogy?: string; sections?: Array<{ id: string; heading: string; explanation: string; example: string }>; whyItMatters?: string; checkYourself?: string[]; gaps?: string[] };
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState("");
  const storage = useAppStore((s) => s.storage);
  const refresh = useAppStore((s) => s.refresh);
  const projects = useMemo(
    () => Object.values(storage?.notebooks ?? {}).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [storage?.notebooks]
  );

  const addFeynmanToProject = async (targetProjectId?: string): Promise<void> => {
    const resolvedProjectId = targetProjectId ?? projectId;
    if (!resolvedProjectId) {
      setStatus("Select project");
      return;
    }
    const content = feynmanToMarkdown(d);
    setStatus("Adding...");
    const response = await chrome.runtime.sendMessage({
      type: "CREATE_PROJECT_NOTE",
      payload: {
        projectId: resolvedProjectId,
        title: firstWords(content, 3),
        content
      }
    });
    if (!response?.ok) {
      setStatus(response?.error ?? "Failed");
      return;
    }
    setStatus("Added");
    await refresh();
  };

  return (
    <Card
      title="Feynman"
      onCopy={() => markdownCopy(data)}
      actions={
        <select
          className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs"
          value={projectId}
          onChange={(event) => {
            const selected = event.target.value;
            setProjectId(selected);
            if (selected) {
              void addFeynmanToProject(selected);
            } else {
              setStatus("");
            }
          }}
        >
          <option value="">Select project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
      }
    >
      <blockquote className="rounded border-l-4 border-l-lime-400 bg-lime-500/10 p-3 text-sm italic">Analogy: {d.analogy}</blockquote>
      {(d.sections ?? []).map((section) => (
        <div key={section.id} className="rounded border border-slate-700 p-2 text-xs">
          <div className="font-semibold">Section: {section.heading}</div>
          <p>{section.explanation}</p>
          <p className="text-slate-300">Example: {section.example}</p>
        </div>
      ))}
      <div className="text-xs"><b>Why it matters:</b> {d.whyItMatters}</div>
      <ul className="text-xs"><b>Check yourself:</b>{(d.checkYourself ?? []).map((q) => <li key={q}>- {q}</li>)}</ul>
      <ul className="text-xs"><b>What to study next:</b>{(d.gaps ?? []).map((g) => <li key={g}>- {g}</li>)}</ul>
      {status ? <div className="text-xs text-slate-400">{status}</div> : null}
    </Card>
  );
};

export const CheatsheetView = ({ data }: { data: unknown }) => {
  const d = data as {
    useWhen?: string;
    workflow?: Array<{ id: string; step: string; action: string; why: string; redFlags?: string[] }>;
    decisionRules?: Array<{ id: string; if: string; then: string }>;
    templates?: Array<{ id: string; name: string; template: string; example: string }>;
    pitfalls?: Array<{ id: string; mistake: string; fix: string }>;
    quickChecks?: string[];
  };
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState("");
  const storage = useAppStore((s) => s.storage);
  const refresh = useAppStore((s) => s.refresh);
  const projects = useMemo(
    () => Object.values(storage?.notebooks ?? {}).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [storage?.notebooks]
  );

  const addCheatsheetToProject = async (targetProjectId?: string): Promise<void> => {
    const resolvedProjectId = targetProjectId ?? projectId;
    if (!resolvedProjectId) {
      setStatus("Select project");
      return;
    }
    const content = cheatsheetToMarkdown(d);
    setStatus("Adding...");
    const response = await chrome.runtime.sendMessage({
      type: "CREATE_PROJECT_NOTE",
      payload: {
        projectId: resolvedProjectId,
        title: firstWords(content, 3),
        content
      }
    });
    if (!response?.ok) {
      setStatus(response?.error ?? "Failed");
      return;
    }
    setStatus("Added");
    await refresh();
  };

  return (
    <Card
      title="Cheatsheet"
      onCopy={() => markdownCopy(data)}
      actions={
        <select
          className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs"
          value={projectId}
          onChange={(event) => {
            const selected = event.target.value;
            setProjectId(selected);
            if (selected) {
              void addCheatsheetToProject(selected);
            } else {
              setStatus("");
            }
          }}
        >
          <option value="">Select project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
      }
    >
      <div className="rounded border border-teal-300/60 bg-teal-50 p-3 text-xs text-slate-900">
        <b>When to use:</b> {d.useWhen ?? "Use this playbook when you need an actionable execution plan."}
      </div>
      <div className="flex flex-wrap gap-1 text-[11px]">
        {(d.quickChecks ?? []).slice(0, 10).map((check) => (
          <span key={check} className="rounded-full border border-teal-300 bg-teal-100 px-2 py-0.5 text-teal-800">{check}</span>
        ))}
      </div>
      <input value={query} onChange={(event) => setQuery(event.target.value.toLowerCase())} placeholder="Search action/rule/template..." className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs" />
      <div className="grid gap-2 md:grid-cols-2 text-xs">
        {(d.workflow ?? [])
          .filter((step) => `${step.step} ${step.action} ${step.why}`.toLowerCase().includes(query))
          .map((step) => (
            <article key={step.id} className="rounded border border-slate-700 p-2">
              <div className="text-[11px] uppercase text-teal-300">{step.step}</div>
              <div className="mt-1 text-slate-100">{step.action}</div>
              <div className="mt-1 text-slate-300"><b>Why:</b> {step.why}</div>
              {(step.redFlags ?? []).length > 0 ? <div className="mt-1 text-rose-300">Red flags: {(step.redFlags ?? []).join(" | ")}</div> : null}
            </article>
          ))}
      </div>
      <div className="grid gap-2 md:grid-cols-2 text-xs">
        <div className="rounded border border-slate-700 p-2">
          <div className="mb-1 text-[11px] font-semibold uppercase text-cyan-300">Decision rules</div>
          <ul className="space-y-1">
            {(d.decisionRules ?? []).map((rule) => (
              <li key={rule.id}><b>If:</b> {rule.if} <br /><b>Then:</b> {rule.then}</li>
            ))}
          </ul>
        </div>
        <div className="rounded border border-slate-700 p-2">
          <div className="mb-1 text-[11px] font-semibold uppercase text-amber-300">Common pitfalls</div>
          <ul className="space-y-1">
            {(d.pitfalls ?? []).map((pitfall) => (
              <li key={pitfall.id}><b>{pitfall.mistake}</b> {"->"} {pitfall.fix}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="space-y-2 text-xs">
        <div className="text-[11px] font-semibold uppercase text-violet-300">Ready templates</div>
        {(d.templates ?? []).map((template) => (
          <div key={template.id} className="rounded border border-slate-700 p-2">
            <div className="font-semibold text-slate-100">{template.name}</div>
            <div className="mt-1 font-mono text-[11px] text-cyan-200">{template.template}</div>
            <div className="mt-1 text-slate-300">Example: {template.example}</div>
          </div>
        ))}
      </div>
      {status ? <div className="text-xs text-slate-400">{status}</div> : null}
    </Card>
  );
};

const feynmanToMarkdown = (
  data: { analogy?: string; sections?: Array<{ heading: string; explanation: string; example: string }>; whyItMatters?: string; checkYourself?: string[]; gaps?: string[] }
): string => {
  const lines: string[] = ["# Feynman", ""];
  if (data.analogy) {
    lines.push(`Analogy: ${data.analogy}`);
    lines.push("");
  }
  (data.sections ?? []).forEach((section) => {
    lines.push(`## ${section.heading}`);
    lines.push(section.explanation);
    if (section.example) lines.push(`Example: ${section.example}`);
    lines.push("");
  });
  if (data.whyItMatters) lines.push(`Why it matters: ${data.whyItMatters}`);
  if (data.checkYourself?.length) lines.push(`Check yourself: ${data.checkYourself.join(" | ")}`);
  if (data.gaps?.length) lines.push(`What to study next: ${data.gaps.join(" | ")}`);
  return lines.join("\n").trim();
};

const cheatsheetToMarkdown = (
  data: {
    useWhen?: string;
    workflow?: Array<{ step: string; action: string; why: string; redFlags?: string[] }>;
    decisionRules?: Array<{ if: string; then: string }>;
    templates?: Array<{ name: string; template: string; example: string }>;
    pitfalls?: Array<{ mistake: string; fix: string }>;
    quickChecks?: string[];
  }
): string => {
  const lines: string[] = ["# Cheatsheet Playbook", ""];
  if (data.useWhen?.trim()) {
    lines.push(`When to use: ${data.useWhen.trim()}`);
    lines.push("");
  }
  if (data.quickChecks?.length) {
    lines.push(`Quick checks: ${data.quickChecks.join(" | ")}`);
    lines.push("");
  }
  lines.push("## Workflow");
  (data.workflow ?? []).forEach((step, index) => {
    lines.push(`${index + 1}. ${step.step}: ${step.action}`);
    lines.push(`   Why: ${step.why}`);
    if (step.redFlags?.length) lines.push(`   Red flags: ${step.redFlags.join(" | ")}`);
  });
  lines.push("");
  lines.push("## Decision rules");
  (data.decisionRules ?? []).forEach((rule) => lines.push(`- If ${rule.if} -> ${rule.then}`));
  lines.push("");
  lines.push("## Templates");
  (data.templates ?? []).forEach((template) => {
    lines.push(`- ${template.name}`);
    lines.push(`  template: ${template.template}`);
    lines.push(`  example: ${template.example}`);
  });
  lines.push("");
  lines.push("## Pitfalls");
  (data.pitfalls ?? []).forEach((pitfall) => lines.push(`- ${pitfall.mistake} -> ${pitfall.fix}`));
  return lines.join("\n").trim();
};
