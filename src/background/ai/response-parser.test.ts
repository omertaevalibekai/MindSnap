import { describe, expect, it } from "vitest";
import { parseResponse } from "./response-parser";

describe("parseResponse", () => {
  const flashcards = {
    title: "Biology",
    cards: [{ id: "1", front: "What carries genetic information?", back: "DNA", difficulty: "easy" }],
    metadata: { suggestedTags: ["biology"] }
  };

  it.each([
    JSON.stringify(flashcards),
    "```json\n" + JSON.stringify(flashcards) + "\n```",
    "Here are your cards:\n" + JSON.stringify(flashcards) + "\nDone."
  ])("accepts structured flashcards with optional surrounding text", (raw) => {
    expect(parseResponse(raw, "flashcards")).toEqual(flashcards);
  });

  it("rejects malformed JSON and invalid card fields", () => {
    expect(() => parseResponse("not JSON", "flashcards")).toThrow("invalid flashcards JSON");
    const invalid = { ...flashcards, cards: [{ ...flashcards.cards[0], difficulty: "impossible" }] };
    expect(() => parseResponse(JSON.stringify(invalid), "flashcards")).toThrow("invalid flashcards JSON");
  });

  it("does not turn thesis arrays into phantom child nodes", () => {
    const result = parseResponse(JSON.stringify({ mind_map: {
      Biology: { summary: "Study of life", theses: ["Cells are the basic unit"], children: [
        { label: "Cells", summary: "Basic units of life", theses: ["Cells contain DNA"] }
      ] }
    } }), "mindmap") as { root: { theses: string[]; children: Array<{ label: string; children: unknown[] }> }; metadata: { totalNodes: number } };
    expect(result.root.theses).toEqual(["Cells are the basic unit"]);
    expect(result.root.children.map((child) => child.label)).toEqual(["Cells"]);
    expect(result.root.children[0].children).toEqual([]);
    expect(result.metadata.totalNodes).toBe(2);
  });
});
