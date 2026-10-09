import { z } from "zod";

const nodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  summary: z.string(),
  theses: z.array(z.string()).default([]),
  importance: z.enum(["high", "medium", "low"]),
  nodeType: z.enum(["concept", "fact", "example", "warning", "question", "action"]),
  children: z.array(z.any())
});

export const responseSchemas = {
  mindmap: z.object({ root: nodeSchema, metadata: z.object({ totalNodes: z.number(), maxDepth: z.number(), keyInsights: z.array(z.string()), suggestedTags: z.array(z.string()) }) }),
  cornell: z.object({ title: z.string(), pairs: z.array(z.object({ id: z.string(), cue: z.string(), notes: z.array(z.string()), importance: z.enum(["high", "medium", "low"]) })), summary: z.string(), metadata: z.object({ suggestedTags: z.array(z.string()) }) }),
  outline: z.object({ title: z.string(), items: z.array(z.any()), metadata: z.object({ suggestedTags: z.array(z.string()) }) }),
  flashcards: z.object({ title: z.string(), cards: z.array(z.object({ id: z.string(), front: z.string(), back: z.string(), difficulty: z.enum(["easy", "medium", "hard"]) })), metadata: z.object({ suggestedTags: z.array(z.string()) }) }),
  summary: z.object({ title: z.string(), tldr: z.string(), keyPoints: z.array(z.any()), conclusions: z.array(z.string()), openQuestions: z.array(z.string()), metadata: z.object({ suggestedTags: z.array(z.string()) }) }),
  timeline: z.object({ title: z.string(), events: z.array(z.any()), metadata: z.object({ suggestedTags: z.array(z.string()) }) }),
  comparison: z.object({ title: z.string(), intro: z.string().default(""), items: z.array(z.string()), criteria: z.array(z.any()), verdict: z.string(), metadata: z.object({ suggestedTags: z.array(z.string()) }) }),
  feynman: z.object({ title: z.string(), analogy: z.string(), sections: z.array(z.any()), whyItMatters: z.string(), checkYourself: z.array(z.string()), gaps: z.array(z.string()), metadata: z.object({ suggestedTags: z.array(z.string()) }) }),
  cheatsheet: z.object({
    title: z.string(),
    useWhen: z.string(),
    workflow: z.array(z.object({
      id: z.string(),
      step: z.string(),
      action: z.string(),
      why: z.string(),
      redFlags: z.array(z.string()).default([])
    })),
    decisionRules: z.array(z.object({
      id: z.string(),
      if: z.string(),
      then: z.string()
    })),
    templates: z.array(z.object({
      id: z.string(),
      name: z.string(),
      template: z.string(),
      example: z.string()
    })),
    pitfalls: z.array(z.object({
      id: z.string(),
      mistake: z.string(),
      fix: z.string()
    })),
    quickChecks: z.array(z.string()),
    metadata: z.object({ suggestedTags: z.array(z.string()) })
  })
};

