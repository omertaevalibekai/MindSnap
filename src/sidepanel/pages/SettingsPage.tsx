import { useEffect, useState } from "react";
import { useAppStore } from "../stores/app-store";
import type { OutputMode } from "../../shared/types/notes";
import { OUTPUT_MODES } from "../../shared/types/notes";

export const SettingsPage = () => {
  const { storage, refresh } = useAppStore();
  const [defaultOutputMode, setDefaultOutputMode] = useState<OutputMode>("mindmap");
  const [defaultDepth, setDefaultDepth] = useState<1 | 2 | 3 | 4>(3);
  const [language, setLanguage] = useState<"en" | "ru">("ru");

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!storage) return;
    setDefaultOutputMode(storage.settings.defaultOutputMode);
    setDefaultDepth(storage.settings.defaultDepth);
    setLanguage(storage.settings.language);
  }, [storage]);

  const save = async (): Promise<void> => {
    await chrome.runtime.sendMessage({
      type: "SAVE_SETTINGS",
      payload: { defaultOutputMode, defaultDepth, language }
    });
    await refresh();
  };

  return (
    <main className="p-3">
      <section className="panel-card space-y-3">
        <h1 className="font-heading text-sm">Settings</h1>
        <p className="text-xs text-slate-400">Notes are generated locally from page content. No external API is used.</p>

        <label className="block space-y-1">
          <span className="text-xs text-slate-300">Default output mode</span>
          <select
            value={defaultOutputMode}
            onChange={(e) => setDefaultOutputMode(e.target.value as OutputMode)}
            className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs"
          >
            {OUTPUT_MODES.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-slate-300">Mind map depth</span>
          <select
            value={defaultDepth}
            onChange={(e) => setDefaultDepth(Number(e.target.value) as 1 | 2 | 3 | 4)}
            className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs"
          >
            {[1, 2, 3, 4].map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-slate-300">Language</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as "en" | "ru")}
            className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs"
          >
            <option value="ru">Russian</option>
            <option value="en">English</option>
          </select>
        </label>

        <button className="rounded bg-indigo-500 px-3 py-2 text-xs" onClick={save}>
          Save
        </button>
      </section>
    </main>
  );
};
