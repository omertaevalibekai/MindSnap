import type { OutputMode } from "../../shared/types/notes";
import { responseSchemas } from "./schemas";

interface ParsedPage {
  title: string;
  url: string;
  headings?: string[];
  paragraphs?: string[];
  lists?: string[];
  selectedText?: string;
}

// Templates follow the page language: Cyrillic-heavy text gets Russian, everything else English.
let lang: "en" | "ru" = "en";
const tr = (en: string, ru: string): string => (lang === "ru" ? ru : en);
const detectLang = (text: string): "en" | "ru" => {
  const cyrillic = text.match(/[а-яё]/gi)?.length ?? 0;
  const latin = text.match(/[a-z]/gi)?.length ?? 0;
  return cyrillic > latin ? "ru" : "en";
};

const splitSentences = (text: string): string[] =>
  text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 12);

const splitChunks = (text: string, max = 12): string[] => {
  const paragraphs = text
    .split(/\n{2,}|\r\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 20);
  if (paragraphs.length > 0) return paragraphs.slice(0, max);
  return splitSentences(text).slice(0, max);
};

const shortLabel = (value: string, words = 5): string =>
  value
    .replace(/[#*_`]/g, "")
    .split(/\s+/)
    .slice(0, words)
    .join(" ")
    .trim() || "Topic";

const tagsFrom = (title: string, chunks: string[]): string[] => {
  const words = `${title} ${chunks.join(" ")}`
    .toLowerCase()
    .match(/[a-zа-яё0-9-]{4,}/gi)
    ?.filter((word, index, arr) => arr.indexOf(word) === index)
    .slice(0, 6);
  return words ?? [];
};

const buildMindmap = (
  title: string,
  depth: number,
  headings: string[],
  chunks: string[]
): Record<string, unknown> => {
  const branchLabels =
    headings.length >= 4
      ? headings.slice(0, 8)
      : chunks.slice(0, 8).map((chunk, index) => shortLabel(chunk, 4) || `Branch ${index + 1}`);

  const makeNode = (
    label: string,
    summary: string,
    theses: string[],
    path: string,
    level: number,
    childTexts: string[]
  ): Record<string, unknown> => {
    const children =
      level < depth
        ? childTexts.slice(0, 5).map((text, index) =>
            makeNode(
              shortLabel(text, 4),
              text.slice(0, 180),
              splitSentences(text).slice(0, 3),
              `${path}-${index}`,
              level + 1,
              []
            )
          )
        : [];

    return {
      id: path,
      label: shortLabel(label, 5),
      summary: summary.slice(0, 220) || `Key point about ${label}.`,
      theses: theses.slice(0, 4),
      importance: level === 1 ? "high" : "medium",
      nodeType: "concept",
      children
    };
  };

  const rootChildren = branchLabels.map((label, index) => {
    const chunk = chunks[index] ?? chunks[0] ?? label;
    const childChunks = splitSentences(chunk).slice(0, 4);
    return makeNode(
      label,
      chunk.slice(0, 220),
      childChunks.slice(0, 3),
      `branch-${index}`,
      1,
      childChunks.length > 0 ? childChunks : splitChunks(chunk, 4)
    );
  });

  const root = makeNode(
    shortLabel(title, 4),
    chunks[0]?.slice(0, 220) ?? `Overview of ${title}.`,
    splitSentences(chunks.join(" ")).slice(0, 3),
    "root",
    0,
    []
  );
  root.children = rootChildren;

  const countNodes = (node: Record<string, unknown>): number => {
    const kids = Array.isArray(node.children) ? (node.children as Record<string, unknown>[]) : [];
    return 1 + kids.reduce((sum, child) => sum + countNodes(child), 0);
  };

  const maxDepth = (node: Record<string, unknown>, level = 1): number => {
    const kids = Array.isArray(node.children) ? (node.children as Record<string, unknown>[]) : [];
    if (kids.length === 0) return level;
    return Math.max(...kids.map((child) => maxDepth(child, level + 1)));
  };

  return {
    root,
    metadata: {
      totalNodes: countNodes(root),
      maxDepth: maxDepth(root),
      keyInsights: splitSentences(chunks.join(" ")).slice(0, 4),
      suggestedTags: tagsFrom(title, chunks)
    }
  };
};

const buildCornell = (title: string, chunks: string[]): Record<string, unknown> => ({
  title,
  pairs: chunks.slice(0, 10).map((chunk, index) => ({
    id: `pair-${index + 1}`,
    cue: shortLabel(chunk, 5),
    notes: splitSentences(chunk).slice(0, 4),
    importance: index < 2 ? "high" : "medium"
  })),
  summary: splitSentences(chunks.join(" ")).slice(0, 3).join(" "),
  metadata: { suggestedTags: tagsFrom(title, chunks) }
});

const buildOutline = (title: string, depth: number, headings: string[], chunks: string[]): Record<string, unknown> => {
  const labels = headings.length > 0 ? headings : chunks.map((chunk) => shortLabel(chunk, 5));
  const items = labels.slice(0, 10).map((heading, index) => ({
    id: `item-${index + 1}`,
    text: heading,
    level: 1,
    children:
      depth > 1
        ? splitSentences(chunks[index] ?? chunks[0] ?? heading)
            .slice(0, 4)
            .map((sentence, childIndex) => ({
              id: `item-${index + 1}-${childIndex + 1}`,
              text: sentence,
              level: 2,
              children: []
            }))
        : []
  }));
  return { title, items, metadata: { suggestedTags: tagsFrom(title, chunks) } };
};

const buildFlashcards = (title: string, chunks: string[]): Record<string, unknown> => {
  const sentences = splitSentences(chunks.join(" "));
  const cards = sentences.slice(0, 16).map((sentence, index) => ({
    id: `card-${index + 1}`,
    front: tr(`What matters about: ${shortLabel(sentence, 6)}?`, `Что важно знать про: ${shortLabel(sentence, 6)}?`),
    back: sentence,
    difficulty: index % 3 === 0 ? "easy" : index % 3 === 1 ? "medium" : "hard"
  }));
  return { title, cards, metadata: { suggestedTags: tagsFrom(title, chunks) } };
};

const buildSummary = (title: string, chunks: string[]): Record<string, unknown> => {
  const sentences = splitSentences(chunks.join(" "));
  return {
    title,
    tldr: sentences.slice(0, 2).join(" "),
    keyPoints: sentences.slice(0, 6).map((point, index) => ({ id: `kp-${index + 1}`, text: point })),
    conclusions: sentences.slice(6, 9),
    openQuestions: chunks.slice(0, 3).map((chunk) => tr(`What else to clarify about ${shortLabel(chunk, 4)}?`, `Что ещё уточнить про ${shortLabel(chunk, 4)}?`)),
    metadata: { suggestedTags: tagsFrom(title, chunks) }
  };
};

const buildTimeline = (title: string, chunks: string[]): Record<string, unknown> => ({
  title,
  events: chunks.slice(0, 10).map((chunk, index) => ({
    id: `event-${index + 1}`,
    date: `Step ${index + 1}`,
    title: shortLabel(chunk, 6),
    description: chunk.slice(0, 240),
    isMilestone: index === 0 || index === chunks.length - 1
  })),
  metadata: { suggestedTags: tagsFrom(title, chunks) }
});

const buildComparison = (title: string, chunks: string[]): Record<string, unknown> => {
  const items = chunks.slice(0, 3).map((chunk) => shortLabel(chunk, 4));
  const safeItems = items.length >= 2 ? items : ["Option A", "Option B"];
  const criteriaNames = ["Clarity", "Depth", "Practical value", "Complexity", "Applicability"];
  return {
    title,
    intro: tr(
      `Comparing ${safeItems.join(", ")} by ${criteriaNames.slice(0, 3).join(", ")} to pick a practical approach.`,
      `Сравниваем ${safeItems.join(", ")} по критериям ${criteriaNames.slice(0, 3).join(", ")} для практического выбора подхода.`
    ),
    items: safeItems,
    criteria: criteriaNames.map((name, index) => ({
      id: `crit-${index + 1}`,
      name,
      values: safeItems.map((item, itemIndex) => ({
        item,
        value: chunks[itemIndex]?.slice(0, 120) ?? "No data",
        rating: itemIndex === 0 ? "good" : itemIndex === 1 ? "neutral" : "bad"
      }))
    })),
    verdict: tr(`For most tasks, "${safeItems[0]}" is the better choice.`, `Для большинства задач предпочтителен вариант "${safeItems[0]}".`),
    metadata: { suggestedTags: tagsFrom(title, chunks) }
  };
};

const buildFeynman = (title: string, chunks: string[]): Record<string, unknown> => {
  const sections = chunks.slice(0, 6).map((chunk, index) => ({
    id: `section-${index + 1}`,
    heading: shortLabel(chunk, 5),
    explanation: chunk.slice(0, 280),
    example: `${tr("Example", "Пример")}: ${shortLabel(splitSentences(chunk)[0] ?? chunk, 12)}`
  }));
  return {
    title,
    analogy: tr(
      `Think of ${title} as a sequence of simple steps, where each block explains the next.`,
      `Представь ${title} как последовательность простых шагов, где каждый блок объясняет следующий.`
    ),
    sections,
    whyItMatters: tr(`Understanding ${title} helps you apply the material faster.`, `Понимание ${title} помогает быстрее применять материал на практике.`),
    checkYourself: sections.map((section) => `${tr("Explain in your own words", "Объясни своими словами")}: ${section.heading}`),
    gaps: sections.map((section) => `${tr("Dig deeper", "Углубить")}: ${section.heading}`),
    metadata: { suggestedTags: tagsFrom(title, chunks) }
  };
};

const buildCheatsheet = (title: string, chunks: string[]): Record<string, unknown> => {
  const steps = chunks.slice(0, 6);
  return {
    title,
    useWhen: tr(`Use this cheatsheet when you need to quickly apply what you know about "${title}".`, `Используй эту шпаргалку, когда нужно быстро применить знания по теме «${title}».`),
    workflow: steps.map((step, index) => ({
      id: `step-${index + 1}`,
      step: shortLabel(step, 4),
      action: step.slice(0, 200),
      why: tr("Lowers the risk of skipping an important step.", "Снижает риск пропустить важный шаг."),
      redFlags: splitSentences(step).slice(0, 1)
    })),
    decisionRules: steps.slice(0, 4).map((step, index) => ({
      id: `rule-${index + 1}`,
      if: tr(`The task involves "${shortLabel(step, 4)}"`, `Задача связана с «${shortLabel(step, 4)}»`),
      then: step.slice(0, 160)
    })),
    templates: steps.slice(0, 4).map((step, index) => ({
      id: `tpl-${index + 1}`,
      name: shortLabel(step, 3),
      template: step.slice(0, 120),
      example: splitSentences(step)[0] ?? step.slice(0, 120)
    })),
    pitfalls: steps.slice(0, 4).map((step, index) => ({
      id: `pit-${index + 1}`,
      mistake: tr(`Skipping "${shortLabel(step, 4)}"`, `Пропустить этап «${shortLabel(step, 4)}»`),
      fix: step.slice(0, 160)
    })),
    quickChecks: steps.map((step) => shortLabel(step, 4)).slice(0, 8),
    metadata: { suggestedTags: tagsFrom(title, chunks) }
  };
};

export const generateQuickNotes = (title: string, chunks: string[]): string => {
  const sentences = splitSentences(chunks.join(" "));
  const summary = sentences.slice(0, 2).join(" ");
  const bullets = chunks
    .slice(0, 6)
    .map((chunk) => `- ${shortLabel(chunk, 14)}`)
    .join("\n");
  return [`## ${title}`, "", summary, "", "## Key points", bullets, "", "## Actions", "- Review and refine notes", "- Link related concepts"].join("\n");
};

export const generateLocally = ({
  outputMode,
  depth,
  text,
  parsedPage
}: {
  outputMode: OutputMode;
  depth: number;
  text: string;
  parsedPage: ParsedPage;
}): unknown => {
  lang = detectLang(text);
  const title = parsedPage.title.trim() || "Untitled page";
  const headings = (parsedPage.headings ?? []).map((heading) => heading.trim()).filter(Boolean);
  const paragraphs = (parsedPage.paragraphs ?? []).map((part) => part.trim()).filter(Boolean);
  const lists = (parsedPage.lists ?? []).map((part) => part.trim()).filter(Boolean);
  const focus = parsedPage.selectedText?.trim();
  const chunks = [
    ...(focus ? [focus] : []),
    ...paragraphs,
    ...lists,
    ...splitChunks(text, 14)
  ].filter((chunk, index, arr) => arr.indexOf(chunk) === index);

  const safeChunks = chunks.length > 0 ? chunks : [text.slice(0, 500) || title];
  const payload =
    outputMode === "mindmap"
      ? buildMindmap(title, depth, headings, safeChunks)
      : outputMode === "cornell"
        ? buildCornell(title, safeChunks)
        : outputMode === "outline"
          ? buildOutline(title, depth, headings, safeChunks)
          : outputMode === "flashcards"
            ? buildFlashcards(title, safeChunks)
            : outputMode === "summary"
              ? buildSummary(title, safeChunks)
              : outputMode === "timeline"
                ? buildTimeline(title, safeChunks)
                : outputMode === "comparison"
                  ? buildComparison(title, safeChunks)
                  : outputMode === "feynman"
                    ? buildFeynman(title, safeChunks)
                    : buildCheatsheet(title, safeChunks);

  return responseSchemas[outputMode].parse(payload);
};
