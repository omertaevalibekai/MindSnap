import { BaseParser } from "./base-parser";

export class GenericParser extends BaseParser {
  parse(): string {
    return document.body.innerText;
  }
}

