export const uuid = (): string => crypto.randomUUID();

export const truncate = (value: string, max: number): string =>
  value.length <= max ? value : `${value.slice(0, max)}...`;

export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const hashString = async (value: string): Promise<string> => {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("");
};


// Wikipedia-style reference markers: [1], [12][13], [note 1], [a], [citation needed]
export const stripCitations = (value: string): string =>
  value
    .replace(/\[(?:\d+|[a-z]|note \d+|citation needed|нет источника|источник не указан \d* ?дней)\]/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,;:!?])/g, "$1");
