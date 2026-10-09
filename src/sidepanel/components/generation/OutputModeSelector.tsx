import { type ComponentType, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BrainCircuit,
  NotebookPen,
  RectangleHorizontal,
  Clock3,
  Scale,
  Lightbulb,
  FileCode2
} from "lucide-react";
import { OUTPUT_MODES } from "../../../shared/types/notes";
import { useGenerationStore } from "../../stores/generation-store";

const stages: Record<string, string> = {
  parsing: "Parsing page...",
  analyzing: "Analyzing structure...",
  building: "Building output..."
};

export const OutputModeSelector = () => {
  const { outputMode, setOutputMode, depth, setDepth } = useGenerationStore();
  const selected = useMemo(() => OUTPUT_MODES.find((x) => x.id === outputMode) ?? OUTPUT_MODES[0], [outputMode]);
  useEffect(() => {
    if (!OUTPUT_MODES.some((mode) => mode.id === outputMode)) {
      setOutputMode(OUTPUT_MODES[0].id);
    }
  }, [outputMode, setOutputMode]);
  const modeIcons: Partial<Record<(typeof OUTPUT_MODES)[number]["id"], ComponentType<{ size?: number; className?: string }>>> = {
    mindmap: BrainCircuit,
    cornell: NotebookPen,
    flashcards: RectangleHorizontal,
    timeline: Clock3,
    comparison: Scale,
    feynman: Lightbulb,
    cheatsheet: FileCode2
  };

  return (
    <section className="panel-card">
      <h3 className="text-sm font-heading">How should the information be presented?</h3>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {OUTPUT_MODES.map((mode) => (
          (() => {
            const Icon = modeIcons[mode.id] ?? BrainCircuit;
            return (
          <button
            key={mode.id}
            onClick={() => setOutputMode(mode.id)}
            className={`rounded-lg border px-2 py-2 text-left transition ${outputMode === mode.id ? "chip-active" : ""}`}
            style={{
              borderColor: outputMode === mode.id ? mode.accent : "#d4dceb",
              background: outputMode === mode.id ? `${mode.accent}1f` : "#ffffff",
              color: "#0f172a"
            }}
            title={`${mode.description}. Best for: ${mode.bestFor}`}
          >
            <div className="mb-1 text-base text-slate-700"><Icon size={16} /></div>
            <div className="text-xs leading-tight text-slate-700">{mode.label}</div>
          </button>
            );
          })()
        ))}
      </div>
      <p className="mt-2 text-xs muted">Best for: {selected.bestFor}</p>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs muted">Depth</span>
        {[1, 2, 3, 4].map((level) => (
          <button
            key={level}
            className={`chip ${depth === level ? "chip-active" : ""}`}
            style={{
              borderColor: depth === level ? selected.accent : "#d4dceb",
              background: depth === level ? `${selected.accent}1f` : "#ffffff",
              color: "#0f172a"
            }}
            onClick={() => setDepth(level as 1 | 2 | 3 | 4)}
          >
            {level}
          </button>
        ))}
      </div>
    </section>
  );
};

export const SnapButton = () => {
  const navigate = useNavigate();
  const { generate, status, stage } = useGenerationStore();
  const [error, setError] = useState<string>("");

  const run = async (): Promise<void> => {
    setError("");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const parsed = await chrome.tabs.sendMessage(tab.id, { type: "PARSE_PAGE" }).catch(() => null);
    if (!parsed) {
      setError("Failed to parse the page. Refresh the tab and try again.");
      return;
    }

    try {
      const item = await generate(parsed);
      navigate(`/view/${item.id}`);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Generation failed.");
    }
  };

  return (
    <div className="panel-card relative overflow-hidden">
      <button className="w-full rounded-xl bg-[#6d5efb] px-4 py-3 font-semibold text-white disabled:opacity-60" onClick={run} disabled={status === "loading"}>
        {status === "loading" ? "Generating..." : "Snap This Page"}
      </button>
      <AnimatePresence>
        {status === "loading" ? (
          <motion.div
            className="mt-3 rounded-md border border-[#6d5efb]/30 bg-[#6d5efb]/10 p-2 text-xs"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            {stages[stage] ?? "Working..."}
          </motion.div>
        ) : null}
      </AnimatePresence>
      {error ? <p className="mt-2 whitespace-pre-wrap break-words text-xs text-rose-300">{error}</p> : null}
    </div>
  );
};
