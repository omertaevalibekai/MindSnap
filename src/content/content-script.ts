import { parseGeneric } from "./page-detector";

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message?.type === "PARSE_PAGE") {
    sendResponse(parseGeneric());
    return true;
  }
  return false;
});

