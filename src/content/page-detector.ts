import type { ParsedPage } from "../shared/types/parsed-page";

export const detectPageType = (): string => {
  const host = location.hostname;
  if (host.includes("github.com")) return "github";
  if (host.includes("wikipedia.org")) return "wiki";
  if (host.includes("youtube.com")) return "video";
  return "generic";
};

export const parseGeneric = (): ParsedPage => {
  const title = document.title;
  const headings = Array.from(document.querySelectorAll("h1,h2,h3")).map((el) => el.textContent?.trim() ?? "").filter(Boolean);
  const paragraphs = Array.from(document.querySelectorAll("p")).map((el) => el.textContent?.trim() ?? "").filter((v) => v.length > 30).slice(0, 120);
  const lists = Array.from(document.querySelectorAll("li")).map((el) => el.textContent?.trim() ?? "").filter(Boolean).slice(0, 80);
  // Avoid minifier edge-cases with template literal newlines in content bundle.
  const text = [...headings, ...paragraphs, ...lists].join(String.fromCharCode(10));
  return { url: location.href, title, text, headings, paragraphs, lists };
};

