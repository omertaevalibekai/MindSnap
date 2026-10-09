import { MAX_INPUT_CHARS } from "../../shared/constants";
import { truncate } from "../../shared/utils";

export const estimateTokens = (value: string): number => Math.ceil(value.length / 4);

export const normalizeInput = (value: string): { text: string; tokens: number } => {
  const text = truncate(value, MAX_INPUT_CHARS);
  return { text, tokens: estimateTokens(text) };
};

