import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAppStore } from "../stores/app-store";

const ComparisonView = lazy(async () => import("../components/notes/ComparisonView").then((m) => ({ default: m.ComparisonView })));
const FeynmanView = lazy(async () => import("../components/notes/FeynmanView").then((m) => ({ default: m.FeynmanView })));
const CheatsheetView = lazy(async () => import("../components/notes/CheatsheetView").then((m) => ({ default: m.CheatsheetView })));

export const ProjectNotesPage = () => {
  const { id = "", noteId = "" } = useParams();
  const { storage, refresh } = useAppStore();
  const [noteDraft, setNoteDraft] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [status, setStatus] = useState("");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [filter, setFilter] = useState<"all" | "easy" | "medium" | "hard">("all");
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const project = storage?.notebooks[id];
  const notes = project?.projectNotes ?? [];
  const note = notes.find((entry) => entry.id === noteId) ?? null;
  const parsedFlashcards = useMemo(() => parseFlashcards(note?.content ?? ""), [note?.content]);
  const isFlashcardsNote = parsedFlashcards.length > 0;
  const parsedComparison = useMemo(() => parseComparison(note?.content ?? ""), [note?.content]);
  const isComparisonNote = parsedComparison.criteria.length > 0 && parsedComparison.items.length > 0;
  const parsedFeynman = useMemo(() => parseFeynman(note?.content ?? ""), [note?.content]);
  const isFeynmanNote = parsedFeynman.sections.length > 0;
  const parsedCheatsheet = useMemo(() => parseCheatsheet(note?.content ?? ""), [note?.content]);
  const isCheatsheetNote = parsedCheatsheet.workflow.length > 0 || parsedCheatsheet.templates.length > 0;
  const visibleCards = useMemo(
    () => parsedFlashcards.filter((card) => filter === "all" || card.difficulty === filter),
    [parsedFlashcards, filter]
  );
  const activeCard = visibleCards[index] ?? null;

  useEffect(() => {
    setNoteDraft(note?.content ?? "");
    setTitleDraft(note?.title ?? "");
    setIndex(0);
    setFlipped(false);
  }, [note?.content, note?.title, id, noteId]);

  const saveNotes = async (title: string, content: string): Promise<void> => {
    if (!project || !note) return;
    setStatus("Saving...");
    const response = await chrome.runtime.sendMessage({
      type: "UPDATE_PROJECT_NOTE",
      payload: { projectId: project.id, noteId: note.id, title, content }
    });
    if (!response?.ok) {
      setStatus(response?.error ?? "Failed to save notes.");
      return;
    }
    setStatus("Saved");
    await refresh();
  };

  useEffect(() => {
    if (isFlashcardsNote || isComparisonNote || isFeynmanNote || isCheatsheetNote) return;
    if (!project || !note) return;
    if (noteDraft === note.content && titleDraft === note.title) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void saveNotes(titleDraft, noteDraft);
    }, 800);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [noteDraft, titleDraft, project?.id, note?.id, note?.content, note?.title, isFlashcardsNote, isComparisonNote, isFeynmanNote, isCheatsheetNote]);

  if (!project || !note) {
    return <main className="p-4 text-sm">Project note not found.</main>;
  }

  return (
    <main className="app-shell min-h-screen p-4">
      <section className="panel-card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-base">{project.name} - Note</h1>
            <p className="text-xs muted">Notion-style editor with autosave</p>
          </div>
          <Link to={`/knowledge-base?project=${project.id}`} className="rounded border border-zinc-700 px-2 py-1 text-xs">
            <ChevronLeft size={14} />
          </Link>
        </div>
        <input
          className="w-full rounded border border-zinc-700 bg-zinc-950 p-2 text-sm font-semibold"
          value={titleDraft}
          onChange={(event) => setTitleDraft(event.target.value)}
          placeholder="Note title"
        />
        {isFlashcardsNote ? (
          <div className="space-y-3 rounded border border-zinc-700 bg-zinc-950 p-3">
            <div className="flex flex-wrap gap-2 text-xs">
              {(["all", "easy", "medium", "hard"] as const).map((level) => (
                <button
                  key={level}
                  className={`rounded border px-2.5 py-1 ${filter === level ? "border-violet-400 bg-violet-500/20 text-slate-900" : "border-zinc-600 text-slate-900"}`}
                  onClick={() => {
                    setFilter(level);
                    setIndex(0);
                    setFlipped(false);
                  }}
                >
                  {level}
                </button>
              ))}
            </div>
            {!activeCard ? (
              <div className="text-xs muted">No flashcards in this filter.</div>
            ) : (
              <button
                className="min-h-56 w-full rounded-2xl border border-violet-300/50 bg-gradient-to-b from-violet-500/15 to-violet-500/5 p-6 text-left"
                onClick={() => setFlipped((prev) => !prev)}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-wide text-violet-700">{flipped ? "Answer" : "Question"}</div>
                  <span className="rounded-full border border-violet-400/60 bg-violet-500/10 px-2.5 py-0.5 text-[10px] uppercase text-violet-700">{activeCard.difficulty}</span>
                </div>
                <div className="text-base leading-relaxed text-slate-900">{flipped ? activeCard.back : activeCard.front}</div>
                <div className="mt-5 text-xs text-slate-600">Card {index + 1} of {visibleCards.length}</div>
              </button>
            )}
            <div className="flex justify-between text-xs">
              <button className="rounded border border-zinc-600 px-3 py-1.5" onClick={() => { setFlipped(false); setIndex((prev) => Math.max(0, prev - 1)); }}>&lt;</button>
              <button className="rounded border border-zinc-600 px-3 py-1.5" onClick={() => { setFlipped(false); setIndex((prev) => Math.min(visibleCards.length - 1, prev + 1)); }}>&gt;</button>
            </div>
          </div>
        ) : isComparisonNote ? (
          <Suspense fallback={<div className="rounded border border-zinc-700 bg-zinc-950 p-3 text-xs muted">Loading comparison...</div>}>
            <ComparisonView data={parsedComparison} />
          </Suspense>
        ) : isFeynmanNote ? (
          <Suspense fallback={<div className="rounded border border-zinc-700 bg-zinc-950 p-3 text-xs muted">Loading feynman...</div>}>
            <FeynmanView data={parsedFeynman} />
          </Suspense>
        ) : isCheatsheetNote ? (
          <Suspense fallback={<div className="rounded border border-zinc-700 bg-zinc-950 p-3 text-xs muted">Loading cheatsheet...</div>}>
            <CheatsheetView data={parsedCheatsheet} />
          </Suspense>
        ) : (
          <textarea
            className="min-h-[74vh] w-full rounded border border-zinc-700 bg-zinc-950 p-3 text-sm"
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder="Write project notes..."
          />
        )}
        <div className="text-xs muted">{status || "Autosave enabled"}</div>
      </section>
    </main>
  );
};

const parseFlashcards = (content: string): Array<{ front: string; back: string; difficulty: "easy" | "medium" | "hard" }> => {
  if (!/#\s*flashcards/i.test(content)) {
    return [];
  }
  const matches = [...content.matchAll(/##\s*Card\s*\d+\s*\((easy|medium|hard)\)\s*[\r\n]+Q:\s*(.+?)\s*[\r\n]+A:\s*(.+?)(?=(?:[\r\n]+##\s*Card|\s*$))/gis)];
  return matches
    .map((match) => ({
      difficulty: (match[1] ?? "medium").toLowerCase() as "easy" | "medium" | "hard",
      front: (match[2] ?? "").trim(),
      back: (match[3] ?? "").trim()
    }))
    .filter((card) => card.front.length > 0 && card.back.length > 0);
};

const parseComparison = (
  content: string
): {
  title: string;
  intro: string;
  items: string[];
  criteria: Array<{ id: string; name: string; values: Array<{ item: string; value: string; rating: "good" | "neutral" | "bad" }> }>;
  verdict: string;
  metadata: { suggestedTags: string[] };
} => {
  if (!/#\s*comparison/i.test(content)) {
    return { title: "Comparison", intro: "", items: [], criteria: [], verdict: "", metadata: { suggestedTags: [] } };
  }

  const lines = content.split(/\r?\n/);
  const introLines: string[] = [];
  const criteria: Array<{ id: string; name: string; values: Array<{ item: string; value: string; rating: "good" | "neutral" | "bad" }> }> = [];
  const itemSet = new Set<string>();
  let currentCriterion: { id: string; name: string; values: Array<{ item: string; value: string; rating: "good" | "neutral" | "bad" }> } | null = null;
  let verdict = "";
  let inIntro = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^#\s*comparison/i.test(line)) {
      inIntro = true;
      continue;
    }
    if (/^ai opinion:/i.test(line)) {
      verdict = line.replace(/^ai opinion:\s*/i, "").trim();
      inIntro = false;
      continue;
    }
    const criterionMatch = line.match(/^##\s+(.+)$/);
    if (criterionMatch) {
      inIntro = false;
      currentCriterion = {
        id: `criterion-${criteria.length + 1}`,
        name: criterionMatch[1].trim(),
        values: []
      };
      criteria.push(currentCriterion);
      continue;
    }
    if (inIntro && !line.startsWith("##")) {
      introLines.push(line);
      continue;
    }
    if (!currentCriterion) continue;
    const valueMatch = line.match(/^-+\s*(.+?):\s*([+\-~])\s*(.+)$/);
    if (!valueMatch) continue;
    const item = valueMatch[1].trim();
    const marker = valueMatch[2];
    const value = valueMatch[3].trim();
    itemSet.add(item);
    currentCriterion.values.push({
      item,
      value,
      rating: marker === "+" ? "good" : marker === "-" ? "bad" : "neutral"
    });
  }

  return {
    title: "Comparison",
    intro: introLines.join(" ").trim(),
    items: [...itemSet],
    criteria,
    verdict,
    metadata: { suggestedTags: [] }
  };
};

const parseFeynman = (
  content: string
): {
  title: string;
  analogy: string;
  sections: Array<{ id: string; heading: string; explanation: string; example: string }>;
  whyItMatters: string;
  checkYourself: string[];
  gaps: string[];
  metadata: { suggestedTags: string[] };
} => {
  if (!/#\s*feynman/i.test(content)) {
    return { title: "Feynman", analogy: "", sections: [], whyItMatters: "", checkYourself: [], gaps: [], metadata: { suggestedTags: [] } };
  }
  const lines = content.split(/\r?\n/);
  const sections: Array<{ id: string; heading: string; explanation: string; example: string }> = [];
  let analogy = "";
  let whyItMatters = "";
  let checkYourself: string[] = [];
  let gaps: string[] = [];
  let current: { id: string; heading: string; explanation: string; example: string } | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^analogy:/i.test(line)) {
      analogy = line.replace(/^analogy:\s*/i, "").trim();
      continue;
    }
    const sectionMatch = line.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      current = { id: `section-${sections.length + 1}`, heading: sectionMatch[1].trim(), explanation: "", example: "" };
      sections.push(current);
      continue;
    }
    if (/^example:/i.test(line)) {
      if (current) current.example = line.replace(/^example:\s*/i, "").trim();
      continue;
    }
    if (/^why it matters:/i.test(line)) {
      whyItMatters = line.replace(/^why it matters:\s*/i, "").trim();
      continue;
    }
    if (/^check yourself:/i.test(line)) {
      checkYourself = line.replace(/^check yourself:\s*/i, "").split("|").map((item) => item.trim()).filter(Boolean);
      continue;
    }
    if (/^what to study next:/i.test(line)) {
      gaps = line.replace(/^what to study next:\s*/i, "").split("|").map((item) => item.trim()).filter(Boolean);
      continue;
    }
    if (current) {
      current.explanation = current.explanation ? `${current.explanation} ${line}` : line;
    }
  }

  return {
    title: "Feynman",
    analogy,
    sections,
    whyItMatters,
    checkYourself,
    gaps,
    metadata: { suggestedTags: [] }
  };
};

const parseCheatsheet = (
  content: string
): {
  title: string;
  useWhen: string;
  workflow: Array<{ id: string; step: string; action: string; why: string; redFlags: string[] }>;
  decisionRules: Array<{ id: string; if: string; then: string }>;
  templates: Array<{ id: string; name: string; template: string; example: string }>;
  pitfalls: Array<{ id: string; mistake: string; fix: string }>;
  quickChecks: string[];
  metadata: { suggestedTags: string[] };
} => {
  if (!/#\s*cheatsheet/i.test(content)) {
    return { title: "Cheatsheet", useWhen: "", workflow: [], decisionRules: [], templates: [], pitfalls: [], quickChecks: [], metadata: { suggestedTags: [] } };
  }

  const lines = content.split(/\r?\n/);
  const workflow: Array<{ id: string; step: string; action: string; why: string; redFlags: string[] }> = [];
  const decisionRules: Array<{ id: string; if: string; then: string }> = [];
  const templates: Array<{ id: string; name: string; template: string; example: string }> = [];
  const pitfalls: Array<{ id: string; mistake: string; fix: string }> = [];
  let useWhen = "";
  let quickChecks: string[] = [];
  let mode: "workflow" | "rules" | "templates" | "pitfalls" | "" = "";
  let currentWorkflow: { id: string; step: string; action: string; why: string; redFlags: string[] } | null = null;
  let currentTemplate: { id: string; name: string; template: string; example: string } | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^when to use:/i.test(line)) {
      useWhen = line.replace(/^when to use:\s*/i, "").trim();
      continue;
    }
    if (/^quick checks:/i.test(line)) {
      quickChecks = line.replace(/^quick checks:\s*/i, "").split("|").map((item) => item.trim()).filter(Boolean);
      continue;
    }
    if (/^##\s*workflow/i.test(line)) { mode = "workflow"; continue; }
    if (/^##\s*decision rules/i.test(line)) { mode = "rules"; continue; }
    if (/^##\s*templates/i.test(line)) { mode = "templates"; continue; }
    if (/^##\s*pitfalls/i.test(line)) { mode = "pitfalls"; continue; }

    if (mode === "workflow") {
      const stepMatch = line.match(/^\d+\.\s*(.+?):\s*(.+)$/);
      if (stepMatch) {
        currentWorkflow = { id: `step-${workflow.length + 1}`, step: stepMatch[1].trim(), action: stepMatch[2].trim(), why: "", redFlags: [] };
        workflow.push(currentWorkflow);
        continue;
      }
      if (/^why:/i.test(line) && currentWorkflow) {
        currentWorkflow.why = line.replace(/^why:\s*/i, "").trim();
        continue;
      }
      if (/^red flags:/i.test(line) && currentWorkflow) {
        currentWorkflow.redFlags = line.replace(/^red flags:\s*/i, "").split("|").map((item) => item.trim()).filter(Boolean);
        continue;
      }
    }

    if (mode === "rules") {
      const ruleMatch = line.match(/^-+\s*if\s+(.+?)\s*->\s*(.+)$/i);
      if (ruleMatch) {
        decisionRules.push({ id: `rule-${decisionRules.length + 1}`, if: ruleMatch[1].trim(), then: ruleMatch[2].trim() });
      }
      continue;
    }

    if (mode === "templates") {
      const templateName = line.match(/^-+\s*(.+)$/);
      if (templateName && !/^-\s*if\b/i.test(line)) {
        currentTemplate = { id: `tpl-${templates.length + 1}`, name: templateName[1].trim(), template: "", example: "" };
        templates.push(currentTemplate);
        continue;
      }
      if (/^template:/i.test(line) && currentTemplate) {
        currentTemplate.template = line.replace(/^template:\s*/i, "").trim();
        continue;
      }
      if (/^example:/i.test(line) && currentTemplate) {
        currentTemplate.example = line.replace(/^example:\s*/i, "").trim();
        continue;
      }
    }

    if (mode === "pitfalls") {
      const pitMatch = line.match(/^-+\s*(.+?)\s*->\s*(.+)$/);
      if (pitMatch) {
        pitfalls.push({ id: `pit-${pitfalls.length + 1}`, mistake: pitMatch[1].trim(), fix: pitMatch[2].trim() });
      }
    }
  }

  return {
    title: "Cheatsheet",
    useWhen,
    workflow,
    decisionRules,
    templates,
    pitfalls,
    quickChecks,
    metadata: { suggestedTags: [] }
  };
};

