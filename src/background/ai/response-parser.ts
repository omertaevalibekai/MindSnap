import type { OutputMode } from "../../shared/types/notes";
import { responseSchemas } from "./schemas";

const extractJson = (raw: string): string => {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return cleaned.slice(start, end + 1);
};

const toMindMapNode = (label: string, value: unknown, path: string): Record<string, unknown> => {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawTheses = source.theses;
  const theses = Array.isArray(rawTheses)
    ? rawTheses.map((item) => String(item).trim()).filter(Boolean).slice(0, 4)
    : [];
  const scalarKeys = new Set(["id", "summary", "theses", "importance", "nodeType", "metadata", "year_introduced", "year_invented", "origin", "inventor"]);

  const children: Record<string, unknown>[] = [];
  const pushChild = (childLabel: string, childValue: unknown, index: number): void => {
    children.push(toMindMapNode(childLabel, childValue, `${path}-${index}`));
  };

  const rawChildren = source.children;
  if (Array.isArray(rawChildren)) {
    rawChildren.forEach((child, index) => {
      const childObj = child && typeof child === "object" ? (child as Record<string, unknown>) : {};
      const childLabel = String(childObj.label ?? childObj.title ?? `Node ${index + 1}`);
      pushChild(childLabel, childObj, index);
    });
  } else if (rawChildren && typeof rawChildren === "object") {
    Object.entries(rawChildren as Record<string, unknown>).forEach(([childLabel, childValue], index) => {
      pushChild(childLabel, childValue, index);
    });
  }

  const inferredChildren = Object.entries(source).filter(([key, item]) => !scalarKeys.has(key) && item && typeof item === "object");
  inferredChildren.forEach(([childLabel, childValue], index) => {
    if (childLabel === "children") return;
    pushChild(childLabel, childValue, children.length + index);
  });

  return {
    id: String(source.id ?? path),
    label,
    summary: String(source.summary ?? ""),
    theses,
    importance: source.importance === "high" || source.importance === "low" ? source.importance : "medium",
    nodeType:
      source.nodeType === "fact" ||
      source.nodeType === "example" ||
      source.nodeType === "warning" ||
      source.nodeType === "question" ||
      source.nodeType === "action"
        ? source.nodeType
        : "concept",
    children
  };
};

const normalizeMindmapShape = (json: unknown): unknown => {
  if (!json || typeof json !== "object") return json;
  const payload = json as Record<string, unknown>;
  if (payload.root && payload.metadata) return payload;

  const candidate =
    payload.mind_map && typeof payload.mind_map === "object"
      ? (payload.mind_map as Record<string, unknown>)
      : payload;

  const reservedKeys = new Set(["metadata", "keyInsights", "suggestedTags", "title"]);
  const entries = Object.entries(candidate).filter(([key]) => !reservedKeys.has(key));
  if (entries.length === 0) return json;

  const [rootLabel, rootValue] = entries[0];
  const improvedRoot = improveMindmapNode(toMindMapNode(rootLabel, rootValue, "root-0"));

  const totalNodes = (node: Record<string, unknown>): number => {
    const children = Array.isArray(node.children) ? (node.children as Record<string, unknown>[]) : [];
    return 1 + children.reduce((sum, child) => sum + totalNodes(child), 0);
  };

  const maxDepth = (node: Record<string, unknown>): number => {
    const children = Array.isArray(node.children) ? (node.children as Record<string, unknown>[]) : [];
    if (children.length === 0) return 1;
    return 1 + Math.max(...children.map(maxDepth));
  };

  return {
    root: improvedRoot,
    metadata: {
      totalNodes: totalNodes(improvedRoot),
      maxDepth: maxDepth(improvedRoot),
      keyInsights: Array.isArray(payload.keyInsights) ? payload.keyInsights : [],
      suggestedTags: Array.isArray(payload.suggestedTags) ? payload.suggestedTags : []
    }
  };
};

const normalizeLabel = (value: string): string =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const labelKey = (value: string): string => normalizeLabel(value).toLowerCase();

const improveMindmapNode = (node: Record<string, unknown>): Record<string, unknown> => {
  const children = Array.isArray(node.children) ? (node.children as Record<string, unknown>[]) : [];
  const dedup = new Set<string>();

  const improvedChildren = children
    .map((child) => improveMindmapNode(child))
    .filter((child) => {
      const key = labelKey(String(child.label ?? ""));
      if (!key) return false;
      if (dedup.has(key)) return false;
      dedup.add(key);
      return true;
    })
    .slice(0, 8);

  const rawLabel = String(node.label ?? "Node");
  const cleanLabel = normalizeLabel(rawLabel)
    .split(" ")
    .slice(0, 6)
    .join(" ");
  const summary = String(node.summary ?? "").trim();
  const rawTheses = Array.isArray(node.theses) ? (node.theses as unknown[]) : [];
  const theses = rawTheses
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 4);
  const fallbackTheses =
    theses.length > 0
      ? theses
      : summary
          .split(/[.;!?]\s+/)
          .map((part) => part.trim())
          .filter(Boolean)
          .slice(0, 3)
          .map((part) => (part.length > 110 ? `${part.slice(0, 107)}...` : part));

  return {
    ...node,
    label: cleanLabel || "Node",
    summary: summary || `Key point about ${cleanLabel || "this topic"}.`,
    theses: fallbackTheses,
    importance:
      node.importance === "high" || node.importance === "low" || node.importance === "medium"
        ? node.importance
        : "medium",
    nodeType:
      node.nodeType === "fact" ||
      node.nodeType === "example" ||
      node.nodeType === "warning" ||
      node.nodeType === "question" ||
      node.nodeType === "action" ||
      node.nodeType === "concept"
        ? node.nodeType
        : "concept",
    children: improvedChildren
  };
};

const toFlatText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => toFlatText(item)).filter(Boolean).join("; ").trim();
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${key}: ${toFlatText(item)}`)
      .filter((part) => !part.endsWith(": "))
      .join("; ")
      .trim();
  }
  return String(value);
};

const normalizeCheatsheetShape = (json: unknown): unknown => {
  if (!json || typeof json !== "object") return json;
  const payload = json as Record<string, unknown>;
  if (
    typeof payload.title === "string" &&
    typeof payload.useWhen === "string" &&
    Array.isArray(payload.workflow) &&
    Array.isArray(payload.decisionRules) &&
    Array.isArray(payload.templates) &&
    Array.isArray(payload.pitfalls) &&
    Array.isArray(payload.quickChecks) &&
    payload.metadata
  ) {
    return payload;
  }

  if (typeof payload.title === "string" && Array.isArray(payload.sections) && Array.isArray(payload.quickReference)) {
    const legacySections = payload.sections as Array<{ heading?: unknown; entries?: Array<{ term?: unknown; definition?: unknown; syntax?: unknown; example?: unknown }> }>;
    const legacyEntries = legacySections.flatMap((section) =>
      (section.entries ?? []).map((entry, index) => ({
        id: `entry-${index + 1}`,
        term: String(entry.term ?? "Entry"),
        definition: String(entry.definition ?? ""),
        syntax: String(entry.syntax ?? ""),
        example: String(entry.example ?? "")
      }))
    );
    return {
      title: payload.title,
      useWhen: "Используйте этот playbook как быстрый рабочий алгоритм по теме.",
      workflow: legacyEntries.slice(0, 6).map((entry, index) => ({
        id: `step-${index + 1}`,
        step: entry.term,
        action: entry.definition || entry.syntax || "Apply this step.",
        why: entry.syntax || "Improves result quality.",
        redFlags: entry.example ? [entry.example] : []
      })),
      decisionRules: legacyEntries.slice(0, 4).map((entry, index) => ({
        id: `rule-${index + 1}`,
        if: `Нужно решить задачу "${entry.term}"`,
        then: entry.definition || entry.syntax || "Use this approach."
      })),
      templates: legacyEntries.slice(0, 4).map((entry, index) => ({
        id: `tpl-${index + 1}`,
        name: entry.term,
        template: entry.syntax || entry.definition || "Template",
        example: entry.example || entry.definition || "Example"
      })),
      pitfalls: legacyEntries.slice(0, 4).map((entry, index) => ({
        id: `pit-${index + 1}`,
        mistake: `Пропуск шага "${entry.term}"`,
        fix: entry.definition || "Follow the workflow."
      })),
      quickChecks: (payload.quickReference as unknown[]).map((item) => String(item)).filter(Boolean).slice(0, 8),
      metadata: payload.metadata && typeof payload.metadata === "object"
        ? payload.metadata
        : { suggestedTags: [] }
    };
  }

  const root = payload.cheatsheet && typeof payload.cheatsheet === "object"
    ? (payload.cheatsheet as Record<string, unknown>)
    : payload;

  const reserved = new Set(["title", "sections", "quickReference", "metadata", "suggestedTags"]);
  const topEntries = Object.entries(root).filter(([key]) => !reserved.has(key));
  if (topEntries.length === 0) return json;

  const normalizedEntries = topEntries.map(([term, value], index) => {
    const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    const requestObject = source.request && typeof source.request === "object" ? (source.request as Record<string, unknown>) : {};
    const requestObjectAlt = source.Request && typeof source.Request === "object" ? (source.Request as Record<string, unknown>) : {};
    const definition = toFlatText(
      source.description ??
      source.Description ??
      source.summary ??
      source.Summary ??
      source.value ??
      value
    ) || `Key notes about ${term}.`;
    const syntax = toFlatText(
      source.syntax ??
      source.Syntax ??
      requestObject.Parameters ??
      requestObjectAlt.Parameters ??
      source.Request
    );
    const example = toFlatText(source.example ?? source.Example ?? source.response ?? source.Response);

    return {
      id: `entry-${index + 1}`,
      term: String(term),
      definition,
      syntax,
      example
    };
  });

  return {
    title: String(root.title ?? "Operational Cheatsheet"),
    useWhen: "Используйте эту шпаргалку, когда нужно быстро выбрать подход и выполнить задачу без лишних экспериментов.",
    workflow: normalizedEntries.slice(0, 6).map((entry, index) => ({
      id: `step-${index + 1}`,
      step: entry.term,
      action: entry.definition,
      why: entry.syntax || "Поддерживает предсказуемый результат.",
      redFlags: entry.example ? [entry.example] : []
    })),
    decisionRules: normalizedEntries.slice(0, 4).map((entry, index) => ({
      id: `rule-${index + 1}`,
      if: `Если задача связана с "${entry.term}"`,
      then: entry.definition
    })),
    templates: normalizedEntries.slice(0, 4).map((entry, index) => ({
      id: `tpl-${index + 1}`,
      name: entry.term,
      template: entry.syntax || entry.definition,
      example: entry.example || entry.definition
    })),
    pitfalls: normalizedEntries.slice(0, 4).map((entry, index) => ({
      id: `pit-${index + 1}`,
      mistake: `Игнорировать этап "${entry.term}"`,
      fix: entry.definition
    })),
    quickChecks: normalizedEntries.map((entry) => entry.term).slice(0, 8),
    metadata: {
      suggestedTags: Array.isArray(root.suggestedTags) ? root.suggestedTags : []
    }
  };
};

const normalizeFeynmanShape = (json: unknown): unknown => {
  if (!json || typeof json !== "object") return json;
  const payload = json as Record<string, unknown>;
  if (
    typeof payload.title === "string" &&
    typeof payload.analogy === "string" &&
    Array.isArray(payload.sections) &&
    typeof payload.whyItMatters === "string" &&
    Array.isArray(payload.checkYourself) &&
    Array.isArray(payload.gaps) &&
    payload.metadata
  ) {
    return payload;
  }

  const root = payload.feynman && typeof payload.feynman === "object"
    ? (payload.feynman as Record<string, unknown>)
    : payload;
  const reserved = new Set(["title", "analogy", "sections", "whyItMatters", "checkYourself", "gaps", "metadata", "suggestedTags"]);
  const entries = Object.entries(root).filter(([key]) => !reserved.has(key));
  if (entries.length === 0) return json;

  const title = String(root.title ?? "Feynman Explanation");
  const sections = entries.slice(0, 6).map(([heading, value], index) => {
    const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    const explanation = toFlatText(
      source.description ??
      source.explanation ??
      source.summary ??
      source.details ??
      value
    ) || `Simple explanation for ${heading}.`;
    const example = toFlatText(source.example ?? source.Example ?? source.request ?? source.response) || `Practical example of ${heading}.`;
    return {
      id: `section-${index + 1}`,
      heading: String(heading),
      explanation,
      example
    };
  });

  const keyHeadings = sections.map((section) => section.heading).filter(Boolean);
  return {
    title,
    analogy: `Представь это как последовательность простых шагов: ${keyHeadings.slice(0, 2).join(" -> ") || "понятный процесс"}.`,
    sections,
    whyItMatters: `Это важно, потому что помогает быстро понять и применить ${title.toLowerCase()} на практике.`,
    checkYourself: keyHeadings.slice(0, 4).map((heading) => `Как бы ты объяснил блок "${heading}" новичку в 1-2 предложениях?`),
    gaps: keyHeadings.slice(0, 4).map((heading) => `Углубить понимание: ${heading}`),
    metadata: {
      suggestedTags: Array.isArray(root.suggestedTags) ? root.suggestedTags : []
    }
  };
};

export const parseResponse = (raw: string, mode: OutputMode): unknown => {
  try {
    const parsedJson = JSON.parse(extractJson(raw));
    const json = mode === "mindmap"
      ? normalizeMindmapShape(parsedJson)
      : mode === "cheatsheet"
        ? normalizeCheatsheetShape(parsedJson)
        : mode === "feynman"
          ? normalizeFeynmanShape(parsedJson)
        : parsedJson;
    return responseSchemas[mode].parse(json);
  } catch (error) {
    const preview = raw.slice(0, 260).replace(/\s+/g, " ");
    throw new Error(`AI returned invalid ${mode} JSON. Preview: ${preview}. Details: ${String(error)}`);
  }
};

