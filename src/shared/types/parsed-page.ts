export interface ParsedPage {
  url: string;
  title: string;
  text: string;
  headings: string[];
  paragraphs: string[];
  lists: string[];
  selectedText?: string;
}

